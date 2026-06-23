import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Check, Truck, CheckCircle, Navigation, Bell, Star } from "lucide-react";
import { ORDER_FLOW, ORDER_FLOW_LABELS } from "../lib/constants";
import { formatZAR, fmtDateTime, timeAgo } from "../lib/formatters";
import { api } from "../lib/api";
import { StatusBadge } from "../components/StatusBadge";
import { useAuth } from "../context/AuthContext";
import { useUI } from "../context/UIContext";

export default function OrderTrackingPage() {
  const nav = useNavigate();
  const { orderId } = useParams();
  const { currentUser } = useAuth();
  const { notify, notifications } = useUI();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [reviewText, setReviewText] = useState("");
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [existingReview, setExistingReview] = useState(null);

  useEffect(() => {
    api("GET", `/orders/${orderId}`).then(res => {
      if (res.ok && res.data) setOrder(res.data);
      setLoading(false);
    });
  }, [orderId]);

  if (loading) return <div className="p-8 text-center text-gray-400">Loading...</div>;
  if (!order) return <div className="p-8 text-center">Order not found</div>;

  const si = ORDER_FLOW.indexOf(order.status);
  const notifs = notifications.filter(n => n.orderId === order.id && n.targetRole === "CUSTOMER").slice(0, 5);

  const handleSubmitReview = async () => {
    if (rating === 0) return;
    setReviewSubmitting(true);
    const cname = currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : "Anonymous";
    await api("POST", "/reviews", { orderId: order.id, dispensaryId: order.dispensaryId, customerId: currentUser?.id, customerName: cname, rating, comment: reviewText });
    notify("Review submitted - thank you!");
    setExistingReview({ rating, comment: reviewText });
    setReviewOpen(false);
    setReviewSubmitting(false);
  };

  return (
    <div className="max-w-2xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
      <button onClick={() => nav("/dashboard/customer")} className="flex items-center gap-1 text-gray-500 text-xs sm:text-sm mb-2 sm:mb-3"><ArrowLeft className="w-4 h-4" /> Dashboard</button>
      <div className="flex items-center justify-between mb-2 sm:mb-3"><h1 className="text-lg sm:text-xl font-black" style={{ fontFamily: "'Outfit', sans-serif" }}>#{order.id.slice(0,8).toUpperCase()}</h1><StatusBadge status={order.status} /></div>
      <div className="h-28 sm:h-36 rounded-xl sm:rounded-2xl bg-gradient-to-br from-green-50 to-emerald-50 flex items-center justify-center border border-green-200 mb-3 relative">
        {order.status === "IN_TRANSIT" ? <Truck className="w-10 h-10 text-green-600 animate-bounce" /> : order.status === "DELIVERED" ? <CheckCircle className="w-10 h-10 text-green-600" /> : <Navigation className="w-8 h-8 text-green-600" />}
      </div>
      {notifs.length > 0 && <div className="mb-3 space-y-1">{notifs.slice(0, 3).map(n => <div key={n.id} className="bg-green-50 border border-green-200 rounded-lg px-3 py-1.5 text-[11px] text-green-800 flex items-center gap-2"><Bell className="w-3 h-3 flex-shrink-0" /><span className="flex-1">{n.msg}</span><span className="text-green-500 ml-auto whitespace-nowrap">{timeAgo(n.time)}</span></div>)}</div>}
      <div className="bg-white rounded-xl p-4 border mb-3">
        <h3 className="font-bold text-sm mb-3">Progress</h3>
        {ORDER_FLOW.map((s, i) => (
          <div key={s} className="flex items-start gap-2.5">
            <div className="flex flex-col items-center"><div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${i < si ? "bg-green-600 text-white" : i === si ? "bg-green-600 text-white ring-3 ring-green-100" : "bg-gray-100 text-gray-400"}`}>{i <= si ? <Check className="w-3 h-3" /> : i + 1}</div>{i < ORDER_FLOW.length - 1 && <div className={`w-0.5 h-4 ${i < si ? "bg-green-600" : "bg-gray-200"}`} />}</div>
            <p className={`text-xs font-semibold pt-0.5 pb-1.5 ${i <= si ? "text-gray-900" : "text-gray-400"}`}>{ORDER_FLOW_LABELS[s]}</p>
          </div>
        ))}
      </div>
      <div className="bg-white rounded-xl p-4 border">
        <p className="text-xs text-gray-500 mb-2">{order.dispensaryName || order.dispName} · {fmtDateTime(order.createdAt)}</p>
        {(order.items || []).map((i, x) => <div key={x} className="flex justify-between text-sm py-0.5"><span className="text-gray-600">{i.quantity}x {i.productName}</span><span>{formatZAR(i.unitPrice * i.quantity)}</span></div>)}
        <hr className="my-2" /><div className="flex justify-between font-bold text-sm"><span>Total</span><span className="text-green-700">{formatZAR(order.total)}</span></div>
        {order.driverName && <p className="text-xs text-gray-500 mt-2">Driver: {order.driverName}</p>}
      </div>

      {order.status === "DELIVERED" && (
        <div className="mt-3">
          {existingReview ? (
            <div className="bg-green-50 rounded-xl border border-green-200 p-4">
              <p className="text-xs font-bold text-green-700 mb-1">Your review</p>
              <div className="flex gap-0.5 mb-1">{[1,2,3,4,5].map(s => <span key={s} className={s <= existingReview.rating ? "text-amber-400" : "text-gray-300"}>★</span>)}</div>
              {existingReview.comment && <p className="text-xs text-gray-600">"{existingReview.comment}"</p>}
            </div>
          ) : reviewOpen ? (
            <div className="bg-white rounded-xl border p-4 shadow-sm">
              <h3 className="font-bold text-sm mb-3">Rate your order</h3>
              <div className="flex gap-1 mb-3 justify-center">{[1,2,3,4,5].map(s => (
                <button key={s} onClick={() => setRating(s)} className={`text-3xl transition-transform hover:scale-110 ${s <= rating ? "text-amber-400" : "text-gray-300"}`}>★</button>
              ))}</div>
              <textarea value={reviewText} onChange={e => setReviewText(e.target.value)} placeholder="Tell others what you thought... (optional)" rows={3} className="w-full px-3 py-2 rounded-xl border text-sm focus:ring-2 focus:ring-green-500 outline-none resize-none mb-3" />
              <div className="flex gap-2">
                <button onClick={() => setReviewOpen(false)} className="flex-1 py-2.5 rounded-xl border text-sm font-semibold text-gray-600">Cancel</button>
                <button onClick={handleSubmitReview} disabled={rating === 0 || reviewSubmitting} className={`flex-1 py-2.5 rounded-xl text-white font-bold text-sm transition-colors ${rating === 0 ? "bg-gray-300 cursor-not-allowed" : "bg-green-600 hover:bg-green-700"}`}>{reviewSubmitting ? "Submitting..." : "Submit Review"}</button>
              </div>
            </div>
          ) : (
            <button onClick={() => setReviewOpen(true)} className="w-full py-3 rounded-xl border-2 border-dashed border-green-300 text-green-700 font-semibold text-sm hover:bg-green-50 transition-colors flex items-center justify-center gap-2">
              <Star className="w-4 h-4" />Leave a review
            </button>
          )}
        </div>
      )}
    </div>
  );
}
