import React from "react";
import { useAuth } from "@/context/AuthContext";
import { useNavigate } from "react-router-dom";
import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import SchoolIcon from "@mui/icons-material/School";
import AssignmentIndIcon from "@mui/icons-material/AssignmentInd";
import AdminPanelSettingsIcon from "@mui/icons-material/AdminPanelSettings";
import SupervisorAccountIcon from "@mui/icons-material/SupervisorAccount";
import { PageHero } from "@/components/ui/GradientTitles";
import { getDefaultHomeRoute } from "@/utils/roles";

// Configuración visual premium para cada tarjeta de rol
const ROLE_VISUAL_CONFIG: Record<
  string,
  { title: string; subtitle: string; icon: React.ReactNode; color: string; gradient: string }
> = {
  estudiante: {
    title: "Estudiante",
    subtitle: "Accedé a tus inscripciones, asistencias y trayectoria académica.",
    icon: <SchoolIcon sx={{ fontSize: 48 }} />,
    color: "#B7694E",
    gradient: "linear-gradient(135deg, #e59866, #b7694e)",
  },
  docente: {
    title: "Docente",
    subtitle: "Gestioná tus planillas de regularidad, actas finales y presentismo.",
    icon: <AssignmentIndIcon sx={{ fontSize: 48 }} />,
    color: "#2E5E4E",
    gradient: "linear-gradient(135deg, #4d8c75, #2e5e4e)",
  },
  admin: {
    title: "Administrador",
    subtitle: "Consola de administración global del sistema de gestión.",
    icon: <AdminPanelSettingsIcon sx={{ fontSize: 48 }} />,
    color: "#2C3E50",
    gradient: "linear-gradient(135deg, #34495e, #2c3e50)",
  },
  bedel: {
    title: "Bedelía",
    subtitle: "Gestión operativa, inscripciones y control general.",
    icon: <SupervisorAccountIcon sx={{ fontSize: 48 }} />,
    color: "#7D7F6E",
    gradient: "linear-gradient(135deg, #a2a495, #7d7f6e)",
  },
};

export default function RoleSelectorPage() {
  const { user, setActiveRole, refreshProfile } = useAuth();
  const navigate = useNavigate();

  // Filtrar solo los roles relevantes que el usuario posee
  const userRoles = React.useMemo(() => {
    if (!user) return [];
    // Mapeamos los roles reales a nuestro config o creamos fallback
    const rawRoles = user.roles ?? [];
    const unique = new Set<string>();
    
    rawRoles.forEach((r) => {
      const normalized = r.toLowerCase().trim();
      if (normalized === "estudiantes") unique.add("estudiante");
      else if (normalized === "docentes") unique.add("docente");
      else if (normalized.startsWith("bedel")) unique.add("bedel");
      else if (normalized.startsWith("secretaria")) unique.add("secretaria");
      else unique.add(normalized);
    });

    if (user.is_superuser) {
      unique.add("admin");
    }

    return Array.from(unique);
  }, [user]);

  const handleSelectRole = async (role: string) => {
    setActiveRole(role);
    try {
      // Forzar recarga de perfil para que el backend filtre capacidades según el rol activo
      const updatedUser = await refreshProfile();
      if (updatedUser) {
        // Redirigir a la landing de ese rol específico
        const homeRoute = getDefaultHomeRoute(updatedUser);
        navigate(homeRoute, { replace: true });
      }
    } catch {
      // Fallback redirect
      navigate("/login", { replace: true });
    }
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        backgroundColor: "#070d1f",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        py: 8,
        px: 2,
      }}
    >
      <Stack spacing={4} sx={{ width: "100%", maxWidth: 800 }} alignItems="center">
        <PageHero
          title="Seleccioná tu rol"
          subtitle="Tenés múltiples accesos habilitados. ¿Con cuál deseas ingresar hoy?"
          sx={{
            width: "100%",
            textAlign: "center",
            background: "linear-gradient(135deg, rgba(125,127,110,0.95), rgba(183,105,78,0.95))",
            color: "#fff",
            borderRadius: 4,
            p: 4,
          }}
        />

        <Grid container spacing={3} justifyContent="center" sx={{ mt: 2 }}>
          {userRoles.map((role) => {
            const config = ROLE_VISUAL_CONFIG[role] || {
              title: role.toUpperCase(),
              subtitle: "Acceso institucional general",
              icon: <SchoolIcon sx={{ fontSize: 48 }} />,
              color: "#7D7F6E",
              gradient: "linear-gradient(135deg, #a2a495, #7d7f6e)",
            };

            return (
              <Grid item xs={12} sm={6} key={role}>
                <Card
                  onClick={() => handleSelectRole(role)}
                  sx={{
                    cursor: "pointer",
                    height: "100%",
                    minHeight: 180,
                    borderRadius: 4,
                    border: "1px solid rgba(255, 255, 255, 0.1)",
                    background: "rgba(19, 25, 48, 0.85)",
                    backdropFilter: "blur(20px)",
                    transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                    color: "#fff",
                    position: "relative",
                    overflow: "hidden",
                    "&:hover": {
                      transform: "translateY(-6px)",
                      boxShadow: "0 12px 30px rgba(0, 0, 0, 0.4)",
                      borderColor: config.color,
                      "& .icon-wrapper": {
                        background: config.gradient,
                        transform: "scale(1.1)",
                      },
                    },
                  }}
                >
                  <CardContent sx={{ p: 4, height: "100%", display: "flex", flexDirection: "column" }}>
                    <Stack direction="row" spacing={3} alignItems="flex-start" sx={{ flexGrow: 1 }}>
                      <Box
                        className="icon-wrapper"
                        sx={{
                          p: 2,
                          borderRadius: 3,
                          background: "rgba(255,255,255,0.06)",
                          color: "#fff",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          transition: "all 0.3s ease",
                        }}
                      >
                        {config.icon}
                      </Box>
                      <Stack spacing={1} sx={{ pt: 0.5 }}>
                        <Typography variant="h5" fontWeight="bold">
                          {config.title}
                        </Typography>
                        <Typography variant="body2" sx={{ color: "rgba(255, 255, 255, 0.65)", lineHeight: 1.5 }}>
                          {config.subtitle}
                        </Typography>
                      </Stack>
                    </Stack>
                  </CardContent>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      </Stack>
    </Box>
  );
}
