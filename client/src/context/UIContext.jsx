import { createContext, useContext, useState, useCallback, useRef } from "react";

const UIContext = createContext();
export const useUI = () => useContext(UIContext);

export function UIProvider({ children }) {
  const [toast, setToast] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [activityLog, setActivityLog] = useState([]);
  const [showLog, setShowLog] = useState(false);
  const toastTimer = useRef(null);

  const notify = useCallback((msg, type = "success") => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ msg, type, id: Date.now() });
    toastTimer.current = setTimeout(() => setToast(null), 3500);
  }, []);

  const logActivity = useCallback((action, role, details = "") => {
    setActivityLog(prev => [{ id: Date.now(), action, role, details, time: new Date().toISOString() }, ...prev].slice(0, 50));
  }, []);

  const addNotification = useCallback((targetRole, msg, orderId = null) => {
    setNotifications(prev => [{ id: Date.now() + Math.random(), targetRole, msg, orderId, read: false, time: new Date().toISOString() }, ...prev]);
  }, []);

  const unreadCount = useCallback((role) => notifications.filter(n => n.targetRole === role && !n.read).length, [notifications]);
  const markRead = useCallback((role) => setNotifications(prev => prev.map(n => n.targetRole === role ? { ...n, read: true } : n)), []);

  return (
    <UIContext.Provider value={{ toast, notify, menuOpen, setMenuOpen, notifications, addNotification, unreadCount, markRead, activityLog, logActivity, showLog, setShowLog }}>
      {children}
    </UIContext.Provider>
  );
}
