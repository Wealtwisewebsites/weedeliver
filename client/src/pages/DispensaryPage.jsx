import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Star, Clock, MapPin, Truck, Leaf, Eye, Heart, Phone, Shield, Search } from "lucide-react";
import { CATEGORY_LABELS, DISP_COLORS } from "../lib/constants";
import { formatZAR, timeAgo } from "../lib/formatters";
import { DISPENSARIES, PRODUCTS } from "../lib/mockData";
import { api } from "../lib/api";
import { LeafIcon } from "../components/BrandLogo";
import { ProductCard } from "../components/ProductCard";
import { useCart } from "../context/CartContext";

export default function DispensaryPage() {
  const nav = useNavigate();
  const { slug } = useParams();
  const { addToCart } = useCart();
  const [d, setD] = useState(null);
  const [dispProducts, setDispProducts] = useState([]);
  const [cat, setCat] = useState("ALL");
  const [search, setSearch] = useState("");
  const [showAbout, setShowAbout] = useState(false);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api("GET", `/dispensaries/${slug}`).then(res => {
      if (res.ok && res.data) {
        setD(res.data);
        setDispProducts(res.data.products || PRODUCTS.filter(p => p.dispensaryId === res.data.id));
        setReviews(res.data.reviews || []);
      } else {
        const mock = DISPENSARIES.find(x => x.slug === slug);
        if (mock) { setD(mock); setDispProducts(PRODUCTS.filter(p => p.dispensaryId === mock.id)); }
      }
      setLoading(false);
    });
  }, [slug]);

  if (loading) return <div className="p-8 text-center text-gray-500">Loading...</div>;
  if (!d) return <div className="p-8 text-center text-gray-500">Not found</div>;

  const cats = ["ALL", ...new Set(dispProducts.map(p => p.category))];
  const filtered = dispProducts.filter(p => (cat === "ALL" || p.category === cat) && p.name.toLowerCase().includes(search.toLowerCase()));
  const fallbackColor = DISP_COLORS[d.id] || "#1A7A2E";

  return (
    <div className="bg-gray-50 min-h-screen">
      <div className="relative overflow-hidden" style={{ background: d.bannerUrl ? undefined : fallbackColor }}>
        {d.bannerUrl ? <img src={d.bannerUrl} alt="" className="absolute inset-0 w-full h-full object-cover" /> : <div className="absolute inset-0 opacity-15"><LeafIcon className="absolute text-white w-20 h-20 top-4 right-8 rotate-12" /><LeafIcon className="absolute text-white w-14 h-14 bottom-6 left-12 -rotate-30" /><LeafIcon className="absolute text-white w-10 h-10 top-8 left-1/3 rotate-45" /></div>}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-black/10" />
        <button onClick={() => nav("/")} className="absolute top-3 left-3 flex items-center gap-1 bg-black/30 backdrop-blur-sm text-white text-sm px-3 py-1.5 rounded-full hover:bg-black/50 transition-colors z-10"><ArrowLeft className="w-4 h-4" /> Back</button>
        {d.openNow && <div className="absolute top-3 right-3 flex items-center gap-1.5 bg-green-500 text-white text-xs font-bold px-3 py-1.5 rounded-full z-10"><div className="w-2 h-2 rounded-full bg-white animate-pulse" />Open Now</div>}
        <div className="relative z-10 max-w-4xl mx-auto px-3 sm:px-4 pt-16 sm:pt-24 pb-5 sm:pb-8 md:pt-36 md:pb-10">
          <div className="flex items-end gap-3 sm:gap-4">
            <div className="w-18 h-18 sm:w-24 sm:h-24 md:w-28 md:h-28 rounded-xl sm:rounded-2xl shadow-xl border-3 sm:border-4 border-white flex-shrink-0 overflow-hidden" style={{ width: "72px", height: "72px", background: d.profileUrl ? undefined : "rgba(255,255,255,0.15)" }}>
              {d.profileUrl ? <img src={d.profileUrl} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center backdrop-blur-sm"><Leaf className="w-8 sm:w-12 h-8 sm:h-12 text-white/80" /></div>}
            </div>
            <div className="flex-1 min-w-0 pb-0.5">
              <h1 className="text-lg sm:text-2xl md:text-3xl font-black text-white leading-tight drop-shadow-lg truncate" style={{ fontFamily: "'Outfit', sans-serif" }}>{d.name}</h1>
              {d.tagline && <p className="text-xs sm:text-sm text-white/70 italic mt-0.5 truncate">{d.tagline}</p>}
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-3 mt-1.5 sm:mt-2 text-xs sm:text-sm">
                <span className="flex items-center gap-0.5 sm:gap-1 text-amber-300 font-semibold"><Star className="w-3 sm:w-4 h-3 sm:h-4 fill-current" />{d.rating}</span>
                <span className="flex items-center gap-0.5 sm:gap-1 text-white/70"><Clock className="w-3 sm:w-4 h-3 sm:h-4" />{d.deliveryTime}</span>
                <span className="hidden sm:flex items-center gap-1 text-white/70"><MapPin className="w-4 h-4" />{d.city}</span>
                <span className="flex items-center gap-0.5 sm:gap-1 text-white/70"><Truck className="w-3 sm:w-4 h-3 sm:h-4" />{formatZAR(d.deliveryFee)}</span>
              </div>
            </div>
          </div>
          <div className="mt-3 sm:mt-0 sm:absolute sm:top-auto sm:right-4 sm:bottom-8">
            <button onClick={() => setShowAbout(!showAbout)} className="px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg sm:rounded-xl bg-white/20 backdrop-blur-sm border border-white/30 text-xs sm:text-sm font-semibold text-white hover:bg-white/30 flex items-center gap-1 sm:gap-1.5"><Eye className="w-3.5 sm:w-4 h-3.5 sm:h-4" /> About</button>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-3 sm:px-4 pt-3 sm:pt-4">
        {showAbout && (
          <div className="bg-white rounded-xl sm:rounded-2xl border border-gray-100 p-4 sm:p-5 mb-4 sm:mb-5 shadow-sm">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
              <div>
                <h3 className="font-bold text-sm mb-2">About</h3>
                <p className="text-sm text-gray-600 leading-relaxed">{d.bio}</p>
                {d.socialLinks && <div className="mt-3 flex flex-wrap gap-2">
                  {d.socialLinks.instagram && <span className="inline-flex items-center gap-1 text-xs bg-pink-50 text-pink-700 px-2.5 py-1 rounded-full font-medium"><Heart className="w-3 h-3" />{d.socialLinks.instagram}</span>}
                  {d.socialLinks.whatsapp && <span className="inline-flex items-center gap-1 text-xs bg-green-50 text-green-700 px-2.5 py-1 rounded-full font-medium"><Phone className="w-3 h-3" />{d.socialLinks.whatsapp}</span>}
                </div>}
              </div>
              <div>
                <h3 className="font-bold text-sm mb-2">Store Info</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-gray-500">Address</span><span className="font-medium text-right">{d.address}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Delivery Radius</span><span className="font-medium">{d.deliveryRadius} km</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Min Order</span><span className="font-medium">{formatZAR(d.minimumOrder)}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Membership</span><span className="font-medium">{d.membershipType === "FREE" ? "Free" : formatZAR(d.membershipPrice)}</span></div>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 text-[11px] text-amber-800 mb-4 flex items-start gap-2"><Shield className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />Products are for adults 18+ only.</div>

        <div className="relative mb-2 sm:mb-3"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" /><input value={search} onChange={e => setSearch(e.target.value)} placeholder={`Search ${d.name}...`} className="w-full pl-9 sm:pl-10 pr-3 sm:pr-4 py-2 sm:py-2.5 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-green-500 outline-none bg-white" /></div>
        <div className="flex gap-1 sm:gap-1.5 overflow-x-auto pb-2 mb-3 sm:mb-5 scrollbar-hide">{cats.map(c => <button key={c} onClick={() => setCat(c)} className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full text-[11px] sm:text-xs font-semibold whitespace-nowrap transition-all ${cat === c ? "bg-green-600 text-white" : "bg-gray-100 text-gray-600"}`}>{c === "ALL" ? "All" : CATEGORY_LABELS[c] || c}</button>)}</div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3 pb-8 sm:pb-12">{filtered.map(p => <ProductCard key={p.id} p={p} onAdd={addToCart} onClick={() => nav(`/product/${d.slug}/${p.id}`)} />)}</div>
        {filtered.length === 0 && <p className="text-center text-gray-400 py-10 text-sm">No products found</p>}

        {reviews.length > 0 && (() => {
          const avg = reviews.reduce((s, r) => s + r.rating, 0) / reviews.length;
          return (
            <div className="mt-4 mb-10">
              <div className="flex items-center gap-3 mb-3">
                <h2 className="font-black text-base" style={{ fontFamily: "'Outfit', sans-serif" }}>Customer Reviews</h2>
                <span className="flex items-center gap-1 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full text-sm font-bold text-amber-700"><Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />{avg.toFixed(1)} <span className="text-[11px] font-normal text-amber-600">({reviews.length})</span></span>
              </div>
              <div className="space-y-3">
                {reviews.slice(0, 8).map(r => (
                  <div key={r.id} className="bg-white rounded-xl border p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <div>
                        <p className="font-semibold text-sm">{r.customerName || "Customer"}</p>
                        <div className="flex gap-0.5 mt-0.5">{[1,2,3,4,5].map(s => <Star key={s} className={`w-3 h-3 ${s <= r.rating ? "fill-amber-400 text-amber-400" : "text-gray-200"}`} />)}</div>
                      </div>
                      <span className="text-[10px] text-gray-400 flex-shrink-0">{timeAgo(r.createdAt)}</span>
                    </div>
                    {r.comment && <p className="text-sm text-gray-600 leading-relaxed">{r.comment}</p>}
                  </div>
                ))}
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}
