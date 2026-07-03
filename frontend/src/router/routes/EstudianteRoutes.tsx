import { Outlet, Route } from "react-router-dom";
import { ProtectedRoute } from "@/router/guards";
import { lazyPage } from "@/utils/lazy";

const EstudiantesIndex = lazyPage(() => import("@/pages/Estudiantes/Index"));
const CompletarPerfilPage = lazyPage(() => import("@/pages/Estudiantes/CompletarPerfilPage"));
const InscripcionMateriaPage = lazyPage(() => import("@/pages/Estudiantes/InscripcionMateriaPage"));
const CambioComisionPage = lazyPage(() => import("@/pages/Estudiantes/CambioComisionPage"));
const PedidoAnaliticoPage = lazyPage(() => import("@/pages/Estudiantes/PedidoAnaliticoPage"));
const PedidoEquivalenciasPage = lazyPage(() => import("@/pages/Estudiantes/PedidoEquivalenciasPage"));
const TramitesEstudiantePage = lazyPage(() => import("@/pages/Estudiantes/TramitesEstudiantePage"));
const MesaExamenPage = lazyPage(() => import("@/pages/Estudiantes/MesaExamenPage"));
const TrayectoriaPage = lazyPage(() => import("@/pages/Estudiantes/TrayectoriaPage"));
const CertificadoRegularPage = lazyPage(() => import("@/pages/Estudiantes/CertificadoRegularPage"));
const ConstanciaExamenPage = lazyPage(() => import("@/pages/Estudiantes/ConstanciaExamenPage"));
const HorarioPage = lazyPage(() => import("@/pages/Estudiantes/HorarioPage"));
const MisAsistenciasPage = lazyPage(() => import("@/pages/Estudiantes/MisAsistenciasPage"));
const CursoIntroductorioEstudiantePage = lazyPage(() => import("@/pages/Estudiantes/CursoIntroductorioPage"));
const PresentePage = lazyPage(() => import("@/pages/Estudiantes/PresentePage"));

export const buildEstudianteRoutes = () => (
  <>
    <Route element={<ProtectedRoute capability="ver_estudiantes" roles={["estudiante"]}><Outlet /></ProtectedRoute>}>
      <Route path="/estudiantes" element={<EstudiantesIndex />} />
      <Route path="/estudiantes/presente" element={<PresentePage />} />
      <Route path="/estudiantes/completar-perfil" element={<CompletarPerfilPage />} />
      <Route path="/estudiantes/inscripcion-materia" element={<InscripcionMateriaPage />} />
      <Route path="/estudiantes/cambio-comision" element={<CambioComisionPage />} />
      <Route path="/estudiantes/pedido-analitico" element={<PedidoAnaliticoPage />} />
      <Route path="/estudiantes/mesa-examen" element={<MesaExamenPage />} />
      <Route path="/estudiantes/mis-asistencias" element={<MisAsistenciasPage />} />
      <Route path="/estudiantes/pedido-equivalencias" element={<PedidoEquivalenciasPage />} />
      <Route path="/estudiantes/tramites" element={<TramitesEstudiantePage />} />
      <Route path="/estudiantes/certificado-regular" element={<CertificadoRegularPage />} />
      <Route path="/estudiantes/constancia-examen" element={<ConstanciaExamenPage />} />
    </Route>
    <Route element={<ProtectedRoute capability="ver_estudiantes" roles={["estudiante"]}><Outlet /></ProtectedRoute>}>
      <Route path="/estudiantes/trayectoria" element={<TrayectoriaPage />} />
    </Route>
    <Route element={<ProtectedRoute capability="ver_horarios"><Outlet /></ProtectedRoute>}>
      <Route path="/estudiantes/horarios" element={<HorarioPage />} />
    </Route>
    <Route element={<ProtectedRoute capability="gestionar_ci" roles={["estudiante"]}><Outlet /></ProtectedRoute>}>
      <Route path="/estudiantes/curso-introductorio" element={<CursoIntroductorioEstudiantePage />} />
    </Route>
  </>
);
