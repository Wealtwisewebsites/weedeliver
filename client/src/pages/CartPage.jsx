import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ShoppingCart, Store, Leaf, Minus, Plus, Trash2 } from "lucide-react";
import { formatZAR } from "../lib/formatters";
import { api } from "../lib/api";
import { DISPENSARIES } from "../lib/mockData";
import { useAuth } from "../context/AuthContext";
import { useCart } from "../context/CartContext";

export default function CartPage() {
  const nav = useNavigate();
  const { currentUser } = useAuth();
  const { cart, updateCartQty, removeFromCart, cartTotal } = useCart();
  const [cartDispensary, setCartDispensary] = useState(null);

  useEffect(() => {
    if (cart.length === 0) { setCartDispensary(null); return; }
    api("GET", "/dispensaries").then(res => {
      const disps = res.ok && res.data ? res.data : DISPENSARIES;
      setCartDispensary(disps.find(d => d.id === cart[0].dispensaryId) || null);
    });
  }, [cart.length > 0 ? cart[0].dispensaryId : null]);

  if (cart.length === 0) return <div className="max-w-md mx-auto px-4 py-12 sm:py-16 text-center"><ShoppingCart className="w-12 sm:w-14 h-12 sm:h-14 text-gray-300 mx-auto mb-3" /><h2 className="text-base sm:text-lg font-bold mb-2">Cart is empty</h2><button onClick={() => nav("/")} className="px-5 py-2 rounded-full bg-green-600 text-white font-semibold text-sm">Shop Now</button></div>;

  return (
    <div className="max-w-2xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
      <h1 className="text-lg sm:text-xl font-black mb-3 sm:mb-4" style={{ fontFamily: "'Outfit', sans-serif" }}>Your Cart</h1>
      {cartDispensary && <p className="text-xs text-gray-500 mb-3"><Store className="w-3.5 h-3.5 inline mr-1" />From {cartDispensary.name}</p>}
      <div className="space-y-2 mb-3 sm:mb-4">{cart.map(item => (
        <div key={item.id} className="bg-white rounded-lg sm:rounded-xl p-2.5 sm:p-3 border flex items-center gap-2 sm:gap-3">
          <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-lg bg-gray-50 flex items-center justify-center flex-shrink-0">{item.imageUrl ? <img src={item.imageUrl} alt="" className="w-full h-full object-cover rounded-lg" /> : <Leaf className="w-5 sm:w-6 h-5 sm:h-6 text-green-200" />}</div>
          <div className="flex-1 min-w-0"><h3 className="font-semibold text-xs sm:text-sm truncate">{item.name}</h3><p className="text-green-700 font-bold text-xs sm:text-sm">{formatZAR(item.price)}</p></div>
          <div className="flex items-center gap-1"><button onClick={() => updateCartQty(item.id, item.quantity - 1)} className="w-6 h-6 sm:w-7 sm:h-7 rounded-md sm:rounded-lg bg-gray-100 flex items-center justify-center"><Minus className="w-3 h-3" /></button><span className="w-4 sm:w-5 text-center font-bold text-xs sm:text-sm">{item.quantity}</span><button onClick={() => updateCartQty(item.id, item.quantity + 1)} className="w-6 h-6 sm:w-7 sm:h-7 rounded-md sm:rounded-lg bg-gray-100 flex items-center justify-center"><Plus className="w-3 h-3" /></button></div>
          <button onClick={() => removeFromCart(item.id)} className="p-1 text-gray-400 hover:text-red-500"><Trash2 className="w-3.5 sm:w-4 h-3.5 sm:h-4" /></button>
        </div>
      ))}</div>
      <div className="bg-white rounded-xl p-4 border space-y-2">
        <div className="flex justify-between text-sm"><span className="text-gray-500">Subtotal</span><span className="font-semibold">{formatZAR(cartTotal)}</span></div>
        <div className="flex justify-between text-sm"><span className="text-gray-500">Delivery</span><span className="font-semibold">{formatZAR(cartDispensary?.deliveryFee || 0)}</span></div>
        <hr /><div className="flex justify-between"><span className="font-bold">Total</span><span className="font-black text-green-700">{formatZAR(cartTotal + Number(cartDispensary?.deliveryFee || 0))}</span></div>
        <button onClick={() => currentUser ? nav("/checkout") : nav("/login")} className="w-full py-3 rounded-full text-white font-bold shadow-lg" style={{ background: "linear-gradient(135deg, #1A7A2E, #2d9a4a)" }}>Proceed to Checkout</button>
      </div>
    </div>
  );
}
