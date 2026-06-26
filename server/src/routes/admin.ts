import { Router, Request, Response } from "express";
import prisma from "../prisma.js";
import { authenticate } from "../middleware/auth.js";
import { requireRole } from "../middleware/guards.js";

const router = Router();

// All routes require ADMIN
router.use(authenticate, requireRole("ADMIN"));

// List users with pagination and filters
router.get("/users", async (req: Request, res: Response) => {
  try {
    const { role, search, page = "1", limit = "20" } = req.query;
    const where: any = {};
    if (role) where.role = role;
    if (search) where.OR = [
      { email: { contains: search as string } },
      { firstName: { contains: search as string } },
      { lastName: { contains: search as string } },
    ];

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where, skip: (parseInt(page as string) - 1) * parseInt(limit as string),
        take: parseInt(limit as string), orderBy: { createdAt: "desc" },
        select: { id: true, email: true, phone: true, role: true, firstName: true, lastName: true, isVerified: true, isAgeVerified: true, createdAt: true },
      }),
      prisma.user.count({ where }),
    ]);
    res.json({ users, total, page: parseInt(page as string), pages: Math.ceil(total / parseInt(limit as string)) });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// Pending dispensaries
router.get("/dispensaries", async (_req: Request, res: Response) => {
  try {
    const dispensaries = await prisma.dispensary.findMany({
      orderBy: { createdAt: "desc" },
      include: { user: { select: { firstName: true, lastName: true, email: true } } },
    });
    res.json(dispensaries);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// Platform analytics
router.get("/analytics", async (_req: Request, res: Response) => {
  try {
    const [totalUsers, totalDispensaries, activeDispensaries, totalOrders, totalRevenue, todayOrders] = await Promise.all([
      prisma.user.count(),
      prisma.dispensary.count(),
      prisma.dispensary.count({ where: { isApproved: true, isActive: true } }),
      prisma.order.count(),
      prisma.order.aggregate({ _sum: { total: true }, where: { status: "DELIVERED" } }),
      prisma.order.count({ where: { createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } } }),
    ]);

    // Orders by day (last 7 days)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const recentOrders = await prisma.order.findMany({
      where: { createdAt: { gte: sevenDaysAgo } },
      select: { createdAt: true, total: true },
    });

    const dailyData: Record<string, { orders: number; revenue: number }> = {};
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    recentOrders.forEach(o => {
      const day = days[o.createdAt.getDay()];
      if (!dailyData[day]) dailyData[day] = { orders: 0, revenue: 0 };
      dailyData[day].orders++;
      dailyData[day].revenue += Number(o.total);
    });

    res.json({
      totalUsers, totalDispensaries, activeDispensaries, totalOrders,
      totalRevenue: Number(totalRevenue._sum.total || 0), todayOrders,
      dailyData: days.map(d => ({ day: d, ...(dailyData[d] || { orders: 0, revenue: 0 }) })),
    });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// All orders
router.get("/orders", async (_req: Request, res: Response) => {
  try {
    const orders = await prisma.order.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        customer: { select: { firstName: true, lastName: true, email: true } },
        dispensary: { select: { name: true } },
        driver: { select: { firstName: true, lastName: true } },
        items: true,
      },
    });
    res.json(orders);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// Support tickets
router.get("/tickets", async (req: Request, res: Response) => {
  try {
    const tickets = await prisma.supportTicket.findMany({
      orderBy: { createdAt: "desc" },
      include: { user: { select: { firstName: true, lastName: true, email: true } } },
    });
    res.json(tickets);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.put("/tickets/:id", async (req: Request, res: Response) => {
  try {
    const ticket = await prisma.supportTicket.update({
      where: { id: req.params.id },
      data: { status: req.body.status, adminNotes: req.body.adminNotes },
    });
    res.json(ticket);
  } catch (err: any) { res.status(400).json({ error: err.message }); }
});

// Suspend user
router.delete("/users/:id", async (req: Request, res: Response) => {
  try {
    await prisma.user.update({ where: { id: req.params.id }, data: { isVerified: false } });
    res.json({ suspended: true });
  } catch (err: any) { res.status(400).json({ error: err.message }); }
});

// ─── DRIVER APPLICATIONS ───

// List all drivers + their application data (most recent first for review)
router.get("/drivers", async (_req: Request, res: Response) => {
  try {
    const drivers = await prisma.driver.findMany({
      orderBy: [{ appliedAt: "desc" }],
      include: { user: { select: { firstName: true, lastName: true, email: true, phone: true } } },
    });
    const result = drivers.map(d => {
      let app: any = {};
      try { app = d.applicationData ? JSON.parse(d.applicationData) : {}; } catch {}
      const { bankAccountEnc, ...safeApp } = app;
      return {
        id: d.id,
        userId: d.userId,
        status: d.status,
        declineReason: d.declineReason,
        appliedAt: d.appliedAt,
        reviewedAt: d.reviewedAt,
        totalDeliveries: d.totalDeliveries,
        rating: d.rating,
        firstName: d.user.firstName,
        lastName: d.user.lastName,
        email: d.user.email,
        phone: d.user.phone,
        application: safeApp,
      };
    });
    res.json(result);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// Approve a driver application
router.post("/drivers/:userId/approve", async (req: Request, res: Response) => {
  try {
    const driver = await prisma.driver.update({
      where: { userId: req.params.userId },
      data: { status: "APPROVED", reviewedAt: new Date(), declineReason: null },
    });
    res.json({ status: driver.status });
  } catch (err: any) { res.status(400).json({ error: err.message }); }
});

// Decline a driver application
router.post("/drivers/:userId/decline", async (req: Request, res: Response) => {
  try {
    const driver = await prisma.driver.update({
      where: { userId: req.params.userId },
      data: { status: "DECLINED", reviewedAt: new Date(), declineReason: req.body?.reason || "Application did not meet our requirements." },
    });
    res.json({ status: driver.status });
  } catch (err: any) { res.status(400).json({ error: err.message }); }
});

// ─── PAYOUTS ───

// List dispensaries with banking + earnings
router.get("/payouts", async (req: Request, res: Response) => {
  try {
    const { maskAccountNumber } = await import("../utils.js");
    const dispensaries = await prisma.dispensary.findMany({
      where: { isApproved: true },
      include: {
        banking: true,
        orders: { where: { status: "DELIVERED" }, select: { total: true } },
        payouts: { orderBy: { createdAt: "desc" }, take: 5 },
      },
    });

    const result = dispensaries.map(d => {
      const grossRevenue = d.orders.reduce((sum, o) => sum + Number(o.total), 0);
      const commission = Math.round(grossRevenue * 0.15 * 100) / 100;
      const netPayout = Math.round((grossRevenue - commission) * 100) / 100;
      return {
        id: d.id,
        name: d.name,
        slug: d.slug,
        banking: d.banking ? {
          bankName: d.banking.bankName,
          accountHolder: d.banking.accountHolderName,
          accountNumber: maskAccountNumber(d.banking.accountNumber),
          branchCode: d.banking.branchCode,
          accountType: d.banking.accountType,
          isVerified: d.banking.isVerified,
        } : null,
        grossRevenue,
        commission,
        netPayout,
        recentPayouts: d.payouts,
      };
    });

    res.json(result);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// Create / mark payout as paid
router.post("/payouts", async (req: Request, res: Response) => {
  try {
    const { dispensaryId, period, reference } = req.body;
    if (!dispensaryId || !period) return res.status(400).json({ error: "dispensaryId and period required" });

    // Calculate revenue for period (month)
    const [year, month] = period.split("-").map(Number);
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 1);

    const orders = await prisma.order.findMany({
      where: {
        dispensaryId,
        status: "DELIVERED",
        deliveredAt: { gte: startDate, lt: endDate },
      },
      select: { total: true },
    });

    const grossRevenue = orders.reduce((sum, o) => sum + Number(o.total), 0);
    const commission = Math.round(grossRevenue * 0.15 * 100) / 100;
    const netAmount = Math.round((grossRevenue - commission) * 100) / 100;

    if (netAmount <= 0) return res.status(400).json({ error: "No revenue for this period" });

    const payout = await prisma.payout.create({
      data: {
        dispensaryId,
        amount: netAmount,
        grossRevenue,
        commission,
        period,
        status: "PAID",
        paidAt: new Date(),
        reference: reference || `PAY-${Date.now()}`,
        adminId: req.user!.id,
      },
    });

    // Send email via SendGrid (if configured)
    if (process.env.SENDGRID_API_KEY) {
      try {
        const dispensary = await prisma.dispensary.findUnique({
          where: { id: dispensaryId },
          include: { user: { select: { email: true, firstName: true } }, banking: true },
        });
        if (dispensary?.user?.email) {
          const { maskAccountNumber } = await import("../utils.js");
          await fetch("https://api.sendgrid.com/v3/mail/send", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${process.env.SENDGRID_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              personalizations: [{ to: [{ email: dispensary.user.email }] }],
              from: { email: "payouts@weedeliver.co.za", name: "WeeDeliver Payouts" },
              subject: `Payout Processed — ${period}`,
              content: [{
                type: "text/html",
                value: `
                  <h2>Hi ${dispensary.user.firstName},</h2>
                  <p>Your payout for <strong>${period}</strong> has been processed.</p>
                  <table style="border-collapse:collapse;margin:20px 0;">
                    <tr><td style="padding:8px;border:1px solid #ddd;">Gross Revenue</td><td style="padding:8px;border:1px solid #ddd;">R${grossRevenue.toFixed(2)}</td></tr>
                    <tr><td style="padding:8px;border:1px solid #ddd;">Platform Fee (15%)</td><td style="padding:8px;border:1px solid #ddd;">-R${commission.toFixed(2)}</td></tr>
                    <tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold;">Net Payout</td><td style="padding:8px;border:1px solid #ddd;font-weight:bold;">R${netAmount.toFixed(2)}</td></tr>
                    <tr><td style="padding:8px;border:1px solid #ddd;">Bank</td><td style="padding:8px;border:1px solid #ddd;">${dispensary.banking?.bankName || "N/A"}</td></tr>
                    <tr><td style="padding:8px;border:1px solid #ddd;">Account</td><td style="padding:8px;border:1px solid #ddd;">${dispensary.banking ? maskAccountNumber(dispensary.banking.accountNumber) : "N/A"}</td></tr>
                  </table>
                  <p>Thank you for being a WeeDeliver partner!</p>
                `,
              }],
            }),
          });
        }
      } catch (e) {
        console.error("SendGrid email error:", e);
      }
    }

    res.status(201).json(payout);
  } catch (err: any) { res.status(400).json({ error: err.message }); }
});

export default router;
