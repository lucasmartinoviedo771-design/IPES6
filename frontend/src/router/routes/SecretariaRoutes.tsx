import { Outlet, Route } from "react-router-dom";
import { ProtectedRoute } from "@/router/guards";
import ErrorBoundary from "@/debug/ErrorBoundary";
import { lazyPage } from "@/utils/lazy";

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
const CambioComisionAdminPage = lazyPage(() => import("@/pages/Secretaria/CambioComisionAdminPage"));
const AttpIndex = lazyPage(() => import("@/pages/Attp/Index"));
const RectoradoIndex = lazyPage(() => import("@/pages/Rectorado/Index"));
const CursoIntroductorioPage = lazyPage(() => import("@/pages/Secretaria/CursoIntroductorioPage"));
const CorrelatividadesPage = lazyPage(() => import("@/pages/Secretaria/CorrelatividadesPage"));
const CargaNotasPage = lazyPage(() => import("@/pages/Secretaria/CargaNotasPage"));
const ActaExamenPage = lazyPage(() => import("@/pages/Secretaria/ActaExamenPage"));
const ConfirmarInscripcionSecretaria = lazyPage(() => import("@/pages/Secretaria/ConfirmarInscripcion"));
const DocumentacionEstudiantesPage = lazyPage(() => import("@/pages/Secretaria/DocumentacionEstudiantesPage"));
const AnalisisMateriaPage = lazyPage(() => import("@/pages/Secretaria/AnalisisMateriaPage"));

export const buildSecretariaRoutes = () => (
  <>
    {/* ── Landing pages por rol (sin cambio de URL) ── */}
    <Route element={<ProtectedRoute capability="ver_estudiantes"><Outlet /></ProtectedRoute>}>
      <Route path="/secretaria" element={<SecretariaIndex />} />
    </Route>
    <Route element={<ProtectedRoute capability="editar_estructura"><Outlet /></ProtectedRoute>}>
      <Route path="/bedeles" element={<BedelesIndex />} />
    </Route>
    <Route element={<ProtectedRoute capability="carga_regularidades"><Outlet /></ProtectedRoute>}>
      <Route path="/docentes" element={<DocentesIndex />} />
      <Route path="/docentes/mis-materias" element={<DocentesMisMateriasPage />} />
    </Route>
    <Route element={<ProtectedRoute capability="gestionar_ci"><Outlet /></ProtectedRoute>}>
      <Route path="/tutorias" element={<TutoriasIndex />} />
    </Route>
    <Route element={<ProtectedRoute capability="revisar_equivalencias"><Outlet /></ProtectedRoute>}>
      <Route path="/equivalencias" element={<EquivalenciasIndex />} />
    </Route>
    <Route element={<ProtectedRoute capability="gestionar_titulos"><Outlet /></ProtectedRoute>}>
      <Route path="/titulos" element={<TitulosIndex />} />
      <Route path="/titulos/planillas-regularidad" element={<PlanillasRegularidadPage />} />
      <Route path="/titulos/planillas-finales" element={<PlanillasFinalesPage />} />
    </Route>
    <Route element={<ProtectedRoute capability="ver_estructura"><Outlet /></ProtectedRoute>}>
      <Route path="/coordinacion" element={<CoordinacionIndex />} />
      <Route path="/jefatura" element={<JefaturaIndex />} />
    </Route>

    {/* ── Gestión de estudiantes ── */}
    <Route element={<ProtectedRoute capability="ver_estudiantes"><Outlet /></ProtectedRoute>}>
      <Route path="/secretaria/estudiantes" element={<EstudiantesAdminPage />} />
      <Route path="/secretaria/estudiantes/:dni" element={<EstudiantesAdminPage />} />
      <Route path="/secretaria/estudiantes-documentacion" element={<DocumentacionEstudiantesPage />} />
      <Route path="/secretaria/cambio-comision" element={<CambioComisionAdminPage />} />
      <Route path="/secretaria/pedidos-equivalencias" element={<PedidosEquivalenciasPage />} />
    </Route>

    {/* ── Estructura académica ── */}
    <Route element={<ProtectedRoute capability="ver_estructura"><Outlet /></ProtectedRoute>}>
      <Route path="/secretaria/profesorado" element={<CargarProfesoradoPage />} />
      <Route path="/secretaria/profesorado/:profesoradoId/planes" element={<CargarPlanPage />} />
      <Route path="/secretaria/plan/:planId/materias" element={<CargarMateriasPage />} />
      <Route path="/secretaria/comisiones" element={<ComisionesPage />} />
      <Route path="/secretaria/correlatividades" element={<CorrelatividadesPage />} />
      <Route path="/secretaria/correlatividades/analisis" element={<AnalisisMateriaPage />} />
    </Route>

    {/* ── Académico: notas, actas ── */}
    <Route element={<ProtectedRoute capability="carga_regularidades"><Outlet /></ProtectedRoute>}>
      <Route path="/secretaria/carga-notas" element={<CargaNotasPage />} />
      <Route path="/secretaria/actas-examen" element={<ActaExamenPage />} />
    </Route>

    {/* ── Asistencia ── */}
    <Route element={<ProtectedRoute capability="ver_asistencia"><Outlet /></ProtectedRoute>}>
      <Route path="/asistencia/reportes" element={<AsistenciaReportesPage />} />
    </Route>

    {/* ── Inscripciones ── */}
    <Route element={<ProtectedRoute capability="gestionar_preinscripcion"><Outlet /></ProtectedRoute>}>
      <Route path="/secretaria/confirmar-inscripcion" element={<ConfirmarInscripcionSecretaria />} />
    </Route>

    {/* ── Staff ── */}
    <Route element={<ProtectedRoute capability="gestionar_staff"><Outlet /></ProtectedRoute>}>
      <Route path="/secretaria/docentes" element={<CargarDocentesPage />} />
      <Route path="/secretaria/asignar-rol" element={<AsignarRolPage />} />
      <Route path="/secretaria/catedra-docente" element={<CatedraDocentePage />} />
    </Route>

    {/* ── Horarios ── */}
    <Route element={<ProtectedRoute capability="ver_horarios"><Outlet /></ProtectedRoute>}>
      <Route path="/secretaria/horarios" element={<ErrorBoundary><CargarHorarioPage /></ErrorBoundary>} />
    </Route>

    {/* ── Ventanas de inscripción ── */}
    <Route element={<ProtectedRoute capability="gestionar_ventanas"><Outlet /></ProtectedRoute>}>
      <Route path="/secretaria/habilitar-fechas" element={<HabilitarFechasPage />} />
    </Route>

    {/* ── Analíticos / Títulos ── */}
    <Route element={<ProtectedRoute capability="ver_analiticos"><Outlet /></ProtectedRoute>}>
      <Route path="/secretaria/analiticos" element={<AnaliticosPage />} />
    </Route>

    {/* ── Mesas de examen ── */}
    <Route element={<ProtectedRoute capability="ver_actas"><Outlet /></ProtectedRoute>}>
      <Route path="/secretaria/mesas" element={<MesasPage />} />
    </Route>

    {/* ── Curso introductorio ── */}
    <Route element={<ProtectedRoute capability="gestionar_ci"><Outlet /></ProtectedRoute>}>
      <Route path="/curso-introductorio" element={<CursoIntroductorioPage />} />
    </Route>

    {/* ── Paneles de roles específicos ── */}
    <Route element={<ProtectedRoute capability="formalizar_inscripcion"><Outlet /></ProtectedRoute>}>
      <Route path="/attp" element={<AttpIndex />} />
    </Route>
    <Route element={<ProtectedRoute capability="ver_dashboard"><Outlet /></ProtectedRoute>}>
      <Route path="/rectorado" element={<RectoradoIndex />} />
    </Route>
  </>
);
