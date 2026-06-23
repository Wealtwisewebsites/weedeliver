import { User, Store, Bike, Shield, Activity } from "lucide-react";
import { LOGO_URL } from "../lib/logo";
import { useAuth } from "../context/AuthContext";
import { useUI } from "../context/UIContext";

export default function RoleSwitcher() {
  const { currentUser, switchRole } = useAuth();
  const { unreadCount, showLog, setShowLog, activityLog } = useUI();
  const roles = [{ role: "CUSTOMER", label: "Customer", icon: User, c: "emerald" }, { role: "DISPENSARY", label: "Dispensary", icon: Store, c: "purple" }, { role: "DRIVER", label: "Driver", icon: Bike, c: "blue" }, { role: "ADMIN", label: "Admin", icon: Shield, c: "red" }];
  const active = { emerald: "bg-emerald-50 text-emerald-700 border-emerald-300", purple: "bg-purple-50 text-purple-700 border-purple-300", blue: "bg-blue-50 text-blue-700 border-blue-300", red: "bg-red-50 text-red-700 border-red-300" };
  return (
    <div className="sticky top-0 z-[55] bg-gray-900 border-b border-gray-800">
      <div className="max-w-7xl mx-auto px-2 sm:px-3 py-1 flex items-center gap-1 sm:gap-2 overflow-x-auto scrollbar-hide">
        <div className="flex items-center gap-1 sm:gap-1.5 mr-0.5 sm:mr-1 flex-shrink-0">
          <img src={LOGO_URL} alt="" className="h-6 sm:h-7 object-contain" />
          <span className="text-xs sm:text-sm font-black tracking-tight hidden sm:inline" style={{ fontFamily: "'Outfit', sans-serif" }}><span className="text-green-400">WEE</span><span style={{ background: "linear-gradient(90deg, #4ade80 50%, #ffffff 50%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>D</span><span className="text-white">eliver</span></span>
        </div>
        <div className="w-px h-4 sm:h-5 bg-gray-700 flex-shrink-0 hidden sm:block" />
        {roles.map(r => {
          const isA = currentUser?.role === r.role;
          const cnt = unreadCount(r.role);
          return (
            <button key={r.role} onClick={() => switchRole(r.role)} className={`relative flex items-center gap-0.5 sm:gap-1 px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-full text-[10px] sm:text-[11px] font-bold transition-all whitespace-nowrap border ${isA ? active[r.c] : "bg-gray-800 text-gray-400 border-gray-700 hover:bg-gray-700"}`}>
              <r.icon className="w-3 h-3" /><span className="hidden sm:inline">{r.label}</span>
              {cnt > 0 && !isA && <span className="absolute -top-1 -right-1 min-w-[16px] px-1 bg-red-500 text-white text-[9px] rounded-full flex items-center justify-center font-bold animate-pulse">{cnt}</span>}
            </button>
          );
        })}
        <div className="flex-1" />
        <button onClick={() => setShowLog(!showLog)} className={`flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[11px] font-bold border transition-all ${showLog ? "bg-amber-50 text-amber-700 border-amber-300" : "bg-gray-800 text-gray-400 border-gray-700 hover:bg-gray-700"}`}>
          <Activity className="w-3 h-3" /><span className="hidden sm:inline">Log</span>
          {activityLog.length > 0 && <span className="bg-amber-500 text-white text-[9px] rounded-full px-1 min-w-[14px] text-center">{activityLog.length}</span>}
        </button>
      </div>
    </div>
  );
}
