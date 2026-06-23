import { Router, Request, Response } from "express";
import prisma from "../prisma.js";
import { authenticate } from "../middleware/auth.js";
import { z } from "zod";
import { verifyYocoSignature, verifyPaystackSignature } from "../utils.js";

const router = Router();

const initiateSchema = z.object({
  orderId: z.string().uuid(),
  provider: z.enum(["YOCO", "PAYSTACK", "SNAPSCAN", "EFT"]),
});

const YOCO_SECRET = process.env.YOCO_SECRET_KEY || "";
const YOCO_WEBHOOK_SECRET = process.env.YOCO_WEBHOOK_SECRET || "";
const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY || "";
const SNAPSCAN_KEY = process.env.SNAPSCAN_API_KEY || "";
const IS_PRODUCTION = process.env.NODE_ENV === "production";

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
 * IDEMPOTENT: returns early if payment is already SUCCESSFUL.
 */
async function confirmPayment(paymentId: string, providerRef: string, io?: any) {
  const existing = await prisma.payment.findUnique({ where: { id: paymentId } });
  if (!existing) throw new Error("Payment not found");
  if (existing.status === "SUCCESSFUL") return existing;

  const payment = await prisma.payment.update({
    where: { id: paymentId },
    data: { status: "SUCCESSFUL", providerRef },
  });

  if (payment.orderId) {
    const order = await prisma.order.update({
      where: { id: payment.orderId },
      data: { status: "CONFIRMED", confirmedAt: new Date() },
      include: { dispensary: { select: { id: true, name: true } } },
    });
    if (io) {
      io.to(`dispensary:${order.dispensaryId}`).emit("new_order", order);
      io.to(`order:${order.id}`).emit("order_status", { orderId: order.id, status: "CONFIRMED" });
      io.to("admin").emit("order_update", order);
    }
  }
  return payment;
}

async function failPayment(paymentId: string, reason: string) {
  const existing = await prisma.payment.findUnique({ where: { id: paymentId } });
  if (!existing || existing.status !== "PENDING") return existing;
  return prisma.payment.update({
    where: { id: paymentId },
    data: { status: "FAILED", providerRef: reason },
  });
}

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

    // Block duplicate PENDING payments
    const existingPayment = await prisma.payment.findFirst({
      where: { orderId, status: "PENDING" },
    });
    if (existingPayment) {
      return res.status(409).json({ error: "Payment already in progress", paymentId: existingPayment.id });
    }

    const amountCents = Math.round(Number(order.total) * 100);
    const amountRands = Number(order.total);

    const payment = await prisma.payment.create({
      data: { orderId, userId: req.user!.id, provider, amount: amountRands, status: "PENDING" },
    });

    const checkoutData: Record<string, unknown> = { paymentId: payment.id, provider };
    const clientUrl = process.env.CLIENT_URL || "http://localhost:5173";

    if (provider === "YOCO") {
      if (!YOCO_SECRET) return res.status(500).json({ error: "Payment provider not configured" });
      try {
        const yocoRes = await fetch("https://payments.yoco.com/api/checkouts", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${YOCO_SECRET}` },
          body: JSON.stringify({
            amount: amountCents, currency: "ZAR",
            successUrl: `${clientUrl}/payment/callback?provider=yoco&paymentId=${payment.id}&status=success`,
            cancelUrl: `${clientUrl}/payment/callback?provider=yoco&paymentId=${payment.id}&status=cancelled`,
            failureUrl: `${clientUrl}/payment/callback?provider=yoco&paymentId=${payment.id}&status=failed`,
            metadata: { orderId, paymentId: payment.id },
          }),
        });
        const yocoData = await yocoRes.json();
        if (yocoData.redirectUrl) {
          await prisma.payment.update({ where: { id: payment.id }, data: { providerRef: yocoData.id } });
          checkoutData.redirectUrl = yocoData.redirectUrl;
          checkoutData.checkoutId = yocoData.id;
        } else {
          checkoutData.error = yocoData.errorMessage || yocoData.message || "Checkout creation failed";
        }
      } catch { checkoutData.error = "Payment provider temporarily unavailable"; }

    } else if (provider === "PAYSTACK") {
      if (!PAYSTACK_SECRET) return res.status(500).json({ error: "Payment provider not configured" });
      try {
        const psRes = await fetch("https://api.paystack.co/transaction/initialize", {
          method: "POST",
          headers: { Authorization: `Bearer ${PAYSTACK_SECRET}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            email: req.user!.email, amount: amountCents, currency: "ZAR", reference: payment.id,
            callback_url: `${clientUrl}/payment/callback?provider=paystack&reference=${payment.id}`,
            metadata: { orderId, paymentId: payment.id },
          }),
        });
        const psData = await psRes.json();
        if (psData.status && psData.data?.authorization_url) {
          checkoutData.redirectUrl = psData.data.authorization_url;
          checkoutData.reference = psData.data.reference;
          checkoutData.accessCode = psData.data.access_code;
        } else { checkoutData.error = "Payment initialization failed"; }
      } catch { checkoutData.error = "Payment provider temporarily unavailable"; }

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

// VERIFY YOCO
router.post("/verify/yoco", authenticate, async (req: Request, res: Response) => {
  try {
    const { paymentId } = req.body;
    if (!paymentId) return res.status(400).json({ error: "paymentId required" });
    const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
    if (!payment) return res.status(404).json({ error: "Payment not found" });
    // SECURITY: Ownership check
    if (payment.userId !== req.user!.id) return res.status(403).json({ error: "Not your payment" });
    if (payment.status === "SUCCESSFUL") return res.json({ success: true, payment, alreadyConfirmed: true });
    if (!YOCO_SECRET) return res.status(500).json({ error: "Payment provider not configured" });
    const checkoutId = payment.providerRef;
    if (!checkoutId) return res.status(400).json({ error: "No checkout ID found" });

    const verifyRes = await fetch(`https://payments.yoco.com/api/checkouts/${checkoutId}`, {
      method: "GET", headers: { "Authorization": `Bearer ${YOCO_SECRET}` },
    });
    const verifyData = await verifyRes.json();

    if (verifyData.status === "completed") {
      const io = req.app.get("io");
      const confirmed = await confirmPayment(paymentId, checkoutId, io);
      return res.json({ success: true, payment: confirmed });
    } else if (verifyData.status === "expired" || verifyData.status === "cancelled") {
      await failPayment(paymentId, `Yoco checkout ${verifyData.status}`);
      return res.status(400).json({ error: `Payment was ${verifyData.status}` });
    } else {
      return res.json({ success: false, status: verifyData.status, message: "Payment still processing" });
    }
  } catch (err: unknown) {
    console.error("Yoco verify error:", err);
    res.status(500).json({ error: "Payment verification failed. Please try again." });
  }
});

// VERIFY PAYSTACK
router.post("/verify/paystack", authenticate, async (req: Request, res: Response) => {
  try {
    const { reference } = req.body;
    if (!reference) return res.status(400).json({ error: "reference required" });
    const payment = await prisma.payment.findUnique({ where: { id: reference } });
    if (!payment) return res.status(404).json({ error: "Payment not found" });
    // SECURITY: Ownership check
    if (payment.userId !== req.user!.id) return res.status(403).json({ error: "Not your payment" });
    if (payment.status !== "PENDING") return res.status(400).json({ error: "Already processed" });

    // SECURITY: No auto-succeed in production
    if (!PAYSTACK_SECRET) {
      if (IS_PRODUCTION) return res.status(500).json({ error: "Payment provider not configured" });
      console.warn("[DEV ONLY] Auto-confirming Paystack payment without verification");
      const io = req.app.get("io");
      const confirmed = await confirmPayment(payment.id, `dev_paystack_${Date.now()}`, io);
      return res.json({ success: true, payment: confirmed, devMode: true });
    }

    const verifyRes = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
      headers: { Authorization: `Bearer ${PAYSTACK_SECRET}` },
    });
    const verifyData = await verifyRes.json();
    if (verifyData.data?.status === "success") {
      const io = req.app.get("io");
      const confirmed = await confirmPayment(payment.id, verifyData.data.reference, io);
      return res.json({ success: true, payment: confirmed });
    } else {
      await failPayment(payment.id, verifyData.data?.gateway_response || "Failed");
      return res.status(400).json({ error: "Payment verification failed" });
    }
  } catch (err: unknown) {
    res.status(500).json({ error: "Payment verification failed. Please try again." });
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

// YOCO WEBHOOK - SECURITY: Signature mandatory in production
router.post("/webhook/yoco", async (req: Request & { rawBody?: string }, res: Response) => {
  try {
    const signature = req.headers["x-yoco-signature"] as string;
    const rawBody = req.rawBody ?? JSON.stringify(req.body);

    if (IS_PRODUCTION) {
      if (!YOCO_WEBHOOK_SECRET) {
        console.error("[SECURITY] Yoco webhook: YOCO_WEBHOOK_SECRET not configured");
        return res.status(500).json({ error: "Webhook not configured" });
      }
      if (!signature) {
        console.warn("[SECURITY] Yoco webhook: missing signature header");
        return res.status(401).json({ error: "Missing signature" });
      }
      if (!verifyYocoSignature(rawBody, signature, YOCO_WEBHOOK_SECRET)) {
        console.warn("[SECURITY] Yoco webhook: signature verification FAILED");
        return res.status(401).json({ error: "Invalid signature" });
      }
    } else if (YOCO_WEBHOOK_SECRET && signature) {
      if (!verifyYocoSignature(rawBody, signature, YOCO_WEBHOOK_SECRET)) {
        return res.status(401).json({ error: "Invalid signature" });
      }
    } else {
      console.warn("[DEV] Yoco webhook: no signature verification");
    }

    const event = req.body;
    const paymentId = event?.payload?.metadata?.paymentId || event?.paymentId;
    if (!paymentId) return res.json({ received: true });

    const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
    if (!payment || payment.status !== "PENDING") return res.json({ received: true });

    if (event.type === "payment.succeeded" || event.status === "successful") {
      const io = req.app.get("io");
      await confirmPayment(paymentId, event.payload?.id || "yoco_webhook", io);
    } else if (event.type === "payment.failed") {
      await failPayment(paymentId, "Yoco webhook: payment failed");
    }
    res.json({ received: true });
  } catch (err: unknown) {
    console.error("Yoco webhook error:", err);
    res.status(200).json({ received: true, error: "Processing failed" });
  }
});

// PAYSTACK WEBHOOK - SECURITY: Signature mandatory in production
router.post("/webhook/paystack", async (req: Request & { rawBody?: string }, res: Response) => {
  try {
    const signature = req.headers["x-paystack-signature"] as string;
    const rawBody = req.rawBody ?? JSON.stringify(req.body);

    if (IS_PRODUCTION) {
      if (!PAYSTACK_SECRET) {
        console.error("[SECURITY] Paystack webhook: PAYSTACK_SECRET_KEY not configured");
        return res.status(500).json({ error: "Webhook not configured" });
      }
      if (!signature) {
        console.warn("[SECURITY] Paystack webhook: missing signature header");
        return res.status(401).json({ error: "Missing signature" });
      }
      if (!verifyPaystackSignature(rawBody, signature, PAYSTACK_SECRET)) {
        console.warn("[SECURITY] Paystack webhook: signature verification FAILED");
        return res.status(401).json({ error: "Invalid signature" });
      }
    } else if (PAYSTACK_SECRET && signature) {
      if (!verifyPaystackSignature(rawBody, signature, PAYSTACK_SECRET)) {
        return res.status(401).json({ error: "Invalid signature" });
      }
    } else {
      console.warn("[DEV] Paystack webhook: no signature verification");
    }

    const event = req.body;
    if (event.event === "charge.success") {
      const ref = event.data?.reference;
      if (!ref) return res.json({ received: true });
      const payment = await prisma.payment.findFirst({
        where: { OR: [{ id: ref }, { providerRef: ref }] },
      });
      if (payment && payment.status === "PENDING") {
        const io = req.app.get("io");
        await confirmPayment(payment.id, ref, io);
      }
    }
    res.json({ received: true });
  } catch (err: unknown) {
    console.error("Paystack webhook error:", err);
    res.status(200).json({ received: true, error: "Processing failed" });
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