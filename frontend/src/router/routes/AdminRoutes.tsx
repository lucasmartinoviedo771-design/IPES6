import { Outlet, Route } from "react-router-dom";
import { Suspense, lazy } from "react";
import { Box, CircularProgress } from "@mui/material";

import AppShell from "@/components/layout/AppShell";
import { ProtectedRoute } from "@/router/guards";

const SuspenseFallback = (
  <Box p={4} textAlign="center">
    <CircularProgress size={24} />
  </Box>
);

const lazyPage = (importer: () => Promise<{ default: React.ComponentType<any> }>) => {
  const Component = lazy(importer);
  return () => (
    <Suspense fallback={SuspenseFallback}>
      <Component />
    </Suspense>
  );
};

const PrimeraCargaPage = lazyPage(() => import("@/pages/admin/PrimeraCargaPage"));
const ActaExamenPrimeraCargaPage = lazyPage(() => import("@/pages/admin/ActaExamenPrimeraCargaPage"));

const adminRoles: string[] = ["admin", "secretaria", "bedel"];

export const buildAdminRoutes = () => (
  <Route
    element={(
      <ProtectedRoute roles={adminRoles}>
        <AppShell>
          <Outlet />
        </AppShell>
      </ProtectedRoute>
    )}
  >
    <Route path="/admin/primera-carga" element={<PrimeraCargaPage />} />
    <Route path="/admin/primera-carga/actas-examen" element={<ActaExamenPrimeraCargaPage />} />
  </Route>
);
