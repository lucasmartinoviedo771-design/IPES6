import { PropsWithChildren, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  AppBar,
  Toolbar,
  Typography,
  Drawer,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Box,
  CssBaseline,
  IconButton,
  Divider
} from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import DashboardIcon from "@mui/icons-material/Dashboard";
import AssignmentIcon from "@mui/icons-material/Assignment";
import SchoolIcon from "@mui/icons-material/School";
import WorkspacesIcon from "@mui/icons-material/Workspaces";
import BarChartIcon from "@mui/icons-material/BarChart";
import SettingsIcon from "@mui/icons-material/Settings";
import InsightsIcon from "@mui/icons-material/Insights";
import { useAuth } from "@/context/AuthContext";
import { hasAnyRole, isOnlyStudent } from "@/utils/roles";
import TestModeToggle from "./TestModeToggle";

const drawerWidth = 240;

export default function AppShell({ children }: PropsWithChildren) {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState<boolean>(() => {
    try {
      const v = localStorage.getItem("sidebarOpen");
      return v === null ? true : v === "1";
    } catch {
      return true;
    }
  });
  const loc = useLocation();
  const navigate = useNavigate();

  const current = useMemo(() => loc.pathname, [loc.pathname]);

  const studentOnly = isOnlyStudent(user);
  const dashboardVisible = hasAnyRole(user, [
    "admin",
    "secretaria",
    "bedel",
    "preinscripciones",
    "jefa_aaee",
    "jefes",
    "tutor",
    "coordinador",
    "consulta"
  ]) || studentOnly;
  const canPreins = hasAnyRole(user, ["admin", "secretaria", "bedel", "preinscripciones"]);
  const canSeeCarreras = hasAnyRole(user, [
    "admin",
    "secretaria",
    "bedel",
    "preinscripciones",
    "coordinador",
    "tutor",
    "jefes",
    "jefa_aaee"
  ]);
  const canSeeReportes = hasAnyRole(user, [
    "admin",
    "secretaria",
    "bedel",
    "preinscripciones",
    "jefa_aaee",
    "jefes",
    "tutor",
    "coordinador"
  ]);
  const canGlobalOverview = hasAnyRole(user, [
    "admin",
    "secretaria",
    "bedel",
    "preinscripciones",
    "jefa_aaee",
    "jefes",
    "tutor",
    "coordinador",
    "consulta",
  ]);
  const canSecretaria = hasAnyRole(user, [
    "admin",
    "secretaria",
    "bedel",
    "jefa_aaee",
    "jefes",
    "tutor",
    "coordinador"
  ]);
  const canAlumnoPortal = hasAnyRole(user, ["alumno"]);
  const canAlumnoPanel = hasAnyRole(user, [
    "admin",
    "secretaria",
    "bedel",
    "tutor",
    "jefes",
    "jefa_aaee",
    "coordinador"
  ]);
  const showConfig = hasAnyRole(user, ["admin", "secretaria"]);

  useEffect(() => {
    try {
      localStorage.setItem("sidebarOpen", open ? "1" : "0");
    } catch {}
  }, [open]);

  return (
    <Box sx={{ display: "flex", backgroundColor: "background.default", minHeight: "100vh" }}>
      <CssBaseline />
      <AppBar
        position="fixed"
        elevation={0}
        sx={{
          backgroundColor: "#f5eedd",
          color: "text.primary",
          borderBottom: "1px solid #eee",
          zIndex: (t) => t.zIndex.drawer + 1,
        }}
      >
        <Toolbar sx={{ gap: 2, minHeight: 48 }}>
          <IconButton edge="start" color="inherit" onClick={() => setOpen((v) => !v)} size="small" aria-label="Alternar menú">
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" fontWeight={800} sx={{ flexGrow: 1, letterSpacing: 0.3 }}>
            IPES Paulo Freire
          </Typography>
          <TestModeToggle />
          <Box sx={{ display: "flex", alignItems: "center", gap: 2, fontSize: 14 }}>
            <span>Hola, {user?.name ?? user?.dni}</span>
            <Link
              to="#"
              onClick={(e) => {
                e.preventDefault();
                logout();
              }}
            >
              Cerrar sesión
            </Link>
          </Box>
        </Toolbar>
      </AppBar>

      <Drawer
        variant="permanent"
        sx={{
          width: open ? drawerWidth : 0,
          transition: "width .2s ease",
          overflowX: "hidden",
          [`& .MuiDrawer-paper`]: {
            width: open ? drawerWidth : 0,
            transition: "width .2s ease",
            boxSizing: "border-box",
            backgroundColor: "#e6e8da",
            borderRight: "1px solid #d8dcc7",
            overflowX: "hidden",
          },
        }}
      >
        <Toolbar sx={{ minHeight: 48, justifyContent: "flex-end" }}>
          <IconButton size="small" onClick={() => setOpen(false)} aria-label="Ocultar menú">
            <ChevronLeftIcon />
          </IconButton>
        </Toolbar>
        <List dense>
          {dashboardVisible && (
            <ListItemButton
              selected={current === "/dashboard"}
              onClick={() => navigate("/dashboard")}
              sx={{ borderRadius: 2, mx: 1, my: 0.5, "&.Mui-selected": { background: "#dfe3ce" } }}
            >
              <ListItemIcon sx={{ minWidth: 36 }}><DashboardIcon fontSize="small" /></ListItemIcon>
              <ListItemText primary="Dashboard" />
            </ListItemButton>
          )}

          {canPreins && (
            <ListItemButton
              selected={current.startsWith("/preinscripciones")}
              onClick={() => navigate("/preinscripciones")}
              sx={{ borderRadius: 2, mx: 1, my: 0.5, "&.Mui-selected": { background: "#dfe3ce" } }}
            >
              <ListItemIcon sx={{ minWidth: 36 }}><AssignmentIcon fontSize="small" /></ListItemIcon>
              <ListItemText primary="Formalizar inscripción" />
            </ListItemButton>
          )}

          {!studentOnly && canSeeCarreras && (
            <ListItemButton
              selected={current.startsWith("/carreras")}
              onClick={() => navigate("/carreras")}
              sx={{ borderRadius: 2, mx: 1, my: 0.5, "&.Mui-selected": { background: "#dfe3ce" } }}
            >
              <ListItemIcon sx={{ minWidth: 36 }}><WorkspacesIcon fontSize="small" /></ListItemIcon>
              <ListItemText primary="Carreras" />
            </ListItemButton>
          )}

          {!studentOnly && canSeeReportes && (
            <ListItemButton
              selected={current.startsWith("/reportes")}
              onClick={() => navigate("/reportes")}
              sx={{ borderRadius: 2, mx: 1, my: 0.5, "&.Mui-selected": { background: "#dfe3ce" } }}
            >
              <ListItemIcon sx={{ minWidth: 36 }}><BarChartIcon fontSize="small" /></ListItemIcon>
              <ListItemText primary="Reportes" />
            </ListItemButton>
          )}

          {canGlobalOverview && (
            <ListItemButton
              selected={current.startsWith("/vistas")}
              onClick={() => navigate("/vistas")}
              sx={{ borderRadius: 2, mx: 1, my: 0.5, "&.Mui-selected": { background: "#dfe3ce" } }}
            >
              <ListItemIcon sx={{ minWidth: 36 }}><InsightsIcon fontSize="small" /></ListItemIcon>
              <ListItemText primary="Vistas globales" />
            </ListItemButton>
          )}

          {canSecretaria && (
            <ListItemButton
              selected={current.startsWith("/secretaria")}
              onClick={() => navigate("/secretaria")}
              sx={{ borderRadius: 2, mx: 1, my: 0.5, "&.Mui-selected": { background: "#dfe3ce" } }}
            >
              <ListItemIcon sx={{ minWidth: 36 }}><SettingsIcon fontSize="small" /></ListItemIcon>
              <ListItemText primary="Secretaría" />
            </ListItemButton>
          )}

          {(canAlumnoPortal || canAlumnoPanel) && (
            <ListItemButton
              selected={current.startsWith("/alumnos")}
              onClick={() => navigate("/alumnos")}
              sx={{ borderRadius: 2, mx: 1, my: 0.5, "&.Mui-selected": { background: "#dfe3ce" } }}
            >
              <ListItemIcon sx={{ minWidth: 36 }}><SchoolIcon fontSize="small" /></ListItemIcon>
              <ListItemText primary="Alumnos" />
            </ListItemButton>
          )}

          {showConfig && (
            <ListItemButton
              selected={current.startsWith("/configuracion")}
              onClick={() => navigate("/configuracion")}
              sx={{ borderRadius: 2, mx: 1, my: 0.5, "&.Mui-selected": { background: "#dfe3ce" } }}
            >
              <ListItemIcon sx={{ minWidth: 36 }}><SettingsIcon fontSize="small" /></ListItemIcon>
              <ListItemText primary="Configuración" />
            </ListItemButton>
          )}
        </List>

        <Divider sx={{ my: 1 }} />
        <Box p={2} fontSize={12} color="text.secondary">
          Sistema de Gestión
        </Box>
      </Drawer>

      {!open && (
        <Box
          sx={{
            position: "fixed",
            left: 0,
            top: "50%",
            transform: "translateY(-50%)",
            zIndex: 1400,
            backgroundColor: "#e6e8da",
            border: "1px solid #d8dcc7",
            borderLeft: "none",
            borderRadius: "0 8px 8px 0",
            boxShadow: 1,
          }}
        >
          <IconButton size="small" onClick={() => setOpen(true)} aria-label="Mostrar menú">
            <ChevronRightIcon />
          </IconButton>
        </Box>
      )}

      <Box component="main" className="app-main" sx={{ flexGrow: 1, p: 1.5 }}>
        <Toolbar sx={{ minHeight: 48 }} />
        <Box key={current} sx={{ height: "100%" }}>
          {children}
        </Box>
      </Box>
    </Box>
  );
}
