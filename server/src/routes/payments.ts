import { Router, Request, Response } from "express";
import prisma from "../prisma.js";
import { authenticate } from "../middleware/auth.js";
import { z } from "zod";
import {
  readStitchConfig, isStitchConfigured, createStitchClient, buildStitchRedirectUrl,
  verifyStitchWebhook, parseStitchWebhook, amountsMatch, type StitchPaymentStatus,
} from "../services/stitch.js";
import crypto from "crypto";

const router = Router();

const initiateSchema = z.object({
  orderId: z.string().uuid(),
  provider: z.enum(["STITCH", "IKHOKHA", "SNAPSCAN", "EFT"]),
});

const SNAPSCAN_KEY = process.env.SNAPSCAN_API_KEY || "";
const IS_PRODUCTION = process.env.NODE_ENV === "production";

// ─── Stitch (stitch.money) ───
const STITCH = readStitchConfig();
const stitch = createStitchClient(STITCH);
/** Unpaid Stitch payment requests expire so a stale link can never be paid later. */
const STITCH_REQUEST_TTL_MS = 60 * 60 * 1000;
/** Shown on the payer's bank statement; Stitch keeps payer references short. */
const STITCH_PAYER_REFERENCE = "WeeDeliver";

// ─── iKhokha (iK Pay API) ───
// Docs: https://dev.ikhokha.com — auth is an IK-APPID header plus an IK-SIGN HMAC-SHA256
// signature over (url path + JSON body), hex encoded, keyed with the app secret.
const IKHOKHA_APP_ID = process.env.IKHOKHA_APP_ID || "";
const IKHOKHA_APP_SECRET = process.env.IKHOKHA_APP_SECRET || "";
const IKHOKHA_ENTITY_ID = process.env.IKHOKHA_ENTITY_ID || "";
const IKHOKHA_PAYMENT_URL = "https://api.ikhokha.com/public-api/v1/api/payment";

/** iKhokha escapes backslashes/quotes and null bytes before signing. */
function ikEscape(payload: string): string {
  return payload.replace(/[\\"']/g, "\\$&").replace(new RegExp("\u0000", "g"), "\\0");
}

/** HMAC-SHA256(hex) of the escaped (path + body), keyed with the app secret. */
function ikSign(urlPath: string, bodyJson: string): string {
  return crypto
    .createHmac("sha256", IKHOKHA_APP_SECRET.trim())
    .update(ikEscape(urlPath + bodyJson))
    .digest("hex");
}

// EFT bank details from env (SECURITY: never hardcode account numbers)
const EFT_BANK = process.env.EFT_BANK_NAME || "FNB";
const EFT_ACCOUNT = process.env.EFT_ACCOUNT_NUMBER || "";
const EFT_BRANCH = process.env.EFT_BRANCH_CODE || "";
const EFT_TYPE = process.env.EFT_ACCOUNT_TYPE || "Cheque";

/** Sanitize error messages - never leak Prisma/internal details to clients */
function safeError(err: unknown): string {
  if (err instanceof z.ZodError) return err.errors.map(e => e.message).join(", ");
  if (err instanceof Error) {
    if (err.message.includes("prisma") || err.message.includes("\\") || err.message.includes("ECONNREFUSED")) {
      return "An internal error occurred. Please try again.";
    }
    return err.message;
  }
  return "An internal error occurred.";
}

/**
 * Confirm payment + update order status.
 * IDEMPOTENT and race-safe: the webhook and the return-page verify often arrive together, so the
 * payment flips with a conditional update and only the caller that flipped it touches the order.
 */
async function confirmPayment(paymentId: string, providerRef: string, io?: any) {
  const flipped = await prisma.payment.updateMany({
    where: { id: paymentId, status: { not: "SUCCESSFUL" } },
    data: { status: "SUCCESSFUL", providerRef },
  });
  const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
  if (!payment) throw new Error("Payment not found");
  if (flipped.count === 0 || !payment.orderId) return payment;

  // Only an unpaid order moves to CONFIRMED — a late payment must never drag an order that is
  // already confirmed, out for delivery or cancelled back to CONFIRMED.
  const moved = await prisma.order.updateMany({
    where: { id: payment.orderId, status: "PENDING" },
    data: { status: "CONFIRMED", confirmedAt: new Date() },
  });
  if (moved.count === 0) {
    console.warn(`[payments] payment ${paymentId} succeeded but order ${payment.orderId} was not pending — check for a duplicate payment to refund`);
    return payment;
  }
  const order = await prisma.order.findUnique({
    where: { id: payment.orderId },
    include: { dispensary: { select: { id: true, name: true } } },
  });
  if (io && order) {
    io.to(`dispensary:${order.dispensaryId}`).emit("new_order", order);
    io.to(`order:${order.id}`).emit("order_status", { orderId: order.id, status: "CONFIRMED" });
    io.to("admin").emit("order_update", order);
  }
  return payment;
}

async function failPayment(paymentId: string, reason: string, providerRef?: string) {
  const existing = await prisma.payment.findUnique({ where: { id: paymentId } });
  if (!existing || existing.status !== "PENDING") return existing;
  console.warn(`[payments] payment ${paymentId} failed: ${reason}`);
  // Keep the provider's reference when there is one, so a late completion can still be reconciled.
  return prisma.payment.update({
    where: { id: paymentId },
    data: { status: "FAILED", providerRef: existing.providerRef ?? providerRef ?? reason },
  });
}

type StitchOutcome = "confirmed" | "failed" | "pending" | "amount_mismatch";

/**
 * Apply a Stitch payment-request status (read from the Stitch API) to our payment.
 * A completed payment is only accepted when Stitch reports a paid amount that matches what we charged.
 */
async function applyStitchOutcome(
  payment: { id: string; amount: unknown },
  stitchRequestId: string,
  status: StitchPaymentStatus,
  paidAmount: number | null,
  io?: any,
): Promise<StitchOutcome> {
  if (status === "COMPLETED") {
    if (paidAmount === null || !amountsMatch(paidAmount, Number(payment.amount))) {
      console.error(`[Stitch] amount check failed on payment ${payment.id}: paid ${paidAmount ?? "unknown"}, expected ${Number(payment.amount)}`);
      return "amount_mismatch";
    }
    await confirmPayment(payment.id, stitchRequestId, io);
    return "confirmed";
  }
  if (status === "CANCELLED" || status === "EXPIRED") {
    await failPayment(payment.id, `Stitch ${status.toLowerCase()}`, stitchRequestId);
    return "failed";
  }
  if (status === "UNKNOWN") console.warn(`[Stitch] unrecognised payment request state for payment ${payment.id}`);
  return "pending";
}

// AVAILABLE ONLINE PROVIDERS — checkout only offers what the server can actually process.
router.get("/providers", (_req: Request, res: Response) => {
  const providers = [
    ...(isStitchConfigured(STITCH) ? ["STITCH"] : []),
    ...(IKHOKHA_APP_ID && IKHOKHA_APP_SECRET ? ["IKHOKHA"] : []),
  ];
  res.json({ providers });
});

// INITIATE PAYMENT
router.post("/initiate", authenticate, async (req: Request, res: Response) => {
  try {
    const { orderId, provider } = initiateSchema.parse(req.body);

    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) return res.status(404).json({ error: "Order not found" });
    if (order.customerId !== req.user!.id) return res.status(403).json({ error: "Not your order" });

    // Only allow payment for PENDING orders
    if (order.status !== "PENDING") {
      return res.status(400).json({ error: `Order already ${order.status.toLowerCase()}` });
    }
    if (provider === "STITCH" && !isStitchConfigured(STITCH)) {
      return res.status(500).json({ error: "Payment provider not configured" });
    }

    // A previous attempt can die at the provider (card declined, window closed) without ever
    // telling us, leaving a PENDING payment behind. Blocking on that forever made the order
    // permanently unpayable. Only guard against genuine double-submits (a very recent attempt);
    // anything older is abandoned, so retire it and let the customer try again.
    const DOUBLE_SUBMIT_WINDOW_MS = 2 * 60 * 1000;
    const existingPayment = await prisma.payment.findFirst({
      where: { orderId, status: "PENDING" },
      orderBy: { createdAt: "desc" },
    });
    if (existingPayment) {
      const age = Date.now() - new Date(existingPayment.createdAt).getTime();
      if (age < DOUBLE_SUBMIT_WINDOW_MS) {
        return res.status(409).json({ error: "Payment already in progress", paymentId: existingPayment.id });
      }
      // A Stitch request stays payable for an hour and bank approvals can take minutes, so the
      // "abandoned" attempt may in fact have been paid — credit it instead of charging again.
      if (existingPayment.provider === "STITCH" && existingPayment.providerRef && isStitchConfigured(STITCH)) {
        try {
          const previous = await stitch.getPaymentRequest(existingPayment.providerRef);
          const outcome = await applyStitchOutcome(existingPayment, existingPayment.providerRef, previous.status, previous.amount, req.app.get("io"));
          if (outcome === "confirmed") return res.status(409).json({ error: "This order has already been paid." });
        } catch (err) {
          console.error("[Stitch] could not check the previous payment request", err instanceof Error ? err.message : err);
        }
      }
      // Retire the stale attempts; their provider references stay so late completions still reconcile.
      await prisma.payment.updateMany({
        where: { orderId, status: "PENDING" },
        data: { status: "FAILED" },
      });
    }

    const amountCents = Math.round(Number(order.total) * 100);
    const amountRands = Number(order.total);

    const payment = await prisma.payment.create({
      data: { orderId, userId: req.user!.id, provider, amount: amountRands, status: "PENDING" },
    });

    const checkoutData: Record<string, unknown> = { paymentId: payment.id, provider };
    // Guard against a malformed CLIENT_URL env (e.g. extra text/whitespace) breaking provider return URLs.
    const rawClientUrl = (process.env.CLIENT_URL || "").trim();
    const isValidUrl = /^https?:\/\/[^\s/]+(\/[^\s]*)?$/.test(rawClientUrl);
    const fallbackUrl = process.env.NODE_ENV === "production" ? "https://weedeliver-full.vercel.app" : "http://localhost:5173";
    const clientUrl = (isValidUrl ? rawClientUrl : fallbackUrl).replace(/\/+$/, "");

    if (provider === "IKHOKHA") {
      if (!IKHOKHA_APP_ID || !IKHOKHA_APP_SECRET) {
        return res.status(500).json({ error: "Payment provider not configured" });
      }
      try {
        // iKhokha needs an absolute, publicly reachable callback URL.
        const rawServerUrl = (process.env.SERVER_URL || "").trim().replace(/\/+$/, "");
        const serverUrl = /^https?:\/\/[^\s/]+/.test(rawServerUrl)
          ? rawServerUrl
          : (IS_PRODUCTION ? "https://weedeliver.onrender.com" : "http://localhost:3000");
        const apiUrl = new URL(IKHOKHA_PAYMENT_URL);
        const ikBody = {
          entityID: IKHOKHA_ENTITY_ID || payment.id,
          externalEntityID: orderId,
          amount: amountCents, // iKhokha expects cents
          currency: "ZAR",
          requesterUrl: `${clientUrl}/order/${orderId}`,
          description: `WeeDeliver order ${orderId.slice(0, 8).toUpperCase()}`,
          paymentReference: orderId.slice(0, 8).toUpperCase(),
          mode: IS_PRODUCTION ? "live" : "sandbox",
          externalTransactionID: payment.id,
          urls: {
            // Server-to-server confirmation — this is what actually marks the order paid.
            callbackUrl: `${serverUrl}/api/v1/payments/webhook/ikhokha`,
            successPageUrl: `${clientUrl}/payment/callback?provider=ikhokha&paymentId=${payment.id}&status=success`,
            failurePageUrl: `${clientUrl}/payment/callback?provider=ikhokha&paymentId=${payment.id}&status=failed`,
            cancelUrl: `${clientUrl}/payment/callback?provider=ikhokha&paymentId=${payment.id}&status=cancelled`,
          },
        };
        const bodyJson = JSON.stringify(ikBody);
        const ikRes = await fetch(IKHOKHA_PAYMENT_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Accept": "application/json",
            "IK-APPID": IKHOKHA_APP_ID.trim(),
            "IK-SIGN": ikSign(apiUrl.pathname, bodyJson),
          },
          body: bodyJson,
        });
        const ikData: any = await ikRes.json().catch(() => ({}));
        if (ikData.paylinkUrl) {
          await prisma.payment.update({ where: { id: payment.id }, data: { providerRef: ikData.paylinkID } });
          checkoutData.redirectUrl = ikData.paylinkUrl;
          checkoutData.checkoutId = ikData.paylinkID;
        } else {
          console.error("[iKhokha] paylink creation failed", ikRes.status, JSON.stringify(ikData).slice(0, 300));
          checkoutData.error = ikData.message || `iKhokha error (HTTP ${ikRes.status})`;
        }
      } catch { checkoutData.error = "Payment provider temporarily unavailable"; }
    } else if (provider === "STITCH") {
      try {
        const request = await stitch.createPaymentRequest({
          amountRands,
          externalReference: payment.id,
          payerReference: STITCH_PAYER_REFERENCE,
          beneficiaryReference: `WD-${orderId.slice(0, 8).toUpperCase()}`,
          payer: { id: req.user!.id, email: req.user!.email },
          expireAt: new Date(Date.now() + STITCH_REQUEST_TTL_MS),
        });
        await prisma.payment.update({ where: { id: payment.id }, data: { providerRef: request.id } });
        // Stitch appends id, status and externalReference to this URL when it sends the payer back.
        const callbackUrl = `${clientUrl}/payment/callback?provider=stitch&paymentId=${payment.id}`;
        checkoutData.redirectUrl = buildStitchRedirectUrl(request.url, callbackUrl);
        checkoutData.checkoutId = request.id;
      } catch (err) {
        console.error("[Stitch] payment request failed", err instanceof Error ? err.message : err);
        checkoutData.error = "Payment provider temporarily unavailable";
      }

    } else if (provider === "SNAPSCAN") {
      const snapUrl = `https://pos.snapscan.io/qr/${SNAPSCAN_KEY || "DEMO"}?id=${orderId}&amount=${amountCents}&strict=true`;
      checkoutData.qrUrl = snapUrl;
      checkoutData.amountInCents = amountCents;

    } else if (provider === "EFT") {
      if (!EFT_ACCOUNT) return res.status(500).json({ error: "EFT payments not configured" });
      checkoutData.bankDetails = {
        bank: EFT_BANK, accountNumber: EFT_ACCOUNT, branchCode: EFT_BRANCH,
        accountType: EFT_TYPE, reference: payment.id.slice(0, 8).toUpperCase(),
      };
    }

    res.status(201).json(checkoutData);
  } catch (err: unknown) { res.status(400).json({ error: safeError(err) }); }
});

// VERIFY STITCH
// The webhook is the source of truth; when the payer returns before it lands, ask Stitch directly.
router.post("/verify/stitch", authenticate, async (req: Request, res: Response) => {
  try {
    const { paymentId } = req.body || {};
    if (!paymentId || typeof paymentId !== "string") return res.status(400).json({ error: "paymentId required" });
    const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
    if (!payment || payment.provider !== "STITCH") return res.status(404).json({ error: "Payment not found" });
    // SECURITY: Ownership check
    if (payment.userId !== req.user!.id) return res.status(403).json({ error: "Not your payment" });
    if (payment.status === "SUCCESSFUL") return res.json({ success: true, payment, alreadyConfirmed: true });
    if (!isStitchConfigured(STITCH)) return res.status(500).json({ error: "Payment provider not configured" });
    // FAILED attempts are re-checked too: a superseded Stitch request can still be completed.
    if (!payment.providerRef) {
      return res.status(400).json({ error: payment.status === "FAILED" ? "Payment failed" : "No Stitch payment request found" });
    }

    const result = await stitch.getPaymentRequest(payment.providerRef);
    const outcome = await applyStitchOutcome(payment, payment.providerRef, result.status, result.amount, req.app.get("io"));
    if (outcome === "confirmed") {
      const confirmed = await prisma.payment.findUnique({ where: { id: payment.id } });
      return res.json({ success: true, payment: confirmed });
    }
    if (outcome === "failed") return res.status(400).json({ error: `Payment was ${result.status.toLowerCase()}` });
    if (outcome === "amount_mismatch") {
      return res.status(409).json({ error: "We couldn't match this payment to your order. Please contact support." });
    }
    return res.json({ success: false, status: result.status, message: "Payment still processing" });
  } catch (err: unknown) {
    console.error("[Stitch] verify error:", err instanceof Error ? err.message : err);
    res.status(500).json({ error: "Payment verification failed. Please try again." });
  }
});

// VERIFY IKHOKHA
// iKhokha has no public status-lookup endpoint, so the server-to-server callback is the source
// of truth. This just reports what the callback has recorded for the customer's own payment.
router.post("/verify/ikhokha", authenticate, async (req: Request, res: Response) => {
  try {
    const { paymentId } = req.body;
    if (!paymentId) return res.status(400).json({ error: "paymentId required" });
    const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
    if (!payment) return res.status(404).json({ error: "Payment not found" });
    if (payment.userId !== req.user!.id) return res.status(403).json({ error: "Not your payment" });

    if (payment.status === "SUCCESSFUL") return res.json({ success: true, payment });
    if (payment.status === "FAILED") return res.status(400).json({ error: "Payment failed" });
    return res.json({ success: false, status: payment.status, message: "Payment still processing" });
  } catch (err: unknown) {
    res.status(500).json({ error: safeError(err) });
  }
});

// IKHOKHA CALLBACK (server-to-server) — marks the order paid.
router.post("/webhook/ikhokha", async (req: Request & { rawBody?: string }, res: Response) => {
  try {
    // NEVER accept an unverified callback — it can mark an order paid. If the secret is not
    // configured we cannot verify anything, so refuse rather than trusting the caller.
    if (!IKHOKHA_APP_SECRET) {
      console.error("[iKhokha] webhook received but IKHOKHA_APP_SECRET is not configured");
      return res.status(503).json({ error: "Payment provider not configured" });
    }
    const signature = req.headers["ik-sign"] as string | undefined;
    const raw = req.rawBody ?? JSON.stringify(req.body);
    const expected = crypto.createHmac("sha256", IKHOKHA_APP_SECRET.trim()).update(raw).digest("hex");
    const sigBuf = Buffer.from(signature || "", "utf8");
    const expBuf = Buffer.from(expected, "utf8");
    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
      console.error("[iKhokha] webhook signature mismatch");
      return res.status(401).json({ error: "Invalid signature" });
    }

    const { externalTransactionID, status, paylinkID } = req.body || {};
    if (!externalTransactionID) return res.status(400).json({ error: "Missing externalTransactionID" });

    const known = await prisma.payment.findUnique({ where: { id: externalTransactionID } });
    if (!known) return res.status(404).json({ error: "Unknown payment" });

    const normalized = String(status || "").toUpperCase();
    const io = req.app.get("io");
    if (["SUCCESS", "SUCCESSFUL", "COMPLETE", "COMPLETED", "PAID"].includes(normalized)) {
      await confirmPayment(externalTransactionID, paylinkID || "ikhokha", io);
    } else if (["FAILED", "CANCELLED", "EXPIRED", "DECLINED"].includes(normalized)) {
      await failPayment(externalTransactionID, `iKhokha ${normalized.toLowerCase()}`);
    }
    // Always 200 so iKhokha does not retry a message we understood.
    res.json({ received: true });
  } catch (err) {
    console.error("[iKhokha] webhook error", err);
    res.status(500).json({ error: "Webhook processing failed" });
  }
});

// PAYMENT STATUS (SnapScan polling)
router.get("/status/:orderId", authenticate, async (req: Request, res: Response) => {
  try {
    // SECURITY: Ownership check
    const order = await prisma.order.findUnique({ where: { id: req.params.orderId } });
    if (!order) return res.status(404).json({ error: "Order not found" });
    if (order.customerId !== req.user!.id && req.user!.role !== "ADMIN") {
      return res.status(403).json({ error: "Not your order" });
    }
    const payment = await prisma.payment.findFirst({
      where: { orderId: req.params.orderId }, orderBy: { createdAt: "desc" },
    });
    if (!payment) return res.status(404).json({ error: "No payment found" });

    if (payment.provider === "SNAPSCAN" && payment.status === "PENDING" && SNAPSCAN_KEY) {
      try {
        const snapRes = await fetch(`https://pos.snapscan.io/merchant/api/v1/payments?merchantReference=${req.params.orderId}&status=completed`, {
          headers: { "Authorization": `Bearer ${SNAPSCAN_KEY}` },
        });
        const snapData = await snapRes.json();
        if (Array.isArray(snapData) && snapData.length > 0) {
          const io = req.app.get("io");
          await confirmPayment(payment.id, snapData[0].id || "snapscan_confirmed", io);
          return res.json({ status: "SUCCESSFUL" });
        }
      } catch { /* SnapScan API not available */ }
    }
    res.json({ status: payment.status, paymentId: payment.id });
  } catch (err: unknown) { res.status(500).json({ error: "Could not check payment status" }); }
});

// STITCH WEBHOOK (Svix-signed) — the source of truth that marks Stitch orders paid.
router.post("/webhook/stitch", async (req: Request & { rawBody?: string }, res: Response) => {
  try {
    // NEVER accept an unverified webhook — it can mark an order paid. Without the signing secret
    // (or the API credentials used to re-read the payment) refuse; Svix retries once configured.
    if (!isStitchConfigured(STITCH)) {
      console.error("[Stitch] webhook received but Stitch is not fully configured");
      return res.status(503).json({ error: "Webhook not configured" });
    }
    const header = (name: string) => {
      const value = req.headers[name];
      return Array.isArray(value) ? value[0] : value;
    };
    const verified = verifyStitchWebhook(req.rawBody ?? "", {
      id: header("svix-id"),
      timestamp: header("svix-timestamp"),
      signature: header("svix-signature"),
    }, STITCH.webhookSecret);
    if (!verified) {
      console.warn("[Stitch] webhook signature verification FAILED");
      return res.status(401).json({ error: "Invalid signature" });
    }

    const event = parseStitchWebhook(req.body);
    // Not a payment-request event (e.g. payment.confirmation) — acknowledge so it is not retried,
    // but log it: if Stitch's payload shape differs from the docs, this is where it would show.
    if (!event) {
      console.warn("[Stitch] webhook without a payment request node — ignored");
      return res.json({ received: true });
    }

    const payment = await prisma.payment.findFirst({
      where: {
        provider: "STITCH",
        OR: [{ providerRef: event.id }, ...(event.externalReference ? [{ id: event.externalReference }] : [])],
      },
    });
    // Matched on our own payment id (externalReference) too, so a payer who completes an older,
    // superseded tab is still credited.
    if (!payment) {
      console.warn(`[Stitch] webhook for unknown payment request ${event.id}`);
      return res.json({ received: true });
    }
    if (payment.status === "SUCCESSFUL") return res.json({ received: true });

    // Treat the webhook as a trigger: read the state and the actual paid amount from the Stitch API
    // rather than trusting the payload (its amount is the requested amount, not what was paid).
    const result = await stitch.getPaymentRequest(event.id);
    await applyStitchOutcome(payment, event.id, result.status, result.amount, req.app.get("io"));
    res.json({ received: true });
  } catch (err: unknown) {
    // 500 so Svix retries — a dropped "completed" event would leave a paid order unconfirmed.
    console.error("[Stitch] webhook error:", err instanceof Error ? err.message : err);
    res.status(500).json({ error: "Webhook processing failed" });
  }
});

// GET PAYMENT BY ID (ownership-checked)
router.get("/:id", authenticate, async (req: Request, res: Response) => {
  try {
    const payment = await prisma.payment.findUnique({ where: { id: req.params.id } });
    if (!payment) return res.status(404).json({ error: "Not found" });
    if (payment.userId !== req.user!.id && req.user!.role !== "ADMIN") {
      return res.status(403).json({ error: "Not your payment" });
    }
    res.json(payment);
  } catch (err: unknown) { res.status(500).json({ error: "Could not retrieve payment" }); }
});

export default router;