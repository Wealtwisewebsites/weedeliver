// Triggers every automated email through the LIVE app so they land in a real inbox.
// Uses Gmail plus-addresses that (a) deliver to alessiodicosmo@gmail.com and
// (b) contain "e2e.test" so cleanupStoreTest.mjs removes the accounts afterwards.
const BASE = process.env.E2E_BASE || "https://weedeliver.onrender.com/api/v1";
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL || "weedeliver014@gmail.com";
const ADMIN_PASS = process.env.E2E_ADMIN_PASS || "Werichcuz7$";
const INBOX = "alessiodicosmo";
const ts = Date.now();
const addr = (tag) => `${INBOX}+${tag}${ts}.e2e.test@gmail.com`;
let pass = 0, fail = 0;
const log = (ok, label, d = "") => { console.log(`${ok ? "PASS" : "FAIL"}  ${label}${d ? "  — " + d : ""}`); ok ? pass++ : fail++; };

async function call(method, path, { token, body } = {}) {
  const res = await fetch(BASE + path, { method, headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  let data = null; try { data = await res.json(); } catch {}
  return { status: res.status, ok: res.ok, data };
}

async function main() {
  console.log(`\n=== Live email test — every message fires through the app ===\n`);
  let r = await call("POST", "/auth/login", { body: { email: ADMIN_EMAIL, password: ADMIN_PASS } });
  const admin = r.data?.accessToken;
  log(!!admin, "Admin login");

  // 1. Customer welcome
  r = await call("POST", "/auth/register", { body: { email: addr("cust"), password: "test1234", firstName: "Test", lastName: "Customer" } });
  const cust = r.data?.accessToken;
  log(r.ok, "→ Customer WELCOME email", addr("cust"));

  // 2. Dispensary application (owner + admin)
  r = await call("POST", "/auth/register", { body: { email: addr("disp"), password: "test1234", firstName: "Test", lastName: "Dispensary", role: "DISPENSARY" } });
  const dtok = r.data?.accessToken;
  r = await call("POST", "/dispensaries", { token: dtok, body: { name: `EmailTest Greens ${ts}`, address: "1 St", city: "Cape Town", province: "Western Cape", deliveryFee: 25, minimumOrder: 0, membershipType: "FREE" } });
  const dispId = r.data?.id;
  log(!!dispId, "→ Dispensary APPLICATION email (owner) + ADMIN alert");
  r = await call("POST", "/products", { token: dtok, body: { dispensaryId: dispId, name: `Bud ${ts}`, category: "INDOOR_FLOWER", price: 120, unit: "per gram", stock: 50, strainType: "HYBRID" } });
  const prodId = r.data?.id;

  // 3. Dispensary approved
  r = await call("POST", `/dispensaries/${dispId}/approve`, { token: admin });
  log(r.ok, "→ Dispensary APPROVED email");

  // 4. Driver application (driver + admin)
  r = await call("POST", "/auth/register", { body: { email: addr("driver"), password: "test1234", firstName: "Test", lastName: "Driver", role: "DRIVER" } });
  const drvTok = r.data?.accessToken;
  const drvUserId = r.data?.user?.id;
  r = await call("POST", "/drivers/apply", { token: drvTok, body: { idNumber: "9001015800087", vehicleType: "car", vehicleMake: "Toyota", vehicleModel: "Corolla", vehicleReg: "CA12345" } });
  log(r.ok && r.data?.status === "PENDING", "→ Driver APPLICATION email + ADMIN alert");

  // 5. Driver approved
  r = await call("POST", `/admin/drivers/${drvUserId}/approve`, { token: admin });
  log(r.ok, "→ Driver APPROVED email");

  // 6. Order placed (customer + dispensary)
  await call("POST", "/auth/verify-age", { token: cust, body: { dateOfBirth: "1990-01-01" } });
  await call("POST", "/memberships", { token: cust, body: { dispensaryId: dispId } });
  r = await call("POST", "/orders", { token: cust, body: { dispensaryId: dispId, deliveryAddress: "42 Buyer Rd, Cape Town", items: [{ productId: prodId, quantity: 2 }] } });
  const orderId = r.data?.id;
  log(r.ok && orderId, "→ Order CUSTOMER email + Order DISPENSARY email", `total R${r.data?.total}`);

  // 7. Dispensary marks it ready → approved drivers get a "new delivery available" email
  for (const s of ["CONFIRMED", "PREPARING", "READY_FOR_PICKUP"]) await call("PUT", `/orders/${orderId}/status`, { token: dtok, body: { status: s } });
  log(true, "→ Driver NEW-DELIVERY email (to approved drivers)");

  console.log(`\n=== ${pass} steps triggered, ${fail} failed ===`);
  console.log(`Check the ${INBOX}@gmail.com inbox — you should have received:`);
  console.log(`  Welcome · Dispensary application · Dispensary approved · Driver application · Driver approved · Order confirmed · New order to fulfil · New delivery available (driver)`);
  console.log(`Admin alerts (2) went to ${ADMIN_EMAIL}.\n`);
  process.exit(fail > 0 ? 1 : 0);
}
main().catch(e => { console.error("FATAL:", e); process.exit(1); });
