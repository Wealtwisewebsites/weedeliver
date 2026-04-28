import { Server as HttpServer } from "http";
import { Server } from "socket.io";
import jwt from "jsonwebtoken";

export function setupSocket(httpServer: HttpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: process.env.CLIENT_URL || "http://localhost:5173",
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  // Auth middleware for socket connections
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error("No token"));
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string };
      socket.data.userId = decoded.userId;
      next();
    } catch {
      next(new Error("Invalid token"));
    }
  });

  io.on("connection", (socket) => {
    console.log(`Socket connected: ${socket.data.userId}`);

    // Join rooms based on role/context
    socket.on("join_order", (orderId: string) => {
      socket.join(`order:${orderId}`);
    });

    socket.on("join_dispensary", (dispensaryId: string) => {
      socket.join(`dispensary:${dispensaryId}`);
    });

    socket.on("join_drivers", () => {
      socket.join("drivers");
    });

    socket.on("join_admin", () => {
      socket.join("admin");
    });

    // Driver location updates (every 5 seconds from driver app)
    socket.on("driver_location", (data: { lat: number; lng: number; orderId?: string }) => {
      if (data.orderId) {
        io.to(`order:${data.orderId}`).emit("driver_location", {
          lat: data.lat,
          lng: data.lng,
          driverId: socket.data.userId,
        });
      }
    });

    socket.on("disconnect", () => {
      console.log(`Socket disconnected: ${socket.data.userId}`);
    });
  });

  return io;
}
