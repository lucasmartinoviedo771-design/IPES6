import { Outlet, Route } from "react-router-dom";
import { ProtectedRoute } from "@/router/guards";

import DashboardPage from "@/pages/DashboardPage";
import PreinscripcionesPage from "@/pages/PreinscripcionesPage";
import MensajesInboxPage from "@/pages/Mensajes/InboxPage";
import CarrerasPage from "@/pages/CarrerasPage";
import MateriaInscriptosPage from "@/pages/MateriaInscriptosPage";
import ReportesPage from "@/pages/ReportesPage";
import ConfirmarInscripcionPage from "@/pages/ConfirmarInscripcionPage";

const managementRoles: string[] = ["admin", "secretaria", "bedel", "jefa_aaee", "jefes", "tutor", "coordinador", "consulta", "docente"];
const preinscripcionesRoles: string[] = ["admin", "secretaria", "bedel"];
const mensajesRoles: string[] = ["admin", "secretaria", "bedel", "jefa_aaee", "jefes", "tutor", "coordinador", "consulta", "alumno"];
const confirmacionRoles: string[] = ["bedel", "secretaria", "admin"];

export const buildGeneralRoutes = () => (
  <>
    <Route element={<ProtectedRoute roles={managementRoles}><Outlet /></ProtectedRoute>}>
      <Route path="/dashboard" element={<DashboardPage />} />
      <Route path="/carreras" element={<CarrerasPage />} />
      <Route path="/carreras/:profesoradoId/planes/:planId/materias/:materiaId/inscriptos" element={<MateriaInscriptosPage />} />
      <Route path="/reportes" element={<ReportesPage />} />
    </Route>
    <Route element={<ProtectedRoute roles={preinscripcionesRoles}><Outlet /></ProtectedRoute>}>
      <Route path="/preinscripciones" element={<PreinscripcionesPage />} />
    </Route>
    <Route element={<ProtectedRoute roles={mensajesRoles}><Outlet /></ProtectedRoute>}>
      <Route path="/mensajes" element={<MensajesInboxPage />} />
    </Route>
    <Route element={<ProtectedRoute roles={confirmacionRoles}><Outlet /></ProtectedRoute>}>
      <Route path="/gestion/confirmar" element={<ConfirmarInscripcionPage />} />
    </Route>
  </>
);
