import { useNavigate } from "react-router-dom";
import { X, Home, LogIn, LogOut, LayoutDashboard, Store, ShoppingBag } from "lucide-react";
import { LOGO_URL } from "../lib/logo";
import { useAuth } from "../context/AuthContext";
import { useUI } from "../context/UIContext";

const DASHBOARD_PATH = {
  CUSTOMER: "/dashboard/customer",
  DISPENSARY: "/dashboard/dispensary",
  DRIVER: "/dashboard/driver",
  ADMIN: "/dashboard/admin",
};

export default function MobileMenu() {
  const nav = useNavigate();
  const { currentUser, logout } = useAuth();
  const { menuOpen, setMenuOpen } = useUI();

  if (!menuOpen) return null;

  const go = (path) => { nav(path); setMenuOpen(false); };
  const handleLogout = async () => { await logout(); go("/"); };

  return (
    <div className="fixed inset-0 z-[60] lg:hidden">
      <div className="absolute inset-0 bg-black/40" onClick={() => setMenuOpen(false)} />
      <div className="absolute inset-y-0 left-0 w-72 bg-white shadow-2xl flex flex-col">
        <div className="p-4 flex justify-between items-center border-b"><div className="flex items-center gap-1.5"><img src={LOGO_URL} alt="" className="h-8" /><span className="text-lg font-black" style={{ fontFamily: "'Outfit', sans-serif" }}><span className="text-green-700">WEE</span><span style={{ background: "linear-gradient(90deg, #15803d 50%, #111827 50%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>D</span><span className="text-gray-900">eliver</span></span></div><button onClick={() => setMenuOpen(false)}><X className="w-5 h-5" /></button></div>
        <div className="p-3 space-y-1">
          <button onClick={() => go("/")} className="flex items-center gap-3 w-full p-3 rounded-xl text-sm font-medium hover:bg-gray-100"><Home className="w-4 h-4 text-gray-400" />Home</button>
          <button onClick={() => go("/browse")} className="flex items-center gap-3 w-full p-3 rounded-xl text-sm font-medium hover:bg-gray-100"><Store className="w-4 h-4 text-gray-400" />Browse Dispensaries</button>
          {currentUser ? <>
            {DASHBOARD_PATH[currentUser.role] && <button onClick={() => go(DASHBOARD_PATH[currentUser.role])} className="flex items-center gap-3 w-full p-3 rounded-xl text-sm font-medium hover:bg-gray-100"><LayoutDashboard className="w-4 h-4 text-gray-400" />My Dashboard</button>}
            {currentUser.role === "CUSTOMER" && <button onClick={() => go("/cart")} className="flex items-center gap-3 w-full p-3 rounded-xl text-sm font-medium hover:bg-gray-100"><ShoppingBag className="w-4 h-4 text-gray-400" />My Cart</button>}
            <button onClick={handleLogout} className="flex items-center gap-3 w-full p-3 rounded-xl text-sm font-medium text-red-600 hover:bg-red-50"><LogOut className="w-4 h-4" />Sign Out</button>
          </> : (
            <button onClick={() => go("/login")} className="flex items-center gap-3 w-full p-3 rounded-xl text-sm font-bold text-white mt-2" style={{ background: "linear-gradient(135deg, #1A7A2E, #2d9a4a)" }}><LogIn className="w-4 h-4" />Sign In / Register</button>
          )}
        </div>
      </div>
    </div>
  );
}
