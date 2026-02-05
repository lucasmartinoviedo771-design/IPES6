import { Outlet, Route } from "react-router-dom";

import AppShell from "@/components/layout/AppShell";
import { ProtectedRoute } from "@/router/guards";

import { buildGeneralRoutes } from "./GeneralRoutes";
import { buildSecretariaRoutes } from "./SecretariaRoutes";
import { buildEstudianteRoutes } from "./EstudianteRoutes";
import { buildDocenteRoutes } from "./DocenteRoutes";

const shellRoles: string[] = [
  "secretaria",
  "admin",
  "estudiante",
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
    {buildEstudianteRoutes()}
    {buildDocenteRoutes()}
  </Route>
);
