import { useNavigate } from "react-router-dom";
import { ShoppingCart, Menu, LogOut } from "lucide-react";
import { LOGO_URL } from "../lib/logo";
import { useAuth } from "../context/AuthContext";
import { useCart } from "../context/CartContext";
import { useUI } from "../context/UIContext";

export default function Navbar() {
  const nav = useNavigate();
  const { currentUser, logout } = useAuth();
  const { cart } = useCart();
  const { setMenuOpen } = useUI();

  const handleLogout = async () => { await logout(); nav("/"); };

  return (
    <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-gray-200/50">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 h-11 sm:h-12 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <button onClick={() => setMenuOpen(true)} className="lg:hidden p-1.5 -ml-1 rounded-lg hover:bg-gray-100"><Menu className="w-5 h-5" /></button>
          <button onClick={() => nav("/")} className="flex items-center gap-1"><img src={LOGO_URL} alt="WeeDeliver" className="h-7 sm:h-9 object-contain" /><span className="text-sm sm:text-base font-black tracking-tight" style={{ fontFamily: "'Outfit', sans-serif" }}><span className="text-green-700">WEE</span><span style={{ background: "linear-gradient(90deg, #15803d 50%, #111827 50%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>D</span><span className="text-gray-900">eliver</span></span></button>
        </div>
        <div className="flex items-center gap-1.5">
          {currentUser && <button onClick={() => nav("/cart")} className="relative p-2 rounded-lg hover:bg-gray-100"><ShoppingCart className="w-4.5 h-4.5 text-gray-700" />{cart.length > 0 && <span className="absolute -top-0.5 -right-0.5 w-4.5 h-4.5 bg-green-600 text-white text-[10px] rounded-full flex items-center justify-center font-bold">{cart.reduce((s, i) => s + i.quantity, 0)}</span>}</button>}
          {currentUser ? <button onClick={handleLogout} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500"><LogOut className="w-4 h-4" /></button> : <button onClick={() => nav("/login")} className="px-4 py-1.5 rounded-full text-sm font-bold text-white" style={{ background: "linear-gradient(135deg, #1A7A2E, #2d9a4a)" }}>Sign In</button>}
        </div>
      </div>
    </nav>
  );
}
