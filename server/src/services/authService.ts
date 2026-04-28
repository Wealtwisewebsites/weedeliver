import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import prisma from "../prisma.js";
import { z } from "zod";

const registerSchema = z.object({
  email: z.string().email(),
  phone: z.string().optional(),
  password: z.string().min(6),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  role: z.enum(["CUSTOMER", "DISPENSARY", "DRIVER", "ADMIN"]).optional().default("CUSTOMER"),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

export function generateTokens(userId: string) {
  const accessToken = jwt.sign({ userId }, process.env.JWT_SECRET!, { expiresIn: "15m" });
  const refreshToken = jwt.sign({ userId }, process.env.JWT_REFRESH_SECRET!, { expiresIn: "7d" });
  return { accessToken, refreshToken };
}

export async function register(data: unknown) {
  const parsed = registerSchema.parse(data);
  const existing = await prisma.user.findUnique({ where: { email: parsed.email } });
  if (existing) throw new Error("Email already registered");

  const passwordHash = await bcrypt.hash(parsed.password, 12);
  const phone = parsed.phone && parsed.phone.trim() !== "" ? parsed.phone.trim() : null;
  const user = await prisma.user.create({
    data: {
      email: parsed.email,
      phone,
      passwordHash,
      firstName: parsed.firstName,
      lastName: parsed.lastName,
      role: parsed.role,
    },
  });

  // Auto-create driver/dispensary profile if role matches
  if (user.role === "DRIVER") {
    await prisma.driver.create({ data: { userId: user.id } });
  }

  const tokens = generateTokens(user.id);
  return { user: { id: user.id, email: user.email, role: user.role, firstName: user.firstName, lastName: user.lastName }, ...tokens };
}

export async function login(data: unknown) {
  const parsed = loginSchema.parse(data);
  const user = await prisma.user.findUnique({ where: { email: parsed.email } });
  if (!user || !user.passwordHash) throw new Error("Invalid credentials");

  const valid = await bcrypt.compare(parsed.password, user.passwordHash);
  if (!valid) throw new Error("Invalid credentials");

  const tokens = generateTokens(user.id);
  return { user: { id: user.id, email: user.email, role: user.role, firstName: user.firstName, lastName: user.lastName, isAgeVerified: user.isAgeVerified }, ...tokens };
}

export async function refreshAccessToken(refreshToken: string) {
  const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET!) as { userId: string };
  const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
  if (!user) throw new Error("User not found");
  return generateTokens(user.id);
}

export async function verifyAge(userId: string, dateOfBirth: string) {
  const dob = new Date(dateOfBirth);
  const age = Math.floor((Date.now() - dob.getTime()) / (365.25 * 24 * 60 * 60 * 1000));

  if (age < 18) {
    await prisma.user.update({ where: { id: userId }, data: { dateOfBirth: dob, isAgeVerified: false } });
    throw new Error("Must be 18 or older");
  }

  await prisma.user.update({ where: { id: userId }, data: { dateOfBirth: dob, isAgeVerified: true } });
  return { verified: true, age };
}
