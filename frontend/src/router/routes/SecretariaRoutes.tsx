import { Outlet, Route } from "react-router-dom";
import { Suspense, lazy } from "react";
import { Box, CircularProgress } from "@mui/material";

import { ProtectedRoute } from "@/router/guards";
import ErrorBoundary from "@/debug/ErrorBoundary";

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

const SecretariaIndex = lazyPage(() => import("@/pages/Secretaria/Index"));
const BedelesIndex = lazyPage(() => import("@/pages/Bedeles/Index"));
const DocentesIndex = lazyPage(() => import("@/pages/Docentes/Index"));
const DocentesMisMateriasPage = lazyPage(() => import("@/pages/Docentes/MisMateriasPage"));
const TutoriasIndex = lazyPage(() => import("@/pages/Tutorias/Index"));
const EquivalenciasIndex = lazyPage(() => import("@/pages/Equivalencias/Index"));
const TitulosIndex = lazyPage(() => import("@/pages/Titulos/Index"));
const PlanillasRegularidadPage = lazyPage(() => import("@/pages/Titulos/PlanillasRegularidadPage"));
const PlanillasFinalesPage = lazyPage(() => import("@/pages/Titulos/PlanillasFinalesPage"));
const CoordinacionIndex = lazyPage(() => import("@/pages/Coordinacion/Index"));
const JefaturaIndex = lazyPage(() => import("@/pages/Jefatura/Index"));
const CargarProfesoradoPage = lazyPage(() => import("@/pages/Secretaria/CargarProfesoradoPage"));
const CargarPlanPage = lazyPage(() => import("@/pages/Secretaria/CargarPlanPage"));
const CargarMateriasPage = lazyPage(() => import("@/pages/Secretaria/CargarMateriasPage"));
const AsistenciaReportesPage = lazyPage(() => import("@/pages/Secretaria/AsistenciaReportesPage"));
const CargarDocentesPage = lazyPage(() => import("@/pages/Secretaria/CargarDocentesPage"));
const AsignarRolPage = lazyPage(() => import("@/pages/Secretaria/AsignarRolPage"));
const CargarHorarioPage = lazyPage(() => import("@/pages/Secretaria/CargarHorarioPage"));
const CatedraDocentePage = lazyPage(() => import("@/pages/Secretaria/CatedraDocentePage"));
const HabilitarFechasPage = lazyPage(() => import("@/pages/Secretaria/HabilitarFechasPage"));
const ComisionesPage = lazyPage(() => import("@/pages/Secretaria/ComisionesPage"));
const AnaliticosPage = lazyPage(() => import("@/pages/Secretaria/AnaliticosPage"));
const EstudiantesAdminPage = lazyPage(() => import("@/pages/Secretaria/EstudiantesAdminPage"));
const MesasPage = lazyPage(() => import("@/pages/Secretaria/MesasPage"));
const PedidosEquivalenciasPage = lazyPage(() => import("@/pages/Secretaria/PedidosEquivalenciasPage"));
const CursoIntroductorioPage = lazyPage(() => import("@/pages/Secretaria/CursoIntroductorioPage"));
const CorrelatividadesPage = lazyPage(() => import("@/pages/Secretaria/CorrelatividadesPage"));
const CargaNotasPage = lazyPage(() => import("@/pages/Secretaria/CargaNotasPage"));
const ActaExamenPage = lazyPage(() => import("@/pages/Secretaria/ActaExamenPage"));
const ConfirmarInscripcionSecretaria = lazyPage(() => import("@/pages/Secretaria/ConfirmarInscripcion"));

const secretariaPanelRoles: string[] = ["secretaria", "admin", "bedel", "jefa_aaee", "jefes", "tutor"];
const bedelesRoles: string[] = ["secretaria", "admin", "bedel", "jefa_aaee", "jefes", "tutor", "coordinador"];
const docentesRoles: string[] = ["docente", "secretaria", "admin", "bedel"];
const tutoriaRoles: string[] = ["tutor", "secretaria", "admin", "bedel"];
const equivalenciasRoles: string[] = ["equivalencias", "secretaria", "admin", "bedel"];
const titulosRoles: string[] = ["titulos", "secretaria", "admin"];
const coordinacionRoles: string[] = ["coordinador", "jefes", "jefa_aaee", "secretaria", "admin"];
const jefaturaRoles: string[] = ["jefes", "jefa_aaee", "secretaria", "admin"];
const secretariaBaseRoles: string[] = ["secretaria", "admin", "bedel"];
const secretariaAdminRoles: string[] = ["secretaria", "admin"];
const horariosRoles: string[] = ["secretaria", "admin", "coordinador"];
const habilitarFechasRoles: string[] = ["secretaria", "admin", "jefa_aaee"];
const analiticosRoles: string[] = ["secretaria", "bedel", "admin", "tutor", "jefes", "jefa_aaee", "coordinador"];
const mesasRoles: string[] = ["secretaria", "bedel", "admin", "jefes", "jefa_aaee"];
const secretariaTutorRoles: string[] = ["secretaria", "bedel", "admin", "tutor"];
const cursoIntroRoles: string[] = ["secretaria", "bedel", "admin", "curso_intro", "coordinador", "tutor"];
const docentesConsultaRoles: string[] = ["docente", "admin", "secretaria", "bedel"];

export const buildSecretariaRoutes = () => (
  <>
    <Route element={<ProtectedRoute roles={secretariaPanelRoles}><Outlet /></ProtectedRoute>}>
      <Route path="/secretaria" element={<SecretariaIndex />} />
    </Route>
    <Route element={<ProtectedRoute roles={bedelesRoles}><Outlet /></ProtectedRoute>}>
      <Route path="/bedeles" element={<BedelesIndex />} />
    </Route>
    <Route element={<ProtectedRoute roles={docentesRoles}><Outlet /></ProtectedRoute>}>
      <Route path="/docentes" element={<DocentesIndex />} />
    </Route>
    <Route element={<ProtectedRoute roles={docentesConsultaRoles}><Outlet /></ProtectedRoute>}>
      <Route path="/docentes/mis-materias" element={<DocentesMisMateriasPage />} />
    </Route>
    <Route element={<ProtectedRoute roles={tutoriaRoles}><Outlet /></ProtectedRoute>}>
      <Route path="/tutorias" element={<TutoriasIndex />} />
    </Route>
    <Route element={<ProtectedRoute roles={equivalenciasRoles}><Outlet /></ProtectedRoute>}>
      <Route path="/equivalencias" element={<EquivalenciasIndex />} />
    </Route>
    <Route element={<ProtectedRoute roles={titulosRoles}><Outlet /></ProtectedRoute>}>
      <Route path="/titulos" element={<TitulosIndex />} />
      <Route path="/titulos/planillas-regularidad" element={<PlanillasRegularidadPage />} />
      <Route path="/titulos/planillas-finales" element={<PlanillasFinalesPage />} />
    </Route>
    <Route element={<ProtectedRoute roles={coordinacionRoles}><Outlet /></ProtectedRoute>}>
      <Route path="/coordinacion" element={<CoordinacionIndex />} />
    </Route>
    <Route element={<ProtectedRoute roles={jefaturaRoles}><Outlet /></ProtectedRoute>}>
      <Route path="/jefatura" element={<JefaturaIndex />} />
    </Route>
    <Route element={<ProtectedRoute roles={secretariaBaseRoles}><Outlet /></ProtectedRoute>}>
      <Route path="/secretaria/profesorado" element={<CargarProfesoradoPage />} />
      <Route path="/secretaria/profesorado/:profesoradoId/planes" element={<CargarPlanPage />} />
      <Route path="/secretaria/plan/:planId/materias" element={<CargarMateriasPage />} />
      <Route path="/asistencia/reportes" element={<AsistenciaReportesPage />} />
      <Route path="/secretaria/comisiones" element={<ComisionesPage />} />
      <Route path="/secretaria/estudiantes" element={<EstudiantesAdminPage />} />
      <Route path="/secretaria/confirmar-inscripcion" element={<ConfirmarInscripcionSecretaria />} />
      <Route path="/secretaria/correlatividades" element={<CorrelatividadesPage />} />
      <Route path="/secretaria/carga-notas" element={<CargaNotasPage />} />
      <Route path="/secretaria/actas-examen" element={<ActaExamenPage />} />
    </Route>
    <Route element={<ProtectedRoute roles={secretariaAdminRoles}><Outlet /></ProtectedRoute>}>
      <Route path="/secretaria/docentes" element={<CargarDocentesPage />} />
      <Route path="/secretaria/asignar-rol" element={<AsignarRolPage />} />
      <Route path="/secretaria/catedra-docente" element={<CatedraDocentePage />} />
    </Route>
    <Route element={<ProtectedRoute roles={horariosRoles}><Outlet /></ProtectedRoute>}>
      <Route path="/secretaria/horarios" element={<ErrorBoundary><CargarHorarioPage /></ErrorBoundary>} />
    </Route>
    <Route element={<ProtectedRoute roles={habilitarFechasRoles}><Outlet /></ProtectedRoute>}>
      <Route path="/secretaria/habilitar-fechas" element={<HabilitarFechasPage />} />
    </Route>
    <Route element={<ProtectedRoute roles={analiticosRoles}><Outlet /></ProtectedRoute>}>
      <Route path="/secretaria/analiticos" element={<AnaliticosPage />} />
    </Route>
    <Route element={<ProtectedRoute roles={mesasRoles}><Outlet /></ProtectedRoute>}>
      <Route path="/secretaria/mesas" element={<MesasPage />} />
    </Route>
    <Route element={<ProtectedRoute roles={secretariaTutorRoles}><Outlet /></ProtectedRoute>}>
      <Route path="/secretaria/pedidos-equivalencias" element={<PedidosEquivalenciasPage />} />
    </Route>
    <Route element={<ProtectedRoute roles={cursoIntroRoles}><Outlet /></ProtectedRoute>}>
      <Route path="/secretaria/curso-introductorio" element={<CursoIntroductorioPage />} />
    </Route>
  </>
);
