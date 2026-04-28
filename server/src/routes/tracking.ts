import { Router, Request, Response } from "express";
import prisma from "../prisma.js";
import { authenticate } from "../middleware/auth.js";
import { requireRole } from "../middleware/guards.js";

const router = Router();

// Get tracking for an order
router.get("/:orderId", authenticate, async (req: Request, res: Response) => {
  try {
    const tracking = await prisma.deliveryTracking.findUnique({
      where: { orderId: req.params.orderId },
    });
    if (!tracking) return res.status(404).json({ error: "No tracking data" });
    res.json(tracking);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// Driver pushes GPS location
router.post("/driver/location", authenticate, requireRole("DRIVER"), async (req: Request, res: Response) => {
  try {
    const { lat, lng, orderId } = req.body;
    if (!lat || !lng) return res.status(400).json({ error: "lat and lng required" });

    // Update driver's current location
    await prisma.driver.update({
      where: { userId: req.user!.id },
      data: { currentLat: lat, currentLng: lng },
    });

    // Update tracking if on active delivery
    if (orderId) {
      await prisma.deliveryTracking.upsert({
        where: { orderId },
        update: { currentLat: lat, currentLng: lng },
        create: { orderId, driverId: req.user!.id, currentLat: lat, currentLng: lng },
      });

      // Emit to socket
      const io = req.app.get("io");
      if (io) io.to(`order:${orderId}`).emit("driver_location", { lat, lng });
    }

    res.json({ ok: true });
  } catch (err: any) { res.status(400).json({ error: err.message }); }
});

export default router;
