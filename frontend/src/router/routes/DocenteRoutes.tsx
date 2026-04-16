import { Outlet, Route } from "react-router-dom";
import { ProtectedRoute } from "@/router/guards";

import { lazyPage } from "@/utils/lazy";

const TomarAsistenciaPage = lazyPage(() => import("@/pages/Docentes/TomarAsistenciaPage"));
const TomarAsistenciaDemoPage = lazyPage(() => import("@/pages/Docentes/TomarAsistenciaDemoPage"));
const MisPlanillasPage = lazyPage(() => import("@/pages/Docentes/mis-planillas/MisPlanillasPage"));
const PlanillaCursadaFormPage = lazyPage(() => import("@/pages/Docentes/mis-planillas/PlanillaCursadaFormPage"));

const docenteRoles: string[] = ["docente", "admin", "secretaria", "bedel"];

export const buildDocenteRoutes = () => (
  <Route element={<ProtectedRoute roles={docenteRoles}><Outlet /></ProtectedRoute>}>
    <Route path="/docentes/clases/:claseId/asistencia" element={<TomarAsistenciaPage />} />
    <Route path="/docentes/demo-asistencia" element={<TomarAsistenciaDemoPage />} />
    <Route path="/docentes/mis-planillas" element={<MisPlanillasPage />} />
    <Route path="/docentes/mis-planillas/:comisionId" element={<PlanillaCursadaFormPage />} />
  </Route>
);
