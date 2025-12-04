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

const AlumnosIndex = lazyPage(() => import("@/pages/Alumnos/Index"));
const CompletarPerfilPage = lazyPage(() => import("@/pages/Alumnos/CompletarPerfilPage"));
const InscripcionMateriaPage = lazyPage(() => import("@/pages/Alumnos/InscripcionMateriaPage"));
const CambioComisionPage = lazyPage(() => import("@/pages/Alumnos/CambioComisionPage"));
const PedidoAnaliticoPage = lazyPage(() => import("@/pages/Alumnos/PedidoAnaliticoPage"));
const PedidoEquivalenciasPage = lazyPage(() => import("@/pages/Alumnos/PedidoEquivalenciasPage"));
const MesaExamenPage = lazyPage(() => import("@/pages/Alumnos/MesaExamenPage"));
const TrayectoriaPage = lazyPage(() => import("@/pages/Alumnos/TrayectoriaPage"));
const CertificadoRegularPage = lazyPage(() => import("@/pages/Alumnos/CertificadoRegularPage"));
const ConstanciaExamenPage = lazyPage(() => import("@/pages/Alumnos/ConstanciaExamenPage"));
const HorarioPage = lazyPage(() => import("@/pages/Alumnos/HorarioPage"));
const MisAsistenciasPage = lazyPage(() => import("@/pages/Alumnos/MisAsistenciasPage"));
const CursoIntroductorioAlumnoPage = lazyPage(() => import("@/pages/Alumnos/CursoIntroductorioPage"));

const baseRoles: string[] = ["alumno", "admin"];
const alumnoSecretariaRoles: string[] = ["alumno", "admin", "secretaria", "bedel"];
const trayectoriaRoles: string[] = ["alumno", "admin", "bedel", "secretaria", "coordinador", "tutor"];
const cursoIntroRoles: string[] = ["alumno", "admin", "secretaria", "bedel", "curso_intro"];

export const buildAlumnoRoutes = () => (
  <>
    <Route path="/alumnos" element={<AlumnosIndex />} />
    <Route element={<ProtectedRoute roles={baseRoles}><Outlet /></ProtectedRoute>}>
      <Route path="/alumnos/completar-perfil" element={<CompletarPerfilPage />} />
      <Route path="/alumnos/inscripcion-materia" element={<InscripcionMateriaPage />} />
      <Route path="/alumnos/cambio-comision" element={<CambioComisionPage />} />
      <Route path="/alumnos/pedido-analitico" element={<PedidoAnaliticoPage />} />
      <Route path="/alumnos/mesa-examen" element={<MesaExamenPage />} />
      <Route path="/alumnos/horarios" element={<HorarioPage />} />
      <Route path="/alumnos/mis-asistencias" element={<MisAsistenciasPage />} />
    </Route>
    <Route element={<ProtectedRoute roles={alumnoSecretariaRoles}><Outlet /></ProtectedRoute>}>
      <Route path="/alumnos/pedido-equivalencias" element={<PedidoEquivalenciasPage />} />
      <Route path="/alumnos/certificado-regular" element={<CertificadoRegularPage />} />
      <Route path="/alumnos/constancia-examen" element={<ConstanciaExamenPage />} />
    </Route>
    <Route element={<ProtectedRoute roles={trayectoriaRoles}><Outlet /></ProtectedRoute>}>
      <Route path="/alumnos/trayectoria" element={<TrayectoriaPage />} />
    </Route>
    <Route element={<ProtectedRoute roles={cursoIntroRoles}><Outlet /></ProtectedRoute>}>
      <Route path="/alumnos/curso-introductorio" element={<CursoIntroductorioAlumnoPage />} />
    </Route>
  </>
);
