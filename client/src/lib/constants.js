export const DEFAULT_HOURS = { mon: { open: "08:00", close: "22:00", isOpen: true }, tue: { open: "08:00", close: "22:00", isOpen: true }, wed: { open: "08:00", close: "22:00", isOpen: true }, thu: { open: "08:00", close: "22:00", isOpen: true }, fri: { open: "08:00", close: "23:00", isOpen: true }, sat: { open: "09:00", close: "23:00", isOpen: true }, sun: { open: "10:00", close: "20:00", isOpen: true } };
export const DAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
export const DAY_LABELS = { mon: "Monday", tue: "Tuesday", wed: "Wednesday", thu: "Thursday", fri: "Friday", sat: "Saturday", sun: "Sunday" };
export const SA_BANKS = ["ABSA", "FNB", "Standard Bank", "Nedbank", "Capitec", "Investec", "TymeBank", "African Bank"];

export const CATEGORY_LABELS = { INDOOR_FLOWER: "Indoor Flowers", GREENHOUSE_FLOWER: "Greenhouse", ACCESSORY: "Accessories", EDIBLE: "Edibles", CONCENTRATE: "Concentrates", OTHER: "Other" };

export const STATUS_COLORS = {
  PENDING: "bg-yellow-50 text-yellow-700 border-yellow-200",
  CONFIRMED: "bg-blue-50 text-blue-700 border-blue-200",
  PREPARING: "bg-purple-50 text-purple-700 border-purple-200",
  READY_FOR_PICKUP: "bg-indigo-50 text-indigo-700 border-indigo-200",
  DRIVER_ASSIGNED: "bg-cyan-50 text-cyan-700 border-cyan-200",
  IN_TRANSIT: "bg-orange-50 text-orange-700 border-orange-200",
  DELIVERED: "bg-green-50 text-green-700 border-green-200",
  CANCELLED: "bg-red-50 text-red-700 border-red-200",
};

export const ORDER_FLOW = ["PENDING", "CONFIRMED", "PREPARING", "READY_FOR_PICKUP", "DRIVER_ASSIGNED", "IN_TRANSIT", "DELIVERED"];
export const ORDER_FLOW_LABELS = { PENDING: "Order Placed", CONFIRMED: "Confirmed", PREPARING: "Preparing", READY_FOR_PICKUP: "Ready for Pickup", DRIVER_ASSIGNED: "Driver Assigned", IN_TRANSIT: "In Transit", DELIVERED: "Delivered" };

export const DISP_COLORS = { d1: "#1A7A2E", d2: "#b45309", d3: "#7c3aed", d4: "#059669" };

export const EMPTY_PRODUCT = { name: "", category: "INDOOR_FLOWER", strainType: "HYBRID", price: "", unit: "per gram", stock: "", description: "", thcPercent: "", cbdPercent: "", effectSpectrum: 5 };

export const CATEGORY_ICONS = {
  INDOOR_FLOWER: "🌿", GREENHOUSE_FLOWER: "🌱", ACCESSORY: "🔧", EDIBLE: "🍫", CONCENTRATE: "💧", OTHER: "📦"
};

export const STRAIN_COLORS = {
  INDICA: "bg-purple-100 text-purple-700 border-purple-200",
  SATIVA: "bg-amber-100 text-amber-700 border-amber-200",
  HYBRID: "bg-green-100 text-green-700 border-green-200",
};

export const DRIVER_APPLICATION_STEPS = [
  { id: "personal", label: "Personal Info", desc: "Basic details" },
  { id: "vehicle", label: "Vehicle", desc: "Transport info" },
  { id: "documents", label: "Documents", desc: "Upload docs" },
  { id: "quiz", label: "Quiz", desc: "Suitability check" },
  { id: "review", label: "Review", desc: "Submit application" },
];

export const DRIVER_QUIZ = [
  { q: "Are you 18 years or older?", key: "age18", bad: "no" },
  { q: "Do you have a valid South African driver's license?", key: "license", bad: "no" },
  { q: "Are you comfortable handling cannabis products?", key: "cannabis", bad: "no" },
  { q: "Can you work flexible hours, including evenings and weekends?", key: "flexible", bad: "no" },
  { q: "Do you have a reliable smartphone with data?", key: "smartphone", bad: "no" },
  { q: "Are you familiar with the area you'll be delivering in?", key: "area", bad: "no" },
  { q: "Do you agree to follow all WeeDeliver delivery protocols?", key: "protocols", bad: "no" },
];
