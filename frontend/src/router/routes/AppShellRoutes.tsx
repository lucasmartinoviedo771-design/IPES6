import { Outlet, Route } from "react-router-dom";

import AppShell from "@/components/layout/AppShell";
import { ProtectedRoute } from "@/router/guards";

import { buildGeneralRoutes } from "./GeneralRoutes";
import { buildSecretariaRoutes } from "./SecretariaRoutes";
import { buildAlumnoRoutes } from "./AlumnoRoutes";

const shellRoles: string[] = [
  "secretaria",
  "admin",
  "alumno",
  "bedel",
  "coordinador",
  "tutor",
  "jefes",
  "jefa_aaee",
  "docente",
  "equivalencias",
  "titulos",
];

export const buildAppShellRoutes = () => (
  <Route
    element={(
      <ProtectedRoute roles={shellRoles}>
        <AppShell>
          <Outlet />
        </AppShell>
      </ProtectedRoute>
    )}
  >
    {buildGeneralRoutes()}
    {buildSecretariaRoutes()}
    {buildAlumnoRoutes()}
  </Route>
);
