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
  return (
    <Routes>
        <Route element={<AppLayout />}>
            <Route index element={<Navigate to="/preinscripcion" replace />} />
            <Route path="/preinscripcion" element={<PreinscripcionWizard />} />
            {false && <Route path="/preinscripcion/comprobante/:id" element={<div />} />}
            <Route path="/debug/inscripcion-preview" element={<InscripcionPreview />} />

            <Route path="/login" element={<PublicOnlyRoute><LoginPage /></PublicOnlyRoute>} />
            <Route path="/cambiar-password" element={<ProtectedRoute><ChangePasswordPage /></ProtectedRoute>} />

            {/* Bloque protegido con AppShell (incluye alumnos y bedel) */}
            <Route element={<ProtectedRoute roles={['preinscripciones','secretaria','admin','alumno','bedel']}><AppShell><Outlet/></AppShell></ProtectedRoute>}>
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/preinscripciones" element={<PreinscripcionesPage />} />
              {/* Alumnos: índice con tarjetas */}
              <Route path="/alumnos" element={<AlumnosIndex />} />
              <Route path="/carreras" element={<CarrerasPage />} />
              <Route path="/reportes" element={<ReportesPage />} />
              <Route path="/configuracion" element={<ConfiguracionPage />} />
              <Route path="/gestion/confirmar" element={<ProtectedRoute roles={['bedel','secretaria','admin']}><ConfirmarInscripcionPage /></ProtectedRoute>} />
              <Route path="/secretaria" element={<ProtectedRoute roles={['secretaria','admin']}><SecretariaIndex /></ProtectedRoute>} />
<Route path="/secretaria/profesorado" element={<ProtectedRoute roles={['secretaria','admin']}><CargarProfesoradoPage /></ProtectedRoute>} />
<Route path="/secretaria/profesorado/:profesoradoId/planes" element={<ProtectedRoute roles={['secretaria','admin']}><CargarPlanPage /></ProtectedRoute>} />
<Route path="/secretaria/plan/:planId/materias" element={<ProtectedRoute roles={['secretaria','admin']}><CargarMateriasPage /></ProtectedRoute>} />
<Route path="/secretaria/docentes" element={<ProtectedRoute roles={['secretaria','admin']}><CargarDocentesPage /></ProtectedRoute>} />
<Route path="/secretaria/asignar-rol" element={<ProtectedRoute roles={['secretaria','admin']}><AsignarRolPage /></ProtectedRoute>} />
<Route path="/secretaria/horarios" element={<ProtectedRoute roles={['secretaria','admin']}><ErrorBoundary><CargarHorarioPage /></ErrorBoundary></ProtectedRoute>} />
<Route path="/secretaria/catedra-docente" element={<ProtectedRoute roles={['secretaria','admin']}><CatedraDocentePage /></ProtectedRoute>} />
<Route path="/secretaria/habilitar-fechas" element={<ProtectedRoute roles={['secretaria','admin']}><HabilitarFechasPage /></ProtectedRoute>} />
<Route path="/secretaria/comisiones" element={<ProtectedRoute roles={['secretaria','admin']}><ComisionesPage /></ProtectedRoute>} />
<Route path="/secretaria/analiticos" element={<ProtectedRoute roles={['secretaria','bedel','admin']}><AnaliticosPage /></ProtectedRoute>} />
<Route path="/secretaria/mesas" element={<ProtectedRoute roles={['secretaria','bedel','admin']}><MesasPage /></ProtectedRoute>} />
<Route path="/secretaria/correlatividades" element={<ProtectedRoute roles={['secretaria','admin']}><CorrelatividadesPage /></ProtectedRoute>} />
<Route path="/secretaria/carga-notas" element={<ProtectedRoute roles={['secretaria','admin']}><CargaNotasPage /></ProtectedRoute>} />
<Route path="/secretaria/confirmar-inscripcion" element={<ProtectedRoute roles={['secretaria','bedel','admin']}><ConfirmarInscripcionSecretaria /></ProtectedRoute>} />

              {/* Nuevas rutas para Alumnos */}
              <Route path="/alumnos/inscripcion-carrera" element={<ProtectedRoute roles={['alumno','admin']}><InscripcionCarreraPage /></ProtectedRoute>} />
              <Route path="/alumnos/inscripcion-materia" element={<ProtectedRoute roles={['alumno','admin']}><InscripcionMateriaPage /></ProtectedRoute>} />
              <Route path="/alumnos/cambio-comision" element={<ProtectedRoute roles={['alumno','admin']}><CambioComisionPage /></ProtectedRoute>} />
              <Route path="/alumnos/pedido-analitico" element={<ProtectedRoute roles={['alumno','admin']}><PedidoAnaliticoPage /></ProtectedRoute>} />
              <Route path="/alumnos/mesa-examen" element={<ProtectedRoute roles={['alumno','admin']}><MesaExamenPage /></ProtectedRoute>} />
              <Route path="/alumnos/trayectoria" element={<ProtectedRoute roles={['alumno','admin']}><TrayectoriaPage /></ProtectedRoute>} />
            </Route>
    
            <Route path="/dashboard" element={<ProtectedRoute roles={['bedel', 'secretaria', 'admin']}><DashboardPage /></ProtectedRoute>} />


            <Route path="/403" element={<Forbidden />} />
        </Route>
    </Routes>
  );
}
