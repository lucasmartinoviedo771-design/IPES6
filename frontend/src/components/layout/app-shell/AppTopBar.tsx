import React from "react";
import { Link, useNavigate } from "react-router-dom";
import AppBar from "@mui/material/AppBar";
import Badge from "@mui/material/Badge";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import FormControl from "@mui/material/FormControl";
import IconButton from "@mui/material/IconButton";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import Toolbar from "@mui/material/Toolbar";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import MenuIcon from "@mui/icons-material/Menu";
import HelpOutlineIcon from "@mui/icons-material/HelpOutline";
import LogoutIcon from "@mui/icons-material/Logout";
import MailOutlineIcon from "@mui/icons-material/MailOutline";
import SchoolIcon from "@mui/icons-material/School";
import { hasAnyRole } from "@/utils/roles";
import {
  INSTITUTIONAL_TERRACOTTA,
  INSTITUTIONAL_TERRACOTTA_DARK,
} from "@/styles/institutionalColors";
import ipesLogoFull from "@/assets/ipes-logo.png";
import { roleLabels, drawerWidth, collapsedDrawerWidth } from "./constants";

interface RoleOption {
  value: string;
  label: string;
}

interface AppTopBarProps {
  open: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  user: any;
  roleOverride: string | null;
  roleOptions: RoleOption[];
  showRoleSwitcher: boolean;
  canUseMessages: boolean;
  unreadMessages: number;
  badgeColor: "default" | "error" | "warning" | "primary";
  onToggleSidebar: () => void;
  onGuideOpen: () => void;
  onRoleChange: (value: string | null) => void;
  onLogout: () => void;
}

export const AppTopBar: React.FC<AppTopBarProps> = ({
  open,
  user,
  roleOverride,
  roleOptions,
  showRoleSwitcher,
  canUseMessages,
  unreadMessages,
  badgeColor,
  onToggleSidebar,
  onGuideOpen,
  onRoleChange,
  onLogout,
}) => {
  const navigate = useNavigate();

  return (
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
      <Toolbar sx={{ gap: { xs: 1, sm: 2 }, minHeight: 64 }}>
        <IconButton
          edge="start"
          onClick={onToggleSidebar}
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
        <Box sx={{ flexGrow: 1, display: "flex", alignItems: "center", gap: { xs: 1, sm: 3 } }}>
          <Box
            component="img"
            src={ipesLogoFull}
            alt="IPES"
            sx={{ height: { xs: 32, sm: 48, md: 64 }, objectFit: "contain" }}
          />
          {/* Versión Escritorio */}
          <Button
            component="a"
            href="https://ipespaulofreire.edu.ar/campus/my/"
            target="_blank"
            rel="noopener noreferrer"
            variant="outlined"
            startIcon={<SchoolIcon fontSize="small" />}
            sx={{
              display: { xs: "none", md: "inline-flex" },
              textTransform: "none",
              fontWeight: 600,
              color: INSTITUTIONAL_TERRACOTTA,
              borderColor: INSTITUTIONAL_TERRACOTTA,
              borderRadius: 10,
              px: 2,
              py: 0.5,
              "&:hover": {
                borderColor: INSTITUTIONAL_TERRACOTTA_DARK,
                backgroundColor: "rgba(183, 105, 78, 0.08)",
                color: INSTITUTIONAL_TERRACOTTA_DARK,
              },
            }}
          >
            Ir al Campus Virtual
          </Button>

          {/* Versión Móvil */}
          <Tooltip title="Ir al Campus Virtual">
            <IconButton
              component="a"
              href="https://ipespaulofreire.edu.ar/campus/my/"
              target="_blank"
              rel="noopener noreferrer"
              size="small"
              sx={{
                display: { xs: "inline-flex", md: "none" },
                borderRadius: 10,
                border: `1px solid ${INSTITUTIONAL_TERRACOTTA}`,
                backgroundColor: "#ffffff",
                color: INSTITUTIONAL_TERRACOTTA,
                p: 0.75,
                "&:hover": {
                  borderColor: INSTITUTIONAL_TERRACOTTA_DARK,
                  backgroundColor: "rgba(183, 105, 78, 0.08)",
                  color: INSTITUTIONAL_TERRACOTTA_DARK,
                },
              }}
            >
              <SchoolIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: { xs: 1, sm: 2 } }}>
          <Tooltip title="Guía de Usuario">
            <IconButton
              size="small"
              onClick={onGuideOpen}
              sx={{
                display: { xs: "none", sm: "inline-flex" },
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
                minWidth: { xs: 110, sm: 180, md: 220 },
                "& .MuiInputBase-root": {
                  borderRadius: 2,
                  backgroundColor: "#f8fafc",
                  fontSize: { xs: "0.8rem", sm: "0.875rem" },
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
                  onRoleChange(value ? value : null);
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
          <Box sx={{ textAlign: "right", display: { xs: "none", md: "block" } }}>
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
                {user.roles.map((r: string) => roleLabels[r.toLowerCase()] || r.toUpperCase()).join(" • ")}
              </Typography>
            )}
          </Box>
          {hasAnyRole(user, ["estudiante"]) && (
            <Button
              component={Link}
              to="/estudiantes/completar-perfil"
              sx={{
                display: { xs: "none", md: "inline-flex" },
                textTransform: "none",
                fontWeight: 600,
                color: INSTITUTIONAL_TERRACOTTA,
                borderRadius: 10,
              }}
            >
              Mis Datos
            </Button>
          )}
          <Button
            component={Link}
            to="/cambiar-password"
            sx={{
              display: { xs: "none", md: "inline-flex" },
              textTransform: "none",
              fontWeight: 600,
              color: INSTITUTIONAL_TERRACOTTA,
              borderRadius: 10,
            }}
          >
            Cambiar contraseña
          </Button>
          {/* Botón Salir - Escritorio */}
          <Button
            variant="contained"
            color="primary"
            onClick={() => onLogout()}
            startIcon={<LogoutIcon fontSize="small" />}
            sx={{
              display: { xs: "none", md: "inline-flex" },
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
          {/* Botón Salir - Móvil */}
          <Tooltip title="Salir">
            <IconButton
              onClick={() => onLogout()}
              sx={{
                display: { xs: "inline-flex", md: "none" },
                borderRadius: 10,
                backgroundColor: INSTITUTIONAL_TERRACOTTA,
                color: "#ffffff",
                p: 0.75,
                "&:hover": {
                  backgroundColor: INSTITUTIONAL_TERRACOTTA_DARK,
                },
              }}
            >
              <LogoutIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      </Toolbar>
    </AppBar>
  );
};
