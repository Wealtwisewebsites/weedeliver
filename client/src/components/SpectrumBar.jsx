import { Moon, Zap } from "lucide-react";

export const SpectrumBar = ({ value }) => {
  if (!value) return null;
  return (
    <div className="w-full">
      <div className="flex justify-between text-xs mb-1 font-medium">
        <span className="flex items-center gap-1"><Moon className="w-3 h-3" /> Calming</span>
        <span className="flex items-center gap-1">Energising <Zap className="w-3 h-3" /></span>
      </div>
      <div className="h-2.5 rounded-full bg-gradient-to-r from-indigo-400 via-emerald-400 to-amber-400 relative">
        <div className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full border-2 border-gray-800 shadow-md" style={{ left: `calc(${(value - 1) / 9 * 100}% - 8px)` }} />
      </div>
    </div>
  );
};

export default SpectrumBar;
