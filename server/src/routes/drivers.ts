import { Router, Request, Response } from "express";
import prisma from "../prisma.js";
import { authenticate } from "../middleware/auth.js";
import { requireRole } from "../middleware/guards.js";
import { encrypt } from "../utils.js";
import { notifyApplicationReceived, notifyAdminNewApplication } from "../services/notifications.js";

const router = Router();

const parseApp = (s: string | null): Record<string, any> => {
  try { return s ? JSON.parse(s) : {}; } catch { return {}; }
};

// ─── MY DRIVER PROFILE (status + application data) ───
router.get("/profile", authenticate, requireRole("DRIVER"), async (req: Request, res: Response) => {
  try {
    const driver = await prisma.driver.findUnique({ where: { userId: req.user!.id } });
    if (!driver) return res.status(404).json({ error: "Driver profile not found" });
    const { bankAccountEnc, ...app } = parseApp(driver.applicationData);
    res.json({
      id: driver.id,
      userId: driver.userId,
      status: driver.status,
      declineReason: driver.declineReason,
      appliedAt: driver.appliedAt,
      submittedAt: driver.appliedAt,
      reviewedAt: driver.reviewedAt,
      isOnline: driver.isOnline,
      totalDeliveries: driver.totalDeliveries,
      totalEarnings: driver.totalEarnings,
      rating: driver.rating,
      ...app,
    });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ─── SUBMIT APPLICATION ───
router.post("/apply", authenticate, requireRole("DRIVER"), async (req: Request, res: Response) => {
  try {
    const data = req.body || {};
    const driver = await prisma.driver.update({
      where: { userId: req.user!.id },
      data: {
        status: "PENDING",
        appliedAt: new Date(),
        declineReason: null,
        reviewedAt: null,
        vehicleType: data.vehicleType ?? undefined,
        licenseNumber: data.licenceNumber ?? data.licenseNumber ?? undefined,
        applicationData: JSON.stringify(data),
      },
    });
    const u = req.user!;
    void notifyApplicationReceived(u.email, u.firstName, "driver");
    void notifyAdminNewApplication("driver", `${u.firstName} ${u.lastName}`, u.email, data.vehicleMake ? `Vehicle: ${[data.vehicleYear, data.vehicleMake, data.vehicleModel].filter(Boolean).join(" ")}` : "");
    res.json({ status: driver.status, appliedAt: driver.appliedAt });
  } catch (err: any) { res.status(400).json({ error: err.message }); }
});

// ─── UPDATE PROFILE (e.g. profile photo) — merges into applicationData ───
router.put("/profile", authenticate, requireRole("DRIVER"), async (req: Request, res: Response) => {
  try {
    const driver = await prisma.driver.findUnique({ where: { userId: req.user!.id } });
    if (!driver) return res.status(404).json({ error: "Driver profile not found" });
    const app = { ...parseApp(driver.applicationData), ...(req.body || {}) };
    await prisma.driver.update({ where: { userId: req.user!.id }, data: { applicationData: JSON.stringify(app) } });
    res.json({ ok: true });
  } catch (err: any) { res.status(400).json({ error: err.message }); }
});

// ─── SAVE BANKING (account number encrypted at rest) ───
router.put("/banking", authenticate, requireRole("DRIVER"), async (req: Request, res: Response) => {
  try {
    const driver = await prisma.driver.findUnique({ where: { userId: req.user!.id } });
    if (!driver) return res.status(404).json({ error: "Driver profile not found" });
    const { bankName, accountNumber } = req.body || {};
    const app = {
      ...parseApp(driver.applicationData),
      bankName: bankName ?? undefined,
      bankAccountEnc: accountNumber ? encrypt(String(accountNumber)) : undefined,
    };
    await prisma.driver.update({ where: { userId: req.user!.id }, data: { applicationData: JSON.stringify(app) } });
    res.json({ ok: true });
  } catch (err: any) { res.status(400).json({ error: err.message }); }
});

export default router;
