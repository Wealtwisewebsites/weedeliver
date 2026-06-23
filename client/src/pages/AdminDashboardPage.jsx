import { useState, useEffect } from "react";
import { Store, Package, Users, TrendingUp, Shield, RefreshCw, Truck, CreditCard, AlertCircle, Check, X } from "lucide-react";
import { formatZAR, timeAgo } from "../lib/formatters";
import { api } from "../lib/api";
import { StatusBadge } from "../components/StatusBadge";
import { useUI } from "../context/UIContext";

export default function AdminDashboardPage() {
  const { notify } = useUI();
  const [tab, setTab] = useState("overview");
  const [dispensaries, setLocalDisps] = useState([]);
  const [orders, setOrders] = useState([]);
  const [users, setUsers] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const [dispRes, orderRes, userRes, analyticsRes] = await Promise.all([
      api("GET", "/admin/dispensaries"),
      api("GET", "/admin/orders"),
      api("GET", "/admin/users"),
      api("GET", "/admin/analytics"),
    ]);
    if (dispRes.ok) setLocalDisps(dispRes.data || []);
    if (orderRes.ok) setOrders(orderRes.data || []);
    if (userRes.ok) setUsers(userRes.data?.users || []);
    if (analyticsRes.ok) setAnalytics(analyticsRes.data);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const pendingDisps = dispensaries.filter(d => !d.isApproved);

  const handleApprove = async (id) => {
    const res = await api("POST", `/dispensaries/${id}/approve`);
    if (res.ok) {
      setLocalDisps(prev => prev.map(d => d.id === id ? { ...d, isApproved: true } : d));
      notify("Dispensary approved — now live on the platform!");
    } else {
      notify("Failed to approve dispensary", "error");
    }
  };

  const handleSuspend = async (id) => {
    const res = await api("PUT", `/dispensaries/${id}`, { isActive: false });
    if (res.ok) {
      setLocalDisps(prev => prev.map(d => d.id === id ? { ...d, isActive: false } : d));
      notify("Dispensary suspended");
    }
  };

  const stats = [
    { l: "Total Users", v: analytics?.totalUsers ?? users.length, ic: Users, c: "text-blue-600 bg-blue-50" },
    { l: "Dispensaries", v: analytics?.activeDispensaries ?? dispensaries.filter(d => d.isApproved).length, ic: Store, c: "text-green-600 bg-green-50" },
    { l: "Orders", v: analytics?.totalOrders ?? orders.length, ic: Package, c: "text-purple-600 bg-purple-50" },
    { l: "Revenue", v: formatZAR(analytics?.totalRevenue ?? 0), ic: TrendingUp, c: "text-amber-600 bg-amber-50" },
  ];

  const drivers = users.filter(u => u.role === "DRIVER");
  const pendingOrders = orders.filter(o => o.status === "PENDING" || o.status === "CONFIRMED");
  const [selectedDisp, setSelectedDisp] = useState(null);
  const PLATFORM_FEE_PCT = 0.15;
  const deliveredOrders = orders.filter(o => o.status === "DELIVERED");
  const totalRevenue = deliveredOrders.reduce((s, o) => s + Number(o.total || 0), 0);
  const platformFees = totalRevenue * PLATFORM_FEE_PCT;

  const tabs = [
    { id: "overview", l: "Overview", ic: TrendingUp, b: 0 },
    { id: "dispensaries", l: "Dispensaries", ic: Store, b: pendingDisps.length },
    { id: "orders", l: "Orders", ic: Package, b: pendingOrders.length },
    { id: "payments", l: "Payments", ic: CreditCard, b: 0 },
    { id: "users", l: "Users", ic: Users, b: 0 },
    { id: "drivers", l: "Drivers", ic: Truck, b: 0 },
  ];

  return (
    <div className="max-w-5xl mx-auto px-3 sm:px-4 py-4 sm:py-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: "linear-gradient(135deg, #1A7A2E, #2d9a4a)" }}><Shield className="w-4 h-4 text-white" /></div>
          <div><h1 className="text-xl font-black" style={{ fontFamily: "'Outfit', sans-serif" }}>Admin Dashboard</h1><p className="text-[11px] text-gray-400">Full platform visibility</p></div>
        </div>
        <button onClick={load} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-gray-100 text-gray-600 text-xs font-semibold hover:bg-gray-200"><RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />Refresh</button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 mb-4">
        {stats.map(s => (
          <div key={s.l} className="bg-white rounded-xl p-3 border hover:shadow-sm transition-shadow">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-1.5 ${s.c}`}><s.ic className="w-4 h-4" /></div>
            <p className="text-lg font-black">{s.v}</p>
            <p className="text-[10px] text-gray-500">{s.l}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-1 overflow-x-auto pb-1 mb-4">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`relative flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${tab === t.id ? "bg-green-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
            <t.ic className="w-3.5 h-3.5" />{t.l}
            {t.b > 0 && <span className={`px-1.5 py-0.5 text-[9px] rounded-full font-bold ${tab === t.id ? "bg-white text-green-700" : "bg-red-500 text-white"}`}>{t.b}</span>}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <div className="space-y-4">
          {loading ? <p className="text-center text-gray-400 py-8 text-sm">Loading analytics...</p> : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-white rounded-xl border p-4">
                  <p className="text-[11px] text-gray-500 font-medium mb-1">Approval Queue</p>
                  <p className="text-3xl font-black text-amber-600">{pendingDisps.length}</p>
                  <p className="text-[10px] text-gray-400 mt-1">dispensaries awaiting review</p>
                  {pendingDisps.length > 0 && <button onClick={() => setTab("dispensaries")} className="mt-2 text-[10px] text-amber-600 font-semibold hover:underline">Review now →</button>}
                </div>
                <div className="bg-white rounded-xl border p-4">
                  <p className="text-[11px] text-gray-500 font-medium mb-1">Active Orders</p>
                  <p className="text-3xl font-black text-purple-600">{pendingOrders.length}</p>
                  <p className="text-[10px] text-gray-400 mt-1">in-flight right now</p>
                </div>
                <div className="bg-white rounded-xl border p-4">
                  <p className="text-[11px] text-gray-500 font-medium mb-1">Driver Fleet</p>
                  <p className="text-3xl font-black text-blue-600">{drivers.length}</p>
                  <p className="text-[10px] text-gray-400 mt-1">registered drivers</p>
                </div>
              </div>

              <div className="bg-white rounded-xl border p-4">
                <h3 className="font-bold text-sm mb-3 flex items-center gap-2"><TrendingUp className="w-4 h-4 text-green-600" />Revenue Overview</h3>
                {analytics ? (
                  <div className="space-y-3">
                    <div className="flex items-end gap-1 h-24">
                      {[analytics.revenueToday, analytics.revenueWeek / 7, analytics.revenueMonth / 30].map((v, i) => {
                        const max = Math.max(analytics.revenueToday || 1, analytics.revenueWeek / 7 || 1, analytics.revenueMonth / 30 || 1);
                        const pct = max > 0 ? Math.max((v / max) * 100, 4) : 4;
                        const labels = ["Today", "Daily avg (7d)", "Daily avg (30d)"];
                        const colors = ["bg-green-500", "bg-blue-400", "bg-purple-400"];
                        return (
                          <div key={i} className="flex-1 flex flex-col items-center gap-1">
                            <span className="text-[9px] text-gray-500 font-semibold">{formatZAR(v || 0)}</span>
                            <div className={`w-full rounded-t ${colors[i]} transition-all`} style={{ height: `${pct}%` }} />
                            <span className="text-[9px] text-gray-400">{labels[i]}</span>
                          </div>
                        );
                      })}
                    </div>
                    <div className="grid grid-cols-3 gap-3 pt-2 border-t">
                      <div><p className="text-[10px] text-gray-400">Today</p><p className="font-black text-green-700">{formatZAR(analytics.revenueToday || 0)}</p></div>
                      <div><p className="text-[10px] text-gray-400">This week</p><p className="font-black text-blue-700">{formatZAR(analytics.revenueWeek || 0)}</p></div>
                      <div><p className="text-[10px] text-gray-400">This month</p><p className="font-black text-purple-700">{formatZAR(analytics.revenueMonth || 0)}</p></div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm py-2 border-b"><span className="text-gray-500">Total orders processed</span><span className="font-black">{orders.length}</span></div>
                    <div className="flex items-center justify-between text-sm py-2 border-b"><span className="text-gray-500">Total platform revenue</span><span className="font-black text-green-700">{formatZAR(orders.reduce((s, o) => s + Number(o.total || 0), 0))}</span></div>
                    <div className="flex items-center justify-between text-sm py-2"><span className="text-gray-500">Average order value</span><span className="font-black">{orders.length > 0 ? formatZAR(orders.reduce((s, o) => s + Number(o.total || 0), 0) / orders.length) : "—"}</span></div>
                  </div>
                )}
              </div>

              <div className="bg-white rounded-xl border p-4">
                <h3 className="font-bold text-sm mb-3 flex items-center gap-2"><Package className="w-4 h-4 text-purple-600" />Order Status Breakdown</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {["PENDING","CONFIRMED","PREPARING","READY_FOR_PICKUP","IN_TRANSIT","DELIVERED","CANCELLED"].map(s => {
                    const count = orders.filter(o => o.status === s).length;
                    if (count === 0) return null;
                    const colorMap = { PENDING:"bg-yellow-50 border-yellow-200 text-yellow-700", CONFIRMED:"bg-blue-50 border-blue-200 text-blue-700", PREPARING:"bg-orange-50 border-orange-200 text-orange-700", READY_FOR_PICKUP:"bg-purple-50 border-purple-200 text-purple-700", IN_TRANSIT:"bg-green-50 border-green-200 text-green-700", DELIVERED:"bg-emerald-50 border-emerald-200 text-emerald-700", CANCELLED:"bg-red-50 border-red-200 text-red-700" };
                    return (
                      <div key={s} className={`rounded-xl border p-3 ${colorMap[s] || "bg-gray-50 border-gray-200 text-gray-700"}`}>
                        <p className="text-2xl font-black">{count}</p>
                        <p className="text-[10px] font-semibold">{s.replace(/_/g, " ")}</p>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="bg-white rounded-xl border overflow-hidden">
                <div className="px-4 py-3 border-b bg-gray-50 flex items-center justify-between">
                  <p className="text-xs font-semibold text-gray-600">Recent Orders</p>
                  <button onClick={() => setTab("orders")} className="text-[10px] text-green-600 font-semibold hover:underline">View all →</button>
                </div>
                <div className="divide-y">
                  {orders.slice(0, 5).map(o => (
                    <div key={o.id} className="px-4 py-2.5 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-green-700">#{o.id.slice(0,8).toUpperCase()}</p>
                        <p className="text-[10px] text-gray-500 truncate">{o.customer?.firstName || "Customer"} · {o.dispensary?.name || o.dispensaryName}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <StatusBadge status={o.status} />
                        <span className="text-xs font-bold">{formatZAR(o.total)}</span>
                      </div>
                    </div>
                  ))}
                  {orders.length === 0 && <p className="text-center text-gray-400 py-6 text-xs">No orders yet</p>}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {tab === "dispensaries" && (
        <div className="space-y-3">
          {loading && <p className="text-center text-gray-400 py-8 text-sm">Loading...</p>}
          {pendingDisps.length > 0 && (
            <div className="bg-amber-50 rounded-xl border border-amber-200 p-4">
              <h3 className="font-bold text-sm text-amber-800 mb-3 flex items-center gap-2"><AlertCircle className="w-4 h-4" />{pendingDisps.length} Pending Approval</h3>
              <div className="space-y-2">
                {pendingDisps.map(d => (
                  <div key={d.id} className="bg-white rounded-xl p-3 border border-amber-200 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-bold text-sm truncate">{d.name}</p>
                      <p className="text-[11px] text-gray-500">{d.city}, {d.province} · {d.user?.email}</p>
                      <p className="text-[10px] text-gray-400 mt-0.5">{d.address}</p>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      <button onClick={() => handleApprove(d.id)} className="px-3 py-1.5 rounded-lg bg-green-600 text-white text-[11px] font-bold hover:bg-green-700 flex items-center gap-1"><Check className="w-3 h-3" />Approve</button>
                      <button onClick={() => handleSuspend(d.id)} className="px-2.5 py-1.5 rounded-lg bg-red-100 text-red-700 text-[11px] font-bold hover:bg-red-200">Reject</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!loading && dispensaries.length > 0 && (
            <div className="bg-white rounded-xl border overflow-hidden">
              <div className="px-4 py-3 border-b bg-gray-50"><p className="text-xs font-semibold text-gray-600">{dispensaries.length} dispensaries total</p></div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead><tr className="border-b bg-gray-50 text-left">
                    <th className="p-3 font-semibold text-gray-500">Dispensary</th>
                    <th className="p-3 font-semibold text-gray-500">Location</th>
                    <th className="p-3 font-semibold text-gray-500">Owner</th>
                    <th className="p-3 font-semibold text-gray-500">Products</th>
                    <th className="p-3 font-semibold text-gray-500">Status</th>
                    <th className="p-3 font-semibold text-gray-500">Actions</th>
                  </tr></thead>
                  <tbody>
                    {dispensaries.map(d => (
                      <tr key={d.id} className="border-b last:border-0 hover:bg-gray-50 cursor-pointer" onClick={() => setSelectedDisp(d)}>
                        <td className="p-3"><p className="font-semibold">{d.name}</p><p className="text-gray-400">{d.slug}</p></td>
                        <td className="p-3 text-gray-600">{d.city}, {d.province}</td>
                        <td className="p-3 text-gray-500">{d.user?.firstName} {d.user?.lastName}<br/><span className="text-[10px] text-gray-400">{d.user?.email}</span></td>
                        <td className="p-3 text-center">{d._count?.products ?? "—"}</td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${d.isApproved && d.isActive ? "bg-green-100 text-green-700" : !d.isApproved ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"}`}>
                            {d.isApproved && d.isActive ? "LIVE" : !d.isApproved ? "PENDING" : "SUSPENDED"}
                          </span>
                        </td>
                        <td className="p-3">
                          {!d.isApproved && <button onClick={(e) => { e.stopPropagation(); handleApprove(d.id); }} className="px-2 py-1 rounded-lg bg-green-100 text-green-700 text-[10px] font-bold mr-1 hover:bg-green-200">Approve</button>}
                          {d.isActive && d.isApproved && <button onClick={(e) => { e.stopPropagation(); handleSuspend(d.id); }} className="px-2 py-1 rounded-lg bg-red-100 text-red-600 text-[10px] font-bold hover:bg-red-200">Suspend</button>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {!loading && dispensaries.length === 0 && <p className="text-center text-gray-400 py-10 text-sm">No dispensaries yet</p>}
        </div>
      )}

      {tab === "orders" && (
        <div className="bg-white rounded-xl border overflow-hidden">
          {loading ? <p className="text-center text-gray-400 py-8 text-sm">Loading...</p> :
           orders.length === 0 ? <p className="text-center text-gray-400 py-8 text-sm">No orders yet</p> :
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead><tr className="border-b bg-gray-50 text-left">
                <th className="p-3 font-semibold text-gray-500">Order ID</th>
                <th className="p-3 font-semibold text-gray-500">Customer</th>
                <th className="p-3 font-semibold text-gray-500">Dispensary</th>
                <th className="p-3 font-semibold text-gray-500">Total</th>
                <th className="p-3 font-semibold text-gray-500">Status</th>
                <th className="p-3 font-semibold text-gray-500">Time</th>
              </tr></thead>
              <tbody>
                {orders.map(o => (
                  <tr key={o.id} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="p-3 font-bold text-green-700">#{o.id.slice(0,8).toUpperCase()}</td>
                    <td className="p-3">{o.customer?.firstName} {o.customer?.lastName}</td>
                    <td className="p-3 text-gray-600">{o.dispensary?.name}</td>
                    <td className="p-3 font-semibold text-green-700">{formatZAR(o.total)}</td>
                    <td className="p-3"><StatusBadge status={o.status} /></td>
                    <td className="p-3 text-gray-400">{timeAgo(o.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>}
        </div>
      )}

      {tab === "users" && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {["CUSTOMER","DISPENSARY","DRIVER","ADMIN"].map(role => {
              const count = users.filter(u => u.role === role).length;
              const colorMap = { CUSTOMER:"text-emerald-700 bg-emerald-50", DISPENSARY:"text-purple-700 bg-purple-50", DRIVER:"text-blue-700 bg-blue-50", ADMIN:"text-red-700 bg-red-50" };
              return (
                <div key={role} className="bg-white rounded-xl border p-3">
                  <p className={`text-xl font-black ${colorMap[role]?.split(" ")[0]}`}>{count}</p>
                  <p className="text-[10px] text-gray-500">{role}</p>
                </div>
              );
            })}
          </div>
          <div className="bg-white rounded-xl border overflow-hidden">
            {loading ? <p className="text-center text-gray-400 py-8 text-sm">Loading...</p> :
             users.length === 0 ? <p className="text-center text-gray-400 py-8 text-sm">No users yet</p> :
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead><tr className="border-b bg-gray-50 text-left">
                  <th className="p-3 font-semibold text-gray-500">Name</th>
                  <th className="p-3 font-semibold text-gray-500">Email</th>
                  <th className="p-3 font-semibold text-gray-500">Role</th>
                  <th className="p-3 font-semibold text-gray-500">Verified</th>
                  <th className="p-3 font-semibold text-gray-500">Joined</th>
                </tr></thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u.id} className="border-b last:border-0 hover:bg-gray-50">
                      <td className="p-3 font-semibold">{u.firstName} {u.lastName}</td>
                      <td className="p-3 text-gray-500">{u.email}</td>
                      <td className="p-3"><span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${{ CUSTOMER: "bg-emerald-100 text-emerald-700", DISPENSARY: "bg-purple-100 text-purple-700", DRIVER: "bg-blue-100 text-blue-700", ADMIN: "bg-red-100 text-red-700" }[u.role] || "bg-gray-100 text-gray-600"}`}>{u.role}</span></td>
                      <td className="p-3">{u.isAgeVerified ? <span className="text-green-600 font-semibold">✓ Age</span> : <span className="text-gray-400">Pending</span>}</td>
                      <td className="p-3 text-gray-400">{timeAgo(u.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>}
          </div>
        </div>
      )}

      {tab === "drivers" && (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-white rounded-xl border p-3"><p className="text-2xl font-black text-blue-600">{drivers.length}</p><p className="text-[10px] text-gray-500">Total Drivers</p></div>
            <div className="bg-white rounded-xl border p-3"><p className="text-2xl font-black text-green-600">{orders.filter(o => o.status === "IN_TRANSIT").length}</p><p className="text-[10px] text-gray-500">Active Deliveries</p></div>
            <div className="bg-white rounded-xl border p-3"><p className="text-2xl font-black text-purple-600">{orders.filter(o => o.status === "DELIVERED").length}</p><p className="text-[10px] text-gray-500">Delivered</p></div>
          </div>

          {loading ? <p className="text-center text-gray-400 py-8 text-sm">Loading...</p> :
           drivers.length === 0 ? (
            <div className="bg-white rounded-xl border p-8 text-center">
              <Truck className="w-10 h-10 text-gray-300 mx-auto mb-2" />
              <p className="text-gray-500 text-sm font-semibold">No drivers registered yet</p>
              <p className="text-[11px] text-gray-400 mt-1">Drivers sign up with the DRIVER role and appear here</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border overflow-hidden">
              <div className="px-4 py-3 border-b bg-gray-50"><p className="text-xs font-semibold text-gray-600">{drivers.length} registered drivers</p></div>
              <div className="divide-y">
                {drivers.map(driver => {
                  const driverOrders = orders.filter(o => o.driverId === driver.id);
                  const activeOrder = driverOrders.find(o => o.status === "IN_TRANSIT");
                  const delivered = driverOrders.filter(o => o.status === "DELIVERED").length;
                  return (
                    <div key={driver.id} className="p-4 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0"><Truck className="w-4 h-4 text-blue-600" /></div>
                        <div><p className="font-bold text-sm">{driver.firstName} {driver.lastName}</p><p className="text-[11px] text-gray-400">{driver.email}</p></div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        {activeOrder ? (
                          <span className="px-2 py-1 rounded-full bg-green-100 text-green-700 text-[10px] font-bold">ON DELIVERY</span>
                        ) : (
                          <span className="px-2 py-1 rounded-full bg-gray-100 text-gray-500 text-[10px] font-bold">AVAILABLE</span>
                        )}
                        <p className="text-[10px] text-gray-400 mt-1">{delivered} delivered</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {orders.filter(o => o.status === "READY_FOR_PICKUP" && !o.driverId).length > 0 && (
            <div className="bg-amber-50 rounded-xl border border-amber-200 p-4">
              <h3 className="font-bold text-sm text-amber-800 mb-3 flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                {orders.filter(o => o.status === "READY_FOR_PICKUP" && !o.driverId).length} Orders Awaiting Driver
              </h3>
              <div className="space-y-2">
                {orders.filter(o => o.status === "READY_FOR_PICKUP" && !o.driverId).map(o => (
                  <div key={o.id} className="bg-white rounded-xl p-3 border border-amber-200 flex items-center justify-between gap-2">
                    <div><p className="font-bold text-xs text-green-700">#{o.id.slice(0,8).toUpperCase()}</p><p className="text-[10px] text-gray-500">{o.dispensary?.name || o.dispensaryName} → {o.deliveryAddress}</p></div>
                    <span className="font-bold text-xs">{formatZAR(o.total)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {tab === "payments" && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-white rounded-xl border p-4 text-center"><p className="text-xl font-black text-green-700">{formatZAR(totalRevenue)}</p><p className="text-[10px] text-gray-500 mt-0.5">Gross Revenue</p></div>
            <div className="bg-white rounded-xl border p-4 text-center"><p className="text-xl font-black text-blue-700">{formatZAR(platformFees)}</p><p className="text-[10px] text-gray-500 mt-0.5">Platform Fees (15%)</p></div>
            <div className="bg-white rounded-xl border p-4 text-center"><p className="text-xl font-black text-purple-700">{formatZAR(totalRevenue - platformFees)}</p><p className="text-[10px] text-gray-500 mt-0.5">Dispensary Payouts</p></div>
          </div>

          <div className="bg-white rounded-xl border overflow-hidden">
            <div className="px-4 py-3 border-b bg-gray-50 flex items-center justify-between">
              <p className="text-xs font-semibold text-gray-600">Payout Breakdown by Dispensary</p>
              <span className="text-[10px] text-gray-400">15% platform fee applied</span>
            </div>
            {dispensaries.filter(d => d.isApproved).length === 0 ? (
              <p className="text-center text-gray-400 py-8 text-xs">No approved dispensaries</p>
            ) : dispensaries.filter(d => d.isApproved).map(d => {
              const dispOrders = deliveredOrders.filter(o => o.dispensaryId === d.id);
              const gross = dispOrders.reduce((s, o) => s + Number(o.total || 0), 0);
              const fee = gross * PLATFORM_FEE_PCT;
              const payout = gross - fee;
              return (
                <div key={d.id} className="px-4 py-3 flex items-center justify-between gap-3 border-b last:border-0 hover:bg-gray-50 cursor-pointer" onClick={() => { setSelectedDisp(d); setTab("dispensaries"); }}>
                  <div className="min-w-0">
                    <p className="font-semibold text-sm truncate">{d.name}</p>
                    <p className="text-[10px] text-gray-400">{dispOrders.length} orders · {d.banking?.bankName ? d.banking.bankName : <span className="text-amber-600 font-semibold">No banking details</span>}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-black text-sm text-green-700">{formatZAR(payout)}</p>
                    <p className="text-[9px] text-gray-400">of {formatZAR(gross)}</p>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="bg-white rounded-xl border overflow-hidden">
            <div className="px-4 py-3 border-b bg-gray-50"><p className="text-xs font-semibold text-gray-600">Completed Order Log</p></div>
            {deliveredOrders.length === 0 ? (
              <p className="text-center text-gray-400 py-6 text-xs">No completed orders</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead><tr className="border-b bg-gray-50 text-left">
                    <th className="p-3 font-semibold text-gray-500">Order</th>
                    <th className="p-3 font-semibold text-gray-500">Dispensary</th>
                    <th className="p-3 font-semibold text-gray-500">Gross</th>
                    <th className="p-3 font-semibold text-gray-500">Fee</th>
                    <th className="p-3 font-semibold text-gray-500">Payout</th>
                    <th className="p-3 font-semibold text-gray-500">Method</th>
                  </tr></thead>
                  <tbody>
                    {deliveredOrders.slice(0, 25).map(o => {
                      const gross = Number(o.total || 0);
                      const fee = gross * PLATFORM_FEE_PCT;
                      return (
                        <tr key={o.id} className="border-b last:border-0 hover:bg-gray-50">
                          <td className="p-3 font-bold text-green-700">#{o.id.slice(0,8).toUpperCase()}</td>
                          <td className="p-3 text-gray-600">{o.dispensary?.name || o.dispensaryName}</td>
                          <td className="p-3 font-semibold">{formatZAR(gross)}</td>
                          <td className="p-3 text-red-600">-{formatZAR(fee)}</td>
                          <td className="p-3 font-bold text-green-700">{formatZAR(gross - fee)}</td>
                          <td className="p-3"><span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full text-[10px] font-bold">{(o.paymentMethod || "CARD").toUpperCase()}</span></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {selectedDisp && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => setSelectedDisp(null)}>
          <div className="bg-white w-full sm:max-w-2xl rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="px-5 pt-5 pb-3 border-b flex items-center justify-between sticky top-0 bg-white rounded-t-3xl z-10">
              <h2 className="font-black text-base" style={{ fontFamily: "'Outfit', sans-serif" }}>{selectedDisp.name}</h2>
              <button onClick={() => setSelectedDisp(null)} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`px-2 py-1 rounded-full text-[11px] font-bold ${selectedDisp.isApproved && selectedDisp.isActive ? "bg-green-100 text-green-700" : !selectedDisp.isApproved ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"}`}>
                  {selectedDisp.isApproved && selectedDisp.isActive ? "LIVE" : !selectedDisp.isApproved ? "PENDING APPROVAL" : "SUSPENDED"}
                </span>
                <p className="text-sm text-gray-500">{selectedDisp.city}, {selectedDisp.province}</p>
              </div>

              <div className="bg-gray-50 rounded-xl p-3 border">
                <p className="text-[10px] text-gray-400 mb-1">Owner</p>
                <p className="font-semibold text-sm">{selectedDisp.user?.firstName} {selectedDisp.user?.lastName}</p>
                <p className="text-xs text-gray-500">{selectedDisp.user?.email}</p>
              </div>

              {(() => {
                const dispOrders = orders.filter(o => o.dispensaryId === selectedDisp.id);
                const delivered = dispOrders.filter(o => o.status === "DELIVERED");
                const gross = delivered.reduce((s, o) => s + Number(o.total || 0), 0);
                return (
                  <div className="grid grid-cols-3 gap-2">
                    <div className="bg-white border rounded-xl p-3 text-center"><p className="text-xl font-black">{dispOrders.length}</p><p className="text-[10px] text-gray-500">Total Orders</p></div>
                    <div className="bg-white border rounded-xl p-3 text-center"><p className="text-xl font-black text-green-700">{formatZAR(gross)}</p><p className="text-[10px] text-gray-500">Gross Revenue</p></div>
                    <div className="bg-white border rounded-xl p-3 text-center"><p className="text-xl font-black text-blue-700">{formatZAR(gross * (1 - PLATFORM_FEE_PCT))}</p><p className="text-[10px] text-gray-500">Net Payout</p></div>
                  </div>
                );
              })()}

              <div className="bg-white rounded-xl border p-4">
                <h3 className="font-bold text-sm mb-3 flex items-center gap-2"><CreditCard className="w-4 h-4 text-green-600" />Banking Details</h3>
                {selectedDisp.banking?.bankName ? (
                  <div className="space-y-2">
                    {[["Bank", selectedDisp.banking.bankName], ["Account Holder", selectedDisp.banking.accountHolderName], ["Account Number", selectedDisp.banking.accountNumber ? "••••" + selectedDisp.banking.accountNumber.slice(-4) : "—"], ["Branch Code", selectedDisp.banking.branchCode], ["Type", selectedDisp.banking.accountType]].map(([label, val]) => (
                      <div key={label} className="flex justify-between text-sm py-1.5 border-b last:border-0">
                        <span className="text-gray-500">{label}</span>
                        <span className="font-semibold">{val || "—"}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-amber-600 bg-amber-50 rounded-xl p-3">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <p className="text-sm font-medium">No banking details — dispensary cannot receive payouts until added</p>
                  </div>
                )}
              </div>

              <div className="bg-white rounded-xl border overflow-hidden">
                <div className="px-4 py-3 border-b bg-gray-50"><p className="text-xs font-semibold text-gray-600">Recent Orders</p></div>
                <div className="divide-y">
                  {orders.filter(o => o.dispensaryId === selectedDisp.id).slice(0, 6).map(o => (
                    <div key={o.id} className="px-4 py-2.5 flex items-center justify-between gap-2">
                      <div><p className="text-xs font-bold text-green-700">#{o.id.slice(0,8).toUpperCase()}</p><p className="text-[10px] text-gray-400">{timeAgo(o.createdAt)}</p></div>
                      <div className="flex items-center gap-2"><StatusBadge status={o.status} /><span className="text-xs font-bold">{formatZAR(Number(o.total || 0))}</span></div>
                    </div>
                  ))}
                  {orders.filter(o => o.dispensaryId === selectedDisp.id).length === 0 && <p className="text-center text-gray-400 py-4 text-xs">No orders yet</p>}
                </div>
              </div>

              <div className="flex gap-2">
                {!selectedDisp.isApproved && <button onClick={() => { handleApprove(selectedDisp.id); setSelectedDisp(null); }} className="flex-1 py-2.5 rounded-xl bg-green-600 text-white font-bold text-sm flex items-center justify-center gap-1.5 hover:bg-green-700"><Check className="w-4 h-4" />Approve</button>}
                {selectedDisp.isApproved && selectedDisp.isActive && <button onClick={() => { handleSuspend(selectedDisp.id); setSelectedDisp(null); }} className="flex-1 py-2.5 rounded-xl border border-red-200 bg-red-50 text-red-600 font-bold text-sm hover:bg-red-100">Suspend</button>}
                <button onClick={() => setSelectedDisp(null)} className="px-4 py-2.5 rounded-xl border text-sm font-semibold text-gray-600 hover:bg-gray-50">Close</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
