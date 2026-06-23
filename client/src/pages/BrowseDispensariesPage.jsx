import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Search, X, MapPin, Star, Truck, Leaf } from "lucide-react";
import { api } from "../lib/api";
import { DISPENSARIES } from "../lib/mockData";

export default function BrowseDispensariesPage() {
  const nav = useNavigate();
  const [allDisps, setAllDisps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [cityFilter, setCityFilter] = useState("");
  const [sort, setSort] = useState("rating");

  useEffect(() => {
    setLoading(true);
    api("GET", "/dispensaries").then(res => {
      if (res.ok && res.data?.length) setAllDisps(res.data);
      else setAllDisps(DISPENSARIES);
      setLoading(false);
    });
  }, []);

  const cities = [...new Set(allDisps.map(d => d.city).filter(Boolean))].sort();

  const filtered = allDisps
    .filter(d => {
      const q = search.toLowerCase();
      return (!q || d.name.toLowerCase().includes(q) || d.city.toLowerCase().includes(q) || (d.bio || "").toLowerCase().includes(q));
    })
    .filter(d => !cityFilter || d.city === cityFilter)
    .sort((a, b) => {
      if (sort === "rating") return Number(b.rating || 0) - Number(a.rating || 0);
      if (sort === "name") return a.name.localeCompare(b.name);
      if (sort === "distance") return (a.distance ?? 999) - (b.distance ?? 999);
      return 0;
    });

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-4 py-5 sm:py-8">
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-black text-gray-900 mb-1" style={{ fontFamily: "'Outfit', sans-serif" }}>Find Your Dispensary</h1>
        <p className="text-gray-500 text-sm">Browse {allDisps.length} licensed cannabis stores across South Africa</p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-3 sm:p-4 mb-6 space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search dispensaries, strains, or cities..." className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-green-500 outline-none bg-gray-50" />
          {search && <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>}
        </div>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <select value={cityFilter} onChange={e => setCityFilter(e.target.value)} className="w-full pl-8 pr-3 py-2 rounded-xl border border-gray-200 text-xs sm:text-sm outline-none bg-gray-50 focus:ring-2 focus:ring-green-500 appearance-none">
              <option value="">All cities</option>
              {cities.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <select value={sort} onChange={e => setSort(e.target.value)} className="px-3 py-2 rounded-xl border border-gray-200 text-xs sm:text-sm outline-none bg-gray-50 focus:ring-2 focus:ring-green-500">
            <option value="rating">Top Rated</option>
            <option value="name">A-Z</option>
            <option value="distance">Nearest</option>
          </select>
        </div>
        {(search || cityFilter) && (
          <div className="flex items-center gap-2 flex-wrap pt-0.5">
            <span className="text-[11px] text-gray-400">Filters:</span>
            {search && <span className="flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-[11px] font-semibold">"{search}" <button onClick={() => setSearch("")}><X className="w-3 h-3" /></button></span>}
            {cityFilter && <span className="flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-[11px] font-semibold">{cityFilter} <button onClick={() => setCityFilter("")}><X className="w-3 h-3" /></button></span>}
            <button onClick={() => { setSearch(""); setCityFilter(""); }} className="text-[11px] text-gray-400 underline">Clear all</button>
          </div>
        )}
      </div>

      <p className="text-xs text-gray-500 mb-3 font-medium">
        {loading ? "Loading..." : `${filtered.length} dispensar${filtered.length !== 1 ? "ies" : "y"} found`}
        {cityFilter && ` in ${cityFilter}`}
      </p>

      {loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3,4,5,6].map(i => (
            <div key={i} className="bg-white rounded-2xl border overflow-hidden animate-pulse">
              <div className="h-36 bg-gray-200" />
              <div className="p-4 space-y-2"><div className="h-4 bg-gray-200 rounded w-3/4" /><div className="h-3 bg-gray-100 rounded w-1/2" /></div>
            </div>
          ))}
        </div>
      )}

      {!loading && filtered.length === 0 && (
        <div className="text-center py-16">
          <p className="font-bold text-gray-700 mb-1">No dispensaries found</p>
          <p className="text-sm text-gray-400">Try a different search or city filter</p>
          <button onClick={() => { setSearch(""); setCityFilter(""); }} className="mt-4 px-4 py-2 rounded-xl bg-green-600 text-white text-sm font-semibold">Clear filters</button>
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(d => (
            <button key={d.id} onClick={() => nav(`/dispensary/${d.slug}`)} className="bg-white rounded-2xl border border-gray-200 overflow-hidden text-left hover:shadow-lg hover:-translate-y-0.5 transition-all group">
              <div className="relative h-36 bg-gradient-to-br from-green-800 to-emerald-600 overflow-hidden">
                {d.bannerUrl
                  ? <img src={d.bannerUrl} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                  : <div className="absolute inset-0 flex items-center justify-center opacity-20"><Leaf className="w-24 h-24 text-white" /></div>
                }
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
                <div className={`absolute top-2.5 right-2.5 flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${d.isOpen ? "bg-green-500 text-white" : "bg-gray-800/80 text-gray-300"}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${d.isOpen ? "bg-white animate-pulse" : "bg-gray-500"}`} />
                  {d.isOpen ? "OPEN" : "CLOSED"}
                </div>
                <div className="absolute bottom-0 left-0 right-0 px-3 pb-3 flex items-end gap-2.5">
                  <div className="w-11 h-11 rounded-xl border-2 border-white shadow bg-white overflow-hidden flex-shrink-0">
                    {d.logoUrl
                      ? <img src={d.logoUrl} alt="" className="w-full h-full object-cover" />
                      : <div className="w-full h-full bg-green-100 flex items-center justify-center"><Leaf className="w-5 h-5 text-green-600" /></div>
                    }
                  </div>
                  <div className="min-w-0">
                    <p className="font-black text-white text-sm leading-tight truncate drop-shadow" style={{ fontFamily: "'Outfit', sans-serif" }}>{d.name}</p>
                    <p className="text-white/70 text-[10px] truncate">{d.city}, {d.province}</p>
                  </div>
                </div>
              </div>
              <div className="p-3.5">
                {d.tagline && <p className="text-xs text-gray-500 italic mb-2 truncate">"{d.tagline}"</p>}
                <div className="flex items-center justify-between text-[11px] text-gray-500 mb-2">
                  <span className="flex items-center gap-1"><Star className="w-3 h-3 text-amber-400 fill-amber-400" /><span className="font-bold text-gray-700">{Number(d.rating || 0).toFixed(1)}</span> ({d.reviewCount || 0})</span>
                  <span className="flex items-center gap-1"><Truck className="w-3 h-3" /> {Number(d.deliveryFee) === 0 ? <span className="text-green-600 font-semibold">Free delivery</span> : `R${Number(d.deliveryFee).toFixed(0)}`}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-gray-400">{d._count?.products ?? 0} products · Min R{Number(d.minimumOrder || 0).toFixed(0)}</span>
                  {d.membershipType !== "FREE" && <span className="text-[9px] font-bold px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded-full">MEMBERS</span>}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
