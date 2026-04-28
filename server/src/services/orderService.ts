import prisma from "../prisma.js";
import { z } from "zod";
import { isDispensaryOpen } from "../utils.js";

const createOrderSchema = z.object({
  dispensaryId: z.string().uuid(),
  deliveryAddress: z.string().min(1),
  deliveryLat: z.number().optional(),
  deliveryLng: z.number().optional(),
  specialInstructions: z.string().optional(),
  items: z.array(z.object({
    productId: z.string().uuid(),
    quantity: z.number().int().min(1),
  })).min(1),
});

// Allowed status transitions
const TRANSITIONS: Record<string, string[]> = {
  PENDING: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["PREPARING", "CANCELLED"],
  PREPARING: ["READY_FOR_PICKUP", "CANCELLED"],
  READY_FOR_PICKUP: ["DRIVER_ASSIGNED", "CANCELLED"],
  DRIVER_ASSIGNED: ["IN_TRANSIT", "CANCELLED"],
  IN_TRANSIT: ["DELIVERED", "CANCELLED"],
};

export async function createOrder(customerId: string, data: unknown) {
  const parsed = createOrderSchema.parse(data);

  // Verify membership
  const membership = await prisma.membership.findUnique({
    where: { userId_dispensaryId: { userId: customerId, dispensaryId: parsed.dispensaryId } },
  });
  if (!membership || membership.status !== "ACTIVE") {
    throw Object.assign(new Error("Active membership required"), { code: "MEMBERSHIP_REQUIRED", dispensaryId: parsed.dispensaryId });
  }

  // Verify dispensary is active and approved
  const dispensary = await prisma.dispensary.findUnique({ where: { id: parsed.dispensaryId } });
  if (!dispensary || !dispensary.isApproved || !dispensary.isActive) {
    throw new Error("Dispensary not available");
  }

  // Check trading hours — dispensary must be open
  if (!isDispensaryOpen(dispensary.operatingHours)) {
    throw new Error("This dispensary is currently closed and not accepting orders.");
  }

  // Fetch products and calculate totals
  const productIds = parsed.items.map(i => i.productId);
  const products = await prisma.product.findMany({
    where: { id: { in: productIds }, dispensaryId: parsed.dispensaryId, isActive: true },
  });

  if (products.length !== productIds.length) throw new Error("Some products not found or inactive");

  const itemsWithPrices = parsed.items.map(item => {
    const product = products.find(p => p.id === item.productId)!;
    if (product.stock < item.quantity) throw new Error(`${product.name} — insufficient stock`);
    return { productId: item.productId, quantity: item.quantity, unitPrice: product.price, productName: product.name };
  });

  const subtotal = itemsWithPrices.reduce((sum, i) => sum + Number(i.unitPrice) * i.quantity, 0);
  const deliveryFee = Number(dispensary.deliveryFee);
  const total = subtotal + deliveryFee;

  if (subtotal < Number(dispensary.minimumOrder)) {
    throw new Error(`Minimum order is R${dispensary.minimumOrder}`);
  }

  // Create order + items in transaction
  const order = await prisma.$transaction(async (tx) => {
    const newOrder = await tx.order.create({
      data: {
        customerId,
        dispensaryId: parsed.dispensaryId,
        membershipId: membership.id,
        status: "PENDING",
        deliveryAddress: parsed.deliveryAddress,
        deliveryLat: parsed.deliveryLat,
        deliveryLng: parsed.deliveryLng,
        subtotal,
        deliveryFee,
        total,
        specialInstructions: parsed.specialInstructions,
        items: {
          create: itemsWithPrices.map(i => ({
            productId: i.productId,
            quantity: i.quantity,
            unitPrice: i.unitPrice,
            productName: i.productName,
          })),
        },
      },
      include: { items: true, dispensary: { select: { name: true } }, customer: { select: { firstName: true, lastName: true } } },
    });

    // Reduce stock
    for (const item of itemsWithPrices) {
      await tx.product.update({
        where: { id: item.productId },
        data: { stock: { decrement: item.quantity } },
      });
    }

    return newOrder;
  });

  return order;
}

export async function updateOrderStatus(orderId: string, newStatus: string, userId: string, userRole: string, driverName?: string) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) throw new Error("Order not found");

  const allowed = TRANSITIONS[order.status];
  if (!allowed || !allowed.includes(newStatus)) {
    throw new Error(`Cannot transition from ${order.status} to ${newStatus}`);
  }

  // Role-based permission checks
  if (newStatus === "CONFIRMED" || newStatus === "PREPARING" || newStatus === "READY_FOR_PICKUP") {
    if (userRole !== "DISPENSARY" && userRole !== "ADMIN") throw new Error("Only dispensary can update to this status");
  }
  if (newStatus === "DRIVER_ASSIGNED" || newStatus === "IN_TRANSIT" || newStatus === "DELIVERED") {
    if (userRole !== "DRIVER" && userRole !== "ADMIN") throw new Error("Only driver can update to this status");
  }

  // Build timestamp field
  const timestamps: Record<string, Date> = {};
  const tsMap: Record<string, string> = {
    CONFIRMED: "confirmedAt", PREPARING: "preparingAt", READY_FOR_PICKUP: "readyAt",
    DRIVER_ASSIGNED: "driverAssignedAt", IN_TRANSIT: "inTransitAt",
    DELIVERED: "deliveredAt", CANCELLED: "cancelledAt",
  };
  if (tsMap[newStatus]) timestamps[tsMap[newStatus]] = new Date();

  const updateData: any = { status: newStatus, ...timestamps };

  // Assign driver on DRIVER_ASSIGNED
  if (newStatus === "DRIVER_ASSIGNED") {
    updateData.driverId = userId;
  }

  const updated = await prisma.order.update({
    where: { id: orderId },
    data: updateData,
    include: {
      items: true,
      dispensary: { select: { id: true, name: true } },
      customer: { select: { id: true, firstName: true, lastName: true } },
    },
  });

  // Update driver stats on delivery
  if (newStatus === "DELIVERED" && order.driverId) {
    await prisma.driver.update({
      where: { userId: order.driverId },
      data: { totalDeliveries: { increment: 1 }, totalEarnings: { increment: Number(order.deliveryFee) } },
    });
  }

  return updated;
}

export async function getOrder(orderId: string) {
  return prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items: true,
      dispensary: { select: { id: true, name: true, slug: true, logoUrl: true } },
      customer: { select: { id: true, firstName: true, lastName: true } },
      tracking: true,
    },
  });
}

export async function getCustomerOrders(customerId: string) {
  return prisma.order.findMany({
    where: { customerId },
    include: { items: true, dispensary: { select: { name: true, slug: true } } },
    orderBy: { createdAt: "desc" },
  });
}

export async function getDispensaryOrders(dispensaryId: string) {
  return prisma.order.findMany({
    where: { dispensaryId },
    include: { items: true, customer: { select: { firstName: true, lastName: true } } },
    orderBy: { createdAt: "desc" },
  });
}

export async function getAvailableDeliveries() {
  return prisma.order.findMany({
    where: { status: "READY_FOR_PICKUP" },
    include: {
      items: true,
      dispensary: { select: { name: true, address: true, lat: true, lng: true } },
    },
    orderBy: { createdAt: "asc" },
  });
}
