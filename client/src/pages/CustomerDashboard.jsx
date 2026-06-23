import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Package, Bell, Star } from "lucide-react";
import { formatZAR, timeAgo } from "../lib/formatters";
import { api } from "../lib/api";
import { StatusBadge } from "../components/StatusBadge";
import { useAuth } from "../context/AuthContext";
import { useUI } from "../context/UIContext";

export default function CustomerDashboard() {
  const nav = useNavigate();
  const { currentUser } = useAuth();
  const { notifications } = useUI();
  const [tab, setTab] = useState("orders");
  const [orders, setOrders] = useState([]);

  useEffect(() => {
    api("GET", "/orders").then(res => {
      if (res.ok && res.data) setOrders(res.data);
    });
  }, []);

  const myOrders = orders.filter(o => o.customerId === currentUser?.id);
  const myNotifs = notifications.filter(n => n.targetRole === "CUSTOMER").slice(0, 10);

  return (
    <div className="max-w-4xl mx-auto px-3 sm:px-4 py-4 sm:py-5">
      <h1 className="text-lg sm:text-xl font-black mb-3 sm:mb-4" style={{ fontFamily: "'Outfit', sans-serif" }}>Hi, {currentUser?.firstName}!</h1>
      <div className="flex gap-1 mb-4 bg-gray-100 p-1 rounded-xl">{[{ id: "orders", l: "Orders", ic: Package }, { id: "updates", l: "Updates", ic: Bell }].map(t => <button key={t.id} onClick={() => setTab(t.id)} className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold flex-1 justify-center ${tab === t.id ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"}`}><t.ic className="w-4 h-4" />{t.l}</button>)}</div>
      {tab === "orders" && <div className="space-y-2">
        {myOrders.length === 0 && <div className="text-center py-10"><Package className="w-12 h-12 text-gray-300 mx-auto mb-3" /><p className="text-gray-500 mb-3 text-sm">No orders yet</p><button onClick={() => nav("/")} className="px-5 py-2 rounded-full bg-green-600 text-white font-semibold text-sm">Browse Dispensaries</button></div>}
        {myOrders.map(o => (
          <button key={o.id} onClick={() => nav(`/order/${o.id}`)} className="w-full bg-white rounded-xl p-3 border hover:border-green-200 transition-all text-left flex items-center gap-3 hover:shadow-md">
            <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center flex-shrink-0"><Package className="w-5 h-5 text-green-600" /></div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm">#{o.id.slice(0,8).toUpperCase()} - {o.dispensaryName}</p>
              <p className="text-[11px] text-gray-500 truncate">{(o.items || []).map(i => `${i.quantity}x ${i.productName}`).join(", ")}</p>
            </div>
            <div className="text-right flex-shrink-0"><p className="font-bold text-sm text-green-700 mb-0.5">{formatZAR(o.total)}</p><StatusBadge status={o.status} /></div>
          </button>
        ))}
      </div>}
      {tab === "updates" && <div className="space-y-1.5">
        {myNotifs.length === 0 && <p className="text-center text-gray-400 py-8 text-sm">No updates yet</p>}
        {myNotifs.map(n => <div key={n.id} className="bg-white rounded-lg px-3 py-2 border text-xs flex items-center gap-2"><Bell className="w-3.5 h-3.5 text-green-500 flex-shrink-0" /><span className="flex-1">{n.msg}</span><span className="text-gray-400 whitespace-nowrap">{timeAgo(n.time)}</span></div>)}
      </div>}
    </div>
  );
}
