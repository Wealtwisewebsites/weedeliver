import { Request, Response, NextFunction } from "express";
import prisma from "../prisma.js";

// Require specific roles
export const requireRole = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ error: "Not authenticated" });
    if (!roles.includes(req.user.role)) return res.status(403).json({ error: "Forbidden — insufficient role" });
    next();
  };
};

// Require age verification
export const requireAge = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) return res.status(401).json({ error: "Not authenticated" });
  if (!req.user.isAgeVerified) return res.status(403).json({ error: "Age verification required", requiresAgeVerification: true });
  next();
};

// Check active membership for a dispensary (used before order placement)
export const requireMembership = async (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) return res.status(401).json({ error: "Not authenticated" });

  const dispensaryId = req.body.dispensaryId || req.params.dispensaryId;
  if (!dispensaryId) return res.status(400).json({ error: "dispensaryId required" });

  const membership = await prisma.membership.findUnique({
    where: { userId_dispensaryId: { userId: req.user.id, dispensaryId } },
  });

  if (!membership || membership.status !== "ACTIVE") {
    return res.status(403).json({
      error: "Active membership required",
      requiresMembership: true,
      dispensaryId,
    });
  }

  next();
};

// Check that a dispensary owner is accessing their own dispensary
export const requireOwner = async (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) return res.status(401).json({ error: "Not authenticated" });

  const dispensaryId = req.params.id || req.params.dispensaryId;
  if (!dispensaryId) return next();

  const dispensary = await prisma.dispensary.findUnique({ where: { id: dispensaryId } });
  if (!dispensary) return res.status(404).json({ error: "Dispensary not found" });
  if (dispensary.userId !== req.user.id && req.user.role !== "ADMIN") {
    return res.status(403).json({ error: "Not the owner of this dispensary" });
  }

  next();
};
