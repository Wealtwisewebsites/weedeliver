import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import authRoutes from "./routes/auth.js";
import dispensaryRoutes from "./routes/dispensaries.js";
import productRoutes from "./routes/products.js";
import orderRoutes from "./routes/orders.js";
import membershipRoutes from "./routes/memberships.js";
import paymentRoutes from "./routes/payments.js";
import trackingRoutes from "./routes/tracking.js";
import adminRoutes from "./routes/admin.js";

const app = express();

// Security headers
app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  next();
});

// CORS — supports multiple origins for dev + production
// Normalize by stripping any trailing slash so env-var typos don't break matching.
const stripSlash = (s: string) => s.replace(/\/+$/, "");
const allowedOrigins = [
  process.env.CLIENT_URL,
  "https://weedeliver-full.vercel.app",
  "http://localhost:5173",
  "http://localhost:3000",
]
  .filter((o): o is string => Boolean(o))
  .map(stripSlash);

app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    const normalized = stripSlash(origin);
    const allowed =
      allowedOrigins.includes(normalized) ||
      // Allow this project's Vercel preview deployments
      /^https:\/\/weedeliver-full-[a-z0-9-]+\.vercel\.app$/.test(normalized);
    if (allowed || process.env.NODE_ENV !== "production") return cb(null, true);
    // Reject without throwing — avoids a 500 on disallowed origins
    return cb(null, false);
  },
  credentials: true,
}));

// Simple rate limiting (per IP, 100 requests per minute)
const rateLimitMap = new Map<string, { count: number; reset: number }>();
app.use((req, res, next) => {
  if (req.path.includes("/webhook")) return next(); // Skip rate limit for webhooks
  const ip = req.ip || req.socket.remoteAddress || "unknown";
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.reset) {
    rateLimitMap.set(ip, { count: 1, reset: now + 60000 });
  } else {
    entry.count++;
    if (entry.count > 100) {
      return res.status(429).json({ error: "Too many requests. Please try again in a minute." });
    }
  }
  next();
});
// Clean up rate limit map every 5 minutes
setInterval(() => { const now = Date.now(); rateLimitMap.forEach((v, k) => { if (now > v.reset) rateLimitMap.delete(k); }); }, 300000);

// Save raw body for webhook HMAC verification BEFORE json parsing consumes the stream
app.use(express.json({
  limit: "10mb",
  verify: (req: any, _res, buf) => {
    if (req.path?.includes("/webhook")) {
      req.rawBody = buf.toString("utf8");
    }
  },
}));
app.use(cookieParser());

// Health check
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString(), env: process.env.NODE_ENV });
});

// API routes
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/dispensaries", dispensaryRoutes);
app.use("/api/v1/products", productRoutes);
app.use("/api/v1/orders", orderRoutes);
app.use("/api/v1/memberships", membershipRoutes);
app.use("/api/v1/payments", paymentRoutes);
app.use("/api/v1/tracking", trackingRoutes);
app.use("/api/v1/admin", adminRoutes);

// Error handler
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ error: "Internal server error" });
});

export default app;
