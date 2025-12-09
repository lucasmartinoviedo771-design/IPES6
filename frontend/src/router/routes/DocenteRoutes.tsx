import { Outlet, Route } from "react-router-dom";
import { ProtectedRoute } from "@/router/guards";

import DocentesIndex from "@/pages/Docentes/Index";
import DocentesMisMateriasPage from "@/pages/Docentes/MisMateriasPage";
import TomarAsistenciaPage from "@/pages/Docentes/TomarAsistenciaPage";
import DocenteAsistenciaPage from "@/pages/Docentes/DocenteAsistenciaPage";
import TomarAsistenciaDemoPage from "@/pages/Docentes/TomarAsistenciaDemoPage";

const docenteRoles: string[] = ["docente", "admin", "secretaria"];

export const buildDocenteRoutes = () => (
  <Route element={<ProtectedRoute roles={docenteRoles}><Outlet /></ProtectedRoute>}>
    <Route path="/docentes" element={<DocentesIndex />} />
    <Route path="/docentes/mis-materias" element={<DocentesMisMateriasPage />} />
    <Route path="/docentes/clases/:claseId/asistencia" element={<TomarAsistenciaPage />} />
    <Route path="/docentes/demo-asistencia" element={<TomarAsistenciaDemoPage />} />
  </Route>
);
