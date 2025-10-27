import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { hasAnyRole, hasAllRoles } from "@/utils/roles";

type ProtectedProps = {
  children: JSX.Element;
  roles?: string[];           // p.ej. ["bedel","secretaria","admin"]
  redirectTo?: string;        // default: "/login"
  forbiddenTo?: string;       // default: "/403"
  requireAll?: boolean;       // default: false (OR). Si true => AND.
};

export function ProtectedRoute({
  children,
  roles,
  redirectTo = "/login",
  forbiddenTo = "/403",
  requireAll = false,
}: ProtectedProps) {
  const { user, loading } = useAuth();
  const loc = useLocation();

  if (loading) return null; // o un spinner

  // No autenticado → al login, preservando "from"
  if (!user) return <Navigate to={redirectTo} replace state={{ from: loc }} />;

  const mustChange = Boolean(user.must_change_password);
  if (mustChange && loc.pathname !== "/cambiar-password") {
    return <Navigate to="/cambiar-password" replace state={{ from: loc }} />;
  }

  // Sin requisitos de rol → alcanza con estar logueado
  if (!roles || roles.length === 0) return children;

  const allowed = requireAll
    ? hasAllRoles(user, roles)
    : hasAnyRole(user, roles);

  return allowed ? children : <Navigate to={forbiddenTo} replace />;
}

export function PublicOnlyRoute({
  children,
  redirectTo = "/dashboard",
}: {
  children: JSX.Element;
  redirectTo?: string;
}) {
  const { user, loading } = useAuth();
  if (loading) return null; // o spinner
  return user ? <Navigate to={redirectTo} replace /> : children;
}
