import { Star, Clock, Truck, Leaf } from "lucide-react";
import { DISP_COLORS } from "../lib/constants";
import { formatZAR } from "../lib/formatters";
import { LeafIcon } from "./BrandLogo";

export const DispensaryCard = ({ d, onClick }) => {
  const fallbackColor = DISP_COLORS[d.id] || "#1A7A2E";
  return (
    <button onClick={onClick} className="group text-left rounded-xl sm:rounded-2xl overflow-hidden bg-white shadow-sm hover:shadow-xl transition-all duration-300 border border-gray-100 hover:border-green-200 hover:-translate-y-1">
      <div className="h-24 sm:h-28 relative overflow-hidden" style={{ background: d.bannerUrl ? undefined : fallbackColor }}>
        {d.bannerUrl ? <img src={d.bannerUrl} alt="" className="w-full h-full object-cover" /> : <div className="absolute inset-0 opacity-20"><LeafIcon className="absolute text-white w-16 h-16 top-2 right-2 rotate-12" /><LeafIcon className="absolute text-white w-10 h-10 bottom-2 left-4 -rotate-45" /></div>}
        {d.openNow && <div className="absolute top-2 left-2 flex items-center gap-1 bg-green-500 text-white text-[9px] font-bold px-2 py-0.5 rounded-full"><div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />OPEN</div>}
        {!d.isApproved && <div className="absolute top-2 right-2 bg-yellow-500 text-white text-[10px] px-2 py-0.5 rounded-full font-semibold">Pending</div>}
        {d.featured && d.isApproved && <div className="absolute top-2 right-2 bg-amber-400 text-amber-900 text-[9px] font-bold px-2 py-0.5 rounded-full flex items-center gap-0.5"><Star className="w-2.5 h-2.5 fill-current" />FEATURED</div>}
      </div>
      <div className="relative px-2 sm:px-3 pb-2.5 sm:pb-3">
        <div className="flex items-end gap-2 sm:gap-2.5 -mt-4 sm:-mt-5 mb-1.5 sm:mb-2">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl shadow-lg border-2 border-white flex-shrink-0 overflow-hidden" style={{ background: d.profileUrl ? undefined : fallbackColor }}>
            {d.profileUrl ? <img src={d.profileUrl} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><Leaf className="w-5 sm:w-6 h-5 sm:h-6 text-white/80" /></div>}
          </div>
          <div className="flex-1 min-w-0 pt-4 sm:pt-5"><h3 className="font-bold text-gray-900 leading-tight truncate text-xs sm:text-sm" style={{ fontFamily: "'Outfit', sans-serif" }}>{d.name}</h3></div>
        </div>
        {d.tagline && <p className="text-[9px] sm:text-[10px] text-gray-500 italic mb-1.5 sm:mb-2 line-clamp-1">{d.tagline}</p>}
        <div className="flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-xs">
          <span className="flex items-center gap-0.5 text-amber-600 font-semibold"><Star className="w-2.5 sm:w-3 h-2.5 sm:h-3 fill-current" />{d.rating}</span>
          <span className="flex items-center gap-0.5 text-gray-500"><Clock className="w-2.5 sm:w-3 h-2.5 sm:h-3" />{d.deliveryTime}</span>
          <span className="hidden sm:flex items-center gap-0.5 text-gray-500"><Truck className="w-3 h-3" />{formatZAR(d.deliveryFee)}</span>
        </div>
      </div>
    </button>
  );
};

export default DispensaryCard;
