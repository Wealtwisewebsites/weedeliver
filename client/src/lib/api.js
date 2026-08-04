// In dev: Vite proxies /api → localhost:3000 (vite.config.js)
// In production: VITE_API_URL points to Railway backend (e.g. https://weedeliver-api.up.railway.app)
const API = (import.meta.env.VITE_API_URL ?? "") + "/api/v1";

const authHeaders = () => {
  const t = localStorage.getItem("wd_token");
  return { "Content-Type": "application/json", ...(t ? { Authorization: `Bearer ${t}` } : {}) };
};

// "Remember me" persistence. The SPA (Vercel) and API (Render) are different sites, so the
// httpOnly refresh cookie is a third-party cookie — Safari/iOS block it outright, which logged
// users out every ~15 minutes. When the user opts in we also keep the refresh token here and
// send it in the body as a fallback.
export const setRefreshToken = (token) => {
  if (token) localStorage.setItem("wd_refresh", token);
};
export const clearAuthTokens = () => {
  localStorage.removeItem("wd_token");
  localStorage.removeItem("wd_refresh");
};

const refreshToken = async () => {
  try {
    const stored = localStorage.getItem("wd_refresh");
    // credentials:"include" sends the httpOnly cookie where the browser allows it; the body
    // carries the stored token for browsers that block third-party cookies.
    const res = await fetch(`${API}/auth/refresh`, {
      method: "POST",
      headers: authHeaders(),
      credentials: "include",
      body: JSON.stringify({ refreshToken: stored || undefined }),
    });
    const data = await res.json();
    if (data?.accessToken) {
      localStorage.setItem("wd_token", data.accessToken);
      // Rotated refresh token — only keep it if the user opted into staying signed in.
      if (data.refreshToken && stored) localStorage.setItem("wd_refresh", data.refreshToken);
      return true;
    }
  } catch {}
  clearAuthTokens();
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