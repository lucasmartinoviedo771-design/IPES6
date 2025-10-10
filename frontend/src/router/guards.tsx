import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";

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

  // Sin requisitos de rol → alcanza con estar logueado
  if (!roles || roles.length === 0) return children;

  // Normalización de roles (case-insensitive)
  const uRoles = (user.roles || []).map((r) => r.toLowerCase().trim());
  const needed = roles.map((r) => r.toLowerCase().trim());

  // Superuser siempre pasa
  if (user.is_superuser) return children;

  // Permite también si considerás admin == staff
  const hasAdminPower = user.is_staff || uRoles.includes("admin");
  const check = (r: string) =>
    uRoles.includes(r) || (r === "admin" && hasAdminPower);

  const allowed = requireAll
    ? needed.every(check)     // AND
    : needed.some(check);     // OR (por defecto)

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