import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, MapPin, CreditCard, AlertCircle, RefreshCw } from "lucide-react";
import { formatZAR } from "../lib/formatters";
import { api } from "../lib/api";
import { DISPENSARIES } from "../lib/mockData";
import { uid } from "../lib/formatters";
import { useAuth } from "../context/AuthContext";
import { useCart } from "../context/CartContext";
import { useUI } from "../context/UIContext";

export default function CheckoutPage() {
  const nav = useNavigate();
  const { currentUser } = useAuth();
  const { cart, cartTotal, clearCart } = useCart();
  const { notify } = useUI();
  const [pay, setPay] = useState("yoco");
  const [addr, setAddr] = useState("123 Main Rd, Cape Town");
  const [processing, setProcessing] = useState(false);
  const [paymentError, setPaymentError] = useState(null);
  const [cartDispensary, setCartDispensary] = useState(null);

  useEffect(() => {
    if (cart.length === 0) return;
    api("GET", "/dispensaries").then(res => {
      const disps = res.ok && res.data ? res.data : DISPENSARIES;
      setCartDispensary(disps.find(d => d.id === cart[0].dispensaryId) || null);
    });
  }, [cart.length > 0 ? cart[0].dispensaryId : null]);

  if (cart.length === 0) return <div className="max-w-md mx-auto px-4 py-12 text-center"><p className="text-gray-500">Cart empty</p><button onClick={() => nav("/")} className="mt-3 px-5 py-2 rounded-full bg-green-600 text-white font-semibold text-sm">Shop</button></div>;

  const totalAmount = cartTotal + Number(cartDispensary?.deliveryFee || 0);

  const handlePlaceOrder = async () => {
    setPaymentError(null);
    setProcessing(true);

    const orderPayload = {
      dispensaryId: cart[0].dispensaryId,
      deliveryAddress: addr,
      paymentMethod: pay,
      items: cart.map(i => ({ productId: i.id, quantity: i.quantity })),
    };

    const orderRes = await api("POST", "/orders", orderPayload);
    let orderId = orderRes.ok && orderRes.data?.id ? orderRes.data.id : uid("o");

    if (pay === "yoco" || pay === "paystack") {
      try {
        const res = await api("POST", "/payments/initiate", { orderId, provider: pay.toUpperCase() });
        if (res.data?.redirectUrl) {
          notify(`Redirecting to ${pay === "yoco" ? "Yoco" : "Paystack"} checkout...`);
          clearCart();
          window.location.href = res.data.redirectUrl;
          return;
        } else {
          notify(`Order #${String(orderId).slice(0,8).toUpperCase()} placed! (Demo mode)`);
          clearCart();
          nav(`/order/${orderId}`);
        }
      } catch {
        notify(`Order #${String(orderId).slice(0,8).toUpperCase()} placed! (Demo mode)`);
        clearCart();
        nav(`/order/${orderId}`);
      }
    } else {
      notify(`Order #${String(orderId).slice(0,8).toUpperCase()} placed!`);
      clearCart();
      nav(`/order/${orderId}`);
    }
    setProcessing(false);
  };

  return (
    <div className="max-w-2xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
      <button onClick={() => nav("/cart")} className="flex items-center gap-1 text-gray-500 text-xs sm:text-sm mb-2 sm:mb-3"><ArrowLeft className="w-4 h-4" /> Cart</button>
      <h1 className="text-lg sm:text-xl font-black mb-3 sm:mb-4" style={{ fontFamily: "'Outfit', sans-serif" }}>Checkout</h1>
      <div className="space-y-4">
        <div className="bg-white rounded-xl p-4 border"><h3 className="font-bold text-sm mb-2"><MapPin className="w-4 h-4 inline text-green-600 mr-1" />Delivery Address</h3><input value={addr} onChange={e => setAddr(e.target.value)} className="w-full px-3 py-2.5 rounded-xl border text-sm focus:ring-2 focus:ring-green-500 outline-none" /></div>
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
