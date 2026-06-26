import { useState, useEffect } from "react";
import { Plus, Leaf } from "lucide-react";
import { formatZAR } from "../lib/formatters";
import { api } from "../lib/api";
import { EMPTY_PRODUCT, CATEGORY_LABELS, CATEGORY_ICONS, STRAIN_COLORS } from "../lib/constants";
import { useUI } from "../context/UIContext";
import ImageUploadBox from "../components/ImageUploadBox";

const firstImage = (imageUrls) => { try { return JSON.parse(imageUrls || "[]")[0] || ""; } catch { return ""; } };

export default function DispensaryProductsTab({ myIds, dispensaryId }) {
  const { notify } = useUI();
  const [products, setProducts] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_PRODUCT });
  const [editId, setEditId] = useState(null);
  const [filterCat, setFilterCat] = useState("ALL");
  const flowerCategories = ["INDOOR_FLOWER", "GREENHOUSE_FLOWER", "CONCENTRATE", "EDIBLE", "ACCESSORY", "OTHER"];
  const needsStrain = ["INDOOR_FLOWER", "GREENHOUSE_FLOWER", "CONCENTRATE"].includes(form.category);

  useEffect(() => {
    if (!dispensaryId) return;
    api("GET", `/products?dispensaryId=${dispensaryId}`).then(res => {
      if (res.ok && res.data) setProducts(res.data);
    });
  }, [dispensaryId]);

  const myProducts = products.filter(p => myIds.includes(p.dispensaryId));

  const openAdd = () => { setForm({ ...EMPTY_PRODUCT, imageUrl: "" }); setEditId(null); setShowForm(true); };
  const openEdit = (p) => {
    setForm({ name: p.name, category: p.category, strainType: p.strainType || "HYBRID", price: String(p.price), unit: p.unit || "per gram", stock: String(p.stock), description: p.description || "", thcPercent: p.thcPercent != null ? String(p.thcPercent) : "", cbdPercent: p.cbdPercent != null ? String(p.cbdPercent) : "", effectSpectrum: p.effectSpectrum || 5, imageUrl: firstImage(p.imageUrls) });
    setEditId(p.id); setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name || !form.price || !form.stock) { notify("Name, price and stock are required", "error"); return; }
    setSaving(true);
    const slug = form.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const { imageUrl, ...rest } = form;
    const payload = { ...rest, dispensaryId, slug, price: Number(form.price), stock: Number(form.stock), thcPercent: form.thcPercent ? Number(form.thcPercent) : null, cbdPercent: form.cbdPercent ? Number(form.cbdPercent) : null, strainType: needsStrain ? form.strainType : null, imageUrls: imageUrl ? JSON.stringify([imageUrl]) : "[]" };

    if (editId) {
      const res = await api("PUT", `/products/${editId}`, payload);
      const updated = res.ok && res.data ? res.data : { ...payload, id: editId };
      setProducts(prev => prev.map(p => p.id === editId ? { ...p, ...updated } : p));
      notify("Product updated!");
    } else {
      const res = await api("POST", "/products", payload);
      const created = res.ok && res.data ? res.data : { ...payload, id: `p_${Date.now()}`, imageUrls: "[]" };
      setProducts(prev => [...prev, created]);
      notify("Product added to your menu!");
    }
    setSaving(false);
    setShowForm(false);
  };

  const handleToggleActive = async (p) => {
    const res = await api("PUT", `/products/${p.id}`, { isActive: !p.isActive });
    const updated = res.ok && res.data ? res.data : { ...p, isActive: !p.isActive };
    setProducts(prev => prev.map(x => x.id === p.id ? { ...x, ...updated } : x));
    notify(updated.isActive ? "Product is now visible to customers" : "Product hidden from menu");
  };

  const filtered = filterCat === "ALL" ? myProducts : myProducts.filter(p => p.category === filterCat);
  const cats = ["ALL", ...flowerCategories.filter(c => myProducts.some(p => p.category === c))];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-bold">{myProducts.length} product{myProducts.length !== 1 ? "s" : ""} on your menu</p>
          <p className="text-[11px] text-gray-400">{myProducts.filter(p => p.isActive !== false).length} active · {myProducts.filter(p => p.isActive === false).length} hidden</p>
        </div>
        <button onClick={openAdd} className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-white text-xs font-bold shadow-md hover:shadow-lg transition-all" style={{ background: "linear-gradient(135deg, #1A7A2E, #2d9a4a)" }}>
          <Plus className="w-3.5 h-3.5" /> Add Product
        </button>
      </div>

      {myProducts.length > 0 && (
        <div className="flex gap-1.5 overflow-x-auto scrollbar-hide pb-1">
          {cats.map(c => (
            <button key={c} onClick={() => setFilterCat(c)} className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-[11px] font-semibold whitespace-nowrap transition-all ${filterCat === c ? "bg-green-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
              {c !== "ALL" && <span>{CATEGORY_ICONS[c]}</span>}
              {c === "ALL" ? "All" : CATEGORY_LABELS[c]}
            </button>
          ))}
        </div>
      )}

      {myProducts.length === 0 && (
        <div className="text-center py-14 bg-white rounded-2xl border border-dashed border-gray-300">
          <div className="text-4xl mb-3">🌿</div>
          <p className="font-bold text-gray-700 mb-1">No products yet</p>
          <p className="text-xs text-gray-400 mb-4">Add your first product to start selling</p>
          <button onClick={openAdd} className="px-5 py-2.5 rounded-xl text-white text-sm font-bold shadow" style={{ background: "linear-gradient(135deg, #1A7A2E, #2d9a4a)" }}>+ Add First Product</button>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {filtered.map(p => {
          const isHidden = p.isActive === false;
          const imgs = (() => { try { return JSON.parse(p.imageUrls || "[]"); } catch { return []; } })();
          const img = imgs[0] || null;
          return (
            <div key={p.id} className={`bg-white rounded-xl border overflow-hidden transition-all ${isHidden ? "opacity-60 border-dashed" : "border-gray-200 shadow-sm"}`}>
              <div className="relative h-32 bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center overflow-hidden">
                {img ? <img src={img} alt={p.name} className="w-full h-full object-cover" /> : (
                  <span className="text-5xl">{CATEGORY_ICONS[p.category] || "📦"}</span>
                )}
                {isHidden && <div className="absolute inset-0 bg-gray-900/30 flex items-center justify-center"><span className="text-white text-[10px] font-bold bg-gray-800/70 px-2 py-0.5 rounded-full">Hidden</span></div>}
                {p.strainType && <div className={`absolute top-2 left-2 text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${STRAIN_COLORS[p.strainType]}`}>{p.strainType}</div>}
              </div>
              <div className="p-3">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div className="min-w-0">
                    <p className="font-bold text-sm truncate">{p.name}</p>
                    <p className="text-[10px] text-gray-500">{CATEGORY_ICONS[p.category]} {CATEGORY_LABELS[p.category]}</p>
                  </div>
                  <p className="font-black text-green-700 text-sm whitespace-nowrap flex-shrink-0">{formatZAR(p.price)}</p>
                </div>
                {(p.thcPercent || p.cbdPercent) && (
                  <div className="flex gap-1 mb-2">
                    {p.thcPercent && <span className="text-[9px] bg-orange-100 text-orange-700 font-bold px-1.5 py-0.5 rounded">THC {p.thcPercent}%</span>}
                    {p.cbdPercent && <span className="text-[9px] bg-blue-100 text-blue-700 font-bold px-1.5 py-0.5 rounded">CBD {p.cbdPercent}%</span>}
                  </div>
                )}
                <div className="flex items-center justify-between pt-1 border-t border-gray-100">
                  <span className="text-[10px] text-gray-500">Stock: <span className={`font-bold ${p.stock < 5 ? "text-red-500" : "text-gray-700"}`}>{p.stock}</span></span>
                  <div className="flex gap-1.5">
                    <button onClick={() => handleToggleActive(p)} className={`text-[10px] px-2 py-1 rounded-lg font-semibold transition-all ${isHidden ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}>{isHidden ? "Show" : "Hide"}</button>
                    <button onClick={() => openEdit(p)} className="text-[10px] px-2 py-1 rounded-lg bg-green-50 text-green-700 font-semibold hover:bg-green-100 transition-all">Edit</button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center" style={{ background: "rgba(0,0,0,0.5)" }}>
          <div className="bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl max-h-[92vh] overflow-y-auto shadow-2xl">
            <div className="sticky top-0 bg-white border-b px-5 py-4 flex items-center justify-between z-10">
              <div className="flex items-center gap-2">
                <span className="text-xl">{editId ? "✏️" : "🌿"}</span>
                <h2 className="font-black text-base" style={{ fontFamily: "'Outfit', sans-serif" }}>{editId ? "Edit Product" : "Add New Product"}</h2>
              </div>
              <button onClick={() => setShowForm(false)} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200">✕</button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-gray-500 mb-1 uppercase tracking-wide">Product Name *</label>
                <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Purple Haze, OG Kush..." className="w-full px-3 py-2.5 rounded-xl border text-sm focus:ring-2 focus:ring-green-500 outline-none" />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-500 mb-2 uppercase tracking-wide">Product Image</label>
                <ImageUploadBox current={form.imageUrl} onUpload={(url) => setForm({ ...form, imageUrl: url })} label="Upload product photo" aspectHint="Square recommended" folder="products" className="w-full h-40 rounded-xl overflow-hidden border border-gray-200" />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-500 mb-2 uppercase tracking-wide">Category *</label>
                <div className="grid grid-cols-3 gap-1.5">
                  {flowerCategories.map(c => (
                    <button key={c} type="button" onClick={() => setForm({ ...form, category: c })} className={`flex flex-col items-center gap-1 py-2.5 px-2 rounded-xl border text-[10px] font-semibold transition-all ${form.category === c ? "border-green-500 bg-green-50 text-green-700 ring-1 ring-green-500" : "border-gray-200 text-gray-600 hover:border-gray-300"}`}>
                      <span className="text-xl">{CATEGORY_ICONS[c]}</span>
                      {CATEGORY_LABELS[c]}
                    </button>
                  ))}
                </div>
              </div>

              {needsStrain && (
                <div>
                  <label className="block text-[11px] font-bold text-gray-500 mb-2 uppercase tracking-wide">Strain Type</label>
                  <div className="flex gap-2">
                    {["SATIVA", "HYBRID", "INDICA"].map(s => (
                      <button key={s} type="button" onClick={() => setForm({ ...form, strainType: s })} className={`flex-1 py-2 rounded-xl border text-xs font-bold transition-all ${form.strainType === s ? STRAIN_COLORS[s] + " ring-1 ring-current" : "border-gray-200 text-gray-500"}`}>{s}</button>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-1">
                  <label className="block text-[11px] font-bold text-gray-500 mb-1 uppercase tracking-wide">Price (R) *</label>
                  <input type="number" min="0" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} placeholder="150" className="w-full px-3 py-2.5 rounded-xl border text-sm focus:ring-2 focus:ring-green-500 outline-none" />
                </div>
                <div className="col-span-1">
                  <label className="block text-[11px] font-bold text-gray-500 mb-1 uppercase tracking-wide">Unit</label>
                  <select value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })} className="w-full px-2 py-2.5 rounded-xl border text-xs outline-none bg-white focus:ring-2 focus:ring-green-500">
                    {["per gram", "per 3.5g", "per 7g", "per 14g", "per 28g", "per unit", "per pack", "per cart", "per bottle"].map(u => <option key={u}>{u}</option>)}
                  </select>
                </div>
                <div className="col-span-1">
                  <label className="block text-[11px] font-bold text-gray-500 mb-1 uppercase tracking-wide">Stock *</label>
                  <input type="number" min="0" value={form.stock} onChange={e => setForm({ ...form, stock: e.target.value })} placeholder="50" className="w-full px-3 py-2.5 rounded-xl border text-sm focus:ring-2 focus:ring-green-500 outline-none" />
                </div>
              </div>

              {needsStrain && (
                <div>
                  <label className="block text-[11px] font-bold text-gray-500 mb-2 uppercase tracking-wide">Cannabinoid Profile</label>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] text-gray-400 mb-1 block">THC %</label>
                      <div className="relative">
                        <input type="number" min="0" max="100" step="0.1" value={form.thcPercent} onChange={e => setForm({ ...form, thcPercent: e.target.value })} placeholder="e.g. 28" className="w-full px-3 py-2 rounded-xl border text-sm focus:ring-2 focus:ring-orange-400 outline-none pr-8" />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-gray-400">%</span>
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] text-gray-400 mb-1 block">CBD %</label>
                      <div className="relative">
                        <input type="number" min="0" max="100" step="0.1" value={form.cbdPercent} onChange={e => setForm({ ...form, cbdPercent: e.target.value })} placeholder="e.g. 0.5" className="w-full px-3 py-2 rounded-xl border text-sm focus:ring-2 focus:ring-blue-400 outline-none pr-8" />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-gray-400">%</span>
                      </div>
                    </div>
                  </div>
                  <div className="mt-3">
                    <label className="block text-[10px] text-gray-400 mb-1">Effect Spectrum: <span className="font-bold text-gray-700">{["💤 Deep Sleep", "😴 Relaxing", "😌 Calm", "🙂 Balanced", "😊 Uplifted", "😄 Happy", "🎨 Creative", "⚡ Energised", "🚀 Euphoric", "🌟 Intense"][form.effectSpectrum - 1]}</span></label>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-purple-600 font-semibold">Indica</span>
                      <input type="range" min="1" max="10" value={form.effectSpectrum} onChange={e => setForm({ ...form, effectSpectrum: Number(e.target.value) })} className="flex-1 accent-green-600" />
                      <span className="text-[10px] text-yellow-600 font-semibold">Sativa</span>
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-[11px] font-bold text-gray-500 mb-1 uppercase tracking-wide">Description</label>
                <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={2} placeholder="Tasting notes, effects, growing method..." className="w-full px-3 py-2.5 rounded-xl border text-sm focus:ring-2 focus:ring-green-500 outline-none resize-none" />
              </div>

              {form.name && (
                <div className="bg-gray-50 rounded-xl p-3 border border-dashed border-gray-300">
                  <p className="text-[10px] text-gray-400 mb-1.5 font-semibold uppercase tracking-wide">Preview</p>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{CATEGORY_ICONS[form.category]}</span>
                      <div>
                        <p className="font-bold text-sm">{form.name}</p>
                        <div className="flex gap-1 mt-0.5">
                          {needsStrain && form.strainType && <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${STRAIN_COLORS[form.strainType]}`}>{form.strainType}</span>}
                          {form.thcPercent && <span className="text-[9px] bg-orange-100 text-orange-700 font-bold px-1.5 py-0.5 rounded">THC {form.thcPercent}%</span>}
                          {form.cbdPercent && <span className="text-[9px] bg-blue-100 text-blue-700 font-bold px-1.5 py-0.5 rounded">CBD {form.cbdPercent}%</span>}
                        </div>
                      </div>
                    </div>
                    {form.price && <p className="font-black text-green-700">{formatZAR(Number(form.price))}<span className="text-[10px] font-normal text-gray-400"> /{form.unit}</span></p>}
                  </div>
                </div>
              )}

              <button onClick={handleSave} disabled={saving || !form.name || !form.price || !form.stock} className={`w-full py-3 rounded-xl text-white font-bold text-sm shadow-lg transition ${saving || !form.name || !form.price || !form.stock ? "opacity-50 cursor-not-allowed" : "hover:shadow-xl"}`} style={{ background: "linear-gradient(135deg, #1A7A2E, #2d9a4a)" }}>
                {saving ? "Saving..." : editId ? "Save Changes" : "Add to Menu 🌿"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
