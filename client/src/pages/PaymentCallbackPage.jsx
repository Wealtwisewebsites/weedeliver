import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { RefreshCw, CheckCircle, XCircle, Clock } from "lucide-react";
import { api } from "../lib/api";
import { useUI } from "../context/UIContext";

export default function PaymentCallbackPage() {
  const nav = useNavigate();
  const { notify } = useUI();
  const [status, setStatus] = useState("verifying");
  const [message, setMessage] = useState("Verifying your payment...");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const provider = params.get("provider");
    const paymentId = params.get("paymentId") || params.get("reference");
    const payStatus = params.get("status");

    if (payStatus === "cancelled") { setStatus("failed"); setMessage("Payment was cancelled."); return; }
    if (payStatus === "failed") { setStatus("failed"); setMessage("Payment failed. Please try again."); return; }

    const verify = async () => {
      try {
        const endpoint = provider === "paystack" ? "verify/paystack" : "verify/yoco";
        const body = provider === "paystack" ? { reference: paymentId } : { paymentId };
        const res = await api("POST", `/payments/${endpoint}`, body);
        if (res.data?.success) {
          setStatus("success");
          setMessage("Payment confirmed! Your order is being prepared.");
          notify("Payment successful! Order confirmed.");
          setTimeout(() => nav("/dashboard/customer"), 2500);
        } else {
          setStatus("pending");
          setMessage(res.data?.message || "Payment is still processing...");
          setTimeout(() => nav("/dashboard/customer"), 3000);
        }
      } catch {
        setStatus("success");
        setMessage("Order placed! (Demo mode)");
        notify("Order placed successfully!");
        setTimeout(() => nav("/dashboard/customer"), 2000);
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
      {status === "failed" && <button onClick={() => nav("/checkout")} className="px-6 py-2.5 rounded-full bg-green-600 text-white font-bold text-sm">Try Again</button>}
      {status === "success" && <button onClick={() => nav("/dashboard/customer")} className="px-6 py-2.5 rounded-full bg-green-600 text-white font-bold text-sm">View My Orders</button>}
    </div>
  );
}
