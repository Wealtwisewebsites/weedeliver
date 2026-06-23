import { BrowserRouter, Routes, Route } from "react-router-dom";
import { lazy, Suspense } from "react";
import { CheckCircle, AlertCircle, Shield } from "lucide-react";

import { AuthProvider, useAuth } from "./context/AuthContext";
import { CartProvider } from "./context/CartContext";
import { UIProvider, useUI } from "./context/UIContext";

import { LOGO_URL } from "./lib/logo";
import Navbar from "./components/Navbar";
import MobileMenu from "./components/MobileMenu";
import ActivityLogPanel from "./components/ActivityLogPanel";
import ProtectedRoute from "./components/ProtectedRoute";

const HomePage = lazy(() => import("./pages/HomePage"));
const LoginPage = lazy(() => import("./pages/LoginPage"));
const BrowseDispensariesPage = lazy(() => import("./pages/BrowseDispensariesPage"));
const DispensaryPage = lazy(() => import("./pages/DispensaryPage"));
const ProductDetailPage = lazy(() => import("./pages/ProductDetailPage"));
const CartPage = lazy(() => import("./pages/CartPage"));
const CheckoutPage = lazy(() => import("./pages/CheckoutPage"));
const PaymentCallbackPage = lazy(() => import("./pages/PaymentCallbackPage"));
const OrderTrackingPage = lazy(() => import("./pages/OrderTrackingPage"));
const CustomerDashboard = lazy(() => import("./pages/CustomerDashboard"));
const DispensaryDashboardPage = lazy(() => import("./pages/DispensaryDashboardPage"));
const DriverDashboardPage = lazy(() => import("./pages/DriverDashboardPage"));
const AdminDashboardPage = lazy(() => import("./pages/AdminDashboardPage"));

function AgeGate() {
  const { setAgeVerified } = useAuth();
  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: "linear-gradient(135deg, #0a2e12, #1A7A2E, #0f4a2a)", fontFamily: "'DM Sans', sans-serif" }}>
      <div className="max-w-md w-full bg-white/10 backdrop-blur-xl rounded-3xl p-8 text-center border border-white/20 shadow-2xl">
        <img src={LOGO_URL} alt="WeeDeliver" className="h-28 mx-auto mb-4 drop-shadow-2xl" />
        <h1 className="text-3xl font-black tracking-tight mb-2" style={{ fontFamily: "'Outfit', sans-serif" }}><span className="text-green-400">WEE</span><span style={{ background: "linear-gradient(90deg, #4ade80 50%, #ffffff 50%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>D</span><span className="text-white">eliver</span></h1>
        <p className="text-green-200 text-sm mb-8">South Africa's Cannabis Delivery Platform</p>
        <div className="bg-white/10 rounded-2xl p-6 mb-6 border border-white/10"><Shield className="w-8 h-8 text-amber-300 mx-auto mb-3" /><h2 className="text-white font-bold text-lg mb-2">Age Verification Required</h2><p className="text-green-200 text-sm">You must be 18 years or older to access this platform.</p></div>
        <button onClick={() => setAgeVerified(true)} className="w-full bg-white text-green-800 font-bold py-3.5 rounded-full hover:bg-green-50 transition-all text-lg shadow-lg">I am 18 or older — Enter</button>
        <p className="text-white/40 text-xs mt-6">Cannabis products are for adults 18+ only.</p>
      </div>
    </div>
  );
}

function Toast() {
  const { toast } = useUI();
  if (!toast) return null;
  return (
    <div key={toast.id} className={`fixed top-4 right-4 z-[100] px-5 py-3 rounded-2xl shadow-2xl text-white text-sm font-medium flex items-center gap-2 ${toast.type === "success" ? "bg-green-600" : "bg-red-500"}`} style={{ animation: "slideIn .3s ease-out" }}>
      {toast.type === "success" ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}{toast.msg}
    </div>
  );
}

function AppShell() {
  const { ageVerified } = useAuth();
  const { showLog } = useUI();

  if (!ageVerified) return <AgeGate />;

  const LoadingSpinner = () => <div className="p-8 text-center text-gray-500">Loading...</div>;

  return (
    <div className="min-h-screen bg-gray-50" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <Toast />
      <Navbar />
      <main className="min-h-screen pb-20">
        <Suspense fallback={<LoadingSpinner />}>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/browse" element={<BrowseDispensariesPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/dispensary/:slug" element={<DispensaryPage />} />
            <Route path="/product/:dispensarySlug/:productId" element={<ProductDetailPage />} />
            <Route path="/cart" element={<CartPage />} />
            <Route path="/checkout" element={<ProtectedRoute><CheckoutPage /></ProtectedRoute>} />
            <Route path="/payment/callback" element={<PaymentCallbackPage />} />
            <Route path="/order/:orderId" element={<ProtectedRoute><OrderTrackingPage /></ProtectedRoute>} />
            <Route path="/dashboard/customer" element={<ProtectedRoute requiredRole="CUSTOMER"><CustomerDashboard /></ProtectedRoute>} />
            <Route path="/dashboard/dispensary" element={<ProtectedRoute requiredRole="DISPENSARY"><DispensaryDashboardPage /></ProtectedRoute>} />
            <Route path="/dashboard/driver" element={<ProtectedRoute requiredRole="DRIVER"><DriverDashboardPage /></ProtectedRoute>} />
            <Route path="/dashboard/admin" element={<ProtectedRoute requiredRole="ADMIN"><AdminDashboardPage /></ProtectedRoute>} />
          </Routes>
        </Suspense>
      </main>
      {showLog && <ActivityLogPanel />}
      <MobileMenu />
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <CartProvider>
          <UIProvider>
            <AppShell />
          </UIProvider>
        </CartProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
