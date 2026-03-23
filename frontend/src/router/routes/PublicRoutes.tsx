import { ReactNode } from "react";
import { Navigate, Route } from "react-router-dom";
import { PublicOnlyRoute } from "@/router/guards";
import { lazyPage } from "@/utils/lazy";

type PublicRoutesProps = {
  preinscripcionElement: ReactNode;
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
