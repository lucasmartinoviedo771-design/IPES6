import { Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { Box, CircularProgress } from '@mui/material';

import { useAuth } from '@/context/AuthContext';
import { ProtectedRoute, PublicOnlyRoute } from '@/router/guards';

import AppShell from '@/components/layout/AppShell';
import PreinscripcionWizard from '@/components/preinscripcion/PreinscripcionWizard';

import AlumnosPage from '@/pages/AlumnosPage';
import CarrerasPage from '@/pages/CarrerasPage';
import ConfiguracionPage from '@/pages/ConfiguracionPage';
import ConfirmarInscripcionPage from '@/pages/ConfirmarInscripcionPage';
import DashboardPage from '@/pages/DashboardPage';
import Forbidden from '@/pages/Forbidden';
import LoginPage from '@/pages/LoginPage';
import ChangePasswordPage from '@/pages/Auth/ChangePasswordPage';
import PreinscripcionesPage from '@/pages/PreinscripcionesPage';
import ReportesPage from '@/pages/ReportesPage';
import GlobalOverviewPage from '@/pages/GlobalOverviewPage';
import SecretariaIndex from '@/pages/Secretaria/Index';
import CargarProfesoradoPage from '@/pages/Secretaria/CargarProfesoradoPage';
import CargarPlanPage from '@/pages/Secretaria/CargarPlanPage';
import CargarMateriasPage from '@/pages/Secretaria/CargarMateriasPage';
import CargarDocentesPage from '@/pages/Secretaria/CargarDocentesPage';
import AsignarRolPage from '@/pages/Secretaria/AsignarRolPage';
import AnaliticosPage from '@/pages/Secretaria/AnaliticosPage';
import MesasPage from '@/pages/Secretaria/MesasPage';
import ConfirmarInscripcionSecretaria from "@/pages/Secretaria/ConfirmarInscripcion";
import MesaExamenPage from '@/pages/Alumnos/MesaExamenPage';


import CargarHorarioPage from "@/pages/Secretaria/CargarHorarioPage";
import CatedraDocentePage from "@/pages/Secretaria/CatedraDocentePage";
import HabilitarFechasPage from "@/pages/Secretaria/HabilitarFechasPage";
import CorrelatividadesPage from "@/pages/Secretaria/CorrelatividadesPage";
import CargaNotasPage from "@/pages/Secretaria/CargaNotasPage";
import ComisionesPage from "@/pages/Secretaria/ComisionesPage";
import ErrorBoundary from "@/debug/ErrorBoundary";
import { GoogleReCaptchaProvider } from 'react-google-recaptcha-v3';

// Nuevas páginas de Alumnos
import AlumnosIndex from "@/pages/Alumnos/Index";
import InscripcionCarreraPage from "@/pages/Alumnos/InscripcionCarreraPage";
import InscripcionMateriaPage from "@/pages/Alumnos/InscripcionMateriaPage";
import CambioComisionPage from "@/pages/Alumnos/CambioComisionPage";
import PedidoAnaliticoPage from "@/pages/Alumnos/PedidoAnaliticoPage";
import TrayectoriaPage from "@/pages/Alumnos/TrayectoriaPage";
import InscripcionPreview from "@/pages/InscripcionPreview";


function AppLayout() {
    const { loading } = useAuth();

    if (loading) {
        return (
            <Box display="flex" justifyContent="center" alignItems="center" height="100vh">
                <CircularProgress />
            </Box>
        );
    }

    // AppShell ya provee topbar + sidebar. No duplicamos AppBar acá.
    return <Outlet />;
}

export default function App() {
  const recaptchaKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY;
  const preinscripcionElement = recaptchaKey ? (
    <GoogleReCaptchaProvider reCaptchaKey={recaptchaKey}>
      <PreinscripcionWizard />
    </GoogleReCaptchaProvider>
  ) : (
    <PreinscripcionWizard />
  );

  return (
    <Routes>
        <Route element={<AppLayout />}>
            <Route index element={<Navigate to="/preinscripcion" replace />} />
            <Route path="/preinscripcion" element={preinscripcionElement} />
            {false && <Route path="/preinscripcion/comprobante/:id" element={<div />} />}
            <Route path="/debug/inscripcion-preview" element={<InscripcionPreview />} />

            <Route path="/login" element={<PublicOnlyRoute><LoginPage /></PublicOnlyRoute>} />
            <Route path="/cambiar-password" element={<ProtectedRoute><ChangePasswordPage /></ProtectedRoute>} />

            {/* Bloque protegido con AppShell (incluye alumnos y roles administrativos) */}
            <Route element={<ProtectedRoute roles={['preinscripciones','secretaria','admin','alumno','bedel','coordinador','tutor','jefes','jefa_aaee']}><AppShell><Outlet/></AppShell></ProtectedRoute>}>
              <Route path="/dashboard" element={<ProtectedRoute roles={['admin','secretaria','bedel','preinscripciones','jefa_aaee','jefes','tutor','coordinador','consulta']}><DashboardPage /></ProtectedRoute>} />
              <Route path="/preinscripciones" element={<ProtectedRoute roles={['admin','secretaria','bedel','preinscripciones']}><PreinscripcionesPage /></ProtectedRoute>} />
              {/* Alumnos: índice con tarjetas */}
              <Route path="/alumnos" element={<AlumnosIndex />} />
              <Route path="/carreras" element={<ProtectedRoute roles={['admin','secretaria','bedel','preinscripciones','coordinador','tutor','jefes','jefa_aaee','consulta']}><CarrerasPage /></ProtectedRoute>} />
              <Route path="/reportes" element={<ProtectedRoute roles={['admin','secretaria','bedel','preinscripciones','jefa_aaee','jefes','tutor','coordinador','consulta']}><ReportesPage /></ProtectedRoute>} />
              <Route path="/vistas" element={<ProtectedRoute roles={['admin','secretaria','bedel','preinscripciones','jefa_aaee','jefes','tutor','coordinador','consulta']}><GlobalOverviewPage /></ProtectedRoute>} />
              <Route path="/configuracion" element={<ProtectedRoute roles={['admin','secretaria']}><ConfiguracionPage /></ProtectedRoute>} />
              <Route path="/gestion/confirmar" element={<ProtectedRoute roles={['bedel','secretaria','admin']}><ConfirmarInscripcionPage /></ProtectedRoute>} />
              <Route path="/secretaria" element={<ProtectedRoute roles={['secretaria','admin','bedel','jefa_aaee','jefes','tutor']}><SecretariaIndex /></ProtectedRoute>} />
              <Route path="/secretaria/profesorado" element={<ProtectedRoute roles={['secretaria','admin','bedel']}><CargarProfesoradoPage /></ProtectedRoute>} />
              <Route path="/secretaria/profesorado/:profesoradoId/planes" element={<ProtectedRoute roles={['secretaria','admin','bedel']}><CargarPlanPage /></ProtectedRoute>} />
              <Route path="/secretaria/plan/:planId/materias" element={<ProtectedRoute roles={['secretaria','admin','bedel']}><CargarMateriasPage /></ProtectedRoute>} />
              <Route path="/secretaria/docentes" element={<ProtectedRoute roles={['secretaria','admin']}><CargarDocentesPage /></ProtectedRoute>} />
              <Route path="/secretaria/asignar-rol" element={<ProtectedRoute roles={['secretaria','admin']}><AsignarRolPage /></ProtectedRoute>} />
              <Route path="/secretaria/horarios" element={<ProtectedRoute roles={['secretaria','admin']}><ErrorBoundary><CargarHorarioPage /></ErrorBoundary></ProtectedRoute>} />
              <Route path="/secretaria/catedra-docente" element={<ProtectedRoute roles={['secretaria','admin']}><CatedraDocentePage /></ProtectedRoute>} />
              <Route path="/secretaria/habilitar-fechas" element={<ProtectedRoute roles={['secretaria','admin','jefa_aaee']}><HabilitarFechasPage /></ProtectedRoute>} />
              <Route path="/secretaria/comisiones" element={<ProtectedRoute roles={['secretaria','admin','bedel']}><ComisionesPage /></ProtectedRoute>} />
              <Route path="/secretaria/analiticos" element={<ProtectedRoute roles={['secretaria','bedel','admin','tutor','jefes','jefa_aaee']}><AnaliticosPage /></ProtectedRoute>} />
              <Route path="/secretaria/mesas" element={<ProtectedRoute roles={['secretaria','bedel','admin','jefes','jefa_aaee']}><MesasPage /></ProtectedRoute>} />
              <Route path="/secretaria/correlatividades" element={<ProtectedRoute roles={['secretaria','admin','bedel']}><CorrelatividadesPage /></ProtectedRoute>} />
              <Route path="/secretaria/carga-notas" element={<ProtectedRoute roles={['secretaria','admin','bedel']}><CargaNotasPage /></ProtectedRoute>} />
              <Route path="/secretaria/confirmar-inscripcion" element={<ProtectedRoute roles={['secretaria','bedel','admin']}><ConfirmarInscripcionSecretaria /></ProtectedRoute>} />

              {/* Nuevas rutas para Alumnos */}
              <Route path="/alumnos/inscripcion-carrera" element={<ProtectedRoute roles={['alumno','admin']}><InscripcionCarreraPage /></ProtectedRoute>} />
              <Route path="/alumnos/inscripcion-materia" element={<ProtectedRoute roles={['alumno','admin']}><InscripcionMateriaPage /></ProtectedRoute>} />
              <Route path="/alumnos/cambio-comision" element={<ProtectedRoute roles={['alumno','admin']}><CambioComisionPage /></ProtectedRoute>} />
              <Route path="/alumnos/pedido-analitico" element={<ProtectedRoute roles={['alumno','admin']}><PedidoAnaliticoPage /></ProtectedRoute>} />
              <Route path="/alumnos/mesa-examen" element={<ProtectedRoute roles={['alumno','admin']}><MesaExamenPage /></ProtectedRoute>} />
              <Route path="/alumnos/trayectoria" element={<ProtectedRoute roles={['alumno','admin', 'bedel', 'secretaria']}><TrayectoriaPage /></ProtectedRoute>} />
            </Route>
    
            <Route path="/403" element={<Forbidden />} />
        </Route>
    </Routes>
  );
}
