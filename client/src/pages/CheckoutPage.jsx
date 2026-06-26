import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, MapPin, CreditCard, AlertCircle, RefreshCw } from "lucide-react";
import { formatZAR } from "../lib/formatters";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { useCart } from "../context/CartContext";
import { useUI } from "../context/UIContext";

export default function CheckoutPage() {
  const nav = useNavigate();
  const { currentUser, setCurrentUser } = useAuth();
  const { cart, cartTotal, clearCart } = useCart();
  const { notify } = useUI();
  const [pay, setPay] = useState("yoco");
  const [addr, setAddr] = useState("");
  const [dob, setDob] = useState("");
  const [processing, setProcessing] = useState(false);
  const [paymentError, setPaymentError] = useState(null);
  const [cartDispensary, setCartDispensary] = useState(null);

  const needsAge = currentUser && !currentUser.isAgeVerified;

  useEffect(() => {
    if (cart.length === 0) return;
    api("GET", "/dispensaries").then(res => {
      const disps = res.ok && Array.isArray(res.data) ? res.data : [];
      setCartDispensary(disps.find(d => d.id === cart[0].dispensaryId) || null);
    });
  }, [cart.length > 0 ? cart[0].dispensaryId : null]);

  if (cart.length === 0) return <div className="max-w-md mx-auto px-4 py-12 text-center"><p className="text-gray-500">Cart empty</p><button onClick={() => nav("/")} className="mt-3 px-5 py-2 rounded-full bg-green-600 text-white font-semibold text-sm">Shop</button></div>;

  const totalAmount = cartTotal + Number(cartDispensary?.deliveryFee || 0);

  const handlePlaceOrder = async () => {
    setPaymentError(null);
    if (!addr.trim()) { setPaymentError("Please enter a delivery address."); return; }
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
      deliveryAddress: addr,
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

    // 4. Card / EFT — start the payment and redirect to the provider's checkout.
    if (pay === "yoco" || pay === "paystack") {
      const res = await api("POST", "/payments/initiate", { orderId, provider: pay.toUpperCase() });
      if (res.ok && res.data?.redirectUrl) {
        notify(`Redirecting to ${pay === "yoco" ? "Yoco" : "Paystack"} checkout…`);
        clearCart();
        window.location.href = res.data.redirectUrl;
        return;
      }
      setPaymentError(res.data?.error || "Couldn't start the payment. Your order is saved — please try paying again.");
      setProcessing(false);
      return;
    }

    // Other methods (SnapScan / EFT) — go to the order page for instructions.
    clearCart();
    nav(`/order/${orderId}`);
    setProcessing(false);
  };

  return (
    <div className="max-w-2xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
      <button onClick={() => nav("/cart")} className="flex items-center gap-1 text-gray-500 text-xs sm:text-sm mb-2 sm:mb-3"><ArrowLeft className="w-4 h-4" /> Cart</button>
      <h1 className="text-lg sm:text-xl font-black mb-3 sm:mb-4" style={{ fontFamily: "'Outfit', sans-serif" }}>Checkout</h1>
      <div className="space-y-4">
        <div className="bg-white rounded-xl p-4 border"><h3 className="font-bold text-sm mb-2"><MapPin className="w-4 h-4 inline text-green-600 mr-1" />Delivery Address</h3><input value={addr} onChange={e => setAddr(e.target.value)} placeholder="Street, suburb, city" className="w-full px-3 py-2.5 rounded-xl border text-sm focus:ring-2 focus:ring-green-500 outline-none" /></div>
        {needsAge && (
          <div className="bg-amber-50 rounded-xl p-4 border border-amber-200">
            <h3 className="font-bold text-sm mb-1 text-amber-800">Age Verification (18+)</h3>
            <p className="text-[11px] text-amber-700 mb-2">Cannabis is for adults only. Confirm your date of birth to place your first order.</p>
            <input type="date" value={dob} onChange={e => setDob(e.target.value)} max={new Date().toISOString().slice(0, 10)} className="w-full px-3 py-2.5 rounded-xl border text-sm focus:ring-2 focus:ring-green-500 outline-none bg-white" />
          </div>
        )}
        <div className="bg-white rounded-xl p-4 border"><h3 className="font-bold text-sm mb-2"><CreditCard className="w-4 h-4 inline text-green-600 mr-1" />Payment Method</h3>
          {[{ id: "yoco", l: "Pay by Card", sub: "Yoco - Visa, Mastercard, Amex", ic: "\u{1F4B3}" }, { id: "paystack", l: "EFT / Card", sub: "Paystack - Instant EFT or card", ic: "\u{1F3E6}" }].map(m => (
            <button key={m.id} onClick={() => setPay(m.id)} className={`w-full p-3 rounded-xl border text-left flex items-center gap-3 mb-2 transition-all ${pay === m.id ? "border-green-500 bg-green-50 ring-1 ring-green-500 shadow-sm" : "border-gray-200 hover:border-gray-300"}`}>
              <span className="text-lg">{m.ic}</span>
              <div className="flex-1"><div className="text-sm font-semibold">{m.l}</div><div className="text-[10px] text-gray-400">{m.sub}</div></div>
              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${pay === m.id ? "border-green-600" : "border-gray-300"}`}>{pay === m.id && <div className="w-2.5 h-2.5 rounded-full bg-green-600" />}</div>
            </button>
          ))}
        </div>
        <div className="bg-white rounded-xl p-4 border"><h3 className="font-bold text-sm mb-2">Order Summary</h3>
          {cart.map(i => <div key={i.id} className="flex justify-between text-sm py-0.5"><span className="text-gray-600">{i.quantity}x {i.name}</span><span>{formatZAR(i.price * i.quantity)}</span></div>)}
          <hr className="my-2" /><div className="flex justify-between text-sm"><span className="text-gray-500">Delivery</span><span>{formatZAR(cartDispensary?.deliveryFee || 0)}</span></div>
          <div className="flex justify-between mt-1"><span className="font-bold">Total</span><span className="font-black text-green-700 text-lg">{formatZAR(totalAmount)}</span></div>
        </div>
        {paymentError && <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-center gap-2"><AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" /><span className="text-xs text-red-700">{paymentError}</span></div>}
        <button onClick={handlePlaceOrder} disabled={processing} className={`w-full py-3.5 rounded-full text-white font-bold text-base shadow-lg transition-all ${processing ? "opacity-60 cursor-wait" : "hover:shadow-xl active:scale-[0.98]"}`} style={{ background: "linear-gradient(135deg, #1A7A2E, #2d9a4a)" }}>
          {processing ? <span className="flex items-center justify-center gap-2"><RefreshCw className="w-4 h-4 animate-spin" />Processing...</span> : `Pay ${formatZAR(totalAmount)}`}
        </button>
        <p className="text-center text-[10px] text-gray-400">Secure payment powered by {pay === "yoco" ? "Yoco" : "Paystack"}</p>
      </div>
    </div>
  );
}
