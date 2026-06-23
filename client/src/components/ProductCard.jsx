import { Leaf } from "lucide-react";
import { CATEGORY_LABELS } from "../lib/constants";
import { formatZAR } from "../lib/formatters";

export const ProductCard = ({ p, onAdd, onClick }) => {
  const sc = { SATIVA: "text-amber-600 bg-amber-50", INDICA: "text-indigo-600 bg-indigo-50", HYBRID: "text-emerald-600 bg-emerald-50" };
  return (
    <div className="group bg-white rounded-xl sm:rounded-2xl overflow-hidden border border-gray-100 hover:border-green-200 hover:shadow-lg transition-all cursor-pointer" onClick={onClick}>
      <div className="h-28 sm:h-36 relative overflow-hidden bg-gray-100">
        {p.imageUrl ? <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" /> : <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-200"><Leaf className="w-10 sm:w-12 h-10 sm:h-12 text-gray-300" /></div>}
        {p.strainType && <span className={`absolute top-1.5 right-1.5 text-[9px] sm:text-[10px] font-bold px-1.5 sm:px-2 py-0.5 rounded-full ${sc[p.strainType] || ""}`}>{p.strainType}</span>}
        <div className="absolute bottom-1.5 left-1.5 right-1.5 flex gap-1">
          {p.thcPercent != null && <span className="bg-black/50 backdrop-blur-sm text-white text-[8px] sm:text-[9px] font-bold px-1 sm:px-1.5 py-0.5 rounded-full">THC {p.thcPercent}%</span>}
          {p.cbdPercent != null && p.cbdPercent > 1 && <span className="bg-black/50 backdrop-blur-sm text-white text-[8px] sm:text-[9px] font-bold px-1 sm:px-1.5 py-0.5 rounded-full">CBD {p.cbdPercent}%</span>}
        </div>
      </div>
      <div className="p-2 sm:p-3">
        <h4 className="font-bold text-gray-900 text-xs sm:text-sm leading-tight truncate" style={{ fontFamily: "'Outfit', sans-serif" }}>{p.name}</h4>
        <p className="text-[9px] sm:text-[10px] text-gray-500 mt-0.5">{CATEGORY_LABELS[p.category]}</p>
        <div className="flex items-center justify-between mt-1.5 sm:mt-2">
          <span className="text-sm sm:text-base font-bold text-green-700">{formatZAR(p.price)}</span>
          <button onClick={(e) => { e.stopPropagation(); onAdd(p); }} className="bg-green-600 hover:bg-green-700 text-white px-2 sm:px-3 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-semibold transition-colors">Add</button>
        </div>
      </div>
    </div>
  );
};

export default ProductCard;
