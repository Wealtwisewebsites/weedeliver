import { useState, useEffect } from "react";
import { Package, Leaf, Store, Edit, Clock, Check, CheckCircle, MapPin, Truck, CreditCard, Upload, Eye, Heart, AlertCircle, BarChart3 } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { formatZAR, timeAgo, isDispensaryOpen } from "../lib/formatters";
import { api } from "../lib/api";
import { DAY_KEYS, DAY_LABELS, SA_BANKS, CATEGORY_ICONS, STRAIN_COLORS } from "../lib/constants";
import { REVENUE_DATA } from "../lib/mockData";
import { StatusBadge } from "../components/StatusBadge";
import ImageUploadBox from "../components/ImageUploadBox";
import DispensaryProductsTab from "./DispensaryProductsTab";
import { useAuth } from "../context/AuthContext";
import { useUI } from "../context/UIContext";

// operatingHours & socialLinks arrive from the API as JSON strings — parse them to objects for editing.
const safeParse = (val, fallback) => {
  if (val && typeof val === "object") return val;
  if (typeof val === "string") { try { return JSON.parse(val); } catch { return fallback; } }
  return fallback;
};
const hydrateDisp = (d) => ({
  ...d,
  operatingHours: safeParse(d.operatingHours, {}),
  socialLinks: safeParse(d.socialLinks, {}),
});

export default function DispensaryDashboardPage() {
  const { currentUser } = useAuth();
  const { notify, markRead } = useUI();
  const [tab, setTab] = useState("orders");
  const [myDisps, setMyDisps] = useState([]);
  const [myOrders, setMyOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { markRead("DISPENSARY"); }, [tab]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const res = await api("GET", "/dispensaries/mine");
      if (res.ok && Array.isArray(res.data)) {
        setMyDisps(res.data);
        if (res.data.length > 0) {
          const ordRes = await api("GET", `/orders/dispensary/${res.data[0].id}`);
          if (ordRes.ok && ordRes.data) setMyOrders(ordRes.data);
        }
      }
      setLoading(false);
    };
    load();
  }, [currentUser?.id]);

  const myIds = myDisps.map(d => d.id);
  const pending = myOrders.filter(o => o.status === "PENDING");
  const active = myOrders.filter(o => !["DELIVERED", "CANCELLED"].includes(o.status));
  const rev = myOrders.filter(o => o.status === "DELIVERED").reduce((s, o) => s + Number(o.total || 0), 0);

  const [editDisp, setEditDisp] = useState(null);
  useEffect(() => { if (myDisps.length > 0 && !editDisp) setEditDisp(hydrateDisp(myDisps[0])); }, [myDisps]);

  const [creating, setCreating] = useState(false);
  const [newDisp, setNewDisp] = useState({ name: "", slug: "", city: "", province: "Gauteng", address: "", bio: "", tagline: "", deliveryFee: 35, minimumOrder: 100, deliveryRadius: 15, deliveryTime: "25-35 min" });

  const handleCreateDispensary = async () => {
    if (!newDisp.name || !newDisp.city) { notify("Store name and city are required", "error"); return; }
    setCreating(true);
    const slug = newDisp.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-+$/, "");
    const payload = { ...newDisp, slug, lat: -26.2041, lng: 28.0473 };
    const res = await api("POST", "/dispensaries", payload);
    if (res.ok && res.data) {
      setMyDisps([res.data]);
      setEditDisp({ ...res.data });
      notify("Dispensary live! Customers can find you now.");
      setTab("storefront");
    } else {
      notify("Failed to create dispensary", "error");
    }
    setCreating(false);
  };

  const updateOrderStatus = async (orderId, status) => {
    const res = await api("PUT", `/orders/${orderId}/status`, { status });
    if (res.ok) {
      setMyOrders(prev => prev.map(o => o.id === orderId ? { ...o, status } : o));
      notify(`Order updated to ${status.replace(/_/g, " ")}`);
    }
  };

  const [savingStore, setSavingStore] = useState(false);
  const saveStorefront = async () => {
    if (!editDisp || savingStore) return;
    setSavingStore(true);
    const payload = {
      name: editDisp.name,
      tagline: editDisp.tagline,
      bio: editDisp.bio,
      bannerUrl: editDisp.bannerUrl,
      logoUrl: editDisp.logoUrl,
      deliveryFee: editDisp.deliveryFee,
      minimumOrder: editDisp.minimumOrder,
      deliveryRadius: editDisp.deliveryRadius,
      operatingHours: editDisp.operatingHours,
      socialLinks: editDisp.socialLinks,
    };
    const res = await api("PUT", `/dispensaries/${editDisp.id}`, payload);
    if (!res.ok) { notify(res.data?.error || "Failed to save changes", "error"); setSavingStore(false); return; }

    // Banking has its own encrypted endpoint — only save when all fields are filled in.
    const b = editDisp.banking;
    if (b && b.bankName && b.accountHolderName && b.accountNumber && b.branchCode && b.accountType) {
      const bres = await api("PUT", `/dispensaries/${editDisp.id}/banking`, {
        bankName: b.bankName,
        accountHolderName: b.accountHolderName,
        accountNumber: String(b.accountNumber),
        branchCode: String(b.branchCode),
        accountType: b.accountType,
      });
      if (!bres.ok) notify(bres.data?.error || "Store saved, but banking details didn't save", "error");
    }

    // Reload canonical state from the server so the UI reflects exactly what persisted.
    const reload = await api("GET", "/dispensaries/mine");
    if (reload.ok && Array.isArray(reload.data) && reload.data.length > 0) {
      setMyDisps(reload.data);
      setEditDisp({ ...hydrateDisp(reload.data[0]), banking: editDisp.banking });
    }
    setSavingStore(false);
    notify("Changes saved!");
  };

  if (!loading && myDisps.length === 0) {
    return (
      <div className="max-w-lg mx-auto px-3 sm:px-4 py-8">
        <div className="text-center mb-6">
          <div className="w-16 h-16 rounded-2xl bg-green-100 flex items-center justify-center mx-auto mb-3"><Store className="w-8 h-8 text-green-600" /></div>
          <h1 className="text-xl font-black" style={{ fontFamily: "'Outfit', sans-serif" }}>Create Your Dispensary</h1>
          <p className="text-gray-500 text-sm mt-1">Set up your store to start receiving orders on WeeDeliver</p>
        </div>
        <div className="bg-white rounded-2xl border shadow-sm p-5 space-y-3">
          <div><label className="block text-[11px] font-medium text-gray-500 mb-1">Store Name *</label><input value={newDisp.name} onChange={e => setNewDisp({ ...newDisp, name: e.target.value })} placeholder="e.g. Green Leaf Co." className="w-full px-3 py-2.5 rounded-xl border text-sm focus:ring-2 focus:ring-green-500 outline-none" /></div>
          <div><label className="block text-[11px] font-medium text-gray-500 mb-1">Tagline</label><input value={newDisp.tagline} onChange={e => setNewDisp({ ...newDisp, tagline: e.target.value })} placeholder="Short catchy phrase..." className="w-full px-3 py-2.5 rounded-xl border text-sm focus:ring-2 focus:ring-green-500 outline-none" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-[11px] font-medium text-gray-500 mb-1">City *</label><input value={newDisp.city} onChange={e => setNewDisp({ ...newDisp, city: e.target.value })} placeholder="e.g. Cape Town" className="w-full px-3 py-2.5 rounded-xl border text-sm focus:ring-2 focus:ring-green-500 outline-none" /></div>
            <div><label className="block text-[11px] font-medium text-gray-500 mb-1">Province</label>
              <select value={newDisp.province} onChange={e => setNewDisp({ ...newDisp, province: e.target.value })} className="w-full px-3 py-2.5 rounded-xl border text-sm outline-none bg-white">
                {["Gauteng","Western Cape","KwaZulu-Natal","Eastern Cape","Free State","Limpopo","Mpumalanga","North West","Northern Cape"].map(p => <option key={p}>{p}</option>)}
              </select>
            </div>
          </div>
          <div><label className="block text-[11px] font-medium text-gray-500 mb-1">Street Address</label><input value={newDisp.address} onChange={e => setNewDisp({ ...newDisp, address: e.target.value })} placeholder="42 Long St" className="w-full px-3 py-2.5 rounded-xl border text-sm focus:ring-2 focus:ring-green-500 outline-none" /></div>
          <div><label className="block text-[11px] font-medium text-gray-500 mb-1">Bio / Description</label><textarea value={newDisp.bio} onChange={e => setNewDisp({ ...newDisp, bio: e.target.value })} rows={2} placeholder="Tell customers about your store..." className="w-full px-3 py-2.5 rounded-xl border text-sm focus:ring-2 focus:ring-green-500 outline-none resize-none" /></div>
          <div className="grid grid-cols-3 gap-2">
            <div><label className="block text-[11px] font-medium text-gray-500 mb-1">Delivery Fee (R)</label><input type="number" value={newDisp.deliveryFee} onChange={e => setNewDisp({ ...newDisp, deliveryFee: Number(e.target.value) })} className="w-full px-3 py-2 rounded-xl border text-sm outline-none" /></div>
            <div><label className="block text-[11px] font-medium text-gray-500 mb-1">Min Order (R)</label><input type="number" value={newDisp.minimumOrder} onChange={e => setNewDisp({ ...newDisp, minimumOrder: Number(e.target.value) })} className="w-full px-3 py-2 rounded-xl border text-sm outline-none" /></div>
            <div><label className="block text-[11px] font-medium text-gray-500 mb-1">Radius (km)</label><input type="number" value={newDisp.deliveryRadius} onChange={e => setNewDisp({ ...newDisp, deliveryRadius: Number(e.target.value) })} className="w-full px-3 py-2 rounded-xl border text-sm outline-none" /></div>
          </div>
          <button onClick={handleCreateDispensary} disabled={creating || !newDisp.name || !newDisp.city} className={`w-full py-3 rounded-xl text-white font-bold text-sm shadow-lg transition ${creating ? "opacity-60" : "hover:shadow-xl"}`} style={{ background: "linear-gradient(135deg, #1A7A2E, #2d9a4a)" }}>{creating ? "Creating..." : "Create My Dispensary"}</button>
          <p className="text-[10px] text-gray-400 text-center">Your store goes live immediately and is visible to all customers.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-3 sm:px-4 py-4 sm:py-5">
      <h1 className="text-lg sm:text-xl font-black mb-1" style={{ fontFamily: "'Outfit', sans-serif" }}>Dispensary Dashboard</h1>
      <p className="text-gray-500 text-xs mb-4">Manage orders & products</p>
      <div className="grid grid-cols-3 gap-1.5 sm:gap-2 mb-3 sm:mb-4">
        <div className="rounded-xl p-3 text-center bg-amber-50 text-amber-700"><p className="text-xl font-black">{pending.length}</p><p className="text-[10px] font-medium">Pending</p></div>
        <div className="rounded-xl p-3 text-center bg-blue-50 text-blue-700"><p className="text-xl font-black">{active.length}</p><p className="text-[10px] font-medium">Active</p></div>
        <div className="rounded-xl p-3 text-center bg-green-50 text-green-700"><p className="text-xl font-black">{formatZAR(rev)}</p><p className="text-[10px] font-medium">Revenue</p></div>
      </div>
      <div className="flex gap-1 mb-3 sm:mb-4 overflow-x-auto scrollbar-hide">{[{ id: "orders", l: "Orders", ic: Package, b: pending.length }, { id: "storefront", l: "Storefront", ic: Edit }, { id: "products", l: "Products", ic: Leaf }, { id: "settings", l: "Settings", ic: Clock }, { id: "analytics", l: "Analytics", ic: BarChart3 }].map(t => <button key={t.id} onClick={() => setTab(t.id)} className={`relative flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap ${tab === t.id ? "bg-green-600 text-white" : "bg-gray-100 text-gray-600"}`}><t.ic className="w-3.5 h-3.5" />{t.l}{t.b > 0 && <span className={`ml-0.5 px-1.5 py-0.5 text-[9px] rounded-full font-bold ${tab === t.id ? "bg-white text-green-700" : "bg-red-500 text-white"}`}>{t.b}</span>}</button>)}</div>

      {tab === "orders" && <div className="space-y-2.5">
        {myOrders.length === 0 && <p className="text-center text-gray-400 py-8 text-sm">No orders yet — waiting for customers!</p>}
        {myOrders.map(o => (
          <div key={o.id} className={`bg-white rounded-xl p-3.5 border transition-all ${o.status === "PENDING" ? "border-amber-300 ring-1 ring-amber-100 shadow-md" : "border-gray-100"}`}>
            <div className="flex items-center justify-between mb-1.5">
              <div><p className="font-bold text-sm">#{o.id.toUpperCase()}</p><p className="text-[11px] text-gray-500">{o.customerName} · {timeAgo(o.createdAt)}</p></div>
              <StatusBadge status={o.status} />
            </div>
            <p className="text-xs text-gray-600 mb-1">{(o.items || []).map(i => `${i.quantity}× ${i.productName}`).join(", ")}</p>
            <p className="text-[11px] text-gray-400 mb-2"><MapPin className="w-3 h-3 inline mr-0.5" />{o.deliveryAddress}</p>
            <div className="flex items-center justify-between">
              <span className="font-bold text-green-700 text-sm">{formatZAR(o.total)}</span>
              <div className="flex gap-1.5">
                {o.status === "PENDING" && <><button onClick={() => updateOrderStatus(o.id, "CONFIRMED")} className="px-3 py-1.5 rounded-lg bg-green-600 text-white text-[11px] font-bold flex items-center gap-1"><Check className="w-3 h-3" />Accept</button><button onClick={() => updateOrderStatus(o.id, "CANCELLED")} className="px-2.5 py-1.5 rounded-lg bg-red-100 text-red-700 text-[11px] font-bold">Decline</button></>}
                {o.status === "CONFIRMED" && <button onClick={() => updateOrderStatus(o.id, "PREPARING")} className="px-3 py-1.5 rounded-lg bg-orange-500 text-white text-[11px] font-bold">Start Preparing</button>}
                {o.status === "PREPARING" && <button onClick={() => updateOrderStatus(o.id, "READY_FOR_PICKUP")} className="px-3 py-1.5 rounded-lg bg-cyan-600 text-white text-[11px] font-bold">Ready for Pickup</button>}
                {o.status === "READY_FOR_PICKUP" && <span className="text-[11px] text-gray-500 italic">Waiting for driver...</span>}
                {o.status === "DRIVER_ASSIGNED" && <span className="text-[11px] text-indigo-600 font-medium">Driver {o.driverName} coming</span>}
                {o.status === "IN_TRANSIT" && <span className="text-[11px] text-purple-600 font-medium">In transit</span>}
                {o.status === "DELIVERED" && <span className="text-[11px] text-green-600 font-semibold flex items-center gap-1"><CheckCircle className="w-3 h-3" />Delivered</span>}
              </div>
            </div>
          </div>
        ))}
      </div>}

      {tab === "storefront" && editDisp && (
        <div className="space-y-5">
          <div>
            <h3 className="font-bold text-sm mb-2 flex items-center gap-2"><Eye className="w-4 h-4 text-green-600" /> Live Preview</h3>
            <div className="rounded-2xl overflow-hidden border border-gray-200 shadow-sm bg-white">
              <div className="relative overflow-hidden bg-gray-200">
                {editDisp.bannerUrl ? <img src={editDisp.bannerUrl} alt="" className="absolute inset-0 w-full h-full object-cover" /> : <div className="absolute inset-0 bg-gray-100" />}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/25 to-black/5" />
                {editDisp.openNow && <div className="absolute top-2 right-2 flex items-center gap-1 bg-green-500 text-white text-[9px] font-bold px-2 py-0.5 rounded-full z-10"><div className="w-1.5 h-1.5 rounded-full bg-white" />OPEN</div>}
                <div className="relative z-10 px-4 pt-16 pb-4 flex items-end gap-3">
                  <div className="w-16 h-16 rounded-xl shadow-lg border-2 border-white overflow-hidden bg-white/20 backdrop-blur-sm flex-shrink-0">
                    {editDisp.logoUrl ? <img src={editDisp.logoUrl} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><Leaf className="w-7 h-7 text-white/70" /></div>}
                  </div>
                  <div className="pb-0.5">
                    <p className="font-black text-base text-white drop-shadow-md" style={{ fontFamily: "'Outfit', sans-serif" }}>{editDisp.name}</p>
                    {editDisp.tagline && <p className="text-[11px] text-white/70 italic">{editDisp.tagline}</p>}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-4 border space-y-4">
            <h3 className="font-bold text-sm flex items-center gap-2"><Upload className="w-4 h-4 text-green-600" /> Store Images</h3>
            <div>
              <label className="block text-[11px] font-medium text-gray-500 mb-2">Banner Image <span className="text-gray-400">(1200×400 recommended)</span></label>
              <ImageUploadBox current={editDisp.bannerUrl} onUpload={(url) => setEditDisp({ ...editDisp, bannerUrl: url })} label="Upload Banner" aspectHint="Wide landscape" folder="banners" className="h-32 sm:h-36 rounded-xl overflow-hidden" />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-gray-500 mb-2">Profile Picture <span className="text-gray-400">(Square, 400×400 recommended)</span></label>
              <ImageUploadBox current={editDisp.logoUrl} onUpload={(url) => setEditDisp({ ...editDisp, logoUrl: url })} label="Upload Profile" aspectHint="Square" folder="profiles" className="w-24 h-24 sm:w-28 sm:h-28 rounded-xl overflow-hidden" />
            </div>
          </div>

          <div className="bg-white rounded-xl p-4 border space-y-3">
            <h3 className="font-bold text-sm flex items-center gap-2"><Store className="w-4 h-4 text-green-600" /> Profile Info</h3>
            <div><label className="block text-[11px] font-medium text-gray-500 mb-1">Store Name</label><input value={editDisp.name} onChange={e => setEditDisp({ ...editDisp, name: e.target.value })} className="w-full px-3 py-2 rounded-lg border text-sm focus:ring-2 focus:ring-green-500 outline-none" /></div>
            <div><label className="block text-[11px] font-medium text-gray-500 mb-1">Tagline</label><input value={editDisp.tagline || ""} onChange={e => setEditDisp({ ...editDisp, tagline: e.target.value })} placeholder="Short catchy phrase..." className="w-full px-3 py-2 rounded-lg border text-sm focus:ring-2 focus:ring-green-500 outline-none" /></div>
            <div><label className="block text-[11px] font-medium text-gray-500 mb-1">Bio / Description</label><textarea value={editDisp.bio} onChange={e => setEditDisp({ ...editDisp, bio: e.target.value })} rows={3} className="w-full px-3 py-2 rounded-lg border text-sm focus:ring-2 focus:ring-green-500 outline-none resize-none" /></div>
          </div>

          <div className="bg-white rounded-xl p-4 border space-y-3">
            <h3 className="font-bold text-sm flex items-center gap-2"><Heart className="w-4 h-4 text-pink-500" /> Social Links</h3>
            <div><label className="block text-[11px] font-medium text-gray-500 mb-1">Instagram Handle</label><input value={editDisp.socialLinks?.instagram || ""} onChange={e => setEditDisp({ ...editDisp, socialLinks: { ...editDisp.socialLinks, instagram: e.target.value } })} placeholder="@yourstore" className="w-full px-3 py-2 rounded-lg border text-sm focus:ring-2 focus:ring-green-500 outline-none" /></div>
            <div><label className="block text-[11px] font-medium text-gray-500 mb-1">WhatsApp Number</label><input value={editDisp.socialLinks?.whatsapp || ""} onChange={e => setEditDisp({ ...editDisp, socialLinks: { ...editDisp.socialLinks, whatsapp: e.target.value } })} placeholder="+27..." className="w-full px-3 py-2 rounded-lg border text-sm focus:ring-2 focus:ring-green-500 outline-none" /></div>
          </div>

          <div className="bg-white rounded-xl p-4 border space-y-3">
            <h3 className="font-bold text-sm flex items-center gap-2"><Truck className="w-4 h-4 text-green-600" /> Delivery Settings</h3>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="block text-[11px] font-medium text-gray-500 mb-1">Delivery Fee (R)</label><input type="number" value={editDisp.deliveryFee} onChange={e => setEditDisp({ ...editDisp, deliveryFee: Number(e.target.value) })} className="w-full px-3 py-2 rounded-lg border text-sm focus:ring-2 focus:ring-green-500 outline-none" /></div>
              <div><label className="block text-[11px] font-medium text-gray-500 mb-1">Min Order (R)</label><input type="number" value={editDisp.minimumOrder} onChange={e => setEditDisp({ ...editDisp, minimumOrder: Number(e.target.value) })} className="w-full px-3 py-2 rounded-lg border text-sm focus:ring-2 focus:ring-green-500 outline-none" /></div>
            </div>
            <div><label className="block text-[11px] font-medium text-gray-500 mb-1">Delivery Radius: {editDisp.deliveryRadius} km</label><input type="range" min={1} max={50} value={editDisp.deliveryRadius} onChange={e => setEditDisp({ ...editDisp, deliveryRadius: Number(e.target.value) })} className="w-full accent-green-600" /></div>
            <div className="flex items-center justify-between"><span className="text-sm font-medium">Currently Open</span><button onClick={() => setEditDisp({ ...editDisp, openNow: !editDisp.openNow })} className={`w-12 h-6 rounded-full transition-all flex items-center ${editDisp.openNow ? "bg-green-500 justify-end" : "bg-gray-300 justify-start"}`}><div className="w-5 h-5 bg-white rounded-full shadow-sm mx-0.5" /></button></div>
          </div>

          <div className="bg-white rounded-xl p-4 border space-y-3">
            <h3 className="font-bold text-sm flex items-center gap-2"><Clock className="w-4 h-4 text-green-600" /> Trading Hours</h3>
            <p className="text-[11px] text-gray-500">Set your operating hours for each day. Customers cannot order when you're closed.</p>
            <div className="space-y-2">
              {DAY_KEYS.map(day => {
                const hrs = editDisp.operatingHours?.[day] || { open: "08:00", close: "22:00", isOpen: true };
                const updateDay = (field, val) => setEditDisp({ ...editDisp, operatingHours: { ...editDisp.operatingHours, [day]: { ...hrs, [field]: val } } });
                return (
                  <div key={day} className={`flex items-center gap-2 p-2.5 rounded-lg border transition-all ${hrs.isOpen ? "bg-green-50/50 border-green-200" : "bg-gray-50 border-gray-200 opacity-60"}`}>
                    <button onClick={() => updateDay("isOpen", !hrs.isOpen)} className={`w-10 h-5 rounded-full transition-all flex items-center flex-shrink-0 ${hrs.isOpen ? "bg-green-500 justify-end" : "bg-gray-300 justify-start"}`}><div className="w-4 h-4 bg-white rounded-full shadow-sm mx-0.5" /></button>
                    <span className="text-xs font-semibold w-20 flex-shrink-0">{DAY_LABELS[day]}</span>
                    {hrs.isOpen ? (
                      <div className="flex items-center gap-1.5 flex-1">
                        <input type="time" value={hrs.open || "08:00"} onChange={e => updateDay("open", e.target.value)} className="flex-1 px-2 py-1 rounded-md border text-xs focus:ring-2 focus:ring-green-500 outline-none bg-white" />
                        <span className="text-gray-400 text-xs">to</span>
                        <input type="time" value={hrs.close || "22:00"} onChange={e => updateDay("close", e.target.value)} className="flex-1 px-2 py-1 rounded-md border text-xs focus:ring-2 focus:ring-green-500 outline-none bg-white" />
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400 italic">Closed</span>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="flex items-center gap-2 pt-1">
              <div className={`w-2.5 h-2.5 rounded-full ${isDispensaryOpen(editDisp.operatingHours) ? "bg-green-500" : "bg-red-400"}`} />
              <span className="text-xs font-medium">{isDispensaryOpen(editDisp.operatingHours) ? "Currently OPEN based on your hours" : "Currently CLOSED based on your hours"}</span>
            </div>
          </div>

          <div className="bg-white rounded-xl p-4 border space-y-3">
            <h3 className="font-bold text-sm flex items-center gap-2"><CreditCard className="w-4 h-4 text-green-600" /> Banking Details</h3>
            <p className="text-[11px] text-gray-500">Required for receiving payouts. Account numbers are encrypted at rest.</p>
            <div><label className="block text-[11px] font-medium text-gray-500 mb-1">Bank Name</label>
              <select value={editDisp.banking?.bankName || ""} onChange={e => setEditDisp({ ...editDisp, banking: { ...(editDisp.banking || {}), bankName: e.target.value } })} className="w-full px-3 py-2 rounded-lg border text-sm focus:ring-2 focus:ring-green-500 outline-none bg-white">
                <option value="">Select bank...</option>
                {SA_BANKS.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
            <div><label className="block text-[11px] font-medium text-gray-500 mb-1">Account Holder Name</label><input value={editDisp.banking?.accountHolderName || ""} onChange={e => setEditDisp({ ...editDisp, banking: { ...(editDisp.banking || {}), accountHolderName: e.target.value } })} placeholder="Full legal name" className="w-full px-3 py-2 rounded-lg border text-sm focus:ring-2 focus:ring-green-500 outline-none" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="block text-[11px] font-medium text-gray-500 mb-1">Account Number</label><input value={editDisp.banking?.accountNumber || ""} onChange={e => setEditDisp({ ...editDisp, banking: { ...(editDisp.banking || {}), accountNumber: e.target.value } })} placeholder="e.g. 1234567890" className="w-full px-3 py-2 rounded-lg border text-sm focus:ring-2 focus:ring-green-500 outline-none" /></div>
              <div><label className="block text-[11px] font-medium text-gray-500 mb-1">Branch Code</label><input value={editDisp.banking?.branchCode || ""} onChange={e => setEditDisp({ ...editDisp, banking: { ...(editDisp.banking || {}), branchCode: e.target.value } })} placeholder="e.g. 250655" className="w-full px-3 py-2 rounded-lg border text-sm focus:ring-2 focus:ring-green-500 outline-none" /></div>
            </div>
            <div><label className="block text-[11px] font-medium text-gray-500 mb-1">Account Type</label>
              <div className="flex gap-2">{["CHEQUE", "SAVINGS"].map(t => (
                <button key={t} onClick={() => setEditDisp({ ...editDisp, banking: { ...(editDisp.banking || {}), accountType: t } })} className={`flex-1 py-2 rounded-lg border text-xs font-semibold transition-all ${editDisp.banking?.accountType === t ? "border-green-500 bg-green-50 text-green-700 ring-1 ring-green-500" : "border-gray-200 text-gray-600"}`}>{t === "CHEQUE" ? "Cheque" : "Savings"}</button>
              ))}</div>
            </div>
            {editDisp.banking?.bankName && editDisp.banking?.accountNumber && (
              <div className="bg-green-50 rounded-lg p-2.5 flex items-center gap-2"><CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" /><span className="text-[11px] text-green-700 font-medium">Banking details will be saved & encrypted when you save changes</span></div>
            )}
          </div>

          <button onClick={saveStorefront} disabled={savingStore} className={`w-full py-3 rounded-xl bg-green-600 text-white font-bold text-sm hover:bg-green-700 transition-colors ${savingStore ? "opacity-60" : ""}`}>{savingStore ? "Saving..." : "Save Storefront Changes"}</button>
        </div>
      )}

      {tab === "products" && <DispensaryProductsTab myIds={myIds} dispensaryId={myDisps[0]?.id} />}

      {tab === "settings" && editDisp && (
        <div className="space-y-5">
          <div className="bg-amber-50 rounded-xl p-3 border border-amber-200 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
            <p className="text-[11px] text-amber-800">Configure your trading hours and banking details here. Hours are enforced automatically.</p>
          </div>

          <div className="bg-white rounded-xl p-4 border space-y-3">
            <h3 className="font-bold text-sm flex items-center gap-2"><Clock className="w-4 h-4 text-green-600" /> Trading Hours</h3>
            <p className="text-[11px] text-gray-500">Set your operating hours for each day of the week (24h format, SAST).</p>
            <div className="space-y-2">
              {DAY_KEYS.map(day => {
                const hrs = editDisp.operatingHours?.[day] || { open: "08:00", close: "22:00", isOpen: true };
                const updateDay = (field, val) => setEditDisp({ ...editDisp, operatingHours: { ...editDisp.operatingHours, [day]: { ...hrs, [field]: val } } });
                return (
                  <div key={day} className={`flex items-center gap-2 p-2.5 rounded-lg border transition-all ${hrs.isOpen ? "bg-green-50/50 border-green-200" : "bg-gray-50 border-gray-200 opacity-60"}`}>
                    <button onClick={() => updateDay("isOpen", !hrs.isOpen)} className={`w-10 h-5 rounded-full transition-all flex items-center flex-shrink-0 ${hrs.isOpen ? "bg-green-500 justify-end" : "bg-gray-300 justify-start"}`}><div className="w-4 h-4 bg-white rounded-full shadow-sm mx-0.5" /></button>
                    <span className="text-xs font-semibold w-20 flex-shrink-0">{DAY_LABELS[day]}</span>
                    {hrs.isOpen ? (
                      <div className="flex items-center gap-1.5 flex-1">
                        <input type="time" value={hrs.open || "08:00"} onChange={e => updateDay("open", e.target.value)} className="flex-1 px-2 py-1 rounded-md border text-xs focus:ring-2 focus:ring-green-500 outline-none bg-white" />
                        <span className="text-gray-400 text-xs">to</span>
                        <input type="time" value={hrs.close || "22:00"} onChange={e => updateDay("close", e.target.value)} className="flex-1 px-2 py-1 rounded-md border text-xs focus:ring-2 focus:ring-green-500 outline-none bg-white" />
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400 italic">Closed</span>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="flex items-center gap-2 pt-1">
              <div className={`w-2.5 h-2.5 rounded-full animate-pulse ${isDispensaryOpen(editDisp.operatingHours) ? "bg-green-500" : "bg-red-400"}`} />
              <span className="text-xs font-medium">{isDispensaryOpen(editDisp.operatingHours) ? "Your store is currently OPEN" : "Your store is currently CLOSED"}</span>
            </div>
          </div>

          <div className="bg-white rounded-xl p-4 border space-y-3">
            <h3 className="font-bold text-sm flex items-center gap-2"><CreditCard className="w-4 h-4 text-green-600" /> Banking Details for Payouts</h3>
            <p className="text-[11px] text-gray-500">WeeDeliver pays out weekly via EFT (15% platform fee). Account numbers are AES-256 encrypted.</p>
            <div><label className="block text-[11px] font-medium text-gray-500 mb-1">Bank Name</label>
              <select value={editDisp.banking?.bankName || ""} onChange={e => setEditDisp({ ...editDisp, banking: { ...(editDisp.banking || {}), bankName: e.target.value } })} className="w-full px-3 py-2 rounded-lg border text-sm focus:ring-2 focus:ring-green-500 outline-none bg-white">
                <option value="">Select your bank...</option>
                {SA_BANKS.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
            <div><label className="block text-[11px] font-medium text-gray-500 mb-1">Account Holder Name</label><input value={editDisp.banking?.accountHolderName || ""} onChange={e => setEditDisp({ ...editDisp, banking: { ...(editDisp.banking || {}), accountHolderName: e.target.value } })} placeholder="Full legal name as on bank account" className="w-full px-3 py-2 rounded-lg border text-sm focus:ring-2 focus:ring-green-500 outline-none" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="block text-[11px] font-medium text-gray-500 mb-1">Account Number</label><input value={editDisp.banking?.accountNumber || ""} onChange={e => setEditDisp({ ...editDisp, banking: { ...(editDisp.banking || {}), accountNumber: e.target.value } })} placeholder="e.g. 1234567890" className="w-full px-3 py-2 rounded-lg border text-sm focus:ring-2 focus:ring-green-500 outline-none" /></div>
              <div><label className="block text-[11px] font-medium text-gray-500 mb-1">Branch Code</label><input value={editDisp.banking?.branchCode || ""} onChange={e => setEditDisp({ ...editDisp, banking: { ...(editDisp.banking || {}), branchCode: e.target.value } })} placeholder="e.g. 250655" className="w-full px-3 py-2 rounded-lg border text-sm focus:ring-2 focus:ring-green-500 outline-none" /></div>
            </div>
            <div><label className="block text-[11px] font-medium text-gray-500 mb-1">Account Type</label>
              <div className="flex gap-2">{["CHEQUE", "SAVINGS"].map(t => (
                <button key={t} onClick={() => setEditDisp({ ...editDisp, banking: { ...(editDisp.banking || {}), accountType: t } })} className={`flex-1 py-2 rounded-lg border text-xs font-semibold transition-all ${editDisp.banking?.accountType === t ? "border-green-500 bg-green-50 text-green-700 ring-1 ring-green-500" : "border-gray-200 text-gray-600"}`}>{t === "CHEQUE" ? "Cheque / Current" : "Savings"}</button>
              ))}</div>
            </div>
          </div>

          <button onClick={saveStorefront} disabled={savingStore} className={`w-full py-3 rounded-xl bg-green-600 text-white font-bold text-sm hover:bg-green-700 transition-colors ${savingStore ? "opacity-60" : ""}`}>{savingStore ? "Saving..." : "Save Settings"}</button>
        </div>
      )}

      {tab === "analytics" && <div className="bg-white rounded-xl p-4 border"><h3 className="font-bold text-sm mb-3">Revenue</h3><ResponsiveContainer width="100%" height={180}><AreaChart data={REVENUE_DATA}><defs><linearGradient id="g1" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#1A7A2E" stopOpacity={0.2} /><stop offset="95%" stopColor="#1A7A2E" stopOpacity={0} /></linearGradient></defs><CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" /><XAxis dataKey="day" tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 11 }} /><Tooltip /><Area type="monotone" dataKey="revenue" stroke="#1A7A2E" fill="url(#g1)" strokeWidth={2} /></AreaChart></ResponsiveContainer></div>}
    </div>
  );
}
