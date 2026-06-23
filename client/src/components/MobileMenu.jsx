import { useNavigate } from "react-router-dom";
import { X, Home } from "lucide-react";
import { LOGO_URL } from "../lib/logo";
import { useAuth } from "../context/AuthContext";
import { useUI } from "../context/UIContext";

export default function MobileMenu() {
  const nav = useNavigate();
  const { currentUser, switchRole } = useAuth();
  const { menuOpen, setMenuOpen } = useUI();

  if (!menuOpen) return null;

  const go = (path) => { nav(path); setMenuOpen(false); };

  return (
    <div className="fixed inset-0 z-[60] lg:hidden">
      <div className="absolute inset-0 bg-black/40" onClick={() => setMenuOpen(false)} />
      <div className="absolute inset-y-0 left-0 w-72 bg-white shadow-2xl flex flex-col">
        <div className="p-4 flex justify-between items-center border-b"><div className="flex items-center gap-1.5"><img src={LOGO_URL} alt="" className="h-8" /><span className="text-lg font-black" style={{ fontFamily: "'Outfit', sans-serif" }}><span className="text-green-700">WEE</span><span style={{ background: "linear-gradient(90deg, #15803d 50%, #111827 50%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>D</span><span className="text-gray-900">eliver</span></span></div><button onClick={() => setMenuOpen(false)}><X className="w-5 h-5" /></button></div>
        <div className="p-3 space-y-1">
          <button onClick={() => go("/")} className="flex items-center gap-3 w-full p-3 rounded-xl text-sm font-medium hover:bg-gray-100"><Home className="w-4 h-4 text-gray-400" />Home</button>
          {!currentUser && <>
            <p className="text-[10px] text-gray-400 font-medium px-3 mt-3 mb-1">DEMO LOGINS</p>
            {["CUSTOMER", "DISPENSARY", "DRIVER", "ADMIN"].map(r => <button key={r} onClick={() => { switchRole(r); const dm = { CUSTOMER: "/", DISPENSARY: "/dashboard/dispensary", DRIVER: "/dashboard/driver", ADMIN: "/dashboard/admin" }; go(dm[r]); }} className="flex items-center gap-3 w-full p-3 rounded-xl text-sm font-medium hover:bg-gray-100"><div className="w-7 h-7 rounded-full bg-green-100 flex items-center justify-center text-green-700 text-xs font-bold">{r[0]}</div>{r.charAt(0) + r.slice(1).toLowerCase()}</button>)}
          </>}
        </div>
      </div>
    </div>
  );
}
