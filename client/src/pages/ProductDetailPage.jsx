import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Leaf, Minus, Plus } from "lucide-react";
import { CATEGORY_LABELS } from "../lib/constants";
import { formatZAR } from "../lib/formatters";
import { api } from "../lib/api";
import { SpectrumBar } from "../components/SpectrumBar";
import { useCart } from "../context/CartContext";
import { useUI } from "../context/UIContext";

export default function ProductDetailPage() {
  const nav = useNavigate();
  const { dispensarySlug, productId } = useParams();
  const { cart, addToCart, updateCartQty } = useCart();
  const { notify } = useUI();
  const [qty, setQty] = useState(1);
  const [p, setP] = useState(null);
  const [d, setD] = useState(null);
  const [otherProducts, setOtherProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api("GET", `/dispensaries/${dispensarySlug}`).then(res => {
      if (res.ok && res.data) {
        setD(res.data);
        const products = res.data.products || [];
        const product = products.find(x => x.id === productId);
        setP(product || null);
        setOtherProducts(products.filter(x => x.id !== productId).slice(0, 6));
      }
      setLoading(false);
    });
  }, [dispensarySlug, productId]);

  if (loading) return <div className="p-8 text-center text-gray-400">Loading...</div>;
  if (!p || !d) return <div className="p-8 text-center text-gray-400">Product not found</div>;

  const sc = { SATIVA: "bg-amber-100 text-amber-800", INDICA: "bg-indigo-100 text-indigo-800", HYBRID: "bg-emerald-100 text-emerald-800" };
  const inCart = cart.find(i => i.id === p.id);
  const inStock = p.stock == null || p.stock > 0;

  const handleAddToCart = () => {
    if (!inStock) return;
    if (inCart) {
      updateCartQty(p.id, inCart.quantity + qty);
    } else {
      addToCart(p);
      if (qty > 1) updateCartQty(p.id, qty);
    }
    notify(`${p.name} added to cart`);
  };

  return (
    <div className="max-w-3xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
      <button onClick={() => nav(`/dispensary/${d.slug}`)} className="flex items-center gap-1 text-gray-500 hover:text-gray-700 text-xs sm:text-sm mb-3 sm:mb-4">
        <ArrowLeft className="w-4 h-4" /> Back to {d.name}
      </button>

      <div className="bg-white rounded-xl sm:rounded-2xl border overflow-hidden grid md:grid-cols-2 shadow-sm">
        <div className="h-52 sm:h-64 md:h-auto bg-gray-100 flex items-center justify-center overflow-hidden relative">
          {p.imageUrl ? <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover" /> : <Leaf className="w-20 h-20 text-gray-300" />}
          {!inStock && <div className="absolute inset-0 bg-black/40 flex items-center justify-center"><span className="bg-white text-gray-800 font-bold text-sm px-4 py-2 rounded-full">Out of Stock</span></div>}
        </div>

        <div className="p-5 md:p-6 flex flex-col">
          <div className="flex flex-wrap gap-2 mb-2">
            {p.strainType && <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${sc[p.strainType]}`}>{p.strainType}</span>}
            <span className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{CATEGORY_LABELS[p.category]}</span>
            {inStock && p.stock != null && p.stock <= 5 && <span className="text-[10px] bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-bold">Only {p.stock} left</span>}
          </div>

          <h1 className="text-xl sm:text-2xl font-black mb-1" style={{ fontFamily: "'Outfit', sans-serif" }}>{p.name}</h1>
          <p className="text-2xl font-bold text-green-700 mb-1">{formatZAR(p.price)} <span className="text-sm font-normal text-gray-400">{p.unit}</span></p>
          {inCart && <p className="text-xs text-green-600 font-semibold mb-2">{inCart.quantity} already in cart</p>}
          <p className="text-gray-600 text-sm mb-4 flex-1">{p.description}</p>

          {(p.thcPercent != null || (p.cbdPercent != null && p.cbdPercent > 0)) && (
            <div className="space-y-2 mb-4">
              {p.thcPercent != null && (
                <div>
                  <div className="flex justify-between text-xs mb-0.5"><span className="text-gray-500 font-medium">THC</span><span className="font-bold">{p.thcPercent}%</span></div>
                  <div className="h-1.5 bg-gray-100 rounded-full"><div className="h-1.5 bg-amber-400 rounded-full" style={{ width: `${Math.min(p.thcPercent, 35) / 35 * 100}%` }} /></div>
                </div>
              )}
              {p.cbdPercent != null && p.cbdPercent > 0 && (
                <div>
                  <div className="flex justify-between text-xs mb-0.5"><span className="text-gray-500 font-medium">CBD</span><span className="font-bold">{p.cbdPercent}%</span></div>
                  <div className="h-1.5 bg-gray-100 rounded-full"><div className="h-1.5 bg-blue-400 rounded-full" style={{ width: `${Math.min(p.cbdPercent, 25) / 25 * 100}%` }} /></div>
                </div>
              )}
            </div>
          )}

          {p.effectSpectrum && <div className="mb-4"><SpectrumBar value={p.effectSpectrum} /></div>}

          <div className="flex gap-2 mt-auto">
            <div className="flex items-center border rounded-full overflow-hidden bg-gray-50">
              <button onClick={() => setQty(q => Math.max(1, q - 1))} className="w-9 h-10 flex items-center justify-center text-gray-600 hover:bg-gray-100 transition-colors"><Minus className="w-3.5 h-3.5" /></button>
              <span className="w-8 text-center font-bold text-sm">{qty}</span>
              <button onClick={() => setQty(q => q + 1)} className="w-9 h-10 flex items-center justify-center text-gray-600 hover:bg-gray-100 transition-colors"><Plus className="w-3.5 h-3.5" /></button>
            </div>
            <button onClick={handleAddToCart} disabled={!inStock} className={`flex-1 py-2.5 rounded-full text-white font-bold shadow text-sm transition-all ${inStock ? "hover:shadow-lg active:scale-[0.98]" : "opacity-50 cursor-not-allowed"}`} style={{ background: inStock ? "linear-gradient(135deg, #1A7A2E, #2d9a4a)" : undefined, backgroundColor: inStock ? undefined : "#9ca3af" }}>
              {inStock ? (inCart ? `Add ${qty} more · ${formatZAR(p.price * qty)}` : `Add to Cart · ${formatZAR(p.price * qty)}`) : "Out of Stock"}
            </button>
          </div>
        </div>
      </div>

      {otherProducts.length > 0 && (
        <div className="mt-6">
          <h2 className="text-base font-black mb-3" style={{ fontFamily: "'Outfit', sans-serif" }}>Also from {d.name}</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {otherProducts.map(op => (
              <button key={op.id} onClick={() => nav(`/product/${d.slug}/${op.id}`)} className="bg-white rounded-xl border p-3 text-left hover:shadow-md transition-shadow group">
                <div className="h-20 bg-gray-50 rounded-lg mb-2 flex items-center justify-center overflow-hidden">
                  {op.imageUrl ? <img src={op.imageUrl} alt={op.name} className="w-full h-full object-cover rounded-lg group-hover:scale-105 transition-transform" /> : <Leaf className="w-8 h-8 text-gray-200" />}
                </div>
                <p className="text-xs font-bold truncate">{op.name}</p>
                <p className="text-xs text-green-700 font-bold">{formatZAR(op.price)}</p>
                {op.strainType && <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full mt-1 inline-block ${sc[op.strainType] || "bg-gray-100 text-gray-600"}`}>{op.strainType}</span>}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
