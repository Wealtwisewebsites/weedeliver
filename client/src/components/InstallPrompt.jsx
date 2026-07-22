import { useEffect, useState } from "react";
import { Download, X, Share } from "lucide-react";

const isStandalone = () =>
  window.matchMedia?.("(display-mode: standalone)").matches || window.navigator.standalone === true;
const isIos = () => /iphone|ipad|ipod/i.test(window.navigator.userAgent) && !window.MSStream;

// Floating "Install app" prompt. Uses the native install flow on Android/Chrome/Edge,
// and shows Add-to-Home-Screen guidance on iOS Safari (which has no programmatic install).
export default function InstallPrompt() {
  const [deferred, setDeferred] = useState(null);
  const [mode, setMode] = useState(null); // "native" | "ios"

  useEffect(() => {
    if (isStandalone() || localStorage.getItem("wd_install_dismissed") === "1") return;

    const onPrompt = (e) => { e.preventDefault(); setDeferred(e); setMode("native"); };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", () => setMode(null));

    // iOS never fires beforeinstallprompt — show the manual hint after a short delay.
    let iosTimer;
    if (isIos()) iosTimer = setTimeout(() => setMode((m) => m || "ios"), 2500);

    return () => { window.removeEventListener("beforeinstallprompt", onPrompt); clearTimeout(iosTimer); };
  }, []);

  if (!mode) return null;

  const dismiss = () => { setMode(null); localStorage.setItem("wd_install_dismissed", "1"); };
  const install = async () => {
    if (!deferred) return;
    deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
    setMode(null);
  };

  return (
    <div className="fixed bottom-4 inset-x-3 z-[90] max-w-md mx-auto">
      <div className="bg-gray-900 text-white rounded-2xl shadow-2xl border border-white/10 p-3 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-green-600 flex items-center justify-center flex-shrink-0"><Download className="w-5 h-5" /></div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm">Install WeeDeliver</p>
          {mode === "native"
            ? <p className="text-[11px] text-gray-400">Add it to your home screen for a faster, app-like experience.</p>
            : <p className="text-[11px] text-gray-400 flex items-center gap-1">Tap <Share className="w-3 h-3 inline" /> then "Add to Home Screen".</p>}
        </div>
        {mode === "native" && <button onClick={install} className="px-3 py-2 rounded-xl bg-green-600 text-white text-xs font-bold hover:bg-green-700 flex-shrink-0">Install</button>}
        <button onClick={dismiss} aria-label="Dismiss" className="p-1 text-gray-400 hover:text-white flex-shrink-0"><X className="w-4 h-4" /></button>
      </div>
    </div>
  );
}
