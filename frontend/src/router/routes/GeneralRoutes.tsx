import { Outlet, Route } from "react-router-dom";
import { ProtectedRoute } from "@/router/guards";

import { lazyPage } from "@/utils/lazy";

const DashboardPage = lazyPage(() => import("../../pages/DashboardPage"));
const PreinscripcionesPage = lazyPage(() => import("../../pages/PreinscripcionesPage"));
const MensajesInboxPage = lazyPage(() => import("../../pages/Mensajes/InboxPage"));
const CarrerasPage = lazyPage(() => import("../../pages/CarrerasPage"));
const MateriaInscriptosPage = lazyPage(() => import("../../pages/MateriaInscriptosPage"));
const ReportesPage = lazyPage(() => import("../../pages/ReportesPage"));
const ConfirmarInscripcionPage = lazyPage(() => import("../../pages/ConfirmarInscripcionPage"));

export const buildGeneralRoutes = () => (
  <>
    <Route element={<ProtectedRoute capability="ver_dashboard"><Outlet /></ProtectedRoute>}>
      <Route path="/dashboard" element={<DashboardPage />} />
    </Route>
    <Route element={<ProtectedRoute capability="ver_estructura"><Outlet /></ProtectedRoute>}>
      <Route path="/carreras" element={<CarrerasPage />} />
    </Route>
    <Route element={<ProtectedRoute capability="ver_estudiantes"><Outlet /></ProtectedRoute>}>
      <Route path="/carreras/:profesoradoId/planes/:planId/materias/:materiaId/inscriptos" element={<MateriaInscriptosPage />} />
    </Route>
    <Route element={<ProtectedRoute capability="ver_reportes"><Outlet /></ProtectedRoute>}>
      <Route path="/reportes" element={<ReportesPage />} />
    </Route>
    <Route element={<ProtectedRoute capability="gestionar_preinscripcion"><Outlet /></ProtectedRoute>}>
      <Route path="/preinscripciones" element={<PreinscripcionesPage />} />
    </Route>
    <Route element={<ProtectedRoute capability="enviar_mensajes"><Outlet /></ProtectedRoute>}>
      <Route path="/mensajes" element={<MensajesInboxPage />} />
    </Route>
    <Route element={<ProtectedRoute capability="formalizar_inscripcion"><Outlet /></ProtectedRoute>}>
      <Route path="/gestion/confirmar" element={<ConfirmarInscripcionPage />} />
    </Route>
  </>
);
