import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { useEffect } from "react";

export default function ProtectedRoute({ children, requiredRole }) {
  const { currentUser, authLoading } = useAuth();
  const nav = useNavigate();

  useEffect(() => {
    if (!authLoading && !currentUser) {
      nav("/login");
    } else if (!authLoading && requiredRole && currentUser.role !== requiredRole) {
      nav("/");
    }
  }, [authLoading, currentUser, requiredRole, nav]);

  if (authLoading) return <div className="p-8 text-center text-gray-500">Loading...</div>;
  if (!currentUser || (requiredRole && currentUser.role !== requiredRole)) return null;

  return children;
}
