import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import prisma from "../prisma.js";

export interface AuthUser {
  id: string;
  email: string;
  role: string;
  firstName: string;
  lastName: string;
  isAgeVerified: boolean;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

// Verify JWT and attach user to request
export const authenticate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      return res.status(401).json({ error: "No token provided" });
    }

    const token = header.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string };

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, email: true, role: true, firstName: true, lastName: true, isAgeVerified: true },
    });

    if (!user) return res.status(401).json({ error: "User not found" });

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
};

// Optional auth — doesn't fail if no token, just doesn't set req.user
export const optionalAuth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const header = req.headers.authorization;
    if (header?.startsWith("Bearer ")) {
      const token = header.split(" ")[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string };
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: { id: true, email: true, role: true, firstName: true, lastName: true, isAgeVerified: true },
      });
      if (user) req.user = user;
    }
  } catch {}
  next();
};
