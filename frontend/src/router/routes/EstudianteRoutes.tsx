import { Outlet, Route } from "react-router-dom";
import { Suspense, lazy } from "react";
import { Box, CircularProgress } from "@mui/material";

import { ProtectedRoute } from "@/router/guards";

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

const EstudiantesIndex = lazyPage(() => import("@/pages/Estudiantes/Index"));
const CompletarPerfilPage = lazyPage(() => import("@/pages/Estudiantes/CompletarPerfilPage"));
const InscripcionMateriaPage = lazyPage(() => import("@/pages/Estudiantes/InscripcionMateriaPage"));
const CambioComisionPage = lazyPage(() => import("@/pages/Estudiantes/CambioComisionPage"));
const PedidoAnaliticoPage = lazyPage(() => import("@/pages/Estudiantes/PedidoAnaliticoPage"));
const PedidoEquivalenciasPage = lazyPage(() => import("@/pages/Estudiantes/PedidoEquivalenciasPage"));
const MesaExamenPage = lazyPage(() => import("@/pages/Estudiantes/MesaExamenPage"));
const TrayectoriaPage = lazyPage(() => import("@/pages/Estudiantes/TrayectoriaPage"));
const CertificadoRegularPage = lazyPage(() => import("@/pages/Estudiantes/CertificadoRegularPage"));
const ConstanciaExamenPage = lazyPage(() => import("@/pages/Estudiantes/ConstanciaExamenPage"));
const HorarioPage = lazyPage(() => import("@/pages/Estudiantes/HorarioPage"));
const MisAsistenciasPage = lazyPage(() => import("@/pages/Estudiantes/MisAsistenciasPage"));
const CursoIntroductorioEstudiantePage = lazyPage(() => import("@/pages/Estudiantes/CursoIntroductorioPage"));

const baseRoles: string[] = ["estudiante", "admin", "secretaria", "bedel"];
const estudianteSecretariaRoles: string[] = ["estudiante", "admin", "secretaria", "bedel"];
const trayectoriaRoles: string[] = ["estudiante", "admin", "bedel", "secretaria", "coordinador", "tutor"];
const cursoIntroRoles: string[] = ["estudiante", "admin", "secretaria", "bedel", "curso_intro", "coordinador"];

export const buildEstudianteRoutes = () => (
  <>
    <Route path="/estudiantes" element={<EstudiantesIndex />} />
    <Route element={<ProtectedRoute roles={baseRoles}><Outlet /></ProtectedRoute>}>
      <Route path="/estudiantes/completar-perfil" element={<CompletarPerfilPage />} />
      <Route path="/estudiantes/inscripcion-materia" element={<InscripcionMateriaPage />} />
      <Route path="/estudiantes/cambio-comision" element={<CambioComisionPage />} />
      <Route path="/estudiantes/pedido-analitico" element={<PedidoAnaliticoPage />} />
      <Route path="/estudiantes/mesa-examen" element={<MesaExamenPage />} />
      <Route path="/estudiantes/horarios" element={<HorarioPage />} />
      <Route path="/estudiantes/mis-asistencias" element={<MisAsistenciasPage />} />
    </Route>
    <Route element={<ProtectedRoute roles={estudianteSecretariaRoles}><Outlet /></ProtectedRoute>}>
      <Route path="/estudiantes/pedido-equivalencias" element={<PedidoEquivalenciasPage />} />
      <Route path="/estudiantes/certificado-regular" element={<CertificadoRegularPage />} />
      <Route path="/estudiantes/constancia-examen" element={<ConstanciaExamenPage />} />
    </Route>
    <Route element={<ProtectedRoute roles={trayectoriaRoles}><Outlet /></ProtectedRoute>}>
      <Route path="/estudiantes/trayectoria" element={<TrayectoriaPage />} />
    </Route>
    <Route element={<ProtectedRoute roles={cursoIntroRoles}><Outlet /></ProtectedRoute>}>
      <Route path="/estudiantes/curso-introductorio" element={<CursoIntroductorioEstudiantePage />} />
    </Route>
  </>
);
