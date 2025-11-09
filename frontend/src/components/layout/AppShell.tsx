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
  Divider,
  Badge,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button
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
import LogoutIcon from "@mui/icons-material/Logout";
import FactCheckIcon from "@mui/icons-material/FactCheck";
import MailOutlineIcon from "@mui/icons-material/MailOutline";
import HelpOutlineIcon from "@mui/icons-material/HelpOutline"; // Importar ícono de ayuda
import UploadFileIcon from "@mui/icons-material/UploadFile"; // Importar ícono para Primera Carga
import { useAuth } from "@/context/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { obtenerResumenMensajes } from "@/api/mensajes";
import { hasAnyRole, isOnlyStudent } from "@/utils/roles";
import UserGuideDisplay from "../guia/UserGuideDisplay"; // Importar componente de guía
import ipesLogoDark from "@/assets/ipes-logo-dark.png";

const drawerWidth = 280;

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
  const [guideOpen, setGuideOpen] = useState(false); // Estado para el diálogo de la guía
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
  ]);
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
  const canSecretaria = hasAnyRole(user, [
    "admin",
    "secretaria",
    "bedel",
    "jefa_aaee",
    "jefes",
    "tutor",
    "coordinador"
  ]);
  const canAsistenciaReportes = hasAnyRole(user, ["admin", "secretaria", "bedel"]);
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
  const canPrimeraCarga = hasAnyRole(user, ["admin", "secretaria", "bedel"]); // New role check

  const canUseMessages =
    !!user &&
    (!hasAnyRole(user, ["preinscripciones"]) ||
      hasAnyRole(user, ["admin", "secretaria", "bedel"]));


  const { data: messageSummary } = useQuery({
    queryKey: ["mensajes", "resumen"],
    queryFn: obtenerResumenMensajes,
    enabled: canUseMessages,
    refetchInterval: 60_000,
  });

  const unreadMessages = messageSummary?.unread ?? 0;
  const badgeColor =
    unreadMessages === 0
      ? "default"
      : messageSummary?.sla_danger
      ? "error"
      : messageSummary?.sla_warning
      ? "warning"
      : "primary";

  const navButtonSx = {
    borderRadius: 10,
    mx: 2,
    my: 0.5,
    color: "#ffffff",
    "& .MuiListItemIcon-root": { color: "inherit", minWidth: 32 },
    "& .MuiListItemText-primary": { fontWeight: 600, fontSize: 14 },
    "&.Mui-selected": {
      backgroundColor: "rgba(255,255,255,0.15)",
      boxShadow: "0 15px 35px rgba(0,0,0,0.45)",
    },
    "&:hover": {
      backgroundColor: "rgba(255,255,255,0.1)",
    },
  };

  const sidebarOffset = open ? drawerWidth : 0;

  useEffect(() => {
    try {
      localStorage.setItem("sidebarOpen", open ? "1" : "0");
    } catch (error) {
      console.warn("No se pudo persistir la preferencia del menú lateral", error);
    }
  }, [open]);

  return (
    <Box sx={{ display: "flex", backgroundColor: "#f1f3f9", minHeight: "100vh" }}>
      <CssBaseline />
      <AppBar
        position="fixed"
        elevation={0}
        sx={{
          backgroundColor: "#ffffff",
          color: "#0f172a",
          borderBottom: "1px solid #e2e8f0",
          zIndex: (t) => t.zIndex.drawer + 1,
          ml: open ? `${drawerWidth}px` : "72px",
          width: open ? `calc(100% - ${drawerWidth}px)` : "calc(100% - 72px)",
          transition: "margin 0.3s ease, width 0.3s ease",
        }}
      >
        <Toolbar sx={{ gap: 2, minHeight: 64 }}>
          <IconButton
            edge="start"
            onClick={() => setOpen((v) => !v)}
            size="small"
            aria-label="Alternar menú"
            sx={{
              borderRadius: 10,
              border: "1px solid #e2e8f0",
              backgroundColor: "#f8fafc",
              color: "#0f172a",
            }}
          >
            <MenuIcon fontSize="small" />
          </IconButton>
          <Box sx={{ flexGrow: 1, display: "flex", alignItems: "center", gap: 1 }}>
            <Box
              component="img"
              src={ipesLogoDark}
              alt="IPES6"
              sx={{ height: 64, objectFit: "contain" }}
            />
          </Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
            <Tooltip title="Guía de Usuario">
              <IconButton
                size="small"
                onClick={() => setGuideOpen(true)}
                sx={{
                  borderRadius: 10,
                  border: "1px solid #e2e8f0",
                  backgroundColor: "#f8fafc",
                  color: "#0f172a",
                }}
              >
                <HelpOutlineIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            {canUseMessages && (
              <Tooltip title="Mensajes">
                <IconButton
                  size="small"
                  onClick={() => navigate("/mensajes")}
                  sx={{
                    borderRadius: 10,
                    border: "1px solid #e2e8f0",
                    backgroundColor: "#f8fafc",
                    color: "#0f172a",
                  }}
                >
                  <Badge color={badgeColor} badgeContent={unreadMessages} max={99}>
                    <MailOutlineIcon fontSize="small" />
                  </Badge>
                </IconButton>
              </Tooltip>
            )}
            <Box sx={{ textAlign: "right" }}>
              <Typography variant="body2" fontWeight={600}>
                {user?.name ?? user?.dni}
              </Typography>
              {user?.email && (
                <Typography variant="caption" sx={{ color: "#475569" }}>
                  {user.email}
                </Typography>
              )}
            </Box>
              <Button
                component={Link}
                to="/cambiar-password"
                sx={{ textTransform: "none", fontWeight: 600, color: "#2563eb", borderRadius: 10 }}
              >
                Cambiar contraseña
              </Button>
            <Button
              variant="contained"
              color="primary"
              onClick={() => logout()}
              startIcon={<LogoutIcon fontSize="small" />}
              sx={{
                textTransform: "none",
                borderRadius: 10,
                px: 3,
                backgroundColor: "#2563eb",
                "&:hover": { backgroundColor: "#1d4ed8" },
              }}
            >
              Salir
            </Button>
          </Box>
        </Toolbar>
      </AppBar>

      {/* Diálogo para la Guía de Usuario */}
      <Dialog open={guideOpen} onClose={() => setGuideOpen(false)} fullWidth maxWidth="md">
        <DialogTitle>Guía de Usuario</DialogTitle>
        <DialogContent>
          <UserGuideDisplay />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setGuideOpen(false)}>Cerrar</Button>
        </DialogActions>
      </Dialog>

      <Drawer
        variant="permanent"
        open={open}
        sx={{
          width: drawerWidth,
          flexShrink: 0,
          [`& .MuiDrawer-paper`]: {
            width: drawerWidth,
            boxSizing: "border-box",
            background: "linear-gradient(180deg,#050915 0%,#070d1f 60%,#050d20 100%)",
            borderRight: "1px solid rgba(255,255,255,0.08)",
            color: "#fff",
            paddingBottom: 3,
            transform: open ? "translateX(0)" : `translateX(-${drawerWidth}px)`,
            transition: "transform .3s ease",
          },
        }}
      >
        <Box
          sx={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            px: 3,
            pt: 4,
            pb: 2,
            gap: 2,
          }}
        >
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
            <Box sx={{ display: "flex", alignItems: "center" }}>
              <Box
                component="img"
                src={ipesLogoDark}
                alt="IPES6"
                sx={{ height: 60, objectFit: "contain" }}
              />
            </Box>
            <Typography variant="caption" sx={{ textTransform: "uppercase", letterSpacing: 3, color: "rgba(255,255,255,0.6)", display: "none" }}>
              Gestión educativa
            </Typography>
            <Box sx={{ width: 56, height: 4, borderRadius: 10, backgroundColor: "#33ffcc", display: "none" }} />
          </Box>
          <IconButton size="small" onClick={() => setOpen(false)} aria-label="Ocultar menú" sx={{ color: "#fff" }}>
            <ChevronLeftIcon fontSize="small" />
          </IconButton>
        </Box>
        <List dense sx={{ mt: 1 }}>
          {dashboardVisible && (
            <ListItemButton
              selected={current === "/dashboard"}
              onClick={() => navigate("/dashboard")}
              sx={navButtonSx}
            >
              <ListItemIcon><DashboardIcon fontSize="small" /></ListItemIcon>
              <ListItemText primary="Panel de control" primaryTypographyProps={{ sx: { color: "#fff" } }} />
            </ListItemButton>
          )}

          {canPreins && (
            <ListItemButton
              selected={current.startsWith("/preinscripciones")}
              onClick={() => navigate("/preinscripciones")}
              sx={navButtonSx}
            >
              <ListItemIcon><AssignmentIcon fontSize="small" /></ListItemIcon>
              <ListItemText primary="Formalizar inscripción" primaryTypographyProps={{ sx: { color: "#fff" } }} />
            </ListItemButton>
          )}

          {!studentOnly && canSeeCarreras && (
            <ListItemButton
              selected={current.startsWith("/carreras")}
              onClick={() => navigate("/carreras")}
              sx={navButtonSx}
            >
              <ListItemIcon><WorkspacesIcon fontSize="small" /></ListItemIcon>
              <ListItemText primary="Carreras" primaryTypographyProps={{ sx: { color: "#fff" } }} />
            </ListItemButton>
          )}

          {!studentOnly && canSeeReportes && (
            <ListItemButton
              selected={current.startsWith("/reportes")}
              onClick={() => navigate("/reportes")}
              sx={navButtonSx}
            >
              <ListItemIcon><BarChartIcon fontSize="small" /></ListItemIcon>
              <ListItemText primary="Reportes" primaryTypographyProps={{ sx: { color: "#fff" } }} />
            </ListItemButton>
          )}

          {canAsistenciaReportes && (
            <ListItemButton
              selected={current.startsWith("/asistencia")}
              onClick={() => navigate("/asistencia/reportes")}
              sx={navButtonSx}
            >
              <ListItemIcon><FactCheckIcon fontSize="small" /></ListItemIcon>
              <ListItemText primary="Asistencia" primaryTypographyProps={{ sx: { color: "#fff" } }} />
            </ListItemButton>
          )}

          {canUseMessages && (
            <ListItemButton
              selected={current.startsWith("/mensajes")}
              onClick={() => navigate("/mensajes")}
              sx={navButtonSx}
            >
              <ListItemIcon>
                <Badge color={badgeColor} badgeContent={unreadMessages} max={99}>
                  <MailOutlineIcon fontSize="small" />
                </Badge>
              </ListItemIcon>
              <ListItemText primary="Mensajes" primaryTypographyProps={{ sx: { color: "#fff" } }} />
            </ListItemButton>
          )}

          {canSecretaria && (
            <ListItemButton
              selected={current.startsWith("/secretaria")}
              onClick={() => navigate("/secretaria")}
              sx={navButtonSx}
            >
              <ListItemIcon><SettingsIcon fontSize="small" /></ListItemIcon>
              <ListItemText primary="Secretaría" primaryTypographyProps={{ sx: { color: "#fff" } }} />
            </ListItemButton>
          )}

          {(canAlumnoPortal || canAlumnoPanel) && (
            <ListItemButton
              selected={current.startsWith("/alumnos")}
              onClick={() => navigate("/alumnos")}
              sx={navButtonSx}
            >
              <ListItemIcon><SchoolIcon fontSize="small" /></ListItemIcon>
              <ListItemText primary="Alumnos" primaryTypographyProps={{ sx: { color: "#fff" } }} />
            </ListItemButton>
          )}

          {canPrimeraCarga && ( // New sidebar item for "Primera Carga"
            <ListItemButton
              selected={current.startsWith("/admin/primera-carga")}
              onClick={() => navigate("/admin/primera-carga")}
              sx={navButtonSx}
            >
              <ListItemIcon><UploadFileIcon fontSize="small" /></ListItemIcon>
              <ListItemText primary="Primera carga" primaryTypographyProps={{ sx: { color: "#fff" } }} />
            </ListItemButton>
          )}


        </List>

        <Box sx={{ mt: "auto", px: 3 }}>
          <Divider sx={{ borderColor: "rgba(255,255,255,0.1)", mb: 2 }} />
          <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.6)" }}>
            IPES · lucasoviedodev@gmail.com
          </Typography>
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
            backgroundColor: "#050915",
            border: "1px solid rgba(255,255,255,0.1)",
            borderLeft: "none",
            borderRadius: "0 10px 10px 0",
            boxShadow: 1,
          }}
        >
          <IconButton size="small" onClick={() => setOpen(true)} aria-label="Mostrar menú" sx={{ color: "#fff" }}>
            <ChevronRightIcon />
          </IconButton>
        </Box>
      )}

      <Box
        component="main"
        className="app-main"
        sx={{
          flexGrow: 1,
          minHeight: "100vh",
          backgroundColor: "#f1f3f9",
          transition: "margin 0.3s ease",
          ml: { lg: open ? 0 : "72px" },
          pt: 10,
          px: { xs: 2, md: 4 },
          pb: 4,
        }}
      >
        <Toolbar sx={{ minHeight: 64 }} />
        <Box
          key={current}
          sx={{
            minHeight: "70vh",
            borderRadius: 4,
            backgroundColor: "#ffffff",
            border: "1px solid #e2e8f0",
            boxShadow: "0 25px 60px rgba(15,23,42,0.08)",
            p: { xs: 2, md: 4 },
          }}
        >
          {children}
        </Box>
      </Box>
    </Box>
  );
}
