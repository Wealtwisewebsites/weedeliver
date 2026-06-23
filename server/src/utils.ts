import crypto from "crypto";

// ─── TIMEZONE HELPERS ───
// Using Intl API (no external dependency needed) for SA timezone

const DAY_MAP: Record<number, string> = {
  0: "sun", 1: "mon", 2: "tue", 3: "wed", 4: "thu", 5: "fri", 6: "sat",
};

/**
 * Check if a dispensary is currently open based on operatingHours JSON.
 * operatingHours format: { "mon": { "open": "08:00", "close": "22:00", "isOpen": true }, ... }
 */
export function isDispensaryOpen(
  operatingHours: any,
  timezone: string = "Africa/Johannesburg"
): boolean {
  if (!operatingHours) return true; // Default open if no hours set
  // Handle string storage (SQLite) by parsing JSON
  if (typeof operatingHours === "string") {
    try { operatingHours = JSON.parse(operatingHours); } catch { return true; }
  }
  if (typeof operatingHours !== "object") return true;

  const now = new Date();
  // Get current time in SA timezone
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const parts = formatter.formatToParts(now);
  const weekdayPart = parts.find(p => p.type === "weekday")?.value?.toLowerCase() || "";
  const hourPart = parts.find(p => p.type === "hour")?.value || "0";
  const minutePart = parts.find(p => p.type === "minute")?.value || "0";

  // Map weekday name to short key
  const dayKeyMap: Record<string, string> = {
    sun: "sun", mon: "mon", tue: "tue", wed: "wed", thu: "thu", fri: "fri", sat: "sat",
  };
  const dayKey = dayKeyMap[weekdayPart.slice(0, 3).toLowerCase()];
  if (!dayKey) return true;

  const todayHours = operatingHours[dayKey];
  if (!todayHours || todayHours.isOpen === false) return false;

  const currentMinutes = parseInt(hourPart) * 60 + parseInt(minutePart);
  const [openH, openM] = (todayHours.open || "00:00").split(":").map(Number);
  const [closeH, closeM] = (todayHours.close || "23:59").split(":").map(Number);
  const openMinutes = openH * 60 + openM;
  const closeMinutes = closeH * 60 + closeM;

  // Handle overnight hours (e.g., open 20:00, close 04:00)
  if (closeMinutes < openMinutes) {
    return currentMinutes >= openMinutes || currentMinutes <= closeMinutes;
  }

  return currentMinutes >= openMinutes && currentMinutes <= closeMinutes;
}

// ─── HAVERSINE DISTANCE ───
/**
 * Calculate distance between two lat/lng points in kilometers.
 */
export function haversineDistance(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number {
  const R = 6371; // Earth radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─── AES-256 ENCRYPTION FOR BANKING ───
// SECURITY: No fallback — if ENCRYPTION_KEY is missing, crash at startup rather than encrypt with a public key
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;
if (!ENCRYPTION_KEY || ENCRYPTION_KEY.length !== 32) {
  console.warn("[SECURITY] ENCRYPTION_KEY missing or wrong length (need 32 chars). Banking encryption will fail.");
}
const IV_LENGTH = 16;

export function encrypt(text: string): string {
  if (!ENCRYPTION_KEY) throw new Error("ENCRYPTION_KEY not configured");
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv("aes-256-cbc", Buffer.from(ENCRYPTION_KEY, "utf-8"), iv);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  return iv.toString("hex") + ":" + encrypted;
}

export function decrypt(text: string): string {
  if (!ENCRYPTION_KEY) throw new Error("ENCRYPTION_KEY not configured");
  const [ivHex, encryptedHex] = text.split(":");
  if (!ivHex || !encryptedHex) return text;
  const iv = Buffer.from(ivHex, "hex");
  const decipher = crypto.createDecipheriv("aes-256-cbc", Buffer.from(ENCRYPTION_KEY, "utf-8"), iv);
  let decrypted = decipher.update(encryptedHex, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

export function maskAccountNumber(encrypted: string): string {
  try {
    const full = decrypt(encrypted);
    return "****" + full.slice(-4);
  } catch {
    return "****";
  }
}

// ─── YOCO SIGNATURE VERIFICATION ───
export function verifyYocoSignature(payload: string, signature: string, secret: string): boolean {
  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(payload);
  const expected = hmac.digest("hex");
  // timingSafeEqual requires equal-length buffers — return false if lengths differ
  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length) return false;
  return crypto.timingSafeEqual(sigBuf, expBuf);
}

// ─── PAYSTACK SIGNATURE VERIFICATION ───
export function verifyPaystackSignature(payload: string, signature: string, secret: string): boolean {
  const hmac = crypto.createHmac("sha512", secret);
  hmac.update(payload);
  const expected = hmac.digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}
