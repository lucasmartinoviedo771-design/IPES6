import { Navigate, useLocation } from "react-router-dom";
import { Box, CircularProgress } from "@mui/material";

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

  if (loading) {
    return (
      <Box display="flex" alignItems="center" justifyContent="center" minHeight="60vh">
        <CircularProgress size={32} />
      </Box>
    );
  }

  // No autenticado → al login, preservando "from"
  if (!user) return <Navigate to={redirectTo} replace state={{ from: loc }} />;

  const mustChange = Boolean(user.must_change_password);
  if (mustChange && loc.pathname !== "/cambiar-password") {
    return <Navigate to="/cambiar-password" replace state={{ from: loc }} />;
  }

  const mustCompleteProfile = Boolean(user.must_complete_profile);
  if (!mustChange && mustCompleteProfile && loc.pathname !== "/alumnos/completar-perfil") {
    return <Navigate to="/alumnos/completar-perfil" replace state={{ from: loc }} />;
  }

  // Sin requisitos de rol → alcanza con estar logueado
  if (!roles || roles.length === 0) return children;

  const allowed = requireAll
    ? hasAllRoles(user, roles)
    : hasAnyRole(user, roles);

  return allowed ? children : <Navigate to={forbiddenTo} replace state={{ from: loc }} />;
}

export function PublicOnlyRoute({
  children,
  redirectTo = "/alumnos",
}: {
  children: JSX.Element;
  redirectTo?: string;
}) {
  const { user, loading } = useAuth();
  if (loading) {
    return children;
  }
  return user ? <Navigate to={redirectTo} replace /> : children;
}
