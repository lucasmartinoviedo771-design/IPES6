import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";

export default function RequireAuth({ children, roles }:{ children: JSX.Element; roles?: string[] }) {
  const { user, loading } = useAuth();
  const loc = useLocation();

  if (loading) {
    // Evita renderizar antes de saber si el usuario está autenticado
    return null;
  }

  if (!user) {
    // Redirige a login si no está autenticado
    return <Navigate to="/login" state={{ from: loc }} replace />;
  }

  if (roles?.length && !user.roles?.some(r => roles.includes(r))) {
    // Si se requieren roles y el usuario no los tiene, redirige al dashboard
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}