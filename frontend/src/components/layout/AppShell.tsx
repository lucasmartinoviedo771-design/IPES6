import { PropsWithChildren, useEffect, useMemo, useRef, useState, useLayoutEffect } from "react";
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
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Stack,
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
import HelpOutlineIcon from "@mui/icons-material/HelpOutline";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import GroupsIcon from "@mui/icons-material/Groups";
import GavelIcon from "@mui/icons-material/Gavel";
import Diversity3Icon from "@mui/icons-material/Diversity3";
import ChecklistIcon from "@mui/icons-material/Checklist";
import ArticleIcon from "@mui/icons-material/Article";
import InsightsIcon from "@mui/icons-material/Insights";
import { useAuth } from "@/context/AuthContext";
import { ErrorBoundary } from "react-error-boundary";
import { useQuery } from "@tanstack/react-query";
import { obtenerResumenMensajes } from "@/api/mensajes";
import { getDefaultHomeRoute, hasAnyRole, isOnlyStudent } from "@/utils/roles";
import UserGuideDisplay from "../guia/UserGuideDisplay";
import ErrorBoundaryFallback from "@/components/ErrorBoundaryFallback";
import BackButton from "@/components/ui/BackButton";
import ipesLogoFull from "@/assets/ipes-logo.png";
import ipesLogoDark from "@/assets/ipes-logo-dark.png";
import {
  INSTITUTIONAL_GREEN,
  INSTITUTIONAL_TERRACOTTA,
  INSTITUTIONAL_TERRACOTTA_DARK,
  SIDEBAR_GRADIENT,
} from "@/styles/institutionalColors";

const drawerWidth = 280;
const collapsedDrawerWidth = 0;
const ROLE_NAV_MAP: Record<string, string[]> = {
  admin: [
    "dashboard",
    "preinscripciones",
    "carreras",
    "reportes",
    "asistencia",
    "cursoIntro",
    "mensajes",
    "secretaria",
    "bedeles",
    "docentes",
    "tutorias",
    "equivalencias",
    "titulos",
    "coordinacion",
    "jefatura",
    "alumnos",
    "primeraCarga",
  ],
  secretaria: [
    "dashboard",
    "preinscripciones",
    "carreras",
    "reportes",
    "asistencia",
    "cursoIntro",
    "mensajes",
    "secretaria",
    "bedeles",
    "docentes",
    "tutorias",
    "equivalencias",
    "titulos",
    "coordinacion",
    "jefatura",
    "alumnos",
    "primeraCarga",
  ],
  bedel: ["bedeles", "mensajes", "alumnos", "asistencia", "cursoIntro", "primeraCarga"],
  docente: ["docentes", "mensajes"],
  tutor: ["tutorias", "mensajes", "alumnos", "equivalencias", "reportes", "cursoIntro"],
  coordinador: ["coordinacion", "mensajes", "alumnos", "reportes", "cursoIntro"],
  jefes: ["jefatura", "mensajes", "reportes"],
  jefa_aaee: ["jefatura", "mensajes", "reportes"],
  consulta: ["dashboard", "reportes", "mensajes"],
  alumno: ["alumnos", "mensajes"],
  equivalencias: ["equivalencias", "mensajes"],
  titulos: ["titulos", "mensajes"],
  curso_intro: ["cursoIntro", "mensajes"],
};

const roleLabels: Record<string, string> = {
  admin: "Administrador",
  secretaria: "Secretaría",
  bedel: "Bedelía",
  docente: "Docente",
  tutor: "Tutoría",
  coordinador: "Coordinación",
  jefes: "Jefatura",
  jefa_aaee: "Jefa A.A.E.E.",
  consulta: "Consulta",
  alumno: "Alumno/a",
  equivalencias: "Equivalencias",
  titulos: "Títulos",
  curso_intro: "Curso Intro",
};

export default function AppShell({ children }: PropsWithChildren) {
  const { user, logout, roleOverride, setRoleOverride, availableRoleOptions } = useAuth();
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
  const [hasPageBack, setHasPageBack] = useState(false);

  useLayoutEffect(() => {
    if (typeof document === "undefined") return;
    const detect = () => {
      const pageBack = document.querySelector("[data-back-button='page']");
      setHasPageBack(!!pageBack);
    };
    detect();
    const observer = new MutationObserver(() => detect());
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [current]);

  const studentOnly = isOnlyStudent(user);
  const allowedNavSet = useMemo(() => {
    if (!roleOverride) return null;
    const entries = ROLE_NAV_MAP[roleOverride];
    if (!entries || entries.length === 0) {
      return null;
    }
    return new Set(entries);
  }, [roleOverride]);
  const isNavAllowed = (key: string, defaultValue: boolean) => {
    // Si hay rol activo seleccionado, usar SOLO el allowedNavSet
    if (roleOverride) {
      return allowedNavSet ? allowedNavSet.has(key) : false;
    }
    // Si no hay rol seleccionado, usar el valor por defecto (que verifica todos los roles)
    return defaultValue;
  };
  const dashboardVisible = isNavAllowed("dashboard", hasAnyRole(user, [
    "admin",
    "secretaria",
    "bedel",
    "jefa_aaee",
    "jefes",
    "tutor",
    "coordinador",
    "consulta"
  ]));
  const canPreins = isNavAllowed("preinscripciones", hasAnyRole(user, ["admin", "secretaria", "bedel"]));
  const canSeeCarreras = isNavAllowed("carreras", hasAnyRole(user, [
    "admin",
    "secretaria",
    "bedel",
    "coordinador",
    "tutor",
    "jefes",
    "jefa_aaee"
  ]));
  const canSeeReportes = isNavAllowed("reportes", hasAnyRole(user, [
    "admin",
    "secretaria",
    "bedel",
    "jefa_aaee",
    "jefes",
    "tutor",
    "coordinador"
  ]));
  const canSecretaria = isNavAllowed("secretaria", hasAnyRole(user, [
    "admin",
    "secretaria",
    "bedel",
    "jefa_aaee",
    "jefes",
    "tutor",
    "coordinador"
  ]));
  const canBedeles = isNavAllowed("bedeles", hasAnyRole(user, [
    "admin",
    "secretaria",
    "bedel",
    "jefa_aaee",
    "jefes",
    "tutor",
    "coordinador"
  ]));
  const canDocentesPanel = isNavAllowed("docentes", hasAnyRole(user, ["docente", "secretaria", "admin", "bedel"]));
  const canTutoriasPanel = isNavAllowed("tutorias", hasAnyRole(user, ["tutor", "secretaria", "admin", "bedel"]));
  const canEquivalenciasPanel = isNavAllowed("equivalencias", hasAnyRole(user, ["equivalencias", "secretaria", "admin", "bedel"]));
  const canTitulosPanel = isNavAllowed("titulos", hasAnyRole(user, ["titulos", "secretaria", "admin"]));
  const canCoordinacionPanel = isNavAllowed("coordinacion", hasAnyRole(user, ["coordinador", "jefes", "jefa_aaee", "secretaria", "admin"]));
  const canJefaturaPanel = isNavAllowed("jefatura", hasAnyRole(user, ["jefes", "jefa_aaee", "secretaria", "admin"]));
  const canAsistenciaReportes = isNavAllowed("asistencia", hasAnyRole(user, ["admin", "secretaria", "bedel"]));
  const canCursoIntro = isNavAllowed("cursoIntro", hasAnyRole(user, ["admin", "secretaria", "bedel", "curso_intro"]));
  const canAlumnoPortal = isNavAllowed("alumnos", hasAnyRole(user, ["alumno"]));
  const canAlumnoPanel = isNavAllowed("alumnos", hasAnyRole(user, [
    "admin",
    "secretaria",
    "bedel",
    "tutor",
    "jefes",
    "jefa_aaee",
    "coordinador"
  ]));
  const canPrimeraCarga = isNavAllowed("primeraCarga", hasAnyRole(user, ["admin", "secretaria", "bedel"]));
  const roleOptions = useMemo(() => {
    const roles = Array.from(new Set(
      (user?.roles ?? [])
        .map((r) => r.toLowerCase().trim())
        .filter((r) => r.length > 0)
    ));

    // Si availableRoleOptions tiene roles que no están en user.roles (ej: mocks o agregados), los incluimos
    const existingValues = new Set(roles);
    availableRoleOptions.forEach(opt => {
      if (!existingValues.has(opt.value.toLowerCase())) {
        roles.push(opt.value.toLowerCase());
      }
    });

    return roles.map(r => ({
      value: r,
      label: roleLabels[r] || r.toUpperCase()
    })).sort((a, b) => a.label.localeCompare(b.label));
  }, [user, availableRoleOptions]);

  const showRoleSwitcher = roleOptions.length > 1;
  const roleHomeMap: Record<string, string> = {
    admin: "/dashboard",
    secretaria: "/secretaria",
    bedel: "/bedeles",
    docente: "/docentes",
    tutor: "/tutorias",
    coordinador: "/coordinacion",
    jefes: "/jefatura",
    jefa_aaee: "/jefatura",
    consulta: "/dashboard",
    alumno: "/alumnos",
    equivalencias: "/equivalencias",
    titulos: "/titulos",
    curso_intro: "/secretaria/curso-introductorio",
  };
  const previousRoleRef = useRef<string | null>(roleOverride);
  useEffect(() => {
    if (!user) return;
    if (previousRoleRef.current === roleOverride) return;
    previousRoleRef.current = roleOverride;
    if (roleOverride) {
      const destination = roleHomeMap[roleOverride] ?? "/dashboard";
      navigate(destination, { replace: true });
    } else {
      navigate(getDefaultHomeRoute(user), { replace: true });
    }
  }, [roleOverride, user, navigate]);
  // Auto-select first role if user has multiple roles but none selected
  useEffect(() => {
    if (!user) return;
    if (roleOverride) return; // Already has a role selected
    if (availableRoleOptions.length > 1) {
      // User has multiple roles, auto-select the first one
      setRoleOverride(availableRoleOptions[0].value);
    }
  }, [user, roleOverride, availableRoleOptions, setRoleOverride]);


  const canUseMessages = isNavAllowed("mensajes", !!user);


  const { data: messageSummary } = useQuery({
    queryKey: ["mensajes", "resumen"],
    queryFn: obtenerResumenMensajes,
    enabled: canUseMessages,
    refetchInterval: 60_000,
    staleTime: 60_000,
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
      backgroundColor: "rgba(183,105,78,0.35)",
      boxShadow: "0 15px 35px rgba(125,127,110,0.45)",
    },
    "&:hover": {
      backgroundColor: "rgba(125,127,110,0.25)",
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
          ml: { lg: open ? `${drawerWidth}px` : `${collapsedDrawerWidth}px` },
          width: {
            lg: open
              ? `calc(100% - ${drawerWidth}px)`
              : `calc(100% - ${collapsedDrawerWidth}px)`,
          },
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
              src={ipesLogoFull}
              alt="IPES"
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
            {showRoleSwitcher && (
              <FormControl
                size="small"
                variant="outlined"
                sx={{
                  minWidth: 220,
                  "& .MuiInputBase-root": {
                    borderRadius: 2,
                    backgroundColor: "#f8fafc",
                  },
                }}
              >
                <InputLabel id="role-switcher-label">Rol activo</InputLabel>
                <Select
                  labelId="role-switcher-label"
                  label="Rol activo"
                  value={roleOverride ?? ""}
                  onChange={(event) => {
                    const value = event.target.value as string;
                    setRoleOverride(value ? value : null);
                  }}
                >
                  <MenuItem value="">
                    <em>Rol automático (Todos)</em>
                  </MenuItem>
                  {roleOptions.map((option) => (
                    <MenuItem key={option.value} value={option.value}>
                      {option.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}
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
              {user?.roles && user.roles.length > 0 && (
                <Typography
                  variant="caption"
                  sx={{
                    color: INSTITUTIONAL_TERRACOTTA,
                    display: "block",
                    fontWeight: 700,
                    fontSize: "0.65rem",
                    textTransform: "uppercase"
                  }}
                >
                  {user.roles.map(r => roleLabels[r.toLowerCase()] || r.toUpperCase()).join(" • ")}
                </Typography>
              )}
            </Box>
            <Button
              component={Link}
              to="/cambiar-password"
              sx={{
                textTransform: "none",
                fontWeight: 600,
                color: INSTITUTIONAL_TERRACOTTA,
                borderRadius: 10,
              }}
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
                fontWeight: 600,
                borderRadius: 10,
                px: 3,
                backgroundColor: INSTITUTIONAL_TERRACOTTA,
                "&:hover": { backgroundColor: INSTITUTIONAL_TERRACOTTA_DARK },
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
          width: open ? drawerWidth : collapsedDrawerWidth,
          flexShrink: 0,
          [`& .MuiDrawer-paper`]: {
            width: drawerWidth,
            boxSizing: "border-box",
            background: SIDEBAR_GRADIENT,
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
                sx={{ height: 45, objectFit: "contain" }}
              />
            </Box>
            <Typography variant="caption" sx={{ textTransform: "uppercase", letterSpacing: 3, color: "rgba(255,255,255,0.6)", display: "none" }}>
              Gestión educativa
            </Typography>
            <Box sx={{ width: 56, height: 4, borderRadius: 10, backgroundColor: INSTITUTIONAL_TERRACOTTA, display: "none" }} />
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

          {canCursoIntro && (
            <ListItemButton
              selected={current.startsWith("/secretaria/curso-introductorio")}
              onClick={() => navigate("/secretaria/curso-introductorio")}
              sx={navButtonSx}
            >
              <ListItemIcon><AssignmentIcon fontSize="small" /></ListItemIcon>
              <ListItemText primary="Curso introductorio" primaryTypographyProps={{ sx: { color: "#fff" } }} />
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
          {canBedeles && (
            <ListItemButton
              selected={current.startsWith("/bedeles")}
              onClick={() => navigate("/bedeles")}
              sx={navButtonSx}
            >
              <ListItemIcon><GroupsIcon fontSize="small" /></ListItemIcon>
              <ListItemText primary="Bedeles" primaryTypographyProps={{ sx: { color: "#fff" } }} />
            </ListItemButton>
          )}
          {canDocentesPanel && (
            <ListItemButton
              selected={current.startsWith("/docentes")}
              onClick={() => navigate("/docentes")}
              sx={navButtonSx}
            >
              <ListItemIcon><GavelIcon fontSize="small" /></ListItemIcon>
              <ListItemText primary="Docentes" primaryTypographyProps={{ sx: { color: "#fff" } }} />
            </ListItemButton>
          )}
          {canTutoriasPanel && (
            <ListItemButton
              selected={current.startsWith("/tutorias")}
              onClick={() => navigate("/tutorias")}
              sx={navButtonSx}
            >
              <ListItemIcon><Diversity3Icon fontSize="small" /></ListItemIcon>
              <ListItemText primary="Tutorías" primaryTypographyProps={{ sx: { color: "#fff" } }} />
            </ListItemButton>
          )}
          {canEquivalenciasPanel && (
            <ListItemButton
              selected={current.startsWith("/equivalencias")}
              onClick={() => navigate("/equivalencias")}
              sx={navButtonSx}
            >
              <ListItemIcon><ChecklistIcon fontSize="small" /></ListItemIcon>
              <ListItemText primary="Equivalencias" primaryTypographyProps={{ sx: { color: "#fff" } }} />
            </ListItemButton>
          )}
          {canTitulosPanel && (
            <ListItemButton
              selected={current.startsWith("/titulos")}
              onClick={() => navigate("/titulos")}
              sx={navButtonSx}
            >
              <ListItemIcon><ArticleIcon fontSize="small" /></ListItemIcon>
              <ListItemText primary="Títulos" primaryTypographyProps={{ sx: { color: "#fff" } }} />
            </ListItemButton>
          )}
          {canCoordinacionPanel && (
            <ListItemButton
              selected={current.startsWith("/coordinacion")}
              onClick={() => navigate("/coordinacion")}
              sx={navButtonSx}
            >
              <ListItemIcon><InsightsIcon fontSize="small" /></ListItemIcon>
              <ListItemText primary="Coordinación" primaryTypographyProps={{ sx: { color: "#fff" } }} />
            </ListItemButton>
          )}
          {canJefaturaPanel && (
            <ListItemButton
              selected={current.startsWith("/jefatura")}
              onClick={() => navigate("/jefatura")}
              sx={navButtonSx}
            >
              <ListItemIcon><InsightsIcon fontSize="small" /></ListItemIcon>
              <ListItemText primary="Jefatura" primaryTypographyProps={{ sx: { color: "#fff" } }} />
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
            IPES · Sistema de Gestión
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
            backgroundColor: INSTITUTIONAL_GREEN,
            border: "1px solid rgba(255,255,255,0.15)",
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
          pt: 1,
          px: { xs: 2, md: 4 },
          pb: 1,
        }}
      >
        <Toolbar sx={{ minHeight: 64 }} />
        <ErrorBoundary FallbackComponent={ErrorBoundaryFallback} resetKeys={[current]}>
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
            <Stack spacing={{ xs: 2, md: 3 }}>
              {!hasPageBack && (
                <BackButton
                  scope="global"
                  fallbackPath={user ? getDefaultHomeRoute(user) : "/"}
                  sx={{ mb: 0 }}
                />
              )}
              {children}
            </Stack>
          </Box>
        </ErrorBoundary>
      </Box>
    </Box>
  );
}
