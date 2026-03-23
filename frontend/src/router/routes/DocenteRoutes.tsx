import { Outlet, Route } from "react-router-dom";
import { ProtectedRoute } from "@/router/guards";

import { lazyPage } from "@/utils/lazy";

const TomarAsistenciaPage = lazyPage(() => import("@/pages/Docentes/TomarAsistenciaPage"));
const TomarAsistenciaDemoPage = lazyPage(() => import("@/pages/Docentes/TomarAsistenciaDemoPage"));

const docenteRoles: string[] = ["docente", "admin", "secretaria"];

export const buildDocenteRoutes = () => (
  <Route element={<ProtectedRoute roles={docenteRoles}><Outlet /></ProtectedRoute>}>
    <Route path="/docentes/clases/:claseId/asistencia" element={<TomarAsistenciaPage />} />
    <Route path="/docentes/demo-asistencia" element={<TomarAsistenciaDemoPage />} />
  </Route>
);
