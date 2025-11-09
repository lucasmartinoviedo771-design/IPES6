import { useEffect, useState } from "react";
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
import { alpha, SxProps, Theme } from "@mui/material/styles";
import { listarPreinscripciones, PreinscripcionDTO } from "@/api/preinscripciones";

type QuickAction = {
  title: string;
  description: string;
  icon: React.ReactNode;
  onClick: () => void;
  variant?: "contained" | "outlined";
  roles?: string[];
};

const CardBox = ({ children, sx = {} }: { children: React.ReactNode; sx?: SxProps<Theme> }) => (
  <Paper
    elevation={0}
    sx={{
      p: 3,
      borderRadius: 4,
      backgroundColor: "#ffffff",
      border: "1px solid #e2e8f0",
      boxShadow: "0 18px 40px rgba(15,23,42,0.08)",
      ...sx,
    }}
  >
    {children}
  </Paper>
);

const StatCard = ({
  title,
  value,
  subtitle,
  icon,
  color,
}: {
  title: string;
  value: number;
  subtitle?: string;
  icon: React.ReactNode;
  color: string;
}) => (
  <Paper
    elevation={0}
    sx={{
      p: 3,
      minHeight: 150,
      borderRadius: 4,
      background: "#fff",
      border: "1px solid #e5e7eb",
      boxShadow: "0 20px 50px rgba(15,23,42,0.08)",
      display: "flex",
      flexDirection: "column",
      gap: 1.2,
    }}
  >
    <Box
      sx={{
        width: 48,
        height: 48,
        borderRadius: "16px",
        backgroundColor: color,
        display: "grid",
        placeItems: "center",
        color: "#fff",
      }}
    >
      {icon}
    </Box>
    <Typography variant="body2" sx={{ textTransform: "uppercase", letterSpacing: 0.8, color: "#0f172a" }}>
      {title}
    </Typography>
    <Typography variant="h4" fontWeight={700} color="#0f172a">
      {value}
    </Typography>
    {subtitle && (
      <Typography variant="body2" color="#0f172a">
        {subtitle}
      </Typography>
    )}
  </Paper>
);

export default function DashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [metrics, setMetrics] = useState({ total: 0, confirmadas: 0, pendientes: 0, observadas: 0, rechazadas: 0, ratio: 0 });
  const [recientes, setRecientes] = useState<PreinscripcionDTO[]>([]);

  type EstadoNormalizado = Lowercase<PreinscripcionDTO['estado']>;
  const normalizeEstado = (estado: PreinscripcionDTO['estado']) => estado.toLowerCase() as EstadoNormalizado;

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
  }, [user]);


  const can = (roles?: string[]) => {
    if (!roles || roles.length === 0) return true;
    if (user?.is_superuser) return true;
    const u = (user?.roles || []).map(r => r.toLowerCase().trim());
    return roles.some(r => u.includes(r.toLowerCase().trim()));
  };

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
        sx={{ borderRadius: 99 }}
      />
    );
  };

  const statBlocks = [
    {
      title: "Total de preinscripciones",
      value: metrics.total,
      subtitle: "Ciclo lectivo en curso",
      icon: <ScheduleIcon />,
      color: "#4f46e5",
    },
    {
      title: "Confirmadas",
      value: metrics.confirmadas,
      subtitle: `${metrics.ratio}% del total`,
      icon: <CheckCircleIcon />,
      color: "#10b981",
    },
    {
      title: "Pendientes",
      value: metrics.pendientes,
      subtitle: "Requieren revisión",
      icon: <ScheduleIcon />,
      color: "#f59e0b",
    },
    {
      title: "Observadas",
      value: metrics.observadas,
      subtitle: "Necesitan corrección",
      icon: <WarningAmberIcon />,
      color: "#f43f5e",
    },
  ];

  return (
    <Stack spacing={3}>
      <CardBox
        sx={{
          background: "#ffffff",
          color: "#0f172a",
          border: "1px solid #e2e8f0",
          boxShadow: "0 30px 70px rgba(15,23,42,0.08)",
        }}
      >
        <Stack direction={{ xs: "column", md: "row" }} spacing={3} justifyContent="space-between">
          <Box>
            <Typography variant="caption" sx={{ letterSpacing: 3, textTransform: "uppercase", color: "#020617", fontSize: "0.95rem" }}>
              Panel principal
            </Typography>
            <Typography variant="h3" fontWeight={700} mt={1} sx={{ color: "#020617" }}>
              Hola {user?.name ?? user?.dni}, seguimos gestionando IPES6.
            </Typography>
            <Typography variant="body1" sx={{ color: "#020617", mt: 1.5, fontSize: "1.05rem" }}>
              Visualizá indicadores clave, accedé a las preinscripciones y mantené actualizadas las cohortes desde un único
              espacio.
            </Typography>
          </Box>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems={{ xs: "stretch", sm: "center" }}>
            <Button
              variant="outlined"
              onClick={() => navigate("/reportes")}
              sx={{
                borderColor: "#cbd5f5",
                color: "#1e1b4b",
                textTransform: "none",
                fontWeight: 600,
                borderRadius: 999,
              }}
            >
              Ver reportes
            </Button>
            <Button
              variant="contained"
              onClick={() => navigate("/preinscripciones")}
              startIcon={<ScheduleIcon />}
              sx={{
                backgroundColor: "#2563eb",
                color: "#fff",
                textTransform: "none",
                fontWeight: 700,
                borderRadius: 999,
                px: 3,
                "&:hover": { backgroundColor: "#1d4ed8" },
              }}
            >
              Gestionar preinscripciones
            </Button>
          </Stack>
        </Stack>
      </CardBox>

      <Grid container spacing={2}>
        {statBlocks.map(stat => (
          <Grid item xs={12} md={6} lg={3} key={stat.title}>
            <StatCard {...stat} />
          </Grid>
        ))}
      </Grid>

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
                sx={{ textTransform: "none", borderRadius: 999 }}
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
                      borderRadius: 4,
                      p: 2,
                      border: "1px solid #eef2ff",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 1.5,
                      transition: "all .2s ease",
                      "&:hover": { boxShadow: "0 20px 45px rgba(15,23,42,0.08)", transform: "translateY(-2px)" },
                    }}
                  >
                    <Box
                      sx={{
                        width: 44,
                        height: 44,
                        borderRadius: 2,
                        backgroundColor: theme => alpha(theme.palette.primary.main, 0.12),
                        display: "grid",
                        placeItems: "center",
                        color: "primary.main",
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
              <Button size="small" sx={{ textTransform: "none" }} onClick={() => navigate("/preinscripciones")}>
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
                    px: 0,
                    mb: 1,
                    borderRadius: 3,
                    border: "1px solid #e2e8f0",
                    pr: 1,
                    cursor: "pointer",
                  }}
                  secondaryAction={estadoChip(r.estado)}
                  onClick={() => navigate(`/gestion/confirmar?codigo=${encodeURIComponent(r.codigo)}`)}
                >
                  <ListItemText
                    sx={{ pl: 2 }}
                    primaryTypographyProps={{ fontWeight: 600, color: "#020617" }}
                    primary={`${r.alumno.apellido}, ${r.alumno.nombres} · ${r.carrera.nombre}`}
                    secondaryTypographyProps={{ color: "#020617" }}
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
              sx={{ mt: 2, height: 8, borderRadius: 999 }}
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
                sx={{ textTransform: "none", borderRadius: 2 }}
                onClick={() => navigate("/preinscripciones")}
              >
                Revisar pendientes
              </Button>
              <Button
                fullWidth
                variant="outlined"
                sx={{ textTransform: "none", borderRadius: 2 }}
                onClick={() => navigate("/reportes")}
              >
                Descargar reportes
              </Button>
              <Button
                fullWidth
                variant="outlined"
                sx={{ textTransform: "none", borderRadius: 2 }}
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
