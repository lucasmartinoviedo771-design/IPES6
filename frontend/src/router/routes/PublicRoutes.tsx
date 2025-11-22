import { ReactNode, Suspense, lazy } from "react";
import { Navigate, Route } from "react-router-dom";
import { Box, CircularProgress } from "@mui/material";

import { PublicOnlyRoute } from "@/router/guards";

type PublicRoutesProps = {
  preinscripcionElement: ReactNode;
};

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

const LoginPage = lazyPage(() => import("@/pages/LoginPage"));
const AuthCallbackPage = lazyPage(() => import("@/pages/Auth/CallbackPage"));
const DocenteAsistenciaPage = lazyPage(() => import("@/pages/Docentes/DocenteAsistenciaPage"));
const InscripcionPreview = lazyPage(() => import("@/pages/InscripcionPreview"));
const Forbidden = lazyPage(() => import("@/pages/Forbidden"));

export const buildPublicRoutes = ({ preinscripcionElement }: PublicRoutesProps) => (
  <>
    <Route index element={<Navigate to="/preinscripcion" replace />} />
    <Route path="/preinscripcion" element={preinscripcionElement} />
    <Route path="/debug/inscripcion-preview" element={<InscripcionPreview />} />
    <Route path="/login" element={<PublicOnlyRoute><LoginPage /></PublicOnlyRoute>} />
    <Route path="/auth/callback" element={<AuthCallbackPage />} />
    <Route path="/docentes/asistencia" element={<DocenteAsistenciaPage />} />
    <Route path="/403" element={<Forbidden />} />
  </>
);
