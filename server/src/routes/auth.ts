import { Router, Request, Response } from "express";
import * as authService from "../services/authService.js";
import { authenticate } from "../middleware/auth.js";
import prisma from "../prisma.js";

const router = Router();

router.post("/register", async (req: Request, res: Response) => {
  try {
    const result = await authService.register(req.body);
    res.cookie("refreshToken", result.refreshToken, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: process.env.NODE_ENV === "production" ? "none" : "lax", maxAge: 7 * 24 * 60 * 60 * 1000 });
    res.status(201).json({ user: result.user, accessToken: result.accessToken });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.post("/login", async (req: Request, res: Response) => {
  try {
    const result = await authService.login(req.body);
    res.cookie("refreshToken", result.refreshToken, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: process.env.NODE_ENV === "production" ? "none" : "lax", maxAge: 7 * 24 * 60 * 60 * 1000 });
    res.json({ user: result.user, accessToken: result.accessToken });
  } catch (err: any) {
    res.status(401).json({ error: err.message });
  }
});

router.post("/logout", (_req: Request, res: Response) => {
  res.clearCookie("refreshToken");
  res.json({ message: "Logged out" });
});

router.post("/refresh", async (req: Request, res: Response) => {
  try {
    const token = req.cookies?.refreshToken;
    if (!token) return res.status(401).json({ error: "No refresh token" });
    const tokens = await authService.refreshAccessToken(token);
    res.cookie("refreshToken", tokens.refreshToken, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: process.env.NODE_ENV === "production" ? "none" : "lax", maxAge: 7 * 24 * 60 * 60 * 1000 });
    res.json({ accessToken: tokens.accessToken });
  } catch (err: any) {
    res.status(401).json({ error: err.message });
  }
});

router.post("/verify-age", authenticate, async (req: Request, res: Response) => {
  try {
    const result = await authService.verifyAge(req.user!.id, req.body.dateOfBirth);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Get current user profile (for session restoration)
router.get("/me", authenticate, async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { id: true, email: true, role: true, firstName: true, lastName: true, phone: true, isAgeVerified: true, createdAt: true },
    });
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json({ user });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
