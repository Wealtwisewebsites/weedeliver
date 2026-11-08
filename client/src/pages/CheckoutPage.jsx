import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, MapPin, CreditCard, AlertCircle, RefreshCw, Truck, Store } from "lucide-react";
import { formatZAR } from "../lib/formatters";
import { api } from "../lib/api";
import { PAYMENT_OPTIONS, fetchPaymentProviders } from "../lib/payments";
import { useAuth } from "../context/AuthContext";
import { useCart } from "../context/CartContext";
import { useUI } from "../context/UIContext";

export default function CheckoutPage() {
  const nav = useNavigate();
  const { currentUser, setCurrentUser } = useAuth();
  const { cart, cartTotal, clearCart } = useCart();
  const { notify } = useUI();
  // null while loading; then only the providers the server can actually process (Stitch first).
  const [providers, setProviders] = useState(null);
  const [pay, setPay] = useState(null);
  const [fulfillment, setFulfillment] = useState("DELIVERY");
  const [addr, setAddr] = useState("");
  const [dob, setDob] = useState("");
  const [processing, setProcessing] = useState(false);
  const [paymentError, setPaymentError] = useState(null);
  const [cartDispensary, setCartDispensary] = useState(null);

  const needsAge = currentUser && !currentUser.isAgeVerified;

  useEffect(() => {
    fetchPaymentProviders().then(list => {
      setProviders(list);
      setPay(current => current ?? list[0] ?? null);
    });
  }, []);

  useEffect(() => {
    if (cart.length === 0) return;
    api("GET", "/dispensaries").then(res => {
      const disps = res.ok && Array.isArray(res.data) ? res.data : [];
      setCartDispensary(disps.find(d => d.id === cart[0].dispensaryId) || null);
    });
  }, [cart.length > 0 ? cart[0].dispensaryId : null]);

  if (cart.length === 0) return <div className="max-w-md mx-auto px-4 py-12 text-center"><p className="text-gray-500">Cart empty</p><button onClick={() => nav("/")} className="mt-3 px-5 py-2 rounded-full bg-green-600 text-white font-semibold text-sm">Shop</button></div>;

  const isPickup = fulfillment === "PICKUP";
  const deliveryFee = isPickup ? 0 : Number(cartDispensary?.deliveryFee || 0);
  const totalAmount = cartTotal + deliveryFee;

  const handlePlaceOrder = async () => {
    setPaymentError(null);
    // Never create an order the customer has no way to pay for.
    if (!pay) { setPaymentError("Online payment is unavailable right now. Please try again shortly."); return; }
    if (!isPickup && !addr.trim()) { setPaymentError("Please enter a delivery address."); return; }
    setProcessing(true);

    // 1. Age verification (18+) — required before any cannabis order can be placed.
    if (needsAge) {
      if (!dob) { setPaymentError("Please enter your date of birth to confirm you're 18 or older."); setProcessing(false); return; }
      const ageRes = await api("POST", "/auth/verify-age", { dateOfBirth: dob });
      if (!ageRes.ok) { setPaymentError(ageRes.data?.error || "You must be 18 or older to order."); setProcessing(false); return; }
      setCurrentUser(u => (u ? { ...u, isAgeVerified: true } : u));
    }

    // 2. Ensure an active membership with this dispensary (auto-approved for free dispensaries).
    const memRes = await api("POST", "/memberships", { dispensaryId: cart[0].dispensaryId });
    if (!memRes.ok && memRes.status !== 400) {
      setPaymentError(memRes.data?.error || "Couldn't join this dispensary. Please try again.");
      setProcessing(false); return;
    }

    // 3. Create the order.
    const orderRes = await api("POST", "/orders", {
      dispensaryId: cart[0].dispensaryId,
      fulfillmentType: fulfillment,
      ...(isPickup ? {} : { deliveryAddress: addr }),
      items: cart.map(i => ({ productId: i.id, quantity: i.quantity })),
    });
    if (!orderRes.ok || !orderRes.data?.id) {
      const msg = orderRes.data?.requiresMembership
        ? "This dispensary requires an approved membership before you can order."
        : orderRes.data?.requiresAgeVerification
          ? "Please verify your age to place an order."
          : orderRes.data?.error || "Couldn't place your order. Please try again.";
      setPaymentError(msg); setProcessing(false); return;
    }
    const orderId = orderRes.data.id;

    // 4. Card / EFT — start the payment and redirect to the provider's hosted checkout.
    const res = await api("POST", "/payments/initiate", { orderId, provider: pay });
    if (res.ok && res.data?.redirectUrl) {
      notify(`Redirecting to ${PAYMENT_OPTIONS[pay].label} checkout…`);
      clearCart();
      window.location.href = res.data.redirectUrl;
      return;
    }
    setPaymentError(res.data?.error || "Couldn't start the payment. Your order is saved — please try paying again.");
    setProcessing(false);
  };

  return (
    <div className="max-w-2xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
      <button onClick={() => nav("/cart")} className="flex items-center gap-1 text-gray-500 text-xs sm:text-sm mb-2 sm:mb-3"><ArrowLeft className="w-4 h-4" /> Cart</button>
      <h1 className="text-lg sm:text-xl font-black mb-3 sm:mb-4" style={{ fontFamily: "'Outfit', sans-serif" }}>Checkout</h1>
      <div className="space-y-4">
        <div className="bg-white rounded-xl p-4 border">
          <h3 className="font-bold text-sm mb-3">How would you like to get your order?</h3>
          <div className="grid grid-cols-2 gap-2 mb-3">
            {[{ v: "DELIVERY", l: "Delivery", ic: Truck, sub: Number(cartDispensary?.deliveryFee) ? formatZAR(cartDispensary.deliveryFee) : "Free" }, { v: "PICKUP", l: "Pickup", ic: Store, sub: "Free — collect yourself" }].map(o => (
              <button key={o.v} onClick={() => setFulfillment(o.v)} className={`p-3 rounded-xl border text-left transition-all ${fulfillment === o.v ? "border-green-500 bg-green-50 ring-1 ring-green-500" : "border-gray-200 hover:border-gray-300"}`}>
                <o.ic className={`w-5 h-5 mb-1 ${fulfillment === o.v ? "text-green-600" : "text-gray-400"}`} />
                <div className="text-sm font-bold">{o.l}</div>
                <div className="text-[10px] text-gray-500">{o.sub}</div>
              </button>
            ))}
          </div>
          {isPickup ? (
            <div className="bg-green-50 rounded-xl p-3 border border-green-100 flex items-start gap-2">
              <Store className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
              <p className="text-[11px] text-green-800">You'll collect this order from <b>{cartDispensary?.name || "the dispensary"}</b>{cartDispensary?.address ? ` — ${cartDispensary.address}` : ""}. No driver needed — we'll notify you when it's ready.</p>
            </div>
          ) : (
            <div>
              <label className="block text-[11px] font-medium text-gray-500 mb-1"><MapPin className="w-3.5 h-3.5 inline text-green-600 mr-0.5" />Delivery Address</label>
              <input value={addr} onChange={e => setAddr(e.target.value)} placeholder="Street, suburb, city" className="w-full px-3 py-2.5 rounded-xl border text-sm focus:ring-2 focus:ring-green-500 outline-none" />
            </div>
          )}
        </div>
        {needsAge && (
          <div className="bg-amber-50 rounded-xl p-4 border border-amber-200">
            <h3 className="font-bold text-sm mb-1 text-amber-800">Age Verification (18+)</h3>
            <p className="text-[11px] text-amber-700 mb-2">Cannabis is for adults only. Confirm your date of birth to place your first order.</p>
            <input type="date" value={dob} onChange={e => setDob(e.target.value)} max={new Date().toISOString().slice(0, 10)} className="w-full px-3 py-2.5 rounded-xl border text-sm focus:ring-2 focus:ring-green-500 outline-none bg-white" />
          </div>
        )}
        <div className="bg-white rounded-xl p-4 border"><h3 className="font-bold text-sm mb-2"><CreditCard className="w-4 h-4 inline text-green-600 mr-1" />Payment Method</h3>
          {providers === null && <p className="text-xs text-gray-400 py-2">Loading payment options…</p>}
          {providers?.length === 0 && (
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-3">Online payment is unavailable right now. Please try again shortly.</p>
          )}
          {providers?.map(code => {
            const m = PAYMENT_OPTIONS[code];
            return (
              <button key={code} onClick={() => setPay(code)} className={`w-full p-3 rounded-xl border text-left flex items-center gap-3 mb-2 transition-all ${pay === code ? "border-green-500 bg-green-50 ring-1 ring-green-500 shadow-sm" : "border-gray-200 hover:border-gray-300"}`}>
                <span className="text-lg">{m.icon}</span>
                <div className="flex-1"><div className="text-sm font-semibold">{m.title}</div><div className="text-[10px] text-gray-400">{m.sub}</div></div>
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${pay === code ? "border-green-600" : "border-gray-300"}`}>{pay === code && <div className="w-2.5 h-2.5 rounded-full bg-green-600" />}</div>
              </button>
            );
          })}
        </div>
        <div className="bg-white rounded-xl p-4 border"><h3 className="font-bold text-sm mb-2">Order Summary</h3>
          {cart.map(i => <div key={i.id} className="flex justify-between text-sm py-0.5"><span className="text-gray-600">{i.quantity}x {i.name}</span><span>{formatZAR(i.price * i.quantity)}</span></div>)}
          <hr className="my-2" /><div className="flex justify-between text-sm"><span className="text-gray-500">{isPickup ? "Pickup" : "Delivery"}</span><span>{isPickup ? "Free" : formatZAR(deliveryFee)}</span></div>
          <div className="flex justify-between mt-1"><span className="font-bold">Total</span><span className="font-black text-green-700 text-lg">{formatZAR(totalAmount)}</span></div>
        </div>
        {paymentError && <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-center gap-2"><AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" /><span className="text-xs text-red-700">{paymentError}</span></div>}
        <button onClick={handlePlaceOrder} disabled={processing || !pay} className={`w-full py-3.5 rounded-full text-white font-bold text-base shadow-lg transition-all ${processing ? "opacity-60 cursor-wait" : !pay ? "opacity-50 cursor-not-allowed" : "hover:shadow-xl active:scale-[0.98]"}`} style={{ background: "linear-gradient(135deg, #1A7A2E, #2d9a4a)" }}>
          {processing ? <span className="flex items-center justify-center gap-2"><RefreshCw className="w-4 h-4 animate-spin" />Processing...</span> : `Pay ${formatZAR(totalAmount)}`}
        </button>
        <p className="text-center text-[10px] text-gray-400">Secure payment powered by {PAYMENT_OPTIONS[pay]?.label || "our payment partner"}</p>
      </div>
    </div>
  );
}
