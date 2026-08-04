import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { api, setRefreshToken, clearAuthTokens } from "../lib/api";

const AuthContext = createContext();
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [ageVerified, setAgeVerifiedRaw] = useState(() => localStorage.getItem("wd_age_verified") === "true");
  const setAgeVerified = (v) => { setAgeVerifiedRaw(v); if (v) localStorage.setItem("wd_age_verified", "true"); else localStorage.removeItem("wd_age_verified"); };
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    // Restore the session on load. "Keep me signed in" stores a refresh token, so a missing or
    // expired access token is recoverable — previously we gave up whenever wd_token was absent,
    // which silently signed people out on refresh (and hid the cart icon mid-checkout).
    const hasSession = localStorage.getItem("wd_token") || localStorage.getItem("wd_refresh");
    if (hasSession) {
      api("GET", "/auth/me").then(res => {
        if (res.ok && res.data?.user) setCurrentUser(res.data.user);
        setAuthLoading(false);
      });
    } else {
      setAuthLoading(false);
    }
  }, []);

  const register = useCallback(async (userData) => {
    const res = await api("POST", "/auth/register", userData);
    if (res.ok && res.data) {
      localStorage.setItem("wd_token", res.data.accessToken);
      // Keep new signups signed in — being logged out moments after registering is jarring.
      setRefreshToken(res.data.refreshToken);
      setCurrentUser(res.data.user);
      return { ok: true, user: res.data.user };
    }
    return { ok: false, error: res.data?.error || "Registration failed" };
  }, []);

  // `remember` keeps the user signed in across visits by storing the refresh token locally —
  // needed because the httpOnly refresh cookie is third-party here and Safari/iOS block it.
  const login = useCallback(async (email, password, remember = false) => {
    const res = await api("POST", "/auth/login", { email, password });
    if (res.ok && res.data) {
      localStorage.setItem("wd_token", res.data.accessToken);
      if (remember) setRefreshToken(res.data.refreshToken);
      setCurrentUser(res.data.user);
      return { ok: true, user: res.data.user };
    }
    return { ok: false, error: res.data?.error || "Invalid credentials" };
  }, []);

  const logout = useCallback(async () => {
    await api("POST", "/auth/logout");
    clearAuthTokens();
    setCurrentUser(null);
    setAgeVerified(false);
  }, []);

  return (
    <AuthContext.Provider value={{ currentUser, setCurrentUser, ageVerified, setAgeVerified, authLoading, login, logout, register }}>
      {children}
    </AuthContext.Provider>
  );
}
