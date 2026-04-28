import { Router, Request, Response } from "express";
import prisma from "../prisma.js";
import { authenticate } from "../middleware/auth.js";
import { requireRole } from "../middleware/guards.js";
import { upload } from "../middleware/upload.js";
import { z } from "zod";

const router = Router();

const productSchema = z.object({
  dispensaryId: z.string().uuid(),
  name: z.string().min(1),
  description: z.string().optional(),
  category: z.enum(["INDOOR_FLOWER", "GREENHOUSE_FLOWER", "ACCESSORY", "EDIBLE", "CONCENTRATE", "OTHER"]).default("OTHER"),
  price: z.number().positive(),
  unit: z.string().default("per gram"),
  thcPercent: z.number().nullable().optional(),
  cbdPercent: z.number().nullable().optional(),
  strainType: z.enum(["SATIVA", "INDICA", "HYBRID"]).nullable().optional(),
  effectSpectrum: z.number().int().min(1).max(10).nullable().optional(),
  stock: z.number().int().min(0).default(0),
});

router.get("/:id", async (req: Request, res: Response) => {
  try {
    const product = await prisma.product.findUnique({
      where: { id: req.params.id },
      include: { dispensary: { select: { name: true, slug: true } } },
    });
    if (!product) return res.status(404).json({ error: "Not found" });
    res.json(product);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.post("/", authenticate, requireRole("DISPENSARY"), async (req: Request, res: Response) => {
  try {
    const parsed = productSchema.parse(req.body);
    // Verify ownership
    const disp = await prisma.dispensary.findUnique({ where: { id: parsed.dispensaryId } });
    if (!disp || disp.userId !== req.user!.id) return res.status(403).json({ error: "Not your dispensary" });

    const slug = parsed.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    const product = await prisma.product.create({ data: { ...parsed, slug, price: parsed.price, thcPercent: parsed.thcPercent, cbdPercent: parsed.cbdPercent } });
    res.status(201).json(product);
  } catch (err: any) { res.status(400).json({ error: err.message }); }
});

router.put("/:id", authenticate, requireRole("DISPENSARY"), async (req: Request, res: Response) => {
  try {
    const product = await prisma.product.findUnique({ where: { id: req.params.id }, include: { dispensary: true } });
    if (!product || product.dispensary.userId !== req.user!.id) return res.status(403).json({ error: "Forbidden" });
    const updated = await prisma.product.update({ where: { id: req.params.id }, data: req.body });
    res.json(updated);
  } catch (err: any) { res.status(400).json({ error: err.message }); }
});

router.delete("/:id", authenticate, requireRole("DISPENSARY"), async (req: Request, res: Response) => {
  try {
    const product = await prisma.product.findUnique({ where: { id: req.params.id }, include: { dispensary: true } });
    if (!product || product.dispensary.userId !== req.user!.id) return res.status(403).json({ error: "Forbidden" });
    await prisma.product.delete({ where: { id: req.params.id } });
    res.json({ deleted: true });
  } catch (err: any) { res.status(400).json({ error: err.message }); }
});

// Upload product image
router.post("/:id/image", authenticate, requireRole("DISPENSARY"), upload.single("image"), async (req: Request, res: Response) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file" });
    const product = await prisma.product.findUnique({ where: { id: req.params.id }, include: { dispensary: true } });
    if (!product || product.dispensary.userId !== req.user!.id) return res.status(403).json({ error: "Forbidden" });

    // In production: upload to Cloudinary
    const dataUrl = `data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`;
    const updated = await prisma.product.update({
      where: { id: req.params.id },
      data: { imageUrls: { push: dataUrl } },
    });
    res.json({ imageUrls: updated.imageUrls });
  } catch (err: any) { res.status(400).json({ error: err.message }); }
});

export default router;
