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
  console.log("[ProtectedRoute] Check. Path:", loc.pathname, "User:", user?.dni, "Loading:", loading);

  if (loading) {
    return (
      <Box sx={{ display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", height: "100vh", gap: 2 }}>
        <CircularProgress />
        <div style={{ fontFamily: "sans-serif", color: "#666" }}>Cargando sesión...</div>
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

import { getDefaultHomeRoute } from "@/utils/roles";

export function PublicOnlyRoute({
  children,
}: {
  children: JSX.Element;
}) {
  const { user, loading } = useAuth();
  if (loading) {
    return children;
  }
  const redirectTo = getDefaultHomeRoute(user);
  return user ? <Navigate to={redirectTo} replace /> : children;
}
