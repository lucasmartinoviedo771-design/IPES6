import { Routes, Route, Outlet, Navigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import PreinscripcionWizard from "@/components/preinscripcion/PreinscripcionWizard";
import ComprobanteScreen from "@/components/preinscripcion/ComprobanteScreen";
import { Box, CircularProgress, AppBar, Toolbar, Typography } from "@mui/material";
import LoginPage from "@/pages/LoginPage";
import DashboardPage from "@/pages/DashboardPage";
import ConfirmarInscripcionPage from "@/pages/ConfirmarInscripcionPage";
import Forbidden from "@/pages/Forbidden";
import { ProtectedRoute, PublicOnlyRoute } from "@/router/guards";
import ConfiguracionPage from "@/pages/ConfiguracionPage";
import ReportesPage from "@/pages/ReportesPage";
import CarrerasPage from "@/pages/CarrerasPage";
import AlumnosPage from "@/pages/AlumnosPage";
import PreinscripcionesPage from "@/pages/PreinscripcionesPage";
import AppShell from "@/components/layout/AppShell";
import SecretariaIndex from "@/pages/Secretaria/Index";
import CargarProfesoradoPage from "@/pages/Secretaria/CargarProfesoradoPage";
import CargarPlanPage from "@/pages/Secretaria/CargarPlanPage";
import CargarMateriasPage from "@/pages/Secretaria/CargarMateriasPage";
import CargarDocentesPage from "@/pages/Secretaria/CargarDocentesPage";
import AsignarRolPage from "@/pages/Secretaria/AsignarRolPage";
import CargarHorarioPage from "@/pages/Secretaria/CargarHorarioPage";

function AppLayout() {
    const { loading } = useAuth();

    if (loading) {
        return (
            <Box display="flex" justifyContent="center" alignItems="center" height="100vh">
                <CircularProgress />
            </Box>
        );
    }

    return (
        <>
            <AppBar position="static" elevation={0} sx={{ backgroundColor: "#9aa04a" }}>
                <Toolbar sx={{ minHeight: 56 }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                        <img src="/ipes-logo.jpg" alt="IPES" width={28} height={28} style={{ display: "block" }} />
                        <Typography variant="h6" sx={{ color: "#000", fontWeight: 700, letterSpacing: 0.2 }}>
                            IPES Paulo Freire
                        </Typography>
                    </Box>
                </Toolbar>
            </AppBar>
            <Outlet />
        </>
    );
}

export default function App() {
  return (
    <Routes>
        <Route element={<AppLayout />}>
            <Route index element={<Navigate to="/preinscripcion" replace />} />
            <Route path="/preinscripcion" element={<PreinscripcionWizard />} />
            <Route path="/preinscripcion/comprobante/:id" element={<ComprobanteScreen />} />

            <Route path="/login" element={<PublicOnlyRoute><LoginPage /></PublicOnlyRoute>} />

            {/* Bloque protegido con AppShell */}
            <Route element={<ProtectedRoute roles={['preinscripciones','secretaria','admin']}><AppShell><Outlet/></AppShell></ProtectedRoute>}>
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/preinscripciones" element={<PreinscripcionesPage />} />
              <Route path="/alumnos" element={<AlumnosPage />} />
              <Route path="/carreras" element={<CarrerasPage />} />
              <Route path="/reportes" element={<ReportesPage />} />
              <Route path="/configuracion" element={<ConfiguracionPage />} />
              <Route path="/gestion/confirmar" element={<ProtectedRoute roles={['preinscripciones','secretaria','admin']}><ConfirmarInscripcionPage /></ProtectedRoute>} />
              <Route path="/secretaria" element={<ProtectedRoute roles={['secretaria','admin']}><SecretariaIndex /></ProtectedRoute>} />
<Route path="/secretaria/profesorado" element={<ProtectedRoute roles={['secretaria','admin']}><CargarProfesoradoPage /></ProtectedRoute>} />
<Route path="/secretaria/profesorado/:profesoradoId/planes" element={<ProtectedRoute roles={['secretaria','admin']}><CargarPlanPage /></ProtectedRoute>} />
<Route path="/secretaria/plan/:planId/materias" element={<ProtectedRoute roles={['secretaria','admin']}><CargarMateriasPage /></ProtectedRoute>} />
<Route path="/secretaria/docentes" element={<ProtectedRoute roles={['secretaria','admin']}><CargarDocentesPage /></ProtectedRoute>} />
<Route path="/secretaria/asignar-rol" element={<ProtectedRoute roles={['secretaria','admin']}><AsignarRolPage /></ProtectedRoute>} />
<Route path="/secretaria/horarios" element={<ProtectedRoute roles={['secretaria','admin']}><CargarHorarioPage /></ProtectedRoute>} />
            </Route>
    
            <Route path="/dashboard" element={<ProtectedRoute roles={['bedel', 'secretaria', 'admin']}><DashboardPage /></ProtectedRoute>} />
            <Route path="/gestion/confirmar" element={<ProtectedRoute roles={['bedel', 'secretaria', 'admin']}><ConfirmarInscripcionPage /></ProtectedRoute>} />

            <Route path="/403" element={<Forbidden />} />
        </Route>
    </Routes>
  );
}
