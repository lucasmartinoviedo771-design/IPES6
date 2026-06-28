import React from "react";
import { useAuth } from "@/context/AuthContext";
import { useNavigate } from "react-router-dom";
import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import Card from "@mui/material/Card";
import Button from "@mui/material/Button";
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
  bedel_secretaria: {
    title: "Bedelía de Secretaría",
    subtitle: "Acceso global de consulta, preinscripciones, actas y legajos.",
    icon: <SupervisorAccountIcon sx={{ fontSize: 48 }} />,
    color: "#4d8c75",
    gradient: "linear-gradient(135deg, #7d7f6e, #4d8c75)",
  },
  secretaria: {
    title: "Secretaría",
    subtitle: "Gestión administrativa global del instituto.",
    icon: <AdminPanelSettingsIcon sx={{ fontSize: 48 }} />,
    color: "#2C3E50",
    gradient: "linear-gradient(135deg, #34495e, #2c3e50)",
  },
  titulos: {
    title: "Títulos",
    subtitle: "Gestión de títulos, analíticos y certificaciones.",
    icon: <SchoolIcon sx={{ fontSize: 48 }} />,
    color: "#2E5E4E",
    gradient: "linear-gradient(135deg, #4d8c75, #2e5e4e)",
  },
  equivalencias: {
    title: "Equivalencias",
    subtitle: "Control y resolución de equivalencias de materias.",
    icon: <AssignmentIndIcon sx={{ fontSize: 48 }} />,
    color: "#7D7F6E",
    gradient: "linear-gradient(135deg, #a2a495, #7d7f6e)",
  },
  coordinador: {
    title: "Coordinación",
    subtitle: "Coordinación de carreras y seguimiento académico.",
    icon: <SupervisorAccountIcon sx={{ fontSize: 48 }} />,
    color: "#B7694E",
    gradient: "linear-gradient(135deg, #e59866, #b7694e)",
  },
  tutor: {
    title: "Tutorías",
    subtitle: "Acompañamiento y tutorías estudiantiles.",
    icon: <SupervisorAccountIcon sx={{ fontSize: 48 }} />,
    color: "#2E5E4E",
    gradient: "linear-gradient(135deg, #4d8c75, #2e5e4e)",
  },
  jefes: {
    title: "Jefatura",
    subtitle: "Jefatura de departamento y área académica.",
    icon: <AdminPanelSettingsIcon sx={{ fontSize: 48 }} />,
    color: "#2C3E50",
    gradient: "linear-gradient(135deg, #34495e, #2c3e50)",
  },
  jefa_aaee: {
    title: "Jefa A.A.E.E.",
    subtitle: "Jefatura de alumnos y asuntos estudiantiles.",
    icon: <AdminPanelSettingsIcon sx={{ fontSize: 48 }} />,
    color: "#2C3E50",
    gradient: "linear-gradient(135deg, #34495e, #2c3e50)",
  },
  curso_intro: {
    title: "Curso Introductorio",
    subtitle: "Coordinación y gestión del curso de ingreso.",
    icon: <SchoolIcon sx={{ fontSize: 48 }} />,
    color: "#7D7F6E",
    gradient: "linear-gradient(135deg, #a2a495, #7d7f6e)",
  },
  attp: {
    title: "A.T.T.P.",
    subtitle: "Asistencia técnica pedagógica y soporte de aulas.",
    icon: <AssignmentIndIcon sx={{ fontSize: 48 }} />,
    color: "#B7694E",
    gradient: "linear-gradient(135deg, #e59866, #b7694e)",
  },
  rectorado: {
    title: "Rectorado",
    subtitle: "Supervisión institucional y reportes globales.",
    icon: <AdminPanelSettingsIcon sx={{ fontSize: 48 }} />,
    color: "#2C3E50",
    gradient: "linear-gradient(135deg, #34495e, #2c3e50)",
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
      else if (normalized === "bedel_secretaria") unique.add("bedel_secretaria");
      else if (normalized.startsWith("bedel")) unique.add("bedel");
      else if (normalized.startsWith("secretaria")) unique.add("secretaria");
      else unique.add(normalized);
    });

    const assignments = user.role_assignments ?? [];
    assignments.forEach((asg) => {
      const normalized = asg.role.toLowerCase().trim();
      if (normalized === "estudiantes") unique.add("estudiante");
      else if (normalized === "docentes") unique.add("docente");
      else if (normalized === "bedel_secretaria") unique.add("bedel_secretaria");
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

            const assignments = user?.role_assignments?.filter((a) => {
              const r = a.role.toLowerCase().trim();
              const target = role.toLowerCase().trim();
              if (target === "estudiante") return r === "estudiante";
              if (target === "bedel") return r.startsWith("bedel") && r !== "bedel_secretaria";
              if (target === "coordinador") return r.startsWith("coordinador");
              if (target === "tutor") return r.startsWith("tutor");
              return r === target;
            }) || [];

            const isGranular = assignments.length > 0;

            return (
              <Grid item xs={12} sm={6} key={role}>
                <Card
                  onClick={isGranular ? undefined : () => handleSelectRole(role)}
                  sx={{
                    cursor: isGranular ? "default" : "pointer",
                    height: "100%",
                    minHeight: 180,
                    borderRadius: 4,
                    border: "1px solid rgba(255, 255, 255, 0.1)",
                    background: "rgba(19, 25, 48, 0.85)",
                    backdropFilter: "blur(20px)",
                    transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                    color: "#ffffff",
                    position: "relative",
                    overflow: "hidden",
                    ...(!isGranular && {
                      "&:hover": {
                        transform: "translateY(-6px)",
                        boxShadow: "0 12px 30px rgba(0, 0, 0, 0.4)",
                        borderColor: config.color,
                        "& .icon-wrapper": {
                          background: config.gradient,
                          transform: "scale(1.1)",
                        },
                      },
                    }),
                  }}
                >
                  <CardContent sx={{ p: 4, height: "100%", display: "flex", flexDirection: "column" }}>
                    <Stack direction="row" spacing={3} alignItems="flex-start" sx={{ flexGrow: 1 }}>
                      <Box
                        className="icon-wrapper"
                        sx={{
                          p: 2,
                          borderRadius: 3,
                          background: config.gradient,
                          color: "#ffffff",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          transition: "all 0.3s ease",
                        }}
                      >
                        {config.icon}
                      </Box>
                      <Stack spacing={1} sx={{ pt: 0.5, width: "100%" }}>
                        <Typography variant="h5" fontWeight="bold" sx={{ color: "#ffffff" }}>
                          {config.title}
                        </Typography>
                        <Typography variant="body2" sx={{ color: "rgba(255, 255, 255, 0.85)", lineHeight: 1.5 }}>
                          {config.subtitle}
                        </Typography>
                        {isGranular && (
                          <Box sx={{ mt: 1.5, pt: 1.5, borderTop: "1px solid rgba(255, 255, 255, 0.1)", width: "100%" }}>
                            <Typography variant="caption" sx={{ color: "#ffffff", textTransform: "uppercase", letterSpacing: 1, fontWeight: "bold", display: "block", mb: 1.5 }}>
                              Seleccioná Profesorado:
                            </Typography>
                            <Stack spacing={1} sx={{ width: "100%" }}>
                              {assignments.map((asg, idx) => (
                                <Button
                                  key={idx}
                                  variant="outlined"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleSelectRole(`${role}:${asg.profesorado_id}`);
                                  }}
                                  sx={{
                                    textTransform: "none",
                                    justifyContent: "flex-start",
                                    textAlign: "left",
                                    borderColor: "rgba(255, 255, 255, 0.3)",
                                    color: "#ffffff",
                                    py: 1,
                                    px: 2,
                                    width: "100%",
                                    borderRadius: 2,
                                    background: "rgba(255, 255, 255, 0.05)",
                                    "&:hover": {
                                      borderColor: "#ffffff",
                                      background: "rgba(255, 255, 255, 0.15)",
                                    },
                                  }}
                                >
                                  <Typography variant="body2" sx={{ fontWeight: 600, color: "#ffffff" }}>
                                    {asg.profesorado_nombre} {asg.turno ? `(${asg.turno})` : ""}
                                  </Typography>
                                </Button>
                              ))}
                            </Stack>
                          </Box>
                        )}
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
