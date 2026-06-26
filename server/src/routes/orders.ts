import { Router, Request, Response } from "express";
import { authenticate } from "../middleware/auth.js";
import { requireRole, requireAge } from "../middleware/guards.js";
import * as orderService from "../services/orderService.js";
import prisma from "../prisma.js";

const router = Router();

// Place order (customer)
router.post("/", authenticate, requireRole("CUSTOMER"), requireAge, async (req: Request, res: Response) => {
  try {
    const order = await orderService.createOrder(req.user!.id, req.body);
    // Emit to socket room for dispensary notification
    const io = req.app.get("io");
    if (io) {
      io.to(`dispensary:${order.dispensaryId}`).emit("new_order", order);
      io.to("admin").emit("new_order", order);
    }
    res.status(201).json(order);
  } catch (err: any) {
    const status = err.code === "MEMBERSHIP_REQUIRED" ? 403 : 400;
    res.status(status).json({ error: err.message, requiresMembership: err.code === "MEMBERSHIP_REQUIRED", dispensaryId: err.dispensaryId });
  }
});

// Get order by ID
router.get("/:id", authenticate, async (req: Request, res: Response) => {
  try {
    const order = await orderService.getOrder(req.params.id);
    if (!order) return res.status(404).json({ error: "Not found" });
    // Verify access — customer, dispensary owner, assigned driver, or admin
    if (req.user!.role !== "ADMIN" && order.customerId !== req.user!.id && order.driverId !== req.user!.id) {
      return res.status(403).json({ error: "Forbidden" });
    }
    res.json(order);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// Customer's orders
router.get("/mine/list", authenticate, requireRole("CUSTOMER"), async (req: Request, res: Response) => {
  try {
    const orders = await orderService.getCustomerOrders(req.user!.id);
    res.json(orders);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// Dispensary's orders
router.get("/dispensary/:dispensaryId", authenticate, requireRole("DISPENSARY", "ADMIN"), async (req: Request, res: Response) => {
  try {
    const orders = await orderService.getDispensaryOrders(req.params.dispensaryId);
    res.json(orders);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// Available deliveries for drivers
router.get("/driver/available", authenticate, requireRole("DRIVER"), async (req: Request, res: Response) => {
  try {
    const orders = await orderService.getAvailableDeliveries();
    res.json(orders);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// Update order status
router.put("/:id/status", authenticate, async (req: Request, res: Response) => {
  try {
    const { status } = req.body;
    if (!status) return res.status(400).json({ error: "status required" });

    const order = await orderService.updateOrderStatus(req.params.id, status, req.user!.id, req.user!.role);

    // Emit status update via Socket.io
    const io = req.app.get("io");
    if (io) {
      io.to(`order:${order.id}`).emit("order_status", { orderId: order.id, status: order.status });
      io.to(`dispensary:${order.dispensaryId}`).emit("order_update", order);
      if (status === "READY_FOR_PICKUP") io.to("drivers").emit("new_delivery", order);
      io.to("admin").emit("order_update", order);
    }

    res.json(order);
  } catch (err: any) { res.status(400).json({ error: err.message }); }
});

// Accept delivery (driver)
router.post("/:id/accept-delivery", authenticate, requireRole("DRIVER"), async (req: Request, res: Response) => {
  try {
    // Only approved drivers may accept deliveries.
    const driver = await prisma.driver.findUnique({ where: { userId: req.user!.id } });
    if (!driver || driver.status !== "APPROVED") {
      return res.status(403).json({ error: "Your driver application must be approved before you can accept deliveries." });
    }
    const order = await orderService.updateOrderStatus(req.params.id, "DRIVER_ASSIGNED", req.user!.id, "DRIVER");
    const io = req.app.get("io");
    if (io) {
      io.to(`order:${order.id}`).emit("order_status", { orderId: order.id, status: "DRIVER_ASSIGNED", driverName: req.user!.firstName });
      io.to(`dispensary:${order.dispensaryId}`).emit("order_update", order);
    }
    res.json(order);
  } catch (err: any) { res.status(400).json({ error: err.message }); }
});

// Cancel order
router.post("/:id/cancel", authenticate, async (req: Request, res: Response) => {
  try {
    const order = await orderService.updateOrderStatus(req.params.id, "CANCELLED", req.user!.id, req.user!.role);
    const io = req.app.get("io");
    if (io) io.to(`order:${order.id}`).emit("order_status", { orderId: order.id, status: "CANCELLED" });
    res.json(order);
  } catch (err: any) { res.status(400).json({ error: err.message }); }
});

export default router;
