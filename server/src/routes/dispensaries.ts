import { Router, Request, Response } from "express";
import prisma from "../prisma.js";
import { authenticate } from "../middleware/auth.js";
import { requireRole, requireOwner } from "../middleware/guards.js";
import { upload } from "../middleware/upload.js";
import { z } from "zod";
import { isDispensaryOpen, haversineDistance, encrypt, maskAccountNumber } from "../utils.js";

const router = Router();

const createSchema = z.object({
  name: z.string().min(1),
  bio: z.string().optional(),
  tagline: z.string().optional(),
  address: z.string().min(1),
  city: z.string().min(1),
  province: z.string().min(1),
  deliveryRadius: z.number().int().optional().default(10),
  deliveryFee: z.number().optional().default(0),
  minimumOrder: z.number().optional().default(0),
  membershipType: z.enum(["FREE", "PAID", "UPLOAD_PROOF"]).optional().default("FREE"),
  membershipPrice: z.number().optional().default(0),
});

const operatingHoursSchema = z.object({
  mon: z.object({ open: z.string(), close: z.string(), isOpen: z.boolean() }).optional(),
  tue: z.object({ open: z.string(), close: z.string(), isOpen: z.boolean() }).optional(),
  wed: z.object({ open: z.string(), close: z.string(), isOpen: z.boolean() }).optional(),
  thu: z.object({ open: z.string(), close: z.string(), isOpen: z.boolean() }).optional(),
  fri: z.object({ open: z.string(), close: z.string(), isOpen: z.boolean() }).optional(),
  sat: z.object({ open: z.string(), close: z.string(), isOpen: z.boolean() }).optional(),
  sun: z.object({ open: z.string(), close: z.string(), isOpen: z.boolean() }).optional(),
});

const bankingSchema = z.object({
  bankName: z.enum(["ABSA", "FNB", "Standard Bank", "Nedbank", "Capitec", "Investec", "TymeBank", "African Bank"]),
  accountHolderName: z.string().min(1),
  accountNumber: z.string().min(6),
  branchCode: z.string().min(4),
  accountType: z.enum(["CHEQUE", "SAVINGS"]),
});

function enrichDispensary(d: any, userLat?: number, userLng?: number) {
  const isOpen = isDispensaryOpen(d.operatingHours);
  let distance: number | null = null;
  if (userLat !== undefined && userLng !== undefined && d.lat && d.lng) {
    distance = Math.round(haversineDistance(userLat, userLng, Number(d.lat), Number(d.lng)) * 10) / 10;
  }
  return { ...d, isOpen, distance };
}

// ─── MY DISPENSARIES (owner — includes unapproved) ───
router.get("/mine", authenticate, async (req: Request, res: Response) => {
  try {
    const dispensaries = await prisma.dispensary.findMany({
      where: { userId: req.user!.id },
      include: { _count: { select: { products: true, memberships: true } } },
    });
    res.json(dispensaries.map(d => enrichDispensary(d)));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── LIST DISPENSARIES (public) — filter by location ───
router.get("/", async (req: Request, res: Response) => {
  try {
    const { lat, lng, radius, city } = req.query;
    const where: any = { isApproved: true, isActive: true };
    if (city) where.city = { contains: city as string }; // SQLite doesn't support mode: "insensitive"

    const dispensaries = await prisma.dispensary.findMany({
      where,
      orderBy: { rating: "desc" },
      include: { _count: { select: { products: true, memberships: true } } },
    });

    let results = dispensaries.map(d => enrichDispensary(d,
      lat ? parseFloat(lat as string) : undefined,
      lng ? parseFloat(lng as string) : undefined
    ));

    if (lat && lng) {
      const maxRadius = radius ? parseFloat(radius as string) : 50;
      results = results
        .filter(d => d.distance !== null && d.distance <= maxRadius)
        .sort((a, b) => (a.distance ?? 999) - (b.distance ?? 999));
    }

    res.json(results);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET SINGLE DISPENSARY BY SLUG (public) ───
router.get("/:slug", async (req: Request, res: Response) => {
  try {
    const dispensary = await prisma.dispensary.findUnique({
      where: { slug: req.params.slug },
      include: { products: { where: { isActive: true }, orderBy: { createdAt: "desc" } } },
    });
    if (!dispensary) return res.status(404).json({ error: "Not found" });
    res.json(enrichDispensary(dispensary));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── CREATE DISPENSARY ───
router.post("/", authenticate, requireRole("DISPENSARY"), async (req: Request, res: Response) => {
  try {
    const parsed = createSchema.parse(req.body);
    // Make slug unique by appending a suffix if needed
    const baseSlug = parsed.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    let slug = baseSlug;
    const existing = await prisma.dispensary.findUnique({ where: { slug } });
    if (existing) slug = `${baseSlug}-${Date.now()}`;

    const dispensary = await prisma.dispensary.create({
      data: {
        ...parsed,
        slug,
        userId: req.user!.id,
        isApproved: false, // pending admin review before the store goes live
        isActive: true,
      },
    });
    res.status(201).json(dispensary);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// ─── UPDATE DISPENSARY (incl. operatingHours) ───
// Whitelist updatable scalar columns so computed/relation fields (isOpen, distance,
// _count, banking, profileUrl, openNow, etc.) are safely ignored instead of crashing Prisma.
const UPDATABLE_FIELDS = ["name", "bio", "tagline", "logoUrl", "bannerUrl", "address", "city", "province", "membershipType", "isActive"];
const NUMERIC_FIELDS = ["deliveryRadius", "deliveryFee", "minimumOrder", "membershipPrice"];

router.put("/:id", authenticate, requireOwner, async (req: Request, res: Response) => {
  try {
    const src = req.body || {};
    const data: any = {};

    for (const key of UPDATABLE_FIELDS) {
      if (src[key] !== undefined) data[key] = src[key];
    }
    for (const key of NUMERIC_FIELDS) {
      if (src[key] !== undefined && src[key] !== null && src[key] !== "") data[key] = Number(src[key]);
    }
    if (src.operatingHours !== undefined) {
      if (src.operatingHours && typeof src.operatingHours === "object") {
        operatingHoursSchema.parse(src.operatingHours);
        data.operatingHours = JSON.stringify(src.operatingHours);
      } else if (typeof src.operatingHours === "string") {
        data.operatingHours = src.operatingHours;
      }
    }
    if (src.socialLinks !== undefined) {
      data.socialLinks = src.socialLinks && typeof src.socialLinks === "object"
        ? JSON.stringify(src.socialLinks)
        : src.socialLinks;
    }

    const dispensary = await prisma.dispensary.update({ where: { id: req.params.id }, data });
    res.json(enrichDispensary(dispensary));
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// ─── UPLOAD BANNER ───
router.post("/:id/banner", authenticate, requireOwner, upload.single("image"), async (req: Request, res: Response) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file" });
    const dataUrl = `data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`;
    const dispensary = await prisma.dispensary.update({ where: { id: req.params.id }, data: { bannerUrl: dataUrl } });
    res.json({ bannerUrl: dispensary.bannerUrl });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// ─── UPLOAD LOGO ───
router.post("/:id/logo", authenticate, requireOwner, upload.single("image"), async (req: Request, res: Response) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file" });
    const dataUrl = `data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`;
    const dispensary = await prisma.dispensary.update({ where: { id: req.params.id }, data: { logoUrl: dataUrl } });
    res.json({ logoUrl: dispensary.logoUrl });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// ─── ADMIN APPROVE ───
router.post("/:id/approve", authenticate, requireRole("ADMIN"), async (req: Request, res: Response) => {
  try {
    const dispensary = await prisma.dispensary.update({ where: { id: req.params.id }, data: { isApproved: true } });
    res.json(dispensary);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// ─── GET PRODUCTS ───
router.get("/:id/products", async (req: Request, res: Response) => {
  try {
    const products = await prisma.product.findMany({
      where: { dispensaryId: req.params.id, isActive: true },
      orderBy: { createdAt: "desc" },
    });
    res.json(products);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── SAVE/UPDATE BANKING DETAILS ───
router.put("/:id/banking", authenticate, requireOwner, async (req: Request, res: Response) => {
  try {
    const parsed = bankingSchema.parse(req.body);
    const encryptedAccount = encrypt(parsed.accountNumber);

    const banking = await prisma.dispensaryBanking.upsert({
      where: { dispensaryId: req.params.id },
      update: { ...parsed, accountNumber: encryptedAccount },
      create: { dispensaryId: req.params.id, ...parsed, accountNumber: encryptedAccount },
    });
    res.json({ ...banking, accountNumber: "****" + parsed.accountNumber.slice(-4) });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// ─── GET BANKING DETAILS (owner only, masked) ───
router.get("/:id/banking", authenticate, requireOwner, async (req: Request, res: Response) => {
  try {
    const banking = await prisma.dispensaryBanking.findUnique({ where: { dispensaryId: req.params.id } });
    if (!banking) return res.status(404).json({ error: "No banking details" });
    res.json({ ...banking, accountNumber: maskAccountNumber(banking.accountNumber) });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
