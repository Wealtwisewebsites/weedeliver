import { Router, Request, Response } from "express";
import prisma from "../prisma.js";
import { authenticate } from "../middleware/auth.js";
import { z } from "zod";
import { verifyYocoSignature, verifyPaystackSignature } from "../utils.js";
import crypto from "crypto";

const router = Router();

const initiateSchema = z.object({
  orderId: z.string().uuid(),
  provider: z.enum(["YOCO", "PAYSTACK", "SNAPSCAN", "EFT"]),
});

const YOCO_SECRET = process.env.YOCO_SECRET_KEY || "";
const YOCO_PUBLIC = process.env.YOCO_PUBLIC_KEY || "";
const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY || "";
const SNAPSCAN_KEY = process.env.SNAPSCAN_API_KEY || "";

// Helper: confirm payment + update order
async function confirmPayment(paymentId: string, providerRef: string, io?: any) {
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
  return prisma.payment.update({
    where: { id: paymentId },
    data: { status: "FAILED", providerRef: reason },
  });
}

// ─── INITIATE PAYMENT ───
router.post("/initiate", authenticate, async (req: Request, res: Response) => {
  try {
    const { orderId, provider } = initiateSchema.parse(req.body);

    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) return res.status(404).json({ error: "Order not found" });
    if (order.customerId !== req.user!.id) return res.status(403).json({ error: "Not your order" });

    const amountCents = Math.round(Number(order.total) * 100);
    const amountRands = Number(order.total);

    // Create payment record (logs every attempt)
    const payment = await prisma.payment.create({
      data: {
        orderId,
        userId: req.user!.id,
        provider,
        amount: amountRands,
        status: "PENDING",
      },
    });

    let checkoutData: any = { paymentId: payment.id, provider };

    if (provider === "YOCO") {
      // Yoco Checkout API — redirect-based flow
      // 1. Backend creates checkout via POST https://payments.yoco.com/api/checkouts
      // 2. Returns redirectUrl → frontend redirects customer to Yoco payment page
      // 3. After payment, Yoco redirects back to successUrl/cancelUrl/failureUrl
      // 4. Webhook confirms payment on backend
      if (!YOCO_SECRET) {
        return res.status(500).json({ error: "Yoco secret key not configured. Add YOCO_SECRET_KEY to .env" });
      }

      const clientUrl = process.env.CLIENT_URL || "http://localhost:5173";

      try {
        const yocoRes = await fetch("https://payments.yoco.com/api/checkouts", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${YOCO_SECRET}`,
          },
          body: JSON.stringify({
            amount: amountCents,
            currency: "ZAR",
            successUrl: `${clientUrl}/payment/callback?provider=yoco&paymentId=${payment.id}&status=success`,
            cancelUrl: `${clientUrl}/payment/callback?provider=yoco&paymentId=${payment.id}&status=cancelled`,
            failureUrl: `${clientUrl}/payment/callback?provider=yoco&paymentId=${payment.id}&status=failed`,
            metadata: { orderId, paymentId: payment.id },
          }),
        });
        const yocoData = await yocoRes.json();

        if (yocoData.redirectUrl) {
          // Store the Yoco checkout ID as providerRef for later verification
          await prisma.payment.update({
            where: { id: payment.id },
            data: { providerRef: yocoData.id },
          });
          checkoutData.redirectUrl = yocoData.redirectUrl;
          checkoutData.checkoutId = yocoData.id;
        } else {
          checkoutData.error = yocoData.errorMessage || yocoData.message || "Yoco checkout creation failed";
        }
      } catch (e: any) {
        checkoutData.error = `Yoco API error: ${e.message}`;
      }

    } else if (provider === "PAYSTACK") {
      // Initialize Paystack transaction
      if (PAYSTACK_SECRET) {
        try {
          const psRes = await fetch("https://api.paystack.co/transaction/initialize", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${PAYSTACK_SECRET}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              email: req.user!.email,
              amount: amountCents,
              currency: "ZAR",
              reference: payment.id,
              callback_url: `${process.env.CLIENT_URL || "http://localhost:5173"}/payment/callback?provider=paystack&reference=${payment.id}`,
              metadata: { orderId, paymentId: payment.id },
            }),
          });
          const psData = await psRes.json();
          if (psData.status && psData.data?.authorization_url) {
            checkoutData.redirectUrl = psData.data.authorization_url;
            checkoutData.reference = psData.data.reference;
            checkoutData.accessCode = psData.data.access_code;
          } else {
            checkoutData.redirectUrl = null;
            checkoutData.error = "Paystack initialization failed — check API key";
          }
        } catch (e: any) {
          checkoutData.error = e.message;
        }
      } else {
        checkoutData.redirectUrl = null;
        checkoutData.error = "Paystack not configured";
      }

    } else if (provider === "SNAPSCAN") {
      // Generate SnapScan QR URL
      const snapUrl = `https://pos.snapscan.io/qr/${SNAPSCAN_KEY || "DEMO"}?id=${orderId}&amount=${amountCents}&strict=true`;
      checkoutData.qrUrl = snapUrl;
      checkoutData.amountInCents = amountCents;

    } else if (provider === "EFT") {
      checkoutData.bankDetails = {
        bank: "FNB",
        accountNumber: "62792283456",
        branchCode: "250655",
        accountType: "Cheque",
        reference: payment.id.slice(0, 8).toUpperCase(),
      };
    }

    res.status(201).json(checkoutData);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// ─── VERIFY YOCO PAYMENT (after redirect back from Yoco Checkout) ───
router.post("/verify/yoco", authenticate, async (req: Request, res: Response) => {
  try {
    const { paymentId } = req.body;
    if (!paymentId) return res.status(400).json({ error: "paymentId required" });

    const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
    if (!payment) return res.status(404).json({ error: "Payment not found" });
    if (payment.status === "SUCCESSFUL") return res.json({ success: true, payment, alreadyConfirmed: true });

    if (!YOCO_SECRET) {
      return res.status(500).json({ error: "Yoco secret key not configured" });
    }

    // Verify by fetching the checkout status from Yoco API
    const checkoutId = payment.providerRef;
    if (!checkoutId) {
      return res.status(400).json({ error: "No Yoco checkout ID found for this payment" });
    }

    const verifyRes = await fetch(`https://payments.yoco.com/api/checkouts/${checkoutId}`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${YOCO_SECRET}`,
      },
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
      // Still pending
      return res.json({ success: false, status: verifyData.status, message: "Payment still processing" });
    }
  } catch (err: any) {
    console.error("Yoco verify error:", err);
    res.status(500).json({ error: "Payment verification failed. Please try again." });
  }
});

// ─── VERIFY PAYSTACK PAYMENT ───
router.post("/verify/paystack", authenticate, async (req: Request, res: Response) => {
  try {
    const { reference } = req.body;
    if (!reference) return res.status(400).json({ error: "reference required" });

    const payment = await prisma.payment.findUnique({ where: { id: reference } });
    if (!payment) return res.status(404).json({ error: "Payment not found" });
    if (payment.status !== "PENDING") return res.status(400).json({ error: "Already processed" });

    if (PAYSTACK_SECRET) {
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
    }

    // Dev mode: auto-succeed
    const io = req.app.get("io");
    const confirmed = await confirmPayment(payment.id, `dev_paystack_${Date.now()}`, io);
    res.json({ success: true, payment: confirmed });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── PAYMENT STATUS (for SnapScan polling) ───
router.get("/status/:orderId", authenticate, async (req: Request, res: Response) => {
  try {
    const payment = await prisma.payment.findFirst({
      where: { orderId: req.params.orderId },
      orderBy: { createdAt: "desc" },
    });
    if (!payment) return res.status(404).json({ error: "No payment found" });

    // If SnapScan and still pending, check with SnapScan API (if configured)
    if (payment.provider === "SNAPSCAN" && payment.status === "PENDING" && SNAPSCAN_KEY) {
      try {
        const snapRes = await fetch(`https://pos.snapscan.io/merchant/api/v1/payments?merchantReference=${req.params.orderId}&status=completed`, {
          headers: { "Authorization": `Bearer ${SNAPSCAN_KEY}` },
        });
        const snapData = await snapRes.json();
        if (snapData?.length > 0) {
          const io = req.app.get("io");
          await confirmPayment(payment.id, snapData[0].id || "snapscan_confirmed", io);
          return res.json({ status: "SUCCESSFUL" });
        }
      } catch {
        // SnapScan API not available — continue
      }
    }

    res.json({ status: payment.status, paymentId: payment.id });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── YOCO WEBHOOK ───
router.post("/webhook/yoco", express.raw({ type: "application/json" }), async (req: Request, res: Response) => {
  try {
    const signature = req.headers["x-yoco-signature"] as string;
    const body = typeof req.body === "string" ? req.body : JSON.stringify(req.body);

    if (YOCO_SECRET && signature) {
      if (!verifyYocoSignature(body, signature, YOCO_SECRET)) {
        return res.status(401).json({ error: "Invalid signature" });
      }
    }

    const event = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
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
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// ─── PAYSTACK WEBHOOK ───
router.post("/webhook/paystack", express.raw({ type: "application/json" }), async (req: Request, res: Response) => {
  try {
    const signature = req.headers["x-paystack-signature"] as string;
    const body = typeof req.body === "string" ? req.body : JSON.stringify(req.body);

    if (PAYSTACK_SECRET && signature) {
      if (!verifyPaystackSignature(body, signature, PAYSTACK_SECRET)) {
        return res.status(401).json({ error: "Invalid signature" });
      }
    }

    const event = typeof req.body === "string" ? JSON.parse(req.body) : req.body;

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
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// ─── GET PAYMENT BY ID ───
router.get("/:id", authenticate, async (req: Request, res: Response) => {
  try {
    const payment = await prisma.payment.findUnique({ where: { id: req.params.id } });
    if (!payment) return res.status(404).json({ error: "Not found" });
    res.json(payment);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Need express for raw body parsing on webhooks
import express from "express";

export default router;
