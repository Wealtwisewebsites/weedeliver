import { useState, useEffect } from "react";
import { Truck, Check, Clock, User, AlertCircle, Navigation, Activity, DollarSign, Package, CheckCircle, MapPin, Route, CreditCard } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { formatZAR, timeAgo } from "../lib/formatters";
import { api } from "../lib/api";
import { DRIVER_APPLICATION_STEPS, DRIVER_QUIZ, SA_BANKS } from "../lib/constants";
import { StatusBadge } from "../components/StatusBadge";
import ImageUploadBox from "../components/ImageUploadBox";
import { useAuth } from "../context/AuthContext";
import { useUI } from "../context/UIContext";

export default function DriverDashboardPage() {
  const { currentUser } = useAuth();
  const { notify, markRead } = useUI();
  const [orders, setOrders] = useState([]);
  const [driverOnline, setDriverOnline] = useState(false);
  const [tab, setTab] = useState("status");
  const [profile, setProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [appStep, setAppStep] = useState(0);
  const [appData, setAppData] = useState({
    profilePhoto: "", idNumber: "", idDocument: "", licenceDocument: "", vehicleRegDocument: "",
    vehicleType: "car", vehicleMake: "", vehicleModel: "", vehicleYear: "", vehicleColour: "", vehicleReg: "",
    bankName: "", bankAccount: "", quiz: {},
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { markRead("DRIVER"); }, [tab]);
  useEffect(() => {
    api("GET", "/drivers/profile").then(res => {
      if (res.ok && res.data) setProfile(res.data);
      setProfileLoading(false);
    });
  }, []);
  useEffect(() => {
    api("GET", "/orders").then(res => {
      if (res.ok && res.data) setOrders(res.data);
    });
  }, []);

  const available = orders.filter(o => o.status === "READY_FOR_PICKUP");
  const myDel = orders.filter(o => o.driverId === currentUser?.id);
  const activeDel = myDel.find(o => ["DRIVER_ASSIGNED", "IN_TRANSIT"].includes(o.status));
  const completed = myDel.filter(o => o.status === "DELIVERED");
  const earnings = completed.reduce((s, o) => s + Number(o.deliveryFee || 0), 0);
  const quizFailed = DRIVER_QUIZ.some(q => appData.quiz[q.key] === q.bad);

  const updateOrderStatus = async (orderId, status, extra) => {
    const res = await api("PUT", `/orders/${orderId}/status`, { status, ...extra });
    if (res.ok) {
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status, ...extra } : o));
    }
  };

  const acceptDelivery = (orderId) => {
    updateOrderStatus(orderId, "DRIVER_ASSIGNED", { driverId: currentUser.id, driverName: currentUser.firstName });
    setTab("active");
  };

  const submitApplication = async () => {
    setSubmitting(true);
    await api("POST", "/drivers/apply", appData);
    setProfile({ ...appData, status: "PENDING_REVIEW", submittedAt: new Date().toISOString() });
    notify("Application submitted! We'll review within 2-3 business days.");
    setSubmitting(false);
  };

  if (!profileLoading && !profile) {
    const step = DRIVER_APPLICATION_STEPS[appStep];
    return (
      <div className="max-w-lg mx-auto px-3 sm:px-4 py-6">
        <div className="text-center mb-5">
          <div className="w-14 h-14 rounded-2xl mx-auto mb-3 flex items-center justify-center" style={{ background: "linear-gradient(135deg, #1A7A2E, #2d9a4a)" }}>
            <Truck className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-xl font-black" style={{ fontFamily: "'Outfit', sans-serif" }}>Become a WeeDeliver Driver</h1>
          <p className="text-gray-500 text-sm mt-1">Earn on your own schedule delivering across SA</p>
        </div>

        <div className="flex items-center mb-5">
          {DRIVER_APPLICATION_STEPS.map((s, i) => (
            <div key={s.id} className="flex items-center flex-1 last:flex-none">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0 transition-all ${i < appStep ? "bg-green-600 text-white" : i === appStep ? "bg-green-600 text-white ring-4 ring-green-100" : "bg-gray-100 text-gray-400"}`}>
                {i < appStep ? <Check className="w-3.5 h-3.5" /> : i + 1}
              </div>
              {i < DRIVER_APPLICATION_STEPS.length - 1 && <div className={`h-0.5 flex-1 mx-1 ${i < appStep ? "bg-green-500" : "bg-gray-200"}`} />}
            </div>
          ))}
        </div>
        <p className="text-xs font-semibold text-gray-500 mb-3">{step.label} ({appStep + 1}/{DRIVER_APPLICATION_STEPS.length})</p>

        <div className="bg-white rounded-2xl border shadow-sm p-5 space-y-4">
          {appStep === 0 && (
            <>
              <div className="flex flex-col items-center mb-2">
                <div className="w-24 h-24 rounded-full overflow-hidden bg-gray-100 mb-3 flex items-center justify-center border-2 border-dashed border-gray-300">
                  {appData.profilePhoto ? <img src={appData.profilePhoto} alt="" className="w-full h-full object-cover" /> : <User className="w-8 h-8 text-gray-300" />}
                </div>
                <ImageUploadBox current={appData.profilePhoto} onUpload={url => setAppData(d => ({ ...d, profilePhoto: url }))} label="Upload Profile Photo" aspectHint="Clear face photo" folder="drivers" className="w-full h-24 rounded-xl" />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-gray-500 mb-1">SA ID Number *</label>
                <input value={appData.idNumber} onChange={e => setAppData(d => ({ ...d, idNumber: e.target.value }))} placeholder="13-digit RSA ID number" maxLength={13} className="w-full px-3 py-2.5 rounded-xl border text-sm focus:ring-2 focus:ring-green-500 outline-none" />
              </div>
              <div className="bg-amber-50 rounded-xl p-3 border border-amber-100 flex gap-2">
                <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                <p className="text-[11px] text-amber-700">Your ID is verified against the SA Home Affairs database during background screening.</p>
              </div>
            </>
          )}

          {appStep === 1 && (
            <>
              <div>
                <label className="block text-[11px] font-medium text-gray-500 mb-2">Vehicle Type *</label>
                <div className="grid grid-cols-3 gap-2">
                  {[{ v: "motorbike", l: "Motorbike", e: "🏍️" }, { v: "car", l: "Car", e: "🚗" }, { v: "bakkie", l: "Bakkie", e: "🛻" }].map(vt => (
                    <button key={vt.v} onClick={() => setAppData(d => ({ ...d, vehicleType: vt.v }))} className={`py-3 rounded-xl border text-sm font-semibold flex flex-col items-center gap-1 transition-all ${appData.vehicleType === vt.v ? "border-green-500 bg-green-50 text-green-700 ring-1 ring-green-500" : "border-gray-200 text-gray-600"}`}>
                      <span className="text-xl">{vt.e}</span>{vt.l}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-[11px] font-medium text-gray-500 mb-1">Make *</label><input value={appData.vehicleMake} onChange={e => setAppData(d => ({ ...d, vehicleMake: e.target.value }))} placeholder="e.g. Toyota" className="w-full px-3 py-2.5 rounded-xl border text-sm focus:ring-2 focus:ring-green-500 outline-none" /></div>
                <div><label className="block text-[11px] font-medium text-gray-500 mb-1">Model *</label><input value={appData.vehicleModel} onChange={e => setAppData(d => ({ ...d, vehicleModel: e.target.value }))} placeholder="e.g. Corolla" className="w-full px-3 py-2.5 rounded-xl border text-sm focus:ring-2 focus:ring-green-500 outline-none" /></div>
                <div><label className="block text-[11px] font-medium text-gray-500 mb-1">Year</label><input value={appData.vehicleYear} onChange={e => setAppData(d => ({ ...d, vehicleYear: e.target.value }))} placeholder="e.g. 2019" className="w-full px-3 py-2.5 rounded-xl border text-sm focus:ring-2 focus:ring-green-500 outline-none" /></div>
                <div><label className="block text-[11px] font-medium text-gray-500 mb-1">Colour</label><input value={appData.vehicleColour} onChange={e => setAppData(d => ({ ...d, vehicleColour: e.target.value }))} placeholder="e.g. White" className="w-full px-3 py-2.5 rounded-xl border text-sm focus:ring-2 focus:ring-green-500 outline-none" /></div>
              </div>
              <div><label className="block text-[11px] font-medium text-gray-500 mb-1">Registration Number *</label><input value={appData.vehicleReg} onChange={e => setAppData(d => ({ ...d, vehicleReg: e.target.value.toUpperCase() }))} placeholder="e.g. CA 123-456" className="w-full px-3 py-2.5 rounded-xl border text-sm focus:ring-2 focus:ring-green-500 outline-none" /></div>
            </>
          )}

          {appStep === 2 && (
            <>
              <div className="bg-blue-50 rounded-xl p-3 border border-blue-100 flex gap-2">
                <AlertCircle className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
                <p className="text-[11px] text-blue-700">Upload clear photos of all documents. Files are stored encrypted and used only for identity verification.</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-700 mb-1.5">📄 SA ID Document (front & back)</p>
                <ImageUploadBox current={appData.idDocument} onUpload={url => setAppData(d => ({ ...d, idDocument: url }))} label="Upload ID" folder="docs" className="w-full h-24 rounded-xl" />
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-700 mb-1.5">🪪 Driver's Licence (front)</p>
                <ImageUploadBox current={appData.licenceDocument} onUpload={url => setAppData(d => ({ ...d, licenceDocument: url }))} label="Upload Licence" folder="docs" className="w-full h-24 rounded-xl" />
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-700 mb-1.5">📋 Vehicle Registration / Licence Disc</p>
                <ImageUploadBox current={appData.vehicleRegDocument} onUpload={url => setAppData(d => ({ ...d, vehicleRegDocument: url }))} label="Upload Vehicle Reg" folder="docs" className="w-full h-24 rounded-xl" />
              </div>
            </>
          )}

          {appStep === 3 && (
            <>
              <p className="text-sm font-semibold text-gray-700 mb-1">Answer honestly — your responses form part of your driver agreement.</p>
              <div className="space-y-3">
                {DRIVER_QUIZ.map(q => (
                  <div key={q.key} className="bg-gray-50 rounded-xl p-3 border">
                    <p className="text-xs font-semibold text-gray-800 mb-2">{q.q}</p>
                    <div className="flex gap-2">
                      {["yes", "no"].map(ans => (
                        <button key={ans} onClick={() => setAppData(d => ({ ...d, quiz: { ...d.quiz, [q.key]: ans } }))} className={`flex-1 py-1.5 rounded-lg border text-xs font-bold transition-all ${appData.quiz[q.key] === ans ? (ans === q.bad ? "border-red-500 bg-red-50 text-red-700" : "border-green-500 bg-green-50 text-green-700") : "border-gray-200 text-gray-500"}`}>
                          {ans === "yes" ? "Yes" : "No"}
                        </button>
                      ))}
                    </div>
                    {appData.quiz[q.key] === q.bad && <p className="text-[10px] text-red-600 mt-1 font-medium">⚠ This answer may affect your application</p>}
                  </div>
                ))}
              </div>
              {quizFailed && <div className="bg-red-50 rounded-xl p-3 border border-red-200"><p className="text-xs text-red-700 font-semibold">One or more answers suggest you may not meet our requirements. You can still submit but approval is not guaranteed.</p></div>}
            </>
          )}

          {appStep === 4 && (
            <>
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border">
                {appData.profilePhoto ? <img src={appData.profilePhoto} alt="" className="w-12 h-12 rounded-full object-cover" /> : <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center"><User className="w-5 h-5 text-gray-400" /></div>}
                <div><p className="font-bold text-sm">{currentUser?.firstName} {currentUser?.lastName}</p><p className="text-xs text-gray-500">ID: {appData.idNumber || "Not provided"}</p></div>
              </div>
              <div className="space-y-1">
                {[
                  { label: "Vehicle", value: [appData.vehicleYear, appData.vehicleMake, appData.vehicleModel, appData.vehicleReg ? `(${appData.vehicleReg})` : ""].filter(Boolean).join(" ") || "Not provided" },
                  { label: "ID Document", value: appData.idDocument ? "✓ Uploaded" : "⚠ Missing" },
                  { label: "Licence", value: appData.licenceDocument ? "✓ Uploaded" : "⚠ Missing" },
                  { label: "Vehicle Reg", value: appData.vehicleRegDocument ? "✓ Uploaded" : "⚠ Missing" },
                  { label: "Suitability quiz", value: quizFailed ? "⚠ Issues detected" : "✓ All clear" },
                ].map(item => (
                  <div key={item.label} className="flex justify-between text-sm py-2 border-b last:border-0">
                    <span className="text-gray-500">{item.label}</span>
                    <span className={`font-semibold ${item.value.startsWith("⚠") ? "text-amber-600" : "text-green-700"}`}>{item.value}</span>
                  </div>
                ))}
              </div>
              <div className="bg-green-50 rounded-xl p-3 border border-green-200">
                <p className="text-[11px] text-green-800">By submitting you agree to WeeDeliver's Driver Terms and confirm all information is accurate. Approval takes 2-3 business days.</p>
              </div>
            </>
          )}

          <div className="flex gap-3 pt-2">
            {appStep > 0 && <button onClick={() => setAppStep(s => s - 1)} className="flex-1 py-3 rounded-xl border text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors">Back</button>}
            {appStep < DRIVER_APPLICATION_STEPS.length - 1
              ? <button onClick={() => setAppStep(s => s + 1)} className="flex-1 py-3 rounded-xl text-white font-bold text-sm shadow transition-all hover:shadow-lg" style={{ background: "linear-gradient(135deg, #1A7A2E, #2d9a4a)" }}>Continue</button>
              : <button onClick={submitApplication} disabled={submitting} className={`flex-1 py-3 rounded-xl text-white font-bold text-sm shadow transition-all ${submitting ? "opacity-60 cursor-wait" : "hover:shadow-lg"}`} style={{ background: "linear-gradient(135deg, #1A7A2E, #2d9a4a)" }}>{submitting ? "Submitting..." : "Submit Application"}</button>
            }
          </div>
        </div>
      </div>
    );
  }

  if (!profileLoading && profile?.status === "PENDING_REVIEW") {
    return (
      <div className="max-w-md mx-auto px-4 py-12 text-center">
        <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-4"><Clock className="w-7 h-7 text-amber-600" /></div>
        <h1 className="text-xl font-black mb-2" style={{ fontFamily: "'Outfit', sans-serif" }}>Application Under Review</h1>
        <p className="text-gray-500 text-sm mb-5">Our team is reviewing your documents and running background checks. You'll receive an email within 2-3 business days.</p>
        <div className="bg-white rounded-2xl border p-5 text-left space-y-3">
          {[{ l: "Background check", d: "Verifying ID with Home Affairs" }, { l: "Document review", d: "Checking licence & vehicle registration" }, { l: "Account activation", d: "Pending final approval" }].map((item, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0"><Clock className="w-3.5 h-3.5 text-amber-600" /></div>
              <div><p className="text-xs font-semibold">{item.l}</p><p className="text-[10px] text-gray-400">{item.d}</p></div>
            </div>
          ))}
        </div>
        <p className="text-[11px] text-gray-400 mt-4">Submitted {timeAgo(profile.submittedAt || new Date().toISOString())}</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-3 sm:px-4 py-4 sm:py-5">
      <div className="flex items-center gap-3 mb-4">
        <div className="relative">
          {profile?.profilePhoto ? <img src={profile.profilePhoto} alt="" className="w-11 h-11 rounded-full object-cover border-2 border-green-400" /> : <div className="w-11 h-11 rounded-full bg-gray-200 flex items-center justify-center"><User className="w-5 h-5 text-gray-400" /></div>}
          <div className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white ${driverOnline ? "bg-green-500" : "bg-gray-400"}`} />
        </div>
        <div>
          <h1 className="font-black text-base" style={{ fontFamily: "'Outfit', sans-serif" }}>{currentUser?.firstName} {currentUser?.lastName}</h1>
          <p className="text-[11px]">{driverOnline ? <span className="text-green-600 font-semibold">● Online — ready for deliveries</span> : <span className="text-gray-400">● Offline</span>}</p>
        </div>
      </div>

      <div className="flex gap-1 mb-4 overflow-x-auto scrollbar-hide">
        {[{ id: "status", l: "Status", ic: Activity, b: available.length }, { id: "active", l: "Active", ic: Navigation, b: activeDel ? 1 : 0 }, { id: "earnings", l: "Earnings", ic: DollarSign }, { id: "profile", l: "Profile", ic: User }].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`relative flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${tab === t.id ? "bg-green-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
            <t.ic className="w-3.5 h-3.5" />{t.l}
            {t.b > 0 && <span className={`ml-0.5 px-1.5 py-0.5 text-[9px] rounded-full font-bold ${tab === t.id ? "bg-white text-green-700" : "bg-red-500 text-white animate-pulse"}`}>{t.b}</span>}
          </button>
        ))}
      </div>

      {tab === "status" && (
        <div>
          <div className="bg-white rounded-2xl p-6 border text-center mb-4 shadow-sm">
            <button onClick={() => { setDriverOnline(v => !v); notify(driverOnline ? "You are now offline" : "You're online — ready for deliveries!"); }} className={`w-28 h-28 rounded-full mx-auto mb-3 flex flex-col items-center justify-center shadow-xl transition-all ${driverOnline ? "bg-green-500 ring-4 ring-green-200" : "bg-gray-300 ring-4 ring-gray-100"}`}>
              <span className="text-white text-2xl font-black">{driverOnline ? "ON" : "OFF"}</span>
              <span className="text-white/70 text-[10px] mt-0.5">{driverOnline ? "Tap to go offline" : "Tap to start"}</span>
            </button>
            <h2 className="font-bold">{driverOnline ? "You're live!" : "Go online to start earning"}</h2>
            {driverOnline && <div className="mt-2 flex items-center justify-center gap-1.5 text-green-600 text-xs font-medium"><div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />Listening for orders...</div>}
          </div>
          {driverOnline && (
            <div>
              <h3 className="font-bold text-sm mb-2 flex items-center gap-2">
                <Truck className="w-4 h-4 text-green-600" />Available Deliveries
                {available.length > 0 && <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold">{available.length} new</span>}
              </h3>
              {available.length === 0 ? (
                <div className="bg-gray-50 rounded-xl border border-dashed p-8 text-center"><Truck className="w-8 h-8 text-gray-300 mx-auto mb-2" /><p className="text-xs text-gray-400">No deliveries available right now. Stay online.</p></div>
              ) : available.map(o => (
                <div key={o.id} className="bg-white rounded-xl p-4 border border-green-200 shadow-sm mb-3">
                  <div className="flex justify-between mb-2">
                    <div><p className="font-bold text-sm">#{o.id.slice(0,8).toUpperCase()}</p><p className="text-[11px] text-gray-500">{o.dispensaryName}</p></div>
                    <div className="text-right"><p className="font-bold text-green-700">{formatZAR(Number(o.deliveryFee || 0))}</p><p className="text-[9px] text-gray-400">your fee</p></div>
                  </div>
                  <p className="text-[11px] text-gray-500 mb-1"><MapPin className="w-3 h-3 inline mr-0.5" />Deliver to: {o.deliveryAddress}</p>
                  <p className="text-[10px] text-gray-400 mb-3">{(o.items || []).map(i => `${i.quantity}× ${i.productName}`).join(", ")}</p>
                  <button onClick={() => acceptDelivery(o.id)} className="w-full py-2.5 rounded-xl bg-green-600 text-white font-bold text-sm hover:bg-green-700 flex items-center justify-center gap-1.5 transition-colors"><Check className="w-4 h-4" />Accept Delivery</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "active" && (
        <div>
          {activeDel ? (
            <div>
              <div className="h-32 rounded-2xl bg-gradient-to-br from-green-50 to-emerald-50 flex items-center justify-center border border-green-200 mb-4">{activeDel.status === "IN_TRANSIT" ? <Truck className="w-12 h-12 text-green-600 animate-bounce" /> : <Route className="w-10 h-10 text-green-600" />}</div>
              <div className="bg-white rounded-xl p-4 border shadow-sm space-y-2 mb-3">
                <div className="flex justify-between"><h3 className="font-bold">#{activeDel.id.slice(0,8).toUpperCase()}</h3><StatusBadge status={activeDel.status} /></div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-gray-50 rounded-xl p-3"><p className="text-[10px] text-gray-400 mb-0.5">Pickup from</p><p className="font-semibold">{activeDel.dispensaryName}</p></div>
                  <div className="bg-gray-50 rounded-xl p-3"><p className="text-[10px] text-gray-400 mb-0.5">Deliver to</p><p className="font-semibold text-xs">{activeDel.deliveryAddress}</p></div>
                </div>
                <p className="text-xs text-gray-500">{(activeDel.items || []).map(i => `${i.quantity}× ${i.productName}`).join(", ")}</p>
                <div className="flex justify-between text-sm pt-1"><span className="text-gray-500">Your earnings</span><span className="font-bold text-green-700">{formatZAR(Number(activeDel.deliveryFee || 0))}</span></div>
              </div>
              {activeDel.status === "DRIVER_ASSIGNED" && <button onClick={() => updateOrderStatus(activeDel.id, "IN_TRANSIT")} className="w-full py-3 rounded-xl bg-purple-600 text-white font-bold text-sm flex items-center justify-center gap-2 hover:bg-purple-700 transition-colors"><Package className="w-4 h-4" />Order Collected — Start Delivery</button>}
              {activeDel.status === "IN_TRANSIT" && <button onClick={() => updateOrderStatus(activeDel.id, "DELIVERED")} className="w-full py-3 rounded-xl bg-green-600 text-white font-bold text-sm flex items-center justify-center gap-2 hover:bg-green-700 transition-colors mt-2"><CheckCircle className="w-4 h-4" />Mark as Delivered</button>}
            </div>
          ) : (
            <div className="text-center py-12"><Truck className="w-12 h-12 text-gray-200 mx-auto mb-3" /><p className="text-gray-500 font-semibold text-sm">No active delivery</p><p className="text-xs text-gray-400 mt-1">Go online and accept a delivery to get started</p><button onClick={() => setTab("status")} className="mt-3 px-5 py-2 rounded-full bg-green-600 text-white text-sm font-semibold">Go Online</button></div>
          )}
        </div>
      )}

      {tab === "earnings" && (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-white rounded-xl p-4 border text-center"><p className="text-xl font-black text-green-700">{formatZAR(earnings)}</p><p className="text-[10px] text-gray-500 mt-0.5">Total Earned</p></div>
            <div className="bg-white rounded-xl p-4 border text-center"><p className="text-xl font-black">{completed.length}</p><p className="text-[10px] text-gray-500 mt-0.5">Deliveries</p></div>
            <div className="bg-white rounded-xl p-4 border text-center"><p className="text-xl font-black">{completed.length > 0 ? formatZAR(earnings / completed.length) : "—"}</p><p className="text-[10px] text-gray-500 mt-0.5">Avg / run</p></div>
          </div>
          <div className="bg-white rounded-xl p-4 border">
            <h3 className="font-bold text-sm mb-3">This Week</h3>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={[{ d: "Mon", e: 85 }, { d: "Tue", e: 120 }, { d: "Wed", e: 65 }, { d: "Thu", e: 145 }, { d: "Fri", e: 200 }, { d: "Sat", e: 180 }, { d: "Sun", e: 95 }]}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="d" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => [`R${v}`, "Earnings"]} />
                <Bar dataKey="e" fill="#1A7A2E" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          {completed.length > 0 && (
            <div className="bg-white rounded-xl border overflow-hidden">
              <div className="px-4 py-3 border-b bg-gray-50"><p className="text-xs font-semibold text-gray-600">Recent Deliveries</p></div>
              <div className="divide-y">
                {completed.slice(0, 8).map(o => (
                  <div key={o.id} className="px-4 py-2.5 flex justify-between gap-2">
                    <div><p className="text-xs font-bold">#{o.id.slice(0,8).toUpperCase()}</p><p className="text-[10px] text-gray-400">{o.dispensaryName}</p></div>
                    <p className="text-xs font-bold text-green-700">{formatZAR(Number(o.deliveryFee || 0))}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {tab === "profile" && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl p-5 border shadow-sm">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-16 h-16 rounded-full overflow-hidden bg-gray-100 border-2 border-green-300 flex items-center justify-center">
                {profile?.profilePhoto ? <img src={profile.profilePhoto} alt="" className="w-full h-full object-cover" /> : <User className="w-6 h-6 text-gray-400" />}
              </div>
              <div>
                <p className="font-black text-base">{currentUser?.firstName} {currentUser?.lastName}</p>
                <p className="text-xs text-gray-500">{currentUser?.email}</p>
                <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-bold mt-1 inline-block">✓ Verified Driver</span>
              </div>
            </div>
            <div className="mb-3"><p className="text-[11px] font-medium text-gray-500 mb-1.5">Update Profile Photo</p><ImageUploadBox current={profile?.profilePhoto} onUpload={async url => { await api("PUT", "/drivers/profile", { profilePhoto: url }); setProfile(p => ({ ...p, profilePhoto: url })); notify("Profile photo updated!"); }} label="Change Photo" folder="drivers" className="w-full h-24 rounded-xl" /></div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-gray-50 rounded-xl p-3"><p className="text-[10px] text-gray-400 mb-0.5">Vehicle</p><p className="font-semibold">{profile?.vehicleMake} {profile?.vehicleModel}</p></div>
              <div className="bg-gray-50 rounded-xl p-3"><p className="text-[10px] text-gray-400 mb-0.5">Reg</p><p className="font-semibold">{profile?.vehicleReg || "—"}</p></div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 border">
            <h3 className="font-bold text-sm mb-3 flex items-center gap-2"><CreditCard className="w-4 h-4 text-green-600" />Bank Details for Payouts</h3>
            <p className="text-[11px] text-gray-400 mb-3">WeeDeliver pays drivers weekly via EFT every Friday.</p>
            <div className="space-y-3">
              <div>
                <label className="block text-[11px] text-gray-500 mb-1">Bank</label>
                <select value={appData.bankName} onChange={e => setAppData(d => ({ ...d, bankName: e.target.value }))} className="w-full px-3 py-2.5 rounded-xl border text-sm outline-none bg-white focus:ring-2 focus:ring-green-500">
                  <option value="">Select bank...</option>
                  {SA_BANKS.map(b => <option key={b}>{b}</option>)}
                </select>
              </div>
              <div><label className="block text-[11px] text-gray-500 mb-1">Account Number</label><input value={appData.bankAccount} onChange={e => setAppData(d => ({ ...d, bankAccount: e.target.value }))} placeholder="e.g. 1234567890" className="w-full px-3 py-2.5 rounded-xl border text-sm focus:ring-2 focus:ring-green-500 outline-none" /></div>
              <button onClick={async () => { await api("PUT", "/drivers/banking", { bankName: appData.bankName, accountNumber: appData.bankAccount }); notify("Bank details saved!"); }} className="w-full py-2.5 rounded-xl bg-green-600 text-white font-bold text-sm hover:bg-green-700 transition-colors">Save Bank Details</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
