import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { LOGO_URL } from "../lib/logo";
import { LeafIcon } from "../components/BrandLogo";
import { DispensaryCard } from "../components/DispensaryCard";
import { api } from "../lib/api";
import { DISPENSARIES } from "../lib/mockData";
import { useAuth } from "../context/AuthContext";

export default function HomePage() {
  const nav = useNavigate();
  const { currentUser } = useAuth();
  const [dispensaries, setDispensaries] = useState([]);

  useEffect(() => {
    api("GET", "/dispensaries").then(res => {
      if (res.ok && res.data) setDispensaries(res.data);
      else setDispensaries(DISPENSARIES);
    });
  }, []);

  return (
    <div>
      <section className="relative overflow-hidden" style={{ background: "linear-gradient(135deg, #0a2e12, #1A7A2E 60%, #2d9a4a)" }}>
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "radial-gradient(circle at 20% 50%, rgba(255,255,255,0.3) 1px, transparent 1px)", backgroundSize: "30px 30px" }} />
        <div className="max-w-7xl mx-auto px-4 py-12 sm:py-16 md:py-24 relative">
          <div className="flex flex-col md:flex-row items-center gap-6 md:gap-8">
            <div className="flex-1">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/10 border border-white/20 text-green-200 text-[10px] sm:text-xs font-medium mb-4"><LeafIcon className="w-3 sm:w-3.5 h-3 sm:h-3.5" />South Africa's #1 Cannabis Platform</div>
              <h1 className="text-2xl sm:text-3xl md:text-5xl font-black text-white leading-tight tracking-tight mb-4 sm:mb-5" style={{ fontFamily: "'Outfit', sans-serif" }}>SOUTH AFRICA'S MOST RELIABLE <span className="text-green-300">CANNABIS DELIVERY</span> PLATFORM</h1>
              <p className="text-green-200/80 text-sm sm:text-base mb-5 sm:mb-7 max-w-lg">Browse dispensaries, join memberships, and get premium cannabis delivered to your door.</p>
              <button onClick={() => nav(currentUser ? "/browse" : "/login")} className="px-6 sm:px-7 py-2.5 sm:py-3 rounded-full bg-white text-green-800 font-bold text-sm sm:text-base shadow-xl hover:bg-green-50 transition-all">SHOP NOW</button>
            </div>
            <div className="flex-shrink-0">
              <img src={LOGO_URL} alt="WeeDeliver Mascot" className="h-32 sm:h-40 md:h-56 drop-shadow-2xl" style={{ filter: "drop-shadow(0 20px 40px rgba(0,0,0,0.3))" }} />
            </div>
          </div>
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-gray-50 to-transparent" />
      </section>
      <section className="max-w-7xl mx-auto px-3 sm:px-4 py-8 sm:py-12">
        <div className="flex items-center justify-between mb-4 sm:mb-6">
          <h2 className="text-lg sm:text-xl md:text-2xl font-black text-gray-900" style={{ fontFamily: "'Outfit', sans-serif" }}>TOP DISPENSARIES</h2>
          <button onClick={() => nav("/browse")} className="text-xs font-semibold text-green-700 hover:text-green-800 flex items-center gap-1">View all <ChevronRight className="w-3.5 h-3.5" /></button>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">{dispensaries.filter(d => d.isApproved).slice(0,4).map(d => <DispensaryCard key={d.id} d={d} onClick={() => nav(`/dispensary/${d.slug}`)} />)}</div>
      </section>
      <footer className="bg-gray-900 text-gray-400 py-8"><div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-3 text-xs"><div className="flex items-center gap-2"><img src={LOGO_URL} alt="" className="h-8" /><span className="font-black" style={{ fontFamily: "'Outfit', sans-serif" }}><span className="text-green-400">WEE</span><span style={{ background: "linear-gradient(90deg, #4ade80 50%, #ffffff 50%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>D</span><span className="text-white">eliver</span></span></div><p>Cannabis products are for adults 18+ only. &copy; 2026</p></div></footer>
    </div>
  );
}
