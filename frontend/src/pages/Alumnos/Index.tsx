import React, { useMemo } from "react";
import {
  Box,
  Typography,
  Grid,
  ButtonBase,
  Paper,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Divider,
  Chip,
  Stack,
} from "@mui/material";
import AssignmentIcon from "@mui/icons-material/Assignment";
import SwapHorizIcon from "@mui/icons-material/SwapHoriz";
import DescriptionIcon from "@mui/icons-material/Description";
import EventNoteIcon from "@mui/icons-material/EventNote";
import TimelineIcon from "@mui/icons-material/Timeline";
import dayjs from "dayjs";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { fetchVentanas, VentanaDto } from "@/api/ventanas";

type GridSizeConfig = {
  xs?: number;
  sm?: number;
  md?: number;
  lg?: number;
  xl?: number;
};

type QuickActionProps = {
  title: string;
  description: string;
  icon: React.ReactNode;
  path: string;
  grid?: GridSizeConfig;
};

const QuickActionCard: React.FC<QuickActionProps> = ({ title, description, icon, path, grid }) => {
  const navigate = useNavigate();

  return (
    <Grid
      item
      xs={grid?.xs ?? 12}
      sm={grid?.sm ?? 6}
      md={grid?.md ?? 4}
      lg={grid?.lg}
      xl={grid?.xl}
    >
      <ButtonBase
        onClick={() => navigate(path)}
        sx={{
          width: "100%",
          textAlign: "center",
          p: 2,
          borderRadius: 2,
          border: "2px solid",
          borderColor: "divider",
          transition: "all .15s ease",
          height: "100%",
          "&:hover": {
            bgcolor: "rgba(46,125,50,0.05)",
            borderColor: "success.main",
          },
          "&:focus-visible": {
            outline: "none",
            bgcolor: "rgba(46,125,50,0.08)",
            borderColor: "success.main",
            boxShadow: "0 0 0 3px rgba(46,125,50,0.2)",
          },
          "&:hover .qa-icon, &:focus-visible .qa-icon": {
            color: "success.main",
          },
        }}
      >
        <Stack spacing={1.5} alignItems="center" sx={{ width: "100%", textAlign: "center" }}>
          <Box
            className="qa-icon"
            sx={{
              fontSize: 40,
              color: "text.secondary",
              transition: "color .15s ease",
            }}
          >
            {icon}
          </Box>
          <Typography variant="h6" textAlign="center">
            {title}
          </Typography>
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
              minHeight: "3em",
              textAlign: "center",
            }}
          >
            {description}
          </Typography>
        </Stack>
      </ButtonBase>
    </Grid>
  );
};

type Estado = "proximamente" | "en_curso" | "expirado";

const estadoLabel: Record<Estado, string> = {
  proximamente: "Próximamente",
  en_curso: "En curso",
  expirado: "Finalizado",
};

const estadoColor: Record<Estado, "default" | "primary" | "secondary" | "error" | "info" | "success" | "warning"> = {
  proximamente: "info",
  en_curso: "success",
  expirado: "default",
};

type EventoConfig = {
  key: string;
  titulo: string;
  icon: React.ReactNode;
  path: string;
  tiposVentana: string[];
};

type EventoEvaluado = EventoConfig & {
  estado: Estado;
  descripcion: string;
};

const EVENTO_CONFIGS: EventoConfig[] = [
  {
    key: "insc-materia",
    titulo: "Inscripción a Materias",
    icon: <AssignmentIcon />,
    path: "/alumnos/inscripcion-materia",
    tiposVentana: ["MATERIAS"],
  },
  {
    key: "cambio-comision",
    titulo: "Cambio de Comisión",
    icon: <SwapHorizIcon />,
    path: "/alumnos/cambio-comision",
    tiposVentana: ["COMISION"],
  },
  {
    key: "pedido-analitico",
    titulo: "Pedido de Analítico",
    icon: <DescriptionIcon />,
    path: "/alumnos/pedido-analitico",
    tiposVentana: ["ANALITICOS"],
  },
  {
    key: "mesa-examen",
    titulo: "Mesa de Examen",
    icon: <EventNoteIcon />,
    path: "/alumnos/mesa-examen",
    tiposVentana: ["MESAS_FINALES", "MESAS_EXTRA", "MESAS_LIBRES"],
  },
];

type VentanaEvaluada = {
  estado: Estado;
  referencia?: VentanaDto;
  esFuturo?: boolean;
};

const ordenarVentanas = (ventanas: VentanaDto[]) =>
  [...ventanas].sort((a, b) => dayjs(a.desde).diff(dayjs(b.desde)));

const normalizarDia = (valor: string): Date => {
  const fecha = new Date(valor);
  return new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate());
};

const evaluarVentanas = (ventanas: VentanaDto[]): VentanaEvaluada => {
  if (!ventanas.length) return { estado: "proximamente" };

  const ordenadas = ordenarVentanas(ventanas);
  const hoy = new Date();
  const hoyNormalizado = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());

  const activa = ordenadas.find((ventana) => {
    const inicio = normalizarDia(ventana.desde);
    const fin = normalizarDia(ventana.hasta);
    return hoyNormalizado >= inicio && hoyNormalizado <= fin;
  });
  if (activa) {
    return { estado: "en_curso", referencia: activa };
  }

  const futura = ordenadas.find((ventana) => {
    const inicio = normalizarDia(ventana.desde);
    return hoyNormalizado < inicio;
  });
  if (futura) {
    return { estado: "proximamente", referencia: futura, esFuturo: true };
  }

  const pasada = [...ordenadas].reverse().find((ventana) => {
    const fin = normalizarDia(ventana.hasta);
    return hoyNormalizado > fin;
  });
  if (pasada) {
    return { estado: "expirado", referencia: pasada };
  }

  return { estado: "proximamente" };
};

const formatDate = (value: string | undefined) =>
  value ? dayjs(value).format("DD/MM/YYYY") : "";

const construirDescripcion = (titulo: string, evaluada: VentanaEvaluada): string => {
  const { estado, referencia, esFuturo } = evaluada;
  switch (estado) {
    case "en_curso":
      return referencia
        ? `Disponible hasta el ${formatDate(referencia.hasta)}.`
        : `Disponible actualmente.`;
    case "proximamente":
      if (referencia && esFuturo) {
        return `Se habilita el ${formatDate(referencia.desde)}.`;
      }
      return `Se informará la fecha para "${titulo}" próximamente.`;
    case "expirado":
      return referencia
        ? `Finalizó el ${formatDate(referencia.hasta)}.`
        : `El último período para "${titulo}" ha finalizado.`;
    default:
      return "";
  }
};

const useVentanaEstado = () => {
  const tipos = Array.from(
    new Set(EVENTO_CONFIGS.flatMap((evento) => evento.tiposVentana)),
  );

  const { data, isLoading } = useQuery({
    queryKey: ["portal-alumnos", "ventanas"],
    queryFn: async (): Promise<Record<string, VentanaDto[]>> => {
      const resultados = await Promise.all(
        tipos.map(async (tipo) => {
          try {
            const ventanas = await fetchVentanas({ tipo });
            return [tipo, ventanas ?? []] as const;
          } catch {
            return [tipo, []] as const;
          }
        }),
      );
      return Object.fromEntries(resultados);
    },
  });

  return { ventanasPorTipo: data ?? {}, cargando: isLoading };
};

const AlumnosIndex: React.FC = () => {
  const navigate = useNavigate();
  const { ventanasPorTipo, cargando } = useVentanaEstado();

  const eventos = useMemo<EventoEvaluado[]>(() => {
    return EVENTO_CONFIGS.map((config) => {
      const ventanas = config.tiposVentana.flatMap((tipo) => ventanasPorTipo[tipo] ?? []);
      const evaluada = evaluarVentanas(ventanas);
      const descripcion = construirDescripcion(config.titulo, evaluada);

      return {
        ...config,
        estado: evaluada.estado,
        descripcion,
      };
    });
  }, [ventanasPorTipo]);

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Portal de Alumnos
      </Typography>
      <Typography variant="body1" paragraph>
        Acá puedes gestionar tus solicitudes y trámites académicos.
      </Typography>

      <Typography variant="subtitle1" fontWeight={700} sx={{ mt: 2 }}>
        Trayectoria
      </Typography>
      <Typography variant="body2" color="text.secondary">
        Explorá tu historial completo, mesas y recomendaciones en un panel dedicado.
      </Typography>
      <Grid container spacing={2} sx={{ mt: 1 }} justifyContent="flex-start" alignItems="stretch">
        <QuickActionCard
          title="Trayectoria del Estudiante"
          description="Historial completo, mesas/notas y sugerencias de inscripción."
          icon={<TimelineIcon />}
          path="/alumnos/trayectoria"
          grid={{ xs: 12, md: 5 }}
        />
        <Grid item xs={12} md={7}>
          <Paper
            elevation={0}
            sx={{
              height: "100%",
              border: "1px solid",
              borderColor: "divider",
              borderRadius: 2,
              display: "flex",
              flexDirection: "column",
            }}
          >
            <Box sx={{ p: 2, pb: 1 }}>
              <Typography variant="h6" fontWeight={700}>
                Próximos eventos
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Fechas relevantes vinculadas a tus gestiones
              </Typography>
            </Box>
            <Divider />
            <List sx={{ flexGrow: 1 }}>
              {cargando ? (
                <ListItem>
                  <ListItemText primary="Cargando eventos..." />
                </ListItem>
              ) : (
                eventos.map((evento, index) => (
                  <React.Fragment key={evento.key}>
                    <ListItem
                      onClick={() => navigate(evento.path)}
                      sx={{ alignItems: "flex-start", cursor: "pointer" }}
                    >
                      <ListItemIcon sx={{ minWidth: 40, color: "text.secondary" }}>
                        {evento.icon}
                      </ListItemIcon>
                      <ListItemText
                        primary={
                          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                            <Typography variant="subtitle1" fontWeight={600}>
                              {evento.titulo}
                            </Typography>
                            <Chip
                              size="small"
                              label={estadoLabel[evento.estado]}
                              color={estadoColor[evento.estado]}
                              sx={{ borderRadius: 1 }}
                            />
                          </Box>
                        }
                        secondary={
                          <Typography variant="body2" color="text.secondary">
                            {evento.descripcion}
                          </Typography>
                        }
                      />
                    </ListItem>
                    {index < eventos.length - 1 && <Divider component="li" />}
                  </React.Fragment>
                ))
              )}
            </List>
          </Paper>
        </Grid>
      </Grid>

      <Typography variant="subtitle1" fontWeight={700} sx={{ mt: 3 }}>
        Inscripciones
      </Typography>
      <Typography variant="body2" color="text.secondary">
        Accesos rápidos para inscribirte y gestionar trámites académicos.
      </Typography>
      <Grid container spacing={2} sx={{ mt: 1 }} justifyContent="flex-start" alignItems="stretch">
        <QuickActionCard
          title="Inscripción a Materias"
          description="Inscríbete a las materias de tu plan de estudio."
          icon={<AssignmentIcon />}
          path="/alumnos/inscripcion-materia"
        />
        <QuickActionCard
          title="Cambio de Comisión"
          description="Solicitá un cambio de comisión para alguna materia."
          icon={<SwapHorizIcon />}
          path="/alumnos/cambio-comision"
        />
        <QuickActionCard
          title="Pedido de Analítico"
          description="Solicitá tu certificado analítico."
          icon={<DescriptionIcon />}
          path="/alumnos/pedido-analitico"
        />
        <QuickActionCard
          title="Mesa de Examen"
          description="Inscríbete a mesas de examen (parciales, finales, libres, extraordinarias)."
          icon={<EventNoteIcon />}
          path="/alumnos/mesa-examen"
        />
      </Grid>

    </Box>
  );
};

export default AlumnosIndex;
