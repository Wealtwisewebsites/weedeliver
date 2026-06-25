import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  ChevronRight, ShieldCheck, Truck, Lock, Clock, Store, Users,
  Search, BadgeCheck, Sparkles, ArrowRight, MapPin,
} from "lucide-react";
import { LOGO_URL } from "../lib/logo";
import { LeafIcon } from "../components/BrandLogo";
import { DispensaryCard } from "../components/DispensaryCard";
import { api } from "../lib/api";
import { DISPENSARIES } from "../lib/mockData";
import { useAuth } from "../context/AuthContext";

const DISPLAY = { fontFamily: "'Outfit', sans-serif" };

// Scroll-reveal wrapper — compositor-friendly (opacity + transform), respects reduced motion.
function Reveal({ children, delay = 0, className = "" }) {
  const ref = useRef(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) { setShown(true); return; }
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setShown(true); io.disconnect(); } }, { threshold: 0.15 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} className={className} style={{
      opacity: shown ? 1 : 0,
      transform: shown ? "none" : "translateY(28px)",
      transition: "opacity .7s ease, transform .7s cubic-bezier(0.16,1,0.3,1)",
      transitionDelay: `${delay}ms`,
    }}>{children}</div>
  );
}

const STEPS = [
  { icon: Search, title: "Browse dispensaries", body: "Discover verified, licensed dispensaries near you and explore their full menu of premium flower, edibles, and concentrates." },
  { icon: BadgeCheck, title: "Join as a member", body: "Become a member of your chosen dispensary in seconds — the compliant way to access cannabis products in South Africa." },
  { icon: Truck, title: "Get it delivered", body: "Place your order and track your driver in real time, from the dispensary straight to your door. Fast, private, reliable." },
];

const FEATURES = [
  { icon: ShieldCheck, title: "Verified dispensaries", body: "Every dispensary is vetted and approved before going live. You only ever shop from legitimate, licensed sources." },
  { icon: Clock, title: "Real-time delivery", body: "Watch your order move through every stage — confirmed, prepared, picked up, and on its way — with live driver tracking." },
  { icon: Lock, title: "Secure payments", body: "Pay safely with Yoco card, EFT, or QR. Every transaction is encrypted and signature-verified end to end." },
  { icon: Sparkles, title: "Discreet & compliant", body: "Built around South Africa's membership model, with private, unmarked delivery and strict 18+ age verification." },
];

const STATS = [
  { value: "100%", label: "Verified dispensaries" },
  { value: "18+", label: "Age-verified access" },
  { value: "Live", label: "Order tracking" },
  { value: "ZAR", label: "Local payments" },
];

export default function HomePage() {
  const nav = useNavigate();
  const { currentUser } = useAuth();
  const [dispensaries, setDispensaries] = useState([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    api("GET", "/dispensaries").then(res => {
      if (res.ok && Array.isArray(res.data)) setDispensaries(res.data);
      else setDispensaries(DISPENSARIES);
      setLoaded(true);
    });
  }, []);

  const approved = dispensaries.filter(d => d.isApproved);

  return (
    <div className="bg-gray-50" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      {/* ─── HERO ─────────────────────────────────────────── */}
      <section className="relative overflow-hidden" style={{ background: "linear-gradient(135deg, #06220d, #0a2e12 35%, #1A7A2E 100%)" }}>
        <div className="absolute inset-0 opacity-[0.12]" style={{ backgroundImage: "radial-gradient(circle at 20% 40%, rgba(255,255,255,0.4) 1px, transparent 1px)", backgroundSize: "28px 28px" }} />
        <LeafIcon className="absolute -right-10 -top-10 w-72 h-72 text-white/[0.04] rotate-12" />
        <LeafIcon className="absolute -left-16 bottom-0 w-64 h-64 text-white/[0.04] -rotate-45" />
        <div className="max-w-7xl mx-auto px-4 py-14 sm:py-20 md:py-28 relative">
          <div className="flex flex-col md:flex-row items-center gap-8 md:gap-10">
            <div className="flex-1 text-center md:text-left">
              <Reveal>
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 border border-white/20 text-green-200 text-[11px] sm:text-xs font-semibold mb-5 backdrop-blur-sm">
                  <LeafIcon className="w-3.5 h-3.5" />South Africa's #1 Cannabis Platform
                </div>
              </Reveal>
              <Reveal delay={80}>
                <h1 className="text-3xl sm:text-4xl md:text-6xl font-black text-white leading-[1.05] tracking-tight mb-5" style={DISPLAY}>
                  PREMIUM CANNABIS,<br /><span className="text-green-300">DELIVERED</span> TO YOUR DOOR
                </h1>
              </Reveal>
              <Reveal delay={160}>
                <p className="text-green-100/80 text-base sm:text-lg mb-7 max-w-xl mx-auto md:mx-0 leading-relaxed">
                  WeeDeliver connects you with verified South African dispensaries — browse menus, join as a member, and track your delivery in real time. Compliant, discreet, and effortless.
                </p>
              </Reveal>
              <Reveal delay={240}>
                <div className="flex flex-wrap gap-3 justify-center md:justify-start">
                  <button onClick={() => nav(currentUser ? "/browse" : "/login")} className="px-7 py-3.5 rounded-full bg-white text-green-800 font-bold text-sm sm:text-base shadow-xl hover:bg-green-50 hover:-translate-y-0.5 transition-all flex items-center gap-2">
                    {currentUser ? "Browse Dispensaries" : "Get Started"} <ArrowRight className="w-4 h-4" />
                  </button>
                  <a href="#how-it-works" className="px-7 py-3.5 rounded-full bg-white/10 text-white font-bold text-sm sm:text-base border border-white/25 hover:bg-white/20 transition-all backdrop-blur-sm">
                    How it works
                  </a>
                </div>
              </Reveal>
            </div>
            <Reveal delay={200} className="flex-shrink-0">
              <div className="relative">
                <div className="absolute inset-0 bg-green-400/20 blur-3xl rounded-full scale-90" />
                <img src={LOGO_URL} alt="WeeDeliver mascot" className="relative h-40 sm:h-52 md:h-72" style={{ filter: "drop-shadow(0 24px 48px rgba(0,0,0,0.4))" }} />
              </div>
            </Reveal>
          </div>
        </div>
        <svg className="block w-full h-12 sm:h-16 text-gray-50" viewBox="0 0 1440 80" preserveAspectRatio="none" fill="currentColor"><path d="M0,40 C360,90 1080,-10 1440,40 L1440,80 L0,80 Z" /></svg>
      </section>

      {/* ─── STATS STRIP ──────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-4 -mt-6 sm:-mt-8 relative z-10">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-gray-200 rounded-2xl overflow-hidden border border-gray-200 shadow-lg">
          {STATS.map((s, i) => (
            <Reveal key={s.label} delay={i * 70} className="bg-white">
              <div className="px-4 py-5 text-center">
                <div className="text-2xl sm:text-3xl font-black text-green-700" style={DISPLAY}>{s.value}</div>
                <div className="text-[11px] sm:text-xs text-gray-500 font-medium mt-1">{s.label}</div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ─── ABOUT / THE POINT ────────────────────────────── */}
      <section className="max-w-7xl mx-auto px-4 py-16 sm:py-24">
        <div className="grid md:grid-cols-2 gap-10 lg:gap-16 items-center">
          <Reveal>
            <span className="text-xs font-bold text-green-700 tracking-widest uppercase">What is WeeDeliver</span>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-gray-900 mt-3 mb-5 leading-tight" style={DISPLAY}>
              The easiest way to access cannabis in South Africa
            </h2>
            <p className="text-gray-600 text-base leading-relaxed mb-4">
              WeeDeliver is a marketplace that brings licensed dispensaries, customers, and delivery drivers together in one trusted platform. We handle discovery, membership, secure payments, and live delivery — so you can focus on the products you love.
            </p>
            <p className="text-gray-600 text-base leading-relaxed mb-6">
              Whether you're shopping for premium flower, exploring edibles, or running a dispensary of your own, WeeDeliver is built to be compliant, private, and refreshingly simple.
            </p>
            <ul className="space-y-3">
              {["Browse verified dispensaries near you", "Membership-based, fully compliant access", "Live tracking from store to door"].map(t => (
                <li key={t} className="flex items-center gap-3 text-gray-700 font-medium text-sm">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-green-100 text-green-700 flex items-center justify-center"><BadgeCheck className="w-4 h-4" /></span>{t}
                </li>
              ))}
            </ul>
          </Reveal>
          <Reveal delay={120}>
            <div className="relative rounded-3xl overflow-hidden p-8 sm:p-10 min-h-[300px] flex flex-col justify-end" style={{ background: "linear-gradient(150deg, #1A7A2E, #0a2e12)" }}>
              <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "radial-gradient(circle at 70% 20%, rgba(255,255,255,0.5) 1px, transparent 1px)", backgroundSize: "24px 24px" }} />
              <LeafIcon className="absolute right-4 top-4 w-40 h-40 text-white/10" />
              <img src={LOGO_URL} alt="" className="absolute right-6 top-6 h-24 sm:h-28 opacity-90 drop-shadow-xl" />
              <div className="relative">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/15 text-green-100 text-[11px] font-semibold mb-3 backdrop-blur-sm"><MapPin className="w-3 h-3" />Nationwide coverage</div>
                <p className="text-white text-xl sm:text-2xl font-black leading-snug" style={DISPLAY}>Built for South Africa, by people who get it.</p>
                <p className="text-green-100/80 text-sm mt-2">Local dispensaries. Local drivers. Local payments in Rand.</p>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ─── HOW IT WORKS ─────────────────────────────────── */}
      <section id="how-it-works" className="bg-white border-y border-gray-100 py-16 sm:py-24 scroll-mt-20">
        <div className="max-w-7xl mx-auto px-4">
          <Reveal className="text-center max-w-2xl mx-auto mb-12">
            <span className="text-xs font-bold text-green-700 tracking-widest uppercase">How it works</span>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-gray-900 mt-3" style={DISPLAY}>Three steps to your door</h2>
            <p className="text-gray-500 mt-3">From browsing to delivery, WeeDeliver keeps every step simple and transparent.</p>
          </Reveal>
          <div className="grid md:grid-cols-3 gap-6">
            {STEPS.map((s, i) => (
              <Reveal key={s.title} delay={i * 120}>
                <div className="relative h-full bg-gray-50 rounded-2xl p-7 border border-gray-100 hover:border-green-200 hover:shadow-md transition-all group">
                  <span className="absolute top-6 right-6 text-5xl font-black text-green-100 group-hover:text-green-200 transition-colors" style={DISPLAY}>{i + 1}</span>
                  <div className="w-12 h-12 rounded-xl bg-green-600 text-white flex items-center justify-center mb-5 shadow-lg shadow-green-600/20"><s.icon className="w-6 h-6" /></div>
                  <h3 className="text-lg font-black text-gray-900 mb-2" style={DISPLAY}>{s.title}</h3>
                  <p className="text-gray-600 text-sm leading-relaxed">{s.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ─── WHY WEEDELIVER ───────────────────────────────── */}
      <section className="max-w-7xl mx-auto px-4 py-16 sm:py-24">
        <Reveal className="text-center max-w-2xl mx-auto mb-12">
          <span className="text-xs font-bold text-green-700 tracking-widest uppercase">Why WeeDeliver</span>
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-gray-900 mt-3" style={DISPLAY}>Designed for trust and convenience</h2>
        </Reveal>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
          {FEATURES.map((f, i) => (
            <Reveal key={f.title} delay={i * 90}>
              <div className="h-full bg-white rounded-2xl p-6 border border-gray-100 hover:-translate-y-1 hover:shadow-xl transition-all">
                <div className="w-11 h-11 rounded-lg bg-green-50 text-green-700 flex items-center justify-center mb-4"><f.icon className="w-6 h-6" /></div>
                <h3 className="font-black text-gray-900 mb-2" style={DISPLAY}>{f.title}</h3>
                <p className="text-gray-600 text-sm leading-relaxed">{f.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ─── MARKETPLACE CTA (dispensaries + drivers) ─────── */}
      <section className="max-w-7xl mx-auto px-4 pb-16 sm:pb-24">
        <div className="grid md:grid-cols-2 gap-5">
          {[
            { icon: Store, tag: "For dispensaries", title: "Grow your dispensary online", body: "List your menu, reach new members, and manage orders, stock, and payouts from one dashboard.", cta: "Partner with us" },
            { icon: Users, tag: "For drivers", title: "Earn on your schedule", body: "Join our delivery network, accept nearby orders, and get paid for every completed delivery.", cta: "Become a driver" },
          ].map((c, i) => (
            <Reveal key={c.tag} delay={i * 120}>
              <div className="relative h-full rounded-3xl p-8 overflow-hidden border border-gray-100 bg-white hover:shadow-lg transition-all">
                <LeafIcon className="absolute -right-6 -bottom-6 w-36 h-36 text-green-50" />
                <div className="relative">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-600 to-green-800 text-white flex items-center justify-center mb-4 shadow-lg"><c.icon className="w-6 h-6" /></div>
                  <span className="text-[11px] font-bold text-green-700 tracking-widest uppercase">{c.tag}</span>
                  <h3 className="text-xl font-black text-gray-900 mt-1 mb-2" style={DISPLAY}>{c.title}</h3>
                  <p className="text-gray-600 text-sm leading-relaxed mb-5 max-w-sm">{c.body}</p>
                  <button onClick={() => nav("/login")} className="inline-flex items-center gap-1.5 text-green-700 font-bold text-sm hover:gap-2.5 transition-all">{c.cta} <ArrowRight className="w-4 h-4" /></button>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ─── TOP DISPENSARIES ─────────────────────────────── */}
      <section className="max-w-7xl mx-auto px-4 pb-16 sm:pb-20">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl sm:text-2xl font-black text-gray-900" style={DISPLAY}>TOP DISPENSARIES</h2>
          {approved.length > 0 && <button onClick={() => nav("/browse")} className="text-xs font-semibold text-green-700 hover:text-green-800 flex items-center gap-1">View all <ChevronRight className="w-3.5 h-3.5" /></button>}
        </div>
        {approved.length > 0 ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
            {approved.slice(0, 4).map(d => <DispensaryCard key={d.id} d={d} onClick={() => nav(`/dispensary/${d.slug}`)} />)}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-gray-300 bg-white py-14 px-6 text-center">
            <div className="w-14 h-14 rounded-full bg-green-50 text-green-600 flex items-center justify-center mx-auto mb-4"><Store className="w-7 h-7" /></div>
            <h3 className="font-black text-gray-900 text-lg" style={DISPLAY}>Dispensaries launching soon</h3>
            <p className="text-gray-500 text-sm mt-2 max-w-md mx-auto">{loaded ? "We're onboarding verified dispensaries right now. Check back shortly — or sign up to be notified the moment they go live." : "Loading dispensaries…"}</p>
            <button onClick={() => nav("/login")} className="mt-5 px-6 py-2.5 rounded-full bg-green-700 text-white font-bold text-sm hover:bg-green-800 transition-all">Create an account</button>
          </div>
        )}
      </section>

      {/* ─── FOOTER ───────────────────────────────────────── */}
      <footer className="bg-gray-900 text-gray-400">
        <div className="max-w-7xl mx-auto px-4 py-12 grid sm:grid-cols-2 md:grid-cols-4 gap-8">
          <div className="sm:col-span-2 md:col-span-1">
            <div className="flex items-center gap-2 mb-3">
              <img src={LOGO_URL} alt="" className="h-9" />
              <span className="font-black text-lg" style={DISPLAY}><span className="text-green-400">WEE</span><span style={{ background: "linear-gradient(90deg, #4ade80 50%, #ffffff 50%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>D</span><span className="text-white">eliver</span></span>
            </div>
            <p className="text-sm leading-relaxed text-gray-500">South Africa's most reliable cannabis delivery platform. Verified dispensaries, real-time tracking, secure local payments.</p>
          </div>
          <div>
            <h4 className="text-white font-bold text-sm mb-3" style={DISPLAY}>Explore</h4>
            <ul className="space-y-2 text-sm">
              <li><button onClick={() => nav("/browse")} className="hover:text-green-400 transition-colors">Browse dispensaries</button></li>
              <li><a href="#how-it-works" className="hover:text-green-400 transition-colors">How it works</a></li>
              <li><button onClick={() => nav("/login")} className="hover:text-green-400 transition-colors">Sign in</button></li>
            </ul>
          </div>
          <div>
            <h4 className="text-white font-bold text-sm mb-3" style={DISPLAY}>Partner</h4>
            <ul className="space-y-2 text-sm">
              <li><button onClick={() => nav("/login")} className="hover:text-green-400 transition-colors">List your dispensary</button></li>
              <li><button onClick={() => nav("/login")} className="hover:text-green-400 transition-colors">Drive with us</button></li>
            </ul>
          </div>
          <div>
            <h4 className="text-white font-bold text-sm mb-3" style={DISPLAY}>Compliance</h4>
            <p className="text-sm text-gray-500 leading-relaxed">Strictly for adults 18 years and older. Cannabis products carry age and membership requirements under South African law.</p>
          </div>
        </div>
        <div className="border-t border-white/10">
          <div className="max-w-7xl mx-auto px-4 py-5 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-gray-500">
            <p>&copy; 2026 WeeDeliver. All rights reserved.</p>
            <p className="flex items-center gap-1.5"><LeafIcon className="w-3.5 h-3.5 text-green-500" /> For adults 18+ only. Consume responsibly.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
