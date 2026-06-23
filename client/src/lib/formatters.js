export const formatZAR = (n) => `R${Number(n).toFixed(2)}`;
export const fmtTime = (d) => new Date(d).toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit" });
export const fmtDateTime = (d) => new Date(d).toLocaleString("en-ZA", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
export const timeAgo = (d) => { const m = Math.floor((Date.now() - new Date(d).getTime()) / 60000); if (m < 1) return "just now"; if (m < 60) return `${m}m ago`; if (m < 1440) return `${Math.floor(m / 60)}h ago`; return `${Math.floor(m / 1440)}d ago`; };

export const isDispensaryOpen = (hours) => {
  if (!hours) return true;
  const dayMap = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
  const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Africa/Johannesburg" }));
  const dayKey = dayMap[now.getDay()];
  const dayHours = hours[dayKey];
  if (!dayHours || !dayHours.isOpen) return false;
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const [openH, openM] = dayHours.open.split(":").map(Number);
  const [closeH, closeM] = dayHours.close.split(":").map(Number);
  const openMinutes = openH * 60 + openM;
  const closeMinutes = closeH * 60 + closeM;
  if (closeMinutes < openMinutes) {
    return currentMinutes >= openMinutes || currentMinutes <= closeMinutes;
  }
  return currentMinutes >= openMinutes && currentMinutes <= closeMinutes;
};

export const fileToDataUrl = (file) => new Promise((resolve) => { const r = new FileReader(); r.onload = () => resolve(r.result); r.readAsDataURL(file); });

let _idCounter = 0;
export const uid = (prefix = "o") => `${prefix}${++_idCounter}`;
