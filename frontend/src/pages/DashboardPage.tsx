import { useCallback, useEffect, useState } from "react";
import {
  Box,
  Grid,
  Paper,
  Stack,
  Typography,
  Button,
  Chip,
  List,
  ListItem,
  ListItemText,
  Divider,
  LinearProgress,
} from "@mui/material";
import { useNavigate } from "react-router-dom";
import AddIcon from "@mui/icons-material/Add";
import ScheduleIcon from "@mui/icons-material/Schedule";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CancelIcon from "@mui/icons-material/Cancel";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import PeopleIcon from "@mui/icons-material/People";
import MenuBookIcon from "@mui/icons-material/MenuBook";
import BarChartIcon from "@mui/icons-material/BarChart";
import dayjs from "dayjs";
import { useAuth } from "@/context/AuthContext";
import { SxProps, Theme } from "@mui/material/styles";
import { listarPreinscripciones, PreinscripcionDTO } from "@/api/preinscripciones";
import {
  ICON_GRADIENT,
  INSTITUTIONAL_GREEN,
  INSTITUTIONAL_TERRACOTTA,
  INSTITUTIONAL_TERRACOTTA_DARK,
} from "@/styles/institutionalColors";
import { useQuery } from "@tanstack/react-query";
import { getCorrelativasCaidas } from "@/api/reportes";
import AdminCorrelativasWidget from "@/components/dashboard/AdminCorrelativasWidget";
import StudentAlerts from "@/components/dashboard/StudentAlerts";

type QuickAction = {
  title: string;
  description: string;
  icon: React.ReactNode;
  onClick: () => void;
  variant?: "contained" | "outlined";
  roles?: string[];
};

const TERRACOTTA = INSTITUTIONAL_TERRACOTTA;
const TERRACOTTA_DARK = INSTITUTIONAL_TERRACOTTA_DARK;
const OLIVE = INSTITUTIONAL_GREEN;
const OLIVE_TINT = "rgba(125,127,110,0.25)";
const TERRACOTTA_TINT = "rgba(183,105,78,0.15)";
const STAT_PURPLE_GRADIENT = "linear-gradient(135deg,#7c3aed,#a855f7)";
const STAT_GREEN_GRADIENT = "linear-gradient(135deg,#22c55e,#4ade80)";
const STAT_AMBER_GRADIENT = "linear-gradient(135deg,#f59e0b,#f97316)";
const STAT_PINK_GRADIENT = "linear-gradient(135deg,#fb7185,#f43f5e)";

const CardBox = ({ children, sx = {} }: { children: React.ReactNode; sx?: SxProps<Theme> }) => (
  <Paper
    elevation={0}
    sx={{
      p: 3,
      borderRadius: 3,
      backgroundColor: "#ffffff",
      border: "1px solid rgba(125,127,110,0.2)",
      boxShadow: "0 18px 40px rgba(15,23,42,0.06)",
      ...sx,
    }}
  >
    {children}
  </Paper>
);

type StatCardProps = {
  title: string;
  value: number;
  subtitle?: string;
  icon: React.ReactNode;
  accent: string;
  iconBg: string;
  borderColor: string;
};

const StatCard = ({ title, value, subtitle, icon, accent, iconBg, borderColor }: StatCardProps) => (
  <Paper
    elevation={0}
    sx={{
      p: 3,
      minHeight: 150,
      borderRadius: 3,
      background: "#fff",
      border: `1px solid ${borderColor}`,
      boxShadow: "0 20px 45px rgba(15,23,42,0.06)",
      display: "flex",
      flexDirection: "column",
      gap: 1.2,
    }}
  >
    <Box
      sx={{
        width: 52,
        height: 52,
        borderRadius: 12,
        background: iconBg,
        display: "grid",
        placeItems: "center",
        color: "#fff",
        boxShadow: "0 18px 30px rgba(0,0,0,0.08)",
      }}
    >
      {icon}
    </Box>
    <Typography
      variant="caption"
      sx={{ textTransform: "uppercase", letterSpacing: 0.8, color: "#64748b", fontWeight: 600 }}
    >
      {title}
    </Typography>
    <Typography variant="h4" fontWeight={700} color="#0f172a">
      {value}
    </Typography>
    {subtitle && (
      <Typography variant="body2" color="#475569">
        {subtitle}
      </Typography>
    )}
  </Paper>
);

export default function DashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  console.log("[Dashboard] Rendering DashboardPage. User:", user);

  const [metrics, setMetrics] = useState({ total: 0, confirmadas: 0, pendientes: 0, observadas: 0, rechazadas: 0, ratio: 0 });
  const [recientes, setRecientes] = useState<PreinscripcionDTO[]>([]);

  type EstadoNormalizado = Lowercase<PreinscripcionDTO['estado']>;
  const normalizeEstado = (estado: PreinscripcionDTO['estado']) => estado.toLowerCase() as EstadoNormalizado;

  const can = useCallback((roles?: string[]) => {
    if (!roles || roles.length === 0) return true;
    if (user?.is_superuser) return true;
    const userRoles = (user?.roles || []).map((r) => r.toLowerCase().trim());
    return roles.some((role) => userRoles.includes(role.toLowerCase().trim()));
  }, [user]);

  const { data: correlativasCaidas } = useQuery({
    queryKey: ["correlativas-caidas"],
    queryFn: () => getCorrelativasCaidas(),
    enabled: can(["admin", "secretaria"]),
  });

  useEffect(() => {
    const canViewStats = can(['admin', 'secretaria', 'bedel', 'preinscripciones']);

    if (canViewStats) {
      // Cargar las preinscripciones para las métricas y la lista de recientes
      listarPreinscripciones({}).then(({ results }) => {
        const data = results ?? [];
        const total = data.length;
        const confirmadas = data.filter((p) => normalizeEstado(p.estado) === 'confirmada').length;
        const pendientes = data.filter((p) => normalizeEstado(p.estado) === 'enviada').length;
        const observadas = data.filter((p) => normalizeEstado(p.estado) === 'observada').length;
        const rechazadas = data.filter((p) => normalizeEstado(p.estado) === 'rechazada').length;
        const ratio = total > 0 ? Math.round((confirmadas / total) * 100) : 0;

        setMetrics({ total, confirmadas, pendientes, observadas, rechazadas, ratio });

        // Tomar las 3 más recientes para la lista
        // Asumiendo que la API devuelve ordenado por fecha descendente
        setRecientes(data.slice(0, 3));
      }).catch(error => {
        console.error("Error al cargar el dashboard:", error);
        // Opcional: mostrar un estado de error en la UI
      });
    }
  }, [can]);

  const rawActions: QuickAction[] = [
    { title: "Nueva preinscripción", description: "Crear una nueva preinscripción", icon: <AddIcon />, onClick: () => navigate("/preinscripcion"), variant: "contained" },
    { title: "Ver preinscripciones", description: "Gestionar inscripciones existentes", icon: <ScheduleIcon />, onClick: () => navigate("/preinscripciones"), variant: "outlined" },
    { title: "Gestión de alumnos", description: "Administrar información de alumnos", icon: <PeopleIcon />, onClick: () => navigate("/alumnos"), variant: "outlined", roles: ["secretaria", "admin"] },
    { title: "Carreras", description: "Administrar carreras y cohortes", icon: <MenuBookIcon />, onClick: () => navigate("/carreras"), variant: "outlined", roles: ["admin"] },
    { title: "Reportes", description: "Ver estadísticas y reportes", icon: <BarChartIcon />, onClick: () => navigate("/reportes"), variant: "outlined", roles: ["secretaria", "admin"] },
  ];

  const actions = rawActions.filter((a) => can(a.roles));

  const estadoChip = (estado: PreinscripcionDTO["estado"]) => {
    const map: Record<EstadoNormalizado, "default" | "success" | "warning" | "error"> = {
      confirmada: "success",
      observada: "warning",
      rechazada: "error",
      enviada: "warning",
      borrador: "default",
    };
    const intent = map[normalizeEstado(estado)] ?? "default";
    return (
      <Chip
        size="small"
        variant={intent === "default" ? "outlined" : "filled"}
        label={estado}
        color={intent}
        sx={{
          borderRadius: 999,
          fontWeight: 600,
          textTransform: "capitalize",
          ...(intent === "default"
            ? { borderColor: TERRACOTTA, color: TERRACOTTA }
            : {}),
        }}
      />
    );
  };

  const statBlocks = [
    {
      title: "Total de preinscripciones",
      value: metrics.total,
      subtitle: "Ciclo lectivo en curso",
      icon: <ScheduleIcon />,
      accent: "#4338ca",
      iconBg: STAT_PURPLE_GRADIENT,
      borderColor: "rgba(99,102,241,0.25)",
    },
    {
      title: "Confirmadas",
      value: metrics.confirmadas,
      subtitle: `${metrics.ratio}% del total`,
      icon: <CheckCircleIcon />,
      accent: "#0f9d58",
      iconBg: STAT_GREEN_GRADIENT,
      borderColor: "rgba(34,197,94,0.25)",
    },
    {
      title: "Pendientes",
      value: metrics.pendientes,
      subtitle: "Requieren revisión",
      icon: <ScheduleIcon />,
      accent: "#b45309",
      iconBg: STAT_AMBER_GRADIENT,
      borderColor: "rgba(245,158,11,0.25)",
    },
    {
      title: "Correlativas Caídas",
      value: correlativasCaidas?.length || 0,
      subtitle: "Alumnos con problemas",
      icon: <WarningAmberIcon />,
      accent: "#ef4444",
      iconBg: "linear-gradient(135deg, #ef4444, #b91c1c)",
      borderColor: "rgba(239, 68, 68, 0.25)",
    },
  ];

  return (
    <Stack spacing={3}>
      {/* Alertas para alumnos (solo se muestran si hay problemas) */}
      <StudentAlerts />

      <Box
        sx={{
          p: { xs: 3, md: 4 },
          borderRadius: 4,
          background: `linear-gradient(120deg, ${OLIVE} 0%, ${TERRACOTTA} 100%)`,
          color: "#fff",
        }}
      >
        <Stack direction={{ xs: "column", md: "row" }} spacing={3} justifyContent="space-between" alignItems={{ xs: "flex-start", md: "center" }}>
          <Box sx={{ width: "100%" }}>
            <Typography
              variant="subtitle1"
              sx={{
                fontWeight: 800,
                letterSpacing: 3,
                textTransform: "uppercase",
                color: "#fff",
              }}
            >
              Panel principal
            </Typography>
            <Typography variant="body1" sx={{ color: "rgba(255,255,255,0.85)", mt: 0.5 }}>
              Visualizá indicadores clave, accedé a las preinscripciones y mantené actualizadas las cohortes desde un único espacio.
            </Typography>
          </Box>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} alignItems="center" sx={{ width: { xs: "100%", md: "auto" } }}>
            <Button
              variant="outlined"
              onClick={() => navigate("/reportes")}
              sx={{
                borderColor: "rgba(255,255,255,0.4)",
                color: "#fff",
                textTransform: "none",
                fontWeight: 600,
                borderRadius: 999,
                px: 3,
                backgroundColor: "rgba(255,255,255,0.08)",
                "&:hover": { backgroundColor: "rgba(255,255,255,0.15)", borderColor: "rgba(255,255,255,0.6)" },
              }}
            >
              Ver reportes
            </Button>
            <Button
              variant="contained"
              onClick={() => navigate("/preinscripciones")}
              startIcon={<ScheduleIcon />}
              sx={{
                background: `linear-gradient(135deg, ${TERRACOTTA} 0%, ${TERRACOTTA_DARK} 100%)`,
                color: "#fff",
                textTransform: "none",
                fontWeight: 700,
                borderRadius: 999,
                px: 3,
                boxShadow: "0 20px 40px rgba(183,105,78,0.35)",
                "&:hover": { background: `linear-gradient(135deg, ${TERRACOTTA_DARK} 0%, ${TERRACOTTA_DARK} 100%)` },
              }}
            >
              Gestionar preinscripciones
            </Button>
          </Stack>
        </Stack>
      </Box>

      <Grid container spacing={2}>
        {statBlocks.map(stat => (
          <Grid item xs={12} md={6} lg={3} key={stat.title}>
            <StatCard {...stat} />
          </Grid>
        ))}
      </Grid>

      {/* Widget de Correlativas para Admin/Secretaría/Bedel/Tutor */}
      {can(["admin", "secretaria", "bedel", "tutor"]) && (
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <AdminCorrelativasWidget />
          </Grid>
        </Grid>
      )}

      <Grid container spacing={3}>
        <Grid item xs={12} lg={7}>
          <CardBox>
            <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
              <Box>
                <Typography variant="h6" fontWeight={700} color="#020617">
                  Accesos rápidos
                </Typography>
                <Typography variant="body2" color="#020617">
                  Atajos según tus permisos vigentes.
                </Typography>
              </Box>
              <Button
                startIcon={<AddIcon />}
                variant="contained"
                sx={{
                  textTransform: "none",
                  borderRadius: 999,
                  backgroundColor: TERRACOTTA,
                  px: 3,
                  "&:hover": { backgroundColor: TERRACOTTA_DARK },
                }}
                onClick={() => navigate("/preinscripcion")}
              >
                Nueva preinscripción
              </Button>
            </Stack>
            <Grid container spacing={1.5}>
              {actions.map(action => (
                <Grid item xs={12} sm={6} key={action.title}>
                  <Paper
                    elevation={0}
                    onClick={action.onClick}
                    sx={{
                      borderRadius: 5,
                      p: 2,
                      border: `1px solid rgba(125,127,110,0.25)`,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 1.5,
                      transition: "all .2s ease",
                      backgroundColor: "#fff",
                      "&:hover": {
                        boxShadow: "0 20px 45px rgba(15,23,42,0.08)",
                        transform: "translateY(-2px)",
                        borderColor: TERRACOTTA_TINT,
                      },
                    }}
                  >
                    <Box
                      sx={{
                        width: 44,
                        height: 44,
                        borderRadius: 5,
                        background: ICON_GRADIENT,
                        display: "grid",
                        placeItems: "center",
                        color: "#fff",
                        boxShadow: "0 12px 24px rgba(0,0,0,0.12)",
                      }}
                    >
                      {action.icon}
                    </Box>
                    <Box>
                      <Typography fontWeight={700} color="#020617">
                        {action.title}
                      </Typography>
                      <Typography variant="body2" color="#020617">
                        {action.description}
                      </Typography>
                    </Box>
                  </Paper>
                </Grid>
              ))}
            </Grid>
          </CardBox>
        </Grid>

        <Grid item xs={12} lg={5}>
          <CardBox>
            <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
              <Typography variant="h6" fontWeight={700} color="#020617">
                Preinscripciones recientes
              </Typography>
              <Button
                size="small"
                sx={{ textTransform: "none", color: TERRACOTTA, fontWeight: 600 }}
                onClick={() => navigate("/preinscripciones")}
              >
                Ver todas
              </Button>
            </Stack>
            <List dense sx={{ pt: 0 }}>
              {recientes.length === 0 && (
                <Typography variant="body2" color="#020617">
                  Aún no hay movimientos recientes.
                </Typography>
              )}
              {recientes.map(r => (
                <ListItem
                  key={r.codigo}
                  sx={{
                    px: 2,
                    mb: 1.5,
                    borderRadius: 3,
                    border: "1px solid rgba(125,127,110,0.2)",
                    cursor: "pointer",
                    backgroundColor: "#fff",
                  }}
                  secondaryAction={estadoChip(r.estado)}
                  onClick={() => navigate(`/gestion/confirmar?codigo=${encodeURIComponent(r.codigo)}`)}
                >
                  <ListItemText
                    primaryTypographyProps={{ fontWeight: 600, color: "#020617" }}
                    primary={`${r.alumno.apellido}, ${r.alumno.nombres} · ${r.carrera.nombre}`}
                    secondaryTypographyProps={{ color: "#475569" }}
                    secondary={`${r.codigo} · ${dayjs(r.fecha).format("DD/MM/YYYY")}`}
                  />
                </ListItem>
              ))}
            </List>
          </CardBox>
        </Grid>
      </Grid>

      <Grid container spacing={3}>
        <Grid item xs={12} md={4}>
          <CardBox>
            <Typography variant="subtitle2" color="#020617">
              Confirmaciones del período
            </Typography>
            <Typography variant="h4" fontWeight={700} mt={1} color="#020617">
              {metrics.confirmadas} / {metrics.total || 1}
            </Typography>
            <LinearProgress
              variant="determinate"
              value={metrics.total ? metrics.ratio : 0}
              sx={{
                mt: 2,
                height: 8,
                borderRadius: 5,
                "& .MuiLinearProgress-bar": { backgroundColor: TERRACOTTA },
                backgroundColor: TERRACOTTA_TINT,
              }}
            />
            <Typography variant="body2" color="#020617" mt={1}>
              {metrics.ratio}% de las preinscripciones ya están confirmadas.
            </Typography>
          </CardBox>
        </Grid>

        <Grid item xs={12} md={4}>
          <CardBox>
            <Typography variant="subtitle2" color="#020617">
              Estados en seguimiento
            </Typography>
            <Stack gap={1.5} mt={2}>
              <Stack direction="row" spacing={1} alignItems="center">
                <CheckCircleIcon fontSize="small" color="success" />
                <Typography variant="body2" color="#020617">
                  Confirmadas
                </Typography>
                <Chip label={metrics.confirmadas} size="small" color="success" />
              </Stack>
              <Stack direction="row" spacing={1} alignItems="center">
                <ScheduleIcon fontSize="small" color="warning" />
                <Typography variant="body2" color="#020617">
                  Pendientes
                </Typography>
                <Chip label={metrics.pendientes} size="small" color="warning" />
              </Stack>
              <Stack direction="row" spacing={1} alignItems="center">
                <WarningAmberIcon fontSize="small" color="warning" />
                <Typography variant="body2" color="#020617">
                  Observadas
                </Typography>
                <Chip label={metrics.observadas} size="small" color="warning" variant="outlined" />
              </Stack>
              <Stack direction="row" spacing={1} alignItems="center">
                <CancelIcon fontSize="small" color="error" />
                <Typography variant="body2" color="#020617">
                  Rechazadas
                </Typography>
                <Chip label={metrics.rechazadas} size="small" color="error" variant="outlined" />
              </Stack>
            </Stack>
          </CardBox>
        </Grid>

        <Grid item xs={12} md={4}>
          <CardBox>
            <Typography variant="subtitle2" color="#020617">
              Próximos pasos sugeridos
            </Typography>
            <Stack spacing={1.5} mt={2}>
              <Button
                fullWidth
                variant="outlined"
                sx={{
                  textTransform: "none",
                  borderRadius: 999,
                  borderColor: TERRACOTTA,
                  color: TERRACOTTA,
                }}
                onClick={() => navigate("/preinscripciones")}
              >
                Revisar pendientes
              </Button>
              <Button
                fullWidth
                variant="outlined"
                sx={{
                  textTransform: "none",
                  borderRadius: 999,
                  borderColor: TERRACOTTA,
                  color: TERRACOTTA,
                }}
                onClick={() => navigate("/reportes")}
              >
                Descargar reportes
              </Button>
              <Button
                fullWidth
                variant="outlined"
                sx={{
                  textTransform: "none",
                  borderRadius: 999,
                  borderColor: TERRACOTTA,
                  color: TERRACOTTA,
                }}
                onClick={() => navigate("/carreras")}
              >
                Actualizar cohortes
              </Button>
            </Stack>
          </CardBox>
        </Grid>
      </Grid>
    </Stack>
  );
}
