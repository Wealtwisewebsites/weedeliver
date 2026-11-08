import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { RefreshCw, CheckCircle, XCircle, Clock } from "lucide-react";
import { api } from "../lib/api";
import { useUI } from "../context/UIContext";

const VERIFY_ENDPOINTS = { stitch: "verify/stitch", ikhokha: "verify/ikhokha" };

export default function PaymentCallbackPage() {
  const nav = useNavigate();
  const { notify } = useUI();
  const [status, setStatus] = useState("verifying");
  const [message, setMessage] = useState("Verifying your payment...");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const provider = params.get("provider");
    const paymentId = params.get("paymentId");
    const payStatus = params.get("status");

    // Stitch reports "closed" when the payer backs out of its checkout.
    if (payStatus === "cancelled" || payStatus === "closed") { setStatus("failed"); setMessage("Payment was cancelled. Your order is saved — you can pay for it from your orders."); return; }
    if (payStatus === "failed") { setStatus("failed"); setMessage("Payment failed. Your order is saved — you can try paying again from your orders."); return; }

    const endpoint = VERIFY_ENDPOINTS[provider];
    if (!endpoint || !paymentId) { setStatus("failed"); setMessage("We couldn't find this payment. Check your orders for its status."); return; }

    const verify = async () => {
      const res = await api("POST", `/payments/${endpoint}`, { paymentId });
      if (res.data?.success) {
        setStatus("success");
        setMessage("Payment confirmed! Your order is being prepared.");
        notify("Payment successful! Order confirmed.");
        setTimeout(() => nav("/dashboard/customer"), 2500);
      } else if (res.status === 0 || res.status === 401 || res.status === 429 || res.status >= 500) {
        // Unreachable server/provider, an expired session or rate limiting says nothing about the
        // payment itself — the webhook may still confirm it.
        setStatus("pending");
        setMessage("We couldn't confirm your payment yet. Check your orders in a moment.");
        setTimeout(() => nav("/dashboard/customer"), 3000);
      } else if (!res.ok) {
        setStatus("failed");
        setMessage(res.data?.error || "Payment could not be confirmed.");
      } else {
        setStatus("pending");
        setMessage(res.data?.message || "Payment is still processing...");
        setTimeout(() => nav("/dashboard/customer"), 3000);
      }
    };
    verify();
  }, []);

  return (
    <div className="max-w-md mx-auto px-4 py-16 text-center">
      <div className={`w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center ${status === "success" ? "bg-green-100" : status === "failed" ? "bg-red-100" : "bg-amber-100"}`}>
        {status === "verifying" && <RefreshCw className="w-7 h-7 text-amber-600 animate-spin" />}
        {status === "success" && <CheckCircle className="w-7 h-7 text-green-600" />}
        {status === "failed" && <XCircle className="w-7 h-7 text-red-600" />}
        {status === "pending" && <Clock className="w-7 h-7 text-amber-600" />}
      </div>
      <h2 className="text-lg font-black mb-2" style={{ fontFamily: "'Outfit', sans-serif" }}>{status === "success" ? "Payment Successful!" : status === "failed" ? "Payment Failed" : status === "pending" ? "Processing..." : "Verifying Payment..."}</h2>
      <p className="text-sm text-gray-500 mb-6">{message}</p>
      {status === "failed" && <button onClick={() => nav("/dashboard/customer")} className="px-6 py-2.5 rounded-full bg-green-600 text-white font-bold text-sm">View My Orders</button>}
      {status === "success" && <button onClick={() => nav("/dashboard/customer")} className="px-6 py-2.5 rounded-full bg-green-600 text-white font-bold text-sm">View My Orders</button>}
    </div>
  );
}
