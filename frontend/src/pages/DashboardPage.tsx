import { useEffect, useState } from "react";
import { Box, Grid, Paper, Stack, Typography, Button, Chip, List, ListItem, ListItemText, Divider } from "@mui/material";
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
import { alpha } from "@mui/material/styles";
import { listarPreinscripciones } from "@/api/preinscripciones";
import { PreinscripcionDTO } from "@/types"; // Asumiendo que el tipo está en @/types

type QuickAction = {
  title: string;
  description: string;
  icon: React.ReactNode;
  onClick: () => void;
  variant?: "contained" | "outlined";
  roles?: string[];
};

const CardBox = ({ children }: { children: React.ReactNode }) => (
  <Paper elevation={0} sx={{
    p: 2, borderRadius: 3,
    transition: "transform .08s ease, box-shadow .08s ease",
    "&:hover": { transform: "translateY(-2px)", boxShadow: "0 8px 24px rgba(0,0,0,.06)" }
  }}>
    {children}
  </Paper>
);

export default function DashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [metrics, setMetrics] = useState({ total: 0, confirmadas: 0, pendientes: 0, observadas: 0, rechazadas: 0, ratio: 0 });
  const [recientes, setRecientes] = useState<PreinscripcionDTO[]>([]);

  useEffect(() => {
    const canViewStats = can(['admin', 'secretaria', 'bedel', 'preinscripciones']);

    if (canViewStats) {
      // Cargar las preinscripciones para las métricas y la lista de recientes
      listarPreinscripciones({}).then(({ results }) => {
        const data = results ?? [];
        const total = data.length;
        const confirmadas = data.filter(p => p.estado === 'Confirmada').length;
        const pendientes = data.filter(p => p.estado === 'Enviada').length;
        const observadas = data.filter(p => p.estado === 'Observada').length;
        const rechazadas = data.filter(p => p.estado === 'Rechazada').length;
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

  const actions: QuickAction[] = [
    { title: "Nueva Preinscripción", description: "Crear una nueva preinscripción", icon: <AddIcon />, onClick: () => navigate("/preinscripcion"), variant: "contained" },
    { title: "Ver Preinscripciones", description: "Gestionar preinscripciones existentes", icon: <ScheduleIcon />, onClick: () => navigate("/preinscripciones"), variant: "outlined" },
    { title: "Gestión de Alumnos", description: "Administrar información de alumnos", icon: <PeopleIcon />, onClick: () => navigate("/alumnos"), variant: "outlined", roles: ["secretaria", "admin"] },
    { title: "Carreras", description: "Administrar carreras y cohortes", icon: <MenuBookIcon />, onClick: () => navigate("/carreras"), variant: "outlined", roles: ["admin"] },
    { title: "Reportes", description: "Ver estadísticas y reportes", icon: <BarChartIcon />, onClick: () => navigate("/reportes"), variant: "outlined", roles: ["secretaria", "admin"] },
  ].filter(a => can(a.roles));

  const Stat = ({ title, value, subtitle, icon, tint = "#87973a" }:
    { title: string; value: number; subtitle?: string; icon: React.ReactNode; tint?: string }) => (
    <CardBox>
      <Stack direction="row" gap={2} alignItems="center">
        <Box sx={{ width: 44, height: 44, borderRadius: 2, bgcolor: (t)=>alpha(t.palette.primary.main, .12), display:"grid", placeItems:"center" }}>
          {icon}
        </Box>
        <Box>
          <Typography variant="overline" color="text.secondary">{title}</Typography>
          <Typography variant="h5" fontWeight={800}>{value}</Typography>
          {subtitle && <Typography variant="caption" color="text.secondary">{subtitle}</Typography>}
        </Box>
      </Stack>
    </CardBox>
  );

  const estadoChip = (estado: string) => {
    const map: Record<string, "default" | "success" | "warning" | "error"> = {
      "Confirmada": "success", "Observada": "warning", "Rechazada": "error", "Enviada": "default",
    };
    return <Chip size="small" variant="filled" label={estado} color={map[estado] ?? "default"} sx={{ borderRadius: 99 }} />;
  };

  return (
    <Stack gap={3}>
      <Box>
        <Typography variant="h5" fontWeight={800}>Bienvenido, {user?.name ?? user?.dni}</Typography>
        <Typography color="text.secondary">Panel de control del sistema IPES Paulo Freire</Typography>
      </Box>

      {/* métricas */}
      <Grid container spacing={2}>
        <Grid item xs={12} md={3}><Stat title="Total Preinscripciones" value={metrics.total} subtitle="Este período académico" icon={<ScheduleIcon />} /></Grid>
        <Grid item xs={12} md={3}><Stat title="Confirmadas" value={metrics.confirmadas} subtitle={`${metrics.ratio}% del total`} icon={<CheckCircleIcon color="success" />} /></Grid>
        <Grid item xs={12} md={3}><Stat title="Pendientes" value={metrics.pendientes} subtitle="Requieren revisión" icon={<ScheduleIcon color="warning" />} /></Grid>
        <Grid item xs={12} md={3}><Stat title="Observadas" value={metrics.observadas} subtitle="Necesitan corrección" icon={<WarningAmberIcon color="warning" />} /></Grid>
      </Grid>

      <Grid container spacing={2}>
        {/* accesos rápidos en 2 columnas */}
        <Grid item xs={12} md={7}>
          <CardBox>
            <Typography variant="h6" gutterBottom>Accesos Rápidos</Typography>
            <Grid container spacing={1.5}>
              {actions.map((a) => (
                <Grid item xs={12} sm={6} key={a.title}>
                  <Paper
                    elevation={0}
                    onClick={a.onClick}
                    sx={{
                      p: 1.5, borderRadius: 3, cursor: "pointer",
                      display: "flex", alignItems: "center", gap: 1.5,
                      transition: "all .1s ease",
                      "&:hover": { boxShadow: "0 8px 24px rgba(0,0,0,.06)", transform: "translateY(-2px)" }
                    }}
                  >
                    <Box sx={{ width: 36, height: 36, borderRadius: 2, bgcolor: (t)=>alpha(t.palette.primary.main, .1), display:"grid", placeItems:"center" }}>
                      {a.icon}
                    </Box>
                    <Box>
                      <Typography fontWeight={700}>{a.title}</Typography>
                      <Typography variant="caption" color="text.secondary">{a.description}</Typography>
                    </Box>
                  </Paper>
                </Grid>
              ))}
              {/* botón destacado para “nueva” */}
              <Grid item xs={12}>
                <Button fullWidth startIcon={<AddIcon />} variant="contained" sx={{ bgcolor: "primary.main", "&:hover": { bgcolor: "#74822f" } }} onClick={() => navigate("/preinscripcion")}>
                  Nueva Preinscripción
                </Button>
              </Grid>
            </Grid>
          </CardBox>
        </Grid>

        {/* recientes compactas */}
        <Grid item xs={12} md={5}>
          <CardBox>
            <Typography variant="h6" gutterBottom>Preinscripciones Recientes</Typography>
            <List dense sx={{ pt: 0 }}>
              {recientes.map(r => (
                <ListItem
                  key={r.codigo}
                  sx={{ px: 1, borderRadius: 2, border: "1px solid #eee", mb: 1 }}
                  secondaryAction={estadoChip(r.estado)}
                  onClick={() => navigate(`/gestion/confirmar?codigo=${encodeURIComponent(r.codigo)}`)}
                >
                  <ListItemText
                    primaryTypographyProps={{ fontWeight: 600 }}
                    primary={`${r.alumno.apellido}, ${r.alumno.nombres} • ${r.carrera.nombre}`}
                    secondaryTypographyProps={{ color: "text.secondary" }}
                    secondary={`${r.codigo} — ${dayjs(r.created_at).format("DD/MM/YYYY")}`}
                  />
                </ListItem>
              ))}
            </List>
            <Divider sx={{ my: 1 }} />
            <Box textAlign="center">
              <Button size="small" onClick={() => navigate("/preinscripciones")}>Ver todas las preinscripciones</Button>
            </Box>
          </CardBox>
        </Grid>
      </Grid>

      {/* leyenda/estado general integrado */}
      <Grid container spacing={2}>
        <Grid item xs={12} md={3}>
          <CardBox>
            <Typography variant="subtitle2" gutterBottom>Estado General</Typography>
            <Stack gap={1}>
              <Stack direction="row" spacing={1} alignItems="center">
                <CheckCircleIcon fontSize="small" color="success" /><Typography variant="body2">Confirmadas</Typography>
              </Stack>
              <Stack direction="row" spacing={1} alignItems="center">
                <ScheduleIcon fontSize="small" color="warning" /><Typography variant="body2">Pendientes</Typography>
              </Stack>
              <Stack direction="row" spacing={1} alignItems="center">
                <WarningAmberIcon fontSize="small" color="warning" /><Typography variant="body2">Observadas</Typography>
              </Stack>
              <Stack direction="row" spacing={1} alignItems="center">
                <CancelIcon fontSize="small" color="error" /><Typography variant="body2">Rechazadas</Typography>
              </Stack>
            </Stack>
          </CardBox>
        </Grid>
      </Grid>
    </Stack>
  );
}
