// API client for WeeDeliver frontend → backend connection
const API_BASE = import.meta.env.VITE_API_URL || "/api/v1";

let accessToken = localStorage.getItem("wd_token") || null;

const setToken = (token) => {
  accessToken = token;
  if (token) localStorage.setItem("wd_token", token);
  else localStorage.removeItem("wd_token");
};

const getToken = () => accessToken;

const headers = () => {
  const h = { "Content-Type": "application/json" };
  if (accessToken) h["Authorization"] = `Bearer ${accessToken}`;
  return h;
};

const request = async (method, path, body = null) => {
  const opts = { method, headers: headers() };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${API_BASE}${path}`, opts);
  const data = await res.json().catch(() => null);
  if (res.status === 401 && path !== "/auth/refresh") {
    // Try refresh
    const refreshed = await refreshToken();
    if (refreshed) return request(method, path, body);
  }
  return { ok: res.ok, status: res.status, data };
};

const get = (path) => request("GET", path);
const post = (path, body) => request("POST", path, body);
const put = (path, body) => request("PUT", path, body);
const del = (path) => request("DELETE", path);

// Upload file (multipart)
const upload = async (path, file, fieldName = "image") => {
  const form = new FormData();
  form.append(fieldName, file);
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
    body: form,
  });
  const data = await res.json().catch(() => null);
  return { ok: res.ok, status: res.status, data };
};

// ─── AUTH ───
const register = async (userData) => {
  const res = await post("/auth/register", userData);
  if (res.ok && res.data?.accessToken) setToken(res.data.accessToken);
  return res;
};

const login = async (email, password) => {
  const res = await post("/auth/login", { email, password });
  if (res.ok && res.data?.accessToken) setToken(res.data.accessToken);
  return res;
};

const logout = async () => {
  await post("/auth/logout");
  setToken(null);
};

const refreshToken = async () => {
  const res = await post("/auth/refresh");
  if (res.ok && res.data?.accessToken) {
    setToken(res.data.accessToken);
    return true;
  }
  setToken(null);
  return false;
};

const verifyAge = (dateOfBirth) => post("/auth/verify-age", { dateOfBirth });

// ─── DISPENSARIES ───
const getDispensaries = (params = {}) => {
  const qs = new URLSearchParams(params).toString();
  return get(`/dispensaries${qs ? "?" + qs : ""}`);
};
const getDispensary = (slug) => get(`/dispensaries/${slug}`);
const createDispensary = (data) => post("/dispensaries", data);
const updateDispensary = (id, data) => put(`/dispensaries/${id}`, data);
const uploadBanner = (id, file) => upload(`/dispensaries/${id}/banner`, file);
const uploadLogo = (id, file) => upload(`/dispensaries/${id}/logo`, file);
const approveDispensary = (id) => post(`/dispensaries/${id}/approve`);

// ─── PRODUCTS ───
const getProduct = (id) => get(`/products/${id}`);
const createProduct = (data) => post("/products", data);
const updateProduct = (id, data) => put(`/products/${id}`, data);
const deleteProduct = (id) => del(`/products/${id}`);
const uploadProductImage = (id, file) => upload(`/products/${id}/image`, file);

// ─── ORDERS ───
const placeOrder = (data) => post("/orders", data);
const getOrder = (id) => get(`/orders/${id}`);
const getMyOrders = () => get("/orders/mine/list");
const getDispensaryOrders = (dispensaryId) => get(`/orders/dispensary/${dispensaryId}`);
const getAvailableDeliveries = () => get("/orders/driver/available");
const updateOrderStatus = (id, status) => put(`/orders/${id}/status`, { status });
const acceptDelivery = (id) => post(`/orders/${id}/accept-delivery`);
const cancelOrder = (id) => post(`/orders/${id}/cancel`);

// ─── MEMBERSHIPS ───
const getMyMemberships = () => get("/memberships/mine");
const applyMembership = (dispensaryId) => post("/memberships", { dispensaryId });
const approveMembership = (id) => put(`/memberships/${id}/approve`);
const rejectMembership = (id) => put(`/memberships/${id}/reject`);

// ─── PAYMENTS ───
const initiatePayment = (data) => post("/payments/initiate", data);
const verifyYocoPayment = (paymentId, token) => post("/payments/verify/yoco", { paymentId, token });
const verifyPaystackPayment = (reference) => post("/payments/verify/paystack", { reference });
const getPaymentStatus = (orderId) => get(`/payments/status/${orderId}`);
const getPayment = (id) => get(`/payments/${id}`);

// ─── TRACKING ───
const getTracking = (orderId) => get(`/tracking/${orderId}`);
const pushDriverLocation = (data) => post("/tracking/driver/location", data);

// ─── ADMIN ───
const getAdminAnalytics = () => get("/admin/analytics");
const getAdminUsers = (params = {}) => {
  const qs = new URLSearchParams(params).toString();
  return get(`/admin/users${qs ? "?" + qs : ""}`);
};
const getAdminDispensaries = () => get("/admin/dispensaries");
const getAdminTickets = () => get("/admin/tickets");
const updateTicket = (id, data) => put(`/admin/tickets/${id}`, data);

export default {
  setToken, getToken,
  register, login, logout, refreshToken, verifyAge,
  getDispensaries, getDispensary, createDispensary, updateDispensary,
  uploadBanner, uploadLogo, approveDispensary,
  getProduct, createProduct, updateProduct, deleteProduct, uploadProductImage,
  placeOrder, getOrder, getMyOrders, getDispensaryOrders,
  getAvailableDeliveries, updateOrderStatus, acceptDelivery, cancelOrder,
  getMyMemberships, applyMembership, approveMembership, rejectMembership,
  initiatePayment, verifyYocoPayment, verifyPaystackPayment, getPaymentStatus, getPayment,
  getTracking, pushDriverLocation,
  getAdminAnalytics, getAdminUsers, getAdminDispensaries, getAdminTickets, updateTicket,
};
