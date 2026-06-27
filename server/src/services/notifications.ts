// Transactional email via Resend (https://resend.com).
// All sends are best-effort and never throw — a failed email must not break signups or orders.
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const EMAIL_FROM = process.env.EMAIL_FROM || "WeeDeliver <onboarding@resend.dev>";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "weedeliver014@gmail.com";
const APP_URL = process.env.CLIENT_URL && /^https?:\/\//.test(process.env.CLIENT_URL.trim())
  ? process.env.CLIENT_URL.trim().replace(/\/+$/, "")
  : "https://weedeliver-full.vercel.app";

const ZAR = (n: number | string) => `R${Number(n || 0).toFixed(2)}`;

// Branded HTML shell.
function wrap(heading: string, bodyHtml: string, cta?: { label: string; url: string }): string {
  return `
  <div style="margin:0;padding:24px;background:#f3f4f6;font-family:'Segoe UI',Arial,sans-serif;">
    <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #e5e7eb;">
      <div style="background:linear-gradient(135deg,#0a2e12,#1A7A2E);padding:24px 28px;">
        <span style="color:#fff;font-size:22px;font-weight:800;letter-spacing:-0.5px;">WEE<span style="color:#4ade80;">D</span>eliver</span>
      </div>
      <div style="padding:28px;">
        <h1 style="margin:0 0 12px;font-size:20px;color:#111827;">${heading}</h1>
        <div style="font-size:14px;line-height:1.6;color:#374151;">${bodyHtml}</div>
        ${cta ? `<a href="${cta.url}" style="display:inline-block;margin-top:20px;background:#1A7A2E;color:#fff;text-decoration:none;font-weight:700;font-size:14px;padding:11px 22px;border-radius:9999px;">${cta.label}</a>` : ""}
      </div>
      <div style="padding:16px 28px;border-top:1px solid #f3f4f6;color:#9ca3af;font-size:11px;">
        WeeDeliver — South Africa's cannabis delivery platform. For adults 18+ only.
      </div>
    </div>
  </div>`;
}

async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  if (!RESEND_API_KEY) { console.warn("[email] RESEND_API_KEY not set — skipped:", subject); return; }
  if (!to) return;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: EMAIL_FROM, to: [to], subject, html }),
    });
    if (!res.ok) console.error("[email] failed", res.status, (await res.text().catch(() => "")).slice(0, 200));
  } catch (err) {
    console.error("[email] error", err);
  }
}

const KIND_LABEL: Record<string, string> = { dispensary: "dispensary", driver: "driver" };

// ─── Public helpers (fire-and-forget from route handlers) ───

export function notifyCustomerWelcome(to: string, firstName: string) {
  return sendEmail(to, "Welcome to WeeDeliver 🌿",
    wrap(`Welcome, ${firstName || "there"}!`,
      `Thanks for signing up to WeeDeliver. You're all set to browse verified dispensaries and get premium cannabis delivered to your door.`,
      { label: "Start browsing", url: `${APP_URL}/browse` }));
}

export function notifyApplicationReceived(to: string, firstName: string, kind: "dispensary" | "driver") {
  const k = KIND_LABEL[kind];
  return sendEmail(to, `We've received your ${k} application`,
    wrap(`Thanks, ${firstName || "there"}!`,
      `We've received your application to join WeeDeliver as a ${k}. Our team is reviewing it now — you'll get an email the moment a decision is made. ${kind === "dispensary" ? "In the meantime you can finish setting up your storefront and products." : ""}`));
}

export function notifyApproved(to: string, firstName: string, kind: "dispensary" | "driver") {
  const isDisp = kind === "dispensary";
  return sendEmail(to, `You're approved on WeeDeliver! 🎉`,
    wrap(`You're approved, ${firstName || "there"}!`,
      isDisp
        ? `Great news — your dispensary has been approved and is now live on WeeDeliver. Customers can find you and place orders right away.`
        : `Great news — your driver application has been approved. You can now go online and start accepting deliveries.`,
      { label: isDisp ? "Open your dashboard" : "Start delivering", url: `${APP_URL}/login` }));
}

export function notifyAdminNewApplication(kind: "dispensary" | "driver", name: string, email: string, extra = "") {
  const k = KIND_LABEL[kind];
  return sendEmail(ADMIN_EMAIL, `New ${k} application: ${name}`,
    wrap(`New ${k} application`,
      `<b>${name}</b> (${email}) has applied to join as a ${k}.${extra ? `<br/>${extra}` : ""}<br/><br/>Review their application in the admin dashboard.`,
      { label: "Review now", url: `${APP_URL}/dashboard/admin` }));
}

interface OrderEmailData {
  id: string;
  total: number | string;
  deliveryAddress: string;
  items: { productName: string; quantity: number }[];
}

export function notifyOrderCustomer(to: string, firstName: string, dispensaryName: string, order: OrderEmailData) {
  const lines = order.items.map(i => `${i.quantity}× ${i.productName}`).join("<br/>");
  return sendEmail(to, `Order placed — #${order.id.slice(0, 8).toUpperCase()}`,
    wrap(`Order confirmed, ${firstName || "there"}!`,
      `Your order from <b>${dispensaryName}</b> has been placed.<br/><br/>
       <b>Items</b><br/>${lines}<br/><br/>
       <b>Total:</b> ${ZAR(order.total)}<br/>
       <b>Delivering to:</b> ${order.deliveryAddress}<br/><br/>
       We'll keep you posted as the dispensary prepares your order and a driver is assigned.`,
      { label: "Track your order", url: `${APP_URL}/order/${order.id}` }));
}

export function notifyOrderDispensary(to: string, dispensaryName: string, customerName: string, order: OrderEmailData) {
  const lines = order.items.map(i => `${i.quantity}× ${i.productName}`).join("<br/>");
  return sendEmail(to, `New order to fulfil — #${order.id.slice(0, 8).toUpperCase()}`,
    wrap(`New order for ${dispensaryName} 🛎️`,
      `You've received a new order from <b>${customerName}</b>.<br/><br/>
       <b>Items</b><br/>${lines}<br/><br/>
       <b>Total:</b> ${ZAR(order.total)}<br/>
       <b>Deliver to:</b> ${order.deliveryAddress}<br/><br/>
       Open your dashboard to accept and prepare it.`,
      { label: "Open dashboard", url: `${APP_URL}/dashboard/dispensary` }));
}
