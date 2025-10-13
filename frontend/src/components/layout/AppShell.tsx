import { PropsWithChildren, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  AppBar, Toolbar, Typography, Drawer, List, ListItemButton, ListItemIcon, ListItemText,
  Box, CssBaseline, IconButton, Divider, Collapse
} from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";
import DashboardIcon from "@mui/icons-material/Dashboard";
import AssignmentIcon from "@mui/icons-material/Assignment";
import SchoolIcon from "@mui/icons-material/School";
import WorkspacesIcon from "@mui/icons-material/Workspaces";
import BarChartIcon from "@mui/icons-material/BarChart";
import SettingsIcon from "@mui/icons-material/Settings";
import { useAuth } from "@/context/AuthContext";
import ExpandLess from "@mui/icons-material/ExpandLess";
import ExpandMore from "@mui/icons-material/ExpandMore";
import AssignmentIndIcon from "@mui/icons-material/AssignmentInd"; // Asignar rol
import EventNoteIcon from "@mui/icons-material/EventNote";         // Horarios
import LibraryBooksIcon from "@mui/icons-material/LibraryBooks";   // Plan
import ArticleIcon from "@mui/icons-material/Article";             // Materias
import PersonIcon from "@mui/icons-material/Person";               // Docentes
import SchoolOutlinedIcon from "@mui/icons-material/SchoolOutlined"; // Cátedra-Docente
import EventAvailableIcon from "@mui/icons-material/EventAvailable";  // Habilitar fechas
import LinkIcon from "@mui/icons-material/Link";                      // Correlatividades
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import DescriptionIcon from '@mui/icons-material/Description';

const drawerWidth = 240;

export default function AppShell({ children }: PropsWithChildren) {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(true);
  const loc = useLocation();
  const navigate = useNavigate();

  const current = useMemo(() => loc.pathname, [loc.pathname]);
  
  const [openSec, setOpenSec] = useState(true);
  const isSecPath = current.startsWith("/secretaria");

  const [openAlumnos, setOpenAlumnos] = useState(true);
  const isAlumnosPath = current.startsWith("/alumnos");

  return (
    <Box sx={{ display: "flex", backgroundColor: "background.default", minHeight: "100vh" }}>
      <CssBaseline />
      <AppBar position="fixed" elevation={0} sx={{ backgroundColor: "#f5eedd", color: "text.primary", borderBottom: "1px solid #eee" }}>
        <Toolbar sx={{ gap: 2, minHeight: 48 }}>
          <IconButton edge="start" onClick={() => setOpen(v => !v)} size="small">
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" fontWeight={800} sx={{ flexGrow: 1, letterSpacing: .3 }}>
            IPES Paulo Freire
          </Typography>
          <Box sx={{ display: "flex", alignItems: "center", gap: 2, fontSize: 14 }}>
            <span>Hola, {user?.name ?? user?.dni}</span>
            <Link to="#" onClick={(e)=>{e.preventDefault(); logout();}}>Cerrar sesión</Link>
          </Box>
        </Toolbar>
      </AppBar>

      <Drawer
        variant="permanent"
        sx={{
          width: drawerWidth,
          [`& .MuiDrawer-paper`]: {
            width: drawerWidth, boxSizing: "border-box",
            backgroundColor: "#e6e8da", borderRight: "1px solid #d8dcc7"
          }
        }}
      >
        <Toolbar sx={{ minHeight: 48 }} />
        <List dense>
          <ListItemButton
            selected={current === "/dashboard"}
            onClick={() => { console.log("Navigating to Dashboard"); navigate("/dashboard"); }}
            sx={{ borderRadius: 2, mx: 1, my: .5, "&.Mui-selected": { background: "#dfe3ce" } }}
          >
            <ListItemIcon sx={{ minWidth: 36 }}><DashboardIcon fontSize="small" /></ListItemIcon>
            <ListItemText primary="Dashboard" />
          </ListItemButton>

          <ListItemButton
            selected={current.startsWith("/preinscripciones")}
            onClick={() => navigate("/preinscripciones")}
            sx={{ borderRadius: 2, mx: 1, my: .5, "&.Mui-selected": { background: "#dfe3ce" } }}
          >
            <ListItemIcon sx={{ minWidth: 36 }}><AssignmentIcon fontSize="small" /></ListItemIcon>
            <ListItemText primary="Preinscripciones" />
          </ListItemButton>

          <ListItemButton
            selected={current.startsWith("/carreras")}
            onClick={() => navigate("/carreras")}
            sx={{ borderRadius: 2, mx: 1, my: .5, "&.Mui-selected": { background: "#dfe3ce" } }}
          >
            <ListItemIcon sx={{ minWidth: 36 }}><WorkspacesIcon fontSize="small" /></ListItemIcon>
            <ListItemText primary="Carreras" />
          </ListItemButton>

          <ListItemButton
            selected={current.startsWith("/reportes")}
            onClick={() => navigate("/reportes")}
            sx={{ borderRadius: 2, mx: 1, my: .5, "&.Mui-selected": { background: "#dfe3ce" } }}
          >
            <ListItemIcon sx={{ minWidth: 36 }}><BarChartIcon fontSize="small" /></ListItemIcon>
            <ListItemText primary="Reportes" />
          </ListItemButton>

          {/* --- NUEVO: Secretaría (colapsable) --- */}
          <ListItemButton
            onClick={() => navigate("/secretaria")}
            selected={isSecPath}
            sx={{ borderRadius: 2, mx: 1, my: .5, "&.Mui-selected": { background: "#dfe3ce" } }}
          >
            <ListItemIcon sx={{ minWidth: 36 }}><SettingsIcon fontSize="small" /></ListItemIcon>
            <ListItemText primary="Secretaría" />
          </ListItemButton>

          {false &&
          <Collapse in={openSec} timeout="auto" unmountOnExit>
            <List component="div" disablePadding>
              <ListItemButton sx={{ pl: 5 }} selected={current === "/secretaria"} onClick={() => navigate("/secretaria")}>
                <ListItemIcon sx={{ minWidth: 36 }}><SettingsIcon fontSize="small" /></ListItemIcon>
                <ListItemText primary="Inicio de Secretaría" />
              </ListItemButton>

              <ListItemButton sx={{ pl: 5 }} selected={current.startsWith("/secretaria/profesorado")} onClick={() => navigate("/secretaria/profesorado")}>
                <ListItemIcon sx={{ minWidth: 36 }}><SchoolIcon fontSize="small" /></ListItemIcon>
                <ListItemText primary="Cargar Profesorado" />
              </ListItemButton>





              <ListItemButton sx={{ pl: 5 }} selected={current.startsWith("/secretaria/docentes")} onClick={() => navigate("/secretaria/docentes")}>
                <ListItemIcon sx={{ minWidth: 36 }}><PersonIcon fontSize="small" /></ListItemIcon>
                <ListItemText primary="Cargar Docentes" />
              </ListItemButton>

              <ListItemButton sx={{ pl: 5 }} selected={current.startsWith("/secretaria/asignar-rol")} onClick={() => navigate("/secretaria/asignar-rol")}>
                <ListItemIcon sx={{ minWidth: 36 }}><AssignmentIndIcon fontSize="small" /></ListItemIcon>
                <ListItemText primary="Asignar Rol" />
              </ListItemButton>

              <ListItemButton sx={{ pl: 5 }} selected={current.startsWith("/secretaria/horarios")} onClick={() => { console.log("Navigating to Cargar Horario"); navigate("/secretaria/horarios"); }}>
                <ListItemIcon sx={{ minWidth: 36 }}><EventNoteIcon fontSize="small" /></ListItemIcon>
                <ListItemText primary="Cargar Horario" />
              </ListItemButton>

              <ListItemButton sx={{ pl: 5 }} selected={current.startsWith("/secretaria/catedra-docente")} onClick={() => navigate("/secretaria/catedra-docente")}>
                <ListItemIcon sx={{ minWidth: 36 }}><SchoolOutlinedIcon fontSize="small" /></ListItemIcon>
                <ListItemText primary="Cátedra - Docente" />
              </ListItemButton>

              <ListItemButton sx={{ pl: 5 }} selected={current.startsWith("/secretaria/habilitar-fechas")} onClick={() => navigate("/secretaria/habilitar-fechas")}>
                <ListItemIcon sx={{ minWidth: 36 }}><EventAvailableIcon fontSize="small" /></ListItemIcon>
                <ListItemText primary="Habilitar Fechas" />
              </ListItemButton>

              <ListItemButton sx={{ pl: 5 }} selected={current.startsWith("/secretaria/correlatividades")} onClick={() => navigate("/secretaria/correlatividades")}>
                <ListItemIcon sx={{ minWidth: 36 }}><LinkIcon fontSize="small" /></ListItemIcon>
                <ListItemText primary="Correlatividades" />
              </ListItemButton>
            </List>
          </Collapse>
          }

          {/* --- NUEVO: Alumnos (colapsable) --- */}
          <ListItemButton
            onClick={() => navigate("/alumnos")}
            selected={isAlumnosPath}
            sx={{ borderRadius: 2, mx: 1, my: .5, "&.Mui-selected": { background: "#dfe3ce" } }}
          >
            <ListItemIcon sx={{ minWidth: 36 }}><SchoolIcon fontSize="small" /></ListItemIcon>
            <ListItemText primary="Alumnos" />
          </ListItemButton>

          {false &&
          <Collapse in={openAlumnos} timeout="auto" unmountOnExit>
            <List component="div" disablePadding>
              <ListItemButton sx={{ pl: 5 }} selected={current === "/alumnos"} onClick={() => navigate("/alumnos")}>
                <ListItemIcon sx={{ minWidth: 36 }}><DashboardIcon fontSize="small" /></ListItemIcon>
                <ListItemText primary="Inicio Alumnos" />
              </ListItemButton>
              <ListItemButton sx={{ pl: 5 }} selected={current.startsWith("/alumnos/inscripcion-carrera")} onClick={() => navigate("/alumnos/inscripcion-carrera")}>
                <ListItemIcon sx={{ minWidth: 36 }}><SchoolIcon fontSize="small" /></ListItemIcon>
                <ListItemText primary="Inscripción a Carreras" />
              </ListItemButton>
              <ListItemButton sx={{ pl: 5 }} selected={current.startsWith("/alumnos/inscripcion-materia")} onClick={() => navigate("/alumnos/inscripcion-materia")}>
                <ListItemIcon sx={{ minWidth: 36 }}><AssignmentIcon fontSize="small" /></ListItemIcon>
                <ListItemText primary="Inscripción a Materias" />
              </ListItemButton>
              <ListItemButton sx={{ pl: 5 }} selected={current.startsWith("/alumnos/cambio-comision")} onClick={() => navigate("/alumnos/cambio-comision")}>
                <ListItemIcon sx={{ minWidth: 36 }}><SwapHorizIcon fontSize="small" /></ListItemIcon>
                <ListItemText primary="Cambio de Comisión" />
              </ListItemButton>
              <ListItemButton sx={{ pl: 5 }} selected={current.startsWith("/alumnos/pedido-analitico")} onClick={() => navigate("/alumnos/pedido-analitico")}>
                <ListItemIcon sx={{ minWidth: 36 }}><DescriptionIcon fontSize="small" /></ListItemIcon>
                <ListItemText primary="Pedido de Analítico" />
              </ListItemButton>
              <ListItemButton sx={{ pl: 5 }} selected={current.startsWith("/alumnos/mesa-examen")} onClick={() => navigate("/alumnos/mesa-examen")}>
                <ListItemIcon sx={{ minWidth: 36 }}><EventNoteIcon fontSize="small" /></ListItemIcon>
                <ListItemText primary="Mesa de Examen" />
              </ListItemButton>
            </List>
          </Collapse>
          }
          {/* Configuración queda como estaba */}
          <ListItemButton
            selected={current.startsWith("/configuracion")}
            onClick={() => navigate("/configuracion")}
            sx={{ borderRadius: 2, mx: 1, my: .5, "&.Mui-selected": { background: "#dfe3ce" } }}
          >
            <ListItemIcon sx={{ minWidth: 36 }}><SettingsIcon fontSize="small" /></ListItemIcon>
            <ListItemText primary="Configuración" />
          </ListItemButton>
        </List>

        <Divider sx={{ my: 1 }} />
        <Box p={2} fontSize={12} color="text.secondary">Sistema de Gestión</Box>
      </Drawer>

      <Box component="main" className="app-main" sx={{ flexGrow: 1, p: 1.5 }}>
        <Toolbar sx={{ minHeight: 48 }} />
        {children}
      </Box>
    </Box>
  );
}
