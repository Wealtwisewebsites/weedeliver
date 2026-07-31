// End-to-end smoke test against the LIVE deployment.
// Exercises the full multi-role lifecycle: admin, dispensary, product, customer,
// membership, order, and the driver delivery flow. Run: node e2eLive.mjs
const BASE = process.env.E2E_BASE || "https://weedeliver.onrender.com/api/v1";
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL || "weedeliver014@gmail.com";
const ADMIN_PASS = process.env.E2E_ADMIN_PASS || "Werichcuz7$";
const ts = Date.now();

let pass = 0, fail = 0;
const log = (ok, label, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? "  — " + detail : ""}`);
  ok ? pass++ : fail++;
};

async function call(method, path, { token, body } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  let data = null;
  try { data = await res.json(); } catch {}
  return { status: res.status, ok: res.ok, data };
}

async function main() {
  console.log(`\n=== WeeDeliver live E2E — ${BASE} ===\n`);

  // 1. Admin login
  let r = await call("POST", "/auth/login", { body: { email: ADMIN_EMAIL, password: ADMIN_PASS } });
  log(r.ok && r.data?.user?.role === "ADMIN", "Admin login", r.data?.user?.role || JSON.stringify(r.data));
  const adminToken = r.data?.accessToken;

  // 2. Register dispensary owner
  r = await call("POST", "/auth/register", { body: { email: `disp.${ts}@e2e.test`, password: "test1234", firstName: "Test", lastName: "Dispensary", role: "DISPENSARY" } });
  log(r.ok && r.data?.user?.role === "DISPENSARY", "Register dispensary account", r.data?.user?.email);
  const dispToken = r.data?.accessToken;

  // 3. Create dispensary
  r = await call("POST", "/dispensaries", { token: dispToken, body: { name: `E2E Greens ${ts}`, address: "1 Test St", city: "Cape Town", province: "Western Cape", deliveryFee: 25, minimumOrder: 0 } });
  log(r.ok && r.data?.id, "Create dispensary", r.data?.slug);
  const dispensaryId = r.data?.id;

  // 3b. Admin approves the dispensary (required before it can take orders)
  r = await call("POST", `/dispensaries/${dispensaryId}/approve`, { token: adminToken });
  log(r.ok, "Admin approves dispensary");

  // 4. Add a product
  r = await call("POST", "/products", { token: dispToken, body: { dispensaryId, name: `Test OG ${ts}`, category: "INDOOR_FLOWER", price: 120, unit: "per gram", strainType: "HYBRID", stock: 100 } });
  log(r.ok && r.data?.id, "Dispensary adds product", r.data?.name);
  const productId = r.data?.id;

  // 5. Register customer
  r = await call("POST", "/auth/register", { body: { email: `cust.${ts}@e2e.test`, password: "test1234", firstName: "Test", lastName: "Customer" } });
  log(r.ok && r.data?.user?.role === "CUSTOMER", "Register customer account", r.data?.user?.email);
  const custToken = r.data?.accessToken;

  // 6. Age verification
  r = await call("POST", "/auth/verify-age", { token: custToken, body: { dateOfBirth: "1990-01-01" } });
  log(r.ok && r.data?.verified, "Customer age verification", `age ${r.data?.age}`);

  // 7. Join membership (FREE -> auto ACTIVE)
  r = await call("POST", "/memberships", { token: custToken, body: { dispensaryId } });
  log(r.ok && r.data?.status === "ACTIVE", "Customer joins membership", r.data?.status);

  // 8. Place order
  r = await call("POST", "/orders", { token: custToken, body: { dispensaryId, deliveryAddress: "42 Buyer Rd, Cape Town", items: [{ productId, quantity: 2 }] } });
  log(r.ok && r.data?.id && r.data?.status === "PENDING", "Customer places order", `status ${r.data?.status}, total R${r.data?.total}`);
  const orderId = r.data?.id;

  // 9. Dispensary advances order: CONFIRMED -> PREPARING -> READY_FOR_PICKUP
  for (const status of ["CONFIRMED", "PREPARING", "READY_FOR_PICKUP"]) {
    r = await call("PUT", `/orders/${orderId}/status`, { token: dispToken, body: { status } });
    log(r.ok && r.data?.status === status, `Dispensary -> ${status}`, r.data?.status || JSON.stringify(r.data));
  }

  // 10. Register driver, then apply + get admin approval (required to accept deliveries)
  r = await call("POST", "/auth/register", { body: { email: `driver.${ts}@e2e.test`, password: "test1234", firstName: "Test", lastName: "Driver", role: "DRIVER" } });
  log(r.ok && r.data?.user?.role === "DRIVER", "Register driver account", r.data?.user?.email);
  const driverToken = r.data?.accessToken;
  const driverUserId = r.data?.user?.id;
  await call("POST", "/drivers/apply", { token: driverToken, body: { vehicleType: "car", vehicleMake: "Toyota" } });
  r = await call("POST", `/admin/drivers/${driverUserId}/approve`, { token: adminToken });
  log(r.ok, "Admin approves driver");

  // 11. Driver sees available delivery
  r = await call("GET", "/orders/driver/available", { token: driverToken });
  const sees = Array.isArray(r.data) && r.data.some(o => o.id === orderId);
  log(r.ok && sees, "Driver sees available delivery", `${Array.isArray(r.data) ? r.data.length : 0} available`);

  // 12. Driver accepts delivery
  r = await call("POST", `/orders/${orderId}/accept-delivery`, { token: driverToken });
  log(r.ok && r.data?.status === "DRIVER_ASSIGNED", "Driver accepts delivery", r.data?.status);

  // 13. Driver advances: IN_TRANSIT -> DELIVERED
  for (const status of ["IN_TRANSIT", "DELIVERED"]) {
    r = await call("PUT", `/orders/${orderId}/status`, { token: driverToken, body: { status } });
    log(r.ok && r.data?.status === status, `Driver -> ${status}`, r.data?.status || JSON.stringify(r.data));
  }

  // 14. Admin capabilities
  r = await call("GET", "/admin/analytics", { token: adminToken });
  log(r.ok && r.data?.totalOrders >= 1, "Admin analytics", `orders ${r.data?.totalOrders}, revenue R${r.data?.totalRevenue?._sum?.total ?? r.data?.totalRevenue ?? "?"}`);

  r = await call("GET", "/admin/users", { token: adminToken });
  log(r.ok && r.data?.total >= 4, "Admin lists users", `${r.data?.total} users`);

  r = await call("GET", "/admin/dispensaries", { token: adminToken });
  log(r.ok && Array.isArray(r.data) && r.data.length >= 1, "Admin lists dispensaries", `${Array.isArray(r.data) ? r.data.length : 0}`);

  // 15. Verify customer can read their delivered order
  r = await call("GET", `/orders/${orderId}`, { token: custToken });
  log(r.ok && r.data?.status === "DELIVERED", "Customer reads final order", r.data?.status);

  console.log(`\n=== RESULT: ${pass} passed, ${fail} failed ===\n`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch(e => { console.error("FATAL:", e); process.exit(1); });
