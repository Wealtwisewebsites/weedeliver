import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertCircle } from "lucide-react";
import { LOGO_URL } from "../lib/logo";
import { BrandName } from "../components/BrandLogo";
import { useAuth } from "../context/AuthContext";
import { useUI } from "../context/UIContext";

export default function LoginPage() {
  const nav = useNavigate();
  const { login, register } = useAuth();
  const { notify } = useUI();
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState("CUSTOMER");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async () => {
    setError(null);
    setLoading(true);
    if (mode === "login") {
      const res = await login(email, password);
      if (res.ok) {
        notify(`Welcome back, ${res.user.firstName}!`);
        const dm = { CUSTOMER: "/", DISPENSARY: "/dashboard/dispensary", DRIVER: "/dashboard/driver", ADMIN: "/dashboard/admin" };
        nav(dm[res.user.role] || "/");
      } else {
        setError(res.error || "Invalid email or password");
      }
    } else {
      if (!firstName || !lastName) { setError("First and last name required"); setLoading(false); return; }
      const res = await register({ email, password, firstName, lastName, phone, role });
      if (res.ok) {
        notify(`Welcome to WeeDeliver, ${res.user.firstName}!`);
        nav("/");
      } else {
        setError(res.error || "Registration failed");
      }
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: "linear-gradient(180deg, #f0fdf4, #fff)" }}>
      <div className="max-w-md w-full">
        <div className="text-center mb-6"><img src={LOGO_URL} alt="WeeDeliver" className="h-20 mx-auto mb-3 drop-shadow-lg" /><BrandName size="text-2xl" /><p className="text-gray-500 text-sm mt-1">{mode === "login" ? "Sign in to your account" : "Create your account"}</p></div>
        <div className="bg-white rounded-2xl shadow-xl border p-5 space-y-3">
          <div className="flex rounded-xl bg-gray-100 p-0.5">
            <button onClick={() => setMode("login")} className={`flex-1 py-2 rounded-lg text-sm font-bold transition ${mode === "login" ? "bg-white shadow text-green-700" : "text-gray-500"}`}>Sign In</button>
            <button onClick={() => setMode("register")} className={`flex-1 py-2 rounded-lg text-sm font-bold transition ${mode === "register" ? "bg-white shadow text-green-700" : "text-gray-500"}`}>Register</button>
          </div>
          {mode === "register" && <>
            <div className="grid grid-cols-2 gap-2">
              <div><label className="block text-[11px] text-gray-500 mb-1">First Name</label><input value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="Thabo" className="w-full px-3 py-2 rounded-lg border text-sm outline-none focus:ring-2 focus:ring-green-500" /></div>
              <div><label className="block text-[11px] text-gray-500 mb-1">Last Name</label><input value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Mokoena" className="w-full px-3 py-2 rounded-lg border text-sm outline-none focus:ring-2 focus:ring-green-500" /></div>
            </div>
            <div><label className="block text-[11px] text-gray-500 mb-1">Phone (optional)</label><input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+27821234567" className="w-full px-3 py-2 rounded-lg border text-sm outline-none focus:ring-2 focus:ring-green-500" /></div>
            <div><label className="block text-[11px] text-gray-500 mb-1">Account Type</label>
              <div className="grid grid-cols-3 gap-1">{[{r:"CUSTOMER",l:"Customer",i:"\u{1F464}"},{r:"DISPENSARY",l:"Dispensary",i:"\u{1FAA8}"},{r:"DRIVER",l:"Driver",i:"\u{1F6F5}"}].map(t => (
                <button key={t.r} onClick={() => setRole(t.r)} className={`py-2 rounded-lg border text-xs font-bold transition ${role===t.r?"border-green-500 bg-green-50 text-green-700":"border-gray-200 text-gray-500"}`}>{t.i} {t.l}</button>
              ))}</div>
            </div>
          </>}
          <div><label className="block text-[11px] text-gray-500 mb-1">Email</label><input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@email.com" className="w-full px-3 py-2 rounded-lg border text-sm outline-none focus:ring-2 focus:ring-green-500" /></div>
          <div><label className="block text-[11px] text-gray-500 mb-1">Password</label><input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Min 6 characters" className="w-full px-3 py-2 rounded-lg border text-sm outline-none focus:ring-2 focus:ring-green-500" onKeyDown={e => e.key === "Enter" && handleSubmit()} /></div>
          {error && <div className="bg-red-50 border border-red-200 rounded-lg p-2 text-xs text-red-700 flex items-center gap-1"><AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />{error}</div>}
          <button onClick={handleSubmit} disabled={loading || !email || !password} className={`w-full py-3 rounded-xl text-white font-bold text-sm shadow-lg transition ${loading ? "opacity-60" : "hover:shadow-xl"}`} style={{ background: "linear-gradient(135deg, #1A7A2E, #2d9a4a)" }}>{loading ? "Please wait..." : mode === "login" ? "Sign In" : "Create Account"}</button>
          <div className="text-center text-[11px] text-gray-400 pt-1">{mode === "login" ? "Demo: customer@test.com / password123" : "You can also register as a Dispensary or Driver"}</div>
        </div>
      </div>
    </div>
  );
}
