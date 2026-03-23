import React from "react";
import { useNavigate } from "react-router-dom";
import Badge from "@mui/material/Badge";
import Box from "@mui/material/Box";
import Divider from "@mui/material/Divider";
import Drawer from "@mui/material/Drawer";
import IconButton from "@mui/material/IconButton";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Typography from "@mui/material/Typography";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import DashboardIcon from "@mui/icons-material/Dashboard";
import AssignmentIcon from "@mui/icons-material/Assignment";
import SchoolIcon from "@mui/icons-material/School";
import WorkspacesIcon from "@mui/icons-material/Workspaces";
import BarChartIcon from "@mui/icons-material/BarChart";
import SettingsIcon from "@mui/icons-material/Settings";
import FactCheckIcon from "@mui/icons-material/FactCheck";
import MailOutlineIcon from "@mui/icons-material/MailOutline";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import GroupsIcon from "@mui/icons-material/Groups";
import GavelIcon from "@mui/icons-material/Gavel";
import Diversity3Icon from "@mui/icons-material/Diversity3";
import ChecklistIcon from "@mui/icons-material/Checklist";
import ArticleIcon from "@mui/icons-material/Article";
import InsightsIcon from "@mui/icons-material/Insights";
import { hasAnyRole } from "@/utils/roles";
import { INSTITUTIONAL_GREEN, SIDEBAR_GRADIENT, INSTITUTIONAL_TERRACOTTA } from "@/styles/institutionalColors";
import ipesLogoDark from "@/assets/ipes-logo-dark.png";
import { drawerWidth, navButtonSx } from "./constants";

interface AppSidebarProps {
  open: boolean;
  current: string;
  user: any;
  canUseMessages: boolean;
  unreadMessages: number;
  badgeColor: "default" | "error" | "warning" | "primary";
  studentOnly: boolean;
  dashboardVisible: boolean;
  canPreins: boolean;
  canSeeCarreras: boolean;
  canSeeReportes: boolean;
  canSecretaria: boolean;
  canBedeles: boolean;
  canDocentesPanel: boolean;
  canTutoriasPanel: boolean;
  canEquivalenciasPanel: boolean;
  canTitulosPanel: boolean;
  canCoordinacionPanel: boolean;
  canJefaturaPanel: boolean;
  canAsistenciaReportes: boolean;
  canCursoIntro: boolean;
  canEstudiantePortal: boolean;
  canEstudiantePanel: boolean;
  canPrimeraCarga: boolean;
  onClose: () => void;
  onOpen: () => void;
}

export const AppSidebar: React.FC<AppSidebarProps> = ({
  open,
  current,
  user,
  canUseMessages,
  unreadMessages,
  badgeColor,
  studentOnly,
  dashboardVisible,
  canPreins,
  canSeeCarreras,
  canSeeReportes,
  canSecretaria,
  canBedeles,
  canDocentesPanel,
  canTutoriasPanel,
  canEquivalenciasPanel,
  canTitulosPanel,
  canCoordinacionPanel,
  canJefaturaPanel,
  canAsistenciaReportes,
  canCursoIntro,
  canEstudiantePortal,
  canEstudiantePanel,
  canPrimeraCarga,
  onClose,
  onOpen,
}) => {
  const navigate = useNavigate();

  return (
    <>
      <Drawer
        variant="permanent"
        open={open}
        sx={{
          width: open ? drawerWidth : 0,
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
          <IconButton size="small" onClick={onClose} aria-label="Ocultar menú" sx={{ color: "#fff" }}>
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

          {(canEstudiantePortal || canEstudiantePanel) && (
            <ListItemButton
              selected={current.startsWith("/estudiantes")}
              onClick={() => navigate("/estudiantes")}
              sx={navButtonSx}
            >
              <ListItemIcon><SchoolIcon fontSize="small" /></ListItemIcon>
              <ListItemText primary="Estudiantes" primaryTypographyProps={{ sx: { color: "#fff" } }} />
            </ListItemButton>
          )}

          {canPrimeraCarga && (
            <ListItemButton
              selected={current.startsWith("/admin/primera-carga")}
              onClick={() => navigate("/admin/primera-carga")}
              sx={navButtonSx}
            >
              <ListItemIcon><UploadFileIcon fontSize="small" /></ListItemIcon>
              <ListItemText primary="Primera carga" primaryTypographyProps={{ sx: { color: "#fff" } }} />
            </ListItemButton>
          )}

          {hasAnyRole(user, ["admin"]) && (
            <ListItemButton
              selected={current.startsWith("/system/logs")}
              onClick={() => navigate("/system/logs")}
              sx={navButtonSx}
            >
              <ListItemIcon><FactCheckIcon fontSize="small" /></ListItemIcon>
              <ListItemText primary="Alertas de Sistema" primaryTypographyProps={{ sx: { color: "#fff" } }} />
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
          <IconButton size="small" onClick={onOpen} aria-label="Mostrar menú" sx={{ color: "#fff" }}>
            <ChevronRightIcon />
          </IconButton>
        </Box>
      )}
    </>
  );
};
