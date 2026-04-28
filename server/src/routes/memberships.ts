import { Router, Request, Response } from "express";
import prisma from "../prisma.js";
import { authenticate } from "../middleware/auth.js";
import { requireRole } from "../middleware/guards.js";

const router = Router();

// Get my memberships
router.get("/mine", authenticate, requireRole("CUSTOMER"), async (req: Request, res: Response) => {
  try {
    const memberships = await prisma.membership.findMany({
      where: { userId: req.user!.id },
      include: { dispensary: { select: { name: true, slug: true, logoUrl: true, membershipType: true } } },
    });
    res.json(memberships);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// Apply for membership
router.post("/", authenticate, requireRole("CUSTOMER"), async (req: Request, res: Response) => {
  try {
    const { dispensaryId } = req.body;
    if (!dispensaryId) return res.status(400).json({ error: "dispensaryId required" });

    const dispensary = await prisma.dispensary.findUnique({ where: { id: dispensaryId } });
    if (!dispensary) return res.status(404).json({ error: "Dispensary not found" });

    // Check if already has membership
    const existing = await prisma.membership.findUnique({
      where: { userId_dispensaryId: { userId: req.user!.id, dispensaryId } },
    });
    if (existing) return res.status(400).json({ error: "Membership already exists", membership: existing });

    // Auto-approve FREE memberships
    const status = dispensary.membershipType === "FREE" ? "ACTIVE" : "PENDING";

    const membership = await prisma.membership.create({
      data: { userId: req.user!.id, dispensaryId, status },
    });
    res.status(201).json(membership);
  } catch (err: any) { res.status(400).json({ error: err.message }); }
});

// Dispensary approves membership
router.put("/:id/approve", authenticate, requireRole("DISPENSARY"), async (req: Request, res: Response) => {
  try {
    const membership = await prisma.membership.findUnique({ where: { id: req.params.id }, include: { dispensary: true } });
    if (!membership || membership.dispensary.userId !== req.user!.id) return res.status(403).json({ error: "Forbidden" });
    const updated = await prisma.membership.update({ where: { id: req.params.id }, data: { status: "ACTIVE" } });
    res.json(updated);
  } catch (err: any) { res.status(400).json({ error: err.message }); }
});

// Dispensary rejects membership
router.put("/:id/reject", authenticate, requireRole("DISPENSARY"), async (req: Request, res: Response) => {
  try {
    const membership = await prisma.membership.findUnique({ where: { id: req.params.id }, include: { dispensary: true } });
    if (!membership || membership.dispensary.userId !== req.user!.id) return res.status(403).json({ error: "Forbidden" });
    const updated = await prisma.membership.update({ where: { id: req.params.id }, data: { status: "REJECTED" } });
    res.json(updated);
  } catch (err: any) { res.status(400).json({ error: err.message }); }
});

// List dispensary members
router.get("/dispensary/:dispensaryId", authenticate, requireRole("DISPENSARY", "ADMIN"), async (req: Request, res: Response) => {
  try {
    const memberships = await prisma.membership.findMany({
      where: { dispensaryId: req.params.dispensaryId },
      include: { user: { select: { firstName: true, lastName: true, email: true } } },
      orderBy: { createdAt: "desc" },
    });
    res.json(memberships);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

export default router;
