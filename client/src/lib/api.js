// In dev: Vite proxies /api → localhost:3000 (vite.config.js)
// In production: VITE_API_URL points to Railway backend (e.g. https://weedeliver-api.up.railway.app)
const API = (import.meta.env.VITE_API_URL ?? "") + "/api/v1";

const authHeaders = () => {
  const t = localStorage.getItem("wd_token");
  return { "Content-Type": "application/json", ...(t ? { Authorization: `Bearer ${t}` } : {}) };
};

const refreshToken = async () => {
  try {
    // credentials:"include" is required to send the httpOnly refresh cookie cross-origin (Vercel ↔ Render).
    const res = await fetch(`${API}/auth/refresh`, { method: "POST", headers: authHeaders(), credentials: "include" });
    const data = await res.json();
    if (data?.accessToken) { localStorage.setItem("wd_token", data.accessToken); return true; }
  } catch {}
  localStorage.removeItem("wd_token");
  return false;
};

export const api = async (method, path, body) => {
  try {
    const opts = { method, headers: authHeaders(), credentials: "include" };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(`${API}${path}`, opts);
    const data = await res.json().catch(() => null);
    if (res.status === 401 && path !== "/auth/refresh") {
      const refreshed = await refreshToken();
      if (refreshed) return api(method, path, body);
    }
    return { ok: res.ok, status: res.status, data };
  } catch (err) {
    return { ok: false, status: 0, data: null, error: err.message };
  }
};