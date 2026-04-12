import React, { useMemo } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Grid from "@mui/material/Grid";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Stack from "@mui/material/Stack";
import Paper from "@mui/material/Paper";
import TrendingUp from "@mui/icons-material/TrendingUp";
import Event from "@mui/icons-material/Event";
import CompareArrows from "@mui/icons-material/CompareArrows";
import School from "@mui/icons-material/School";
import Assignment from "@mui/icons-material/Assignment";
import CalendarMonth from "@mui/icons-material/CalendarMonth";
import VerifiedUser from "@mui/icons-material/VerifiedUser";
import EventNote from "@mui/icons-material/EventNote";
import AccessTime from "@mui/icons-material/AccessTime";
import ManageAccounts from "@mui/icons-material/ManageAccounts";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { PageHero, SectionTitlePill } from "@/components/ui/GradientTitles";
import {
  ICON_GRADIENT,
  INSTITUTIONAL_GREEN,
  INSTITUTIONAL_GREEN_DARK,
  INSTITUTIONAL_TERRACOTTA,
} from "@/styles/institutionalColors";
import { useAuth } from "@/context/AuthContext";
import { fetchCursoIntroEstado } from "@/api/cursoIntro";
import { getMisAlertas, CorrelativaCaidaItem } from "@/api/reportes";
import { fetchVentanas, VentanaDto } from "@/api/ventanas";
import Alert from "@mui/material/Alert";
import AlertTitle from "@mui/material/AlertTitle";

type EventCard = {
  title: string;
  date: string;
  icon: React.ReactNode;
  path?: string;
};

type SectionCard = {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  path: string;
  status?: "success" | "info" | "warning";
  disabled?: boolean;
};

type Section = {
  title: string;
  subtitle: string;
  items: SectionCard[];
};

const WINDOW_TYPE_CONFIG: Record<string, { title: string; icon: React.ReactNode; subtitle: string; path?: string }> = {
  MATERIAS: { title: "Inscripción a Materias", subtitle: "Registro de cursadas y materias", icon: <Assignment />, path: "/estudiantes/inscripcion-materia" },
  MESAS_FINALES: { title: "Exámenes Finales", subtitle: "Inscripción a mesas de examen", icon: <CalendarMonth />, path: "/estudiantes/mesa-examen" },
  MESAS_EXTRA: { title: "Exámenes Extraordinarios", subtitle: "Mesas especiales y remanentes", icon: <CalendarMonth />, path: "/estudiantes/mesa-examen" },
  COMISION: { title: "Cambio de Comisión", subtitle: "Solicitud de cambio de grupo", icon: <CompareArrows />, path: "/estudiantes/cambio-comision" },
  ANALITICOS: { title: "Títulos y Diplomas", subtitle: "Gestión y seguimiento de trámites", icon: <School />, path: "/estudiantes/tramites" },
  EQUIVALENCIAS: { title: "Equivalencias", subtitle: "Convalidación de materias externas", icon: <CompareArrows />, path: "/estudiantes/tramites" },
  CURSO_INTRODUCTORIO: { title: "Curso Introductorio", subtitle: "Ingreso y nivelación", icon: <VerifiedUser />, path: "/estudiantes/curso-introductorio" },
  PREINSCRIPCION: { title: "Preinscripción", subtitle: "Registro de aspirantes", icon: <Assignment /> },
  CARRERAS: { title: "Inscripción a Carreras", subtitle: "Cambio o alta de plan de estudio", icon: <School /> },
  INSCRIPCION: { title: "Inscripción General", subtitle: "Gestión administrativa", icon: <Assignment /> },
  CALENDARIO_CUATRIMESTRE: { title: "Calendario Académico", subtitle: "Fechas clave del cuatrimestre", icon: <EventNote /> },
};

const formatDateShort = (dateStr: string) => {
  const d = new Date(dateStr + "T12:00:00");
  return `${d.getDate()} de ${d.toLocaleString('es-AR', { month: 'long' })}`;
};

const getWindowStatus = (ventana: VentanaDto) => {
  const now = new Date();
  const from = new Date(ventana.desde + 'T00:00:00');
  const to = new Date(ventana.hasta + 'T23:59:59');

  if (!ventana.activo) return 'closed';
  if (now >= from && now <= to) return 'active';
  if (now < from) return 'future';
  return 'closed';
};

const baseSections: Section[] = [
  {
    title: "Trayectoria",
    subtitle: "Explora tu historial de cursada, materias y seguimiento de inscripciones.",
    items: [
      {
        title: "Trayectoria del Estudiante",
        subtitle: "Historial completo, materias y seguimiento de inscripciones.",
        icon: <TrendingUp />,
        path: "/estudiantes/trayectoria",
      },
      {
        title: "Mis Asistencias",
        subtitle: "Consultá tu historial de presentismo por materia.",
        icon: <EventNote />,
        path: "/estudiantes/mis-asistencias",
      },
    ],
  },
  {
    title: "Inscripciones",
    subtitle: "Accesos rápidos para inscribirte y gestionar tus trámites académicos.",
    items: [
      {
        title: "Inscripción a Materias",
        subtitle: "Inscríbete a las materias de tu plan de estudio.",
        icon: <Assignment />,
        path: "/estudiantes/inscripcion-materia",
      },
      {
        title: "Horario de Cursada",
        subtitle: "Consulta tu horario (comisión) y descárgalo en PDF.",
        icon: <Event />,
        path: "/estudiantes/horarios",
      },
      {
        title: "Cambio de Comisión",
        subtitle: "Solicita tu cambio de comisión a otra materia.",
        icon: <CompareArrows />,
        path: "/estudiantes/cambio-comision",
      },
      {
        title: "Mis Trámites",
        subtitle: "Solicitá tu analítico, tramitá equivalencias y consultá tus resultados.",
        icon: <School />,
        path: "/estudiantes/tramites",
      },
      {
        title: "Mesa de Examen",
        subtitle: "Inscríbete a mesas de examen (plan tabla, finales, libres, ortográficas).",
        icon: <CalendarMonth />,
        path: "/estudiantes/mesa-examen",
      },
    ],
  },
  {
    title: "Certificados",
    subtitle: "Genera tus títulos oficiales para tramitar donde lo necesites.",
    items: [
      {
        title: "Constancia de Estudiante Regular",
        subtitle: "Descarga tu certificado de estudiante regular en un clic.",
        icon: <VerifiedUser />,
        path: "/estudiantes/certificado-regular",
      },
      {
        title: "Constancia de examen",
        subtitle: "Descargá la constancia de la última mesa rendida.",
        icon: <EventNote />,
        path: "/estudiantes/constancia-examen",
      },
    ],
  },
];

const squareCardStyles = {
  width: "100%",
  minHeight: 130,
  border: `1px solid rgba(125,127,110,0.3)`,
  display: "flex",
  flexDirection: "column",
  transition: "all 0.2s ease",
  borderRadius: 10,
  "&:hover": {
    boxShadow: 6,
    transform: "translateY(-3px)",
    borderColor: INSTITUTIONAL_TERRACOTTA,
  },
};

const iconWrapperStyles = {
  width: 48,
  height: 48,
  borderRadius: 8,
  backgroundImage: ICON_GRADIENT,
  color: "common.white",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 24,
  boxShadow: "0 10px 25px rgba(183,105,78,0.35)",
};

const eventCardStyles = {
  width: "100%",
  minHeight: 140,
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.4)",
  display: "flex",
  flexDirection: "column",
  transition: "all 0.2s ease",
};

export default function EstudiantesIndex() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const roles = (user?.roles ?? []).map((role) => (role || "").toLowerCase());
  const isStudent = roles.includes("estudiante") || roles.includes("estudiantes");
  const isAdmin = user?.is_superuser || roles.some(r => ['admin', 'secretaria', 'bedel'].includes(r));

  const { data: cursoIntroEstado } = useQuery({
    queryKey: ["curso-intro", "estado"],
    queryFn: fetchCursoIntroEstado,
    staleTime: 60_000,
    enabled: isStudent && !isAdmin,
    retry: false,
  });

  const { data: alertas } = useQuery<CorrelativaCaidaItem[]>({
    queryKey: ["mis-alertas"],
    queryFn: getMisAlertas,
    staleTime: 60_000,
    enabled: isStudent && !isAdmin,
    retry: false,
  });

  const { data: ventanas } = useQuery({
    queryKey: ["ventanas"],
    queryFn: () => fetchVentanas(),
    staleTime: 60_000,
  });

  const dynamicEvents = useMemo(() => {
    if (!ventanas) return [];
    const mapped = ventanas.map((v) => {
      const config = WINDOW_TYPE_CONFIG[v.tipo] || {
        title: v.tipo,
        subtitle: "Gestión institucional",
        icon: <EventNote />
      };
      const status = getWindowStatus(v);
      return {
        ...v,
        title: config.title,
        subtitle: config.subtitle,
        icon: config.icon,
        path: config.path,
        status,
      };
    });
    // Sort: active first, then future, then closed
    return mapped.sort((a, b) => {
      const order: Record<string, number> = { active: 1, future: 2, closed: 3 };
      if (order[a.status] !== order[b.status]) {
        return order[a.status] - order[b.status];
      }
      return new Date(b.desde).getTime() - new Date(a.desde).getTime();
    });
  }, [ventanas]);

  const sections = useMemo<Section[]>(() => {
    // ... existing memo logic ...
    if (!isStudent) {
      return baseSections;
    }
    const subtitle = cursoIntroEstado
      ? cursoIntroEstado.aprobado
        ? "Curso introductorio aprobado."
        : cursoIntroEstado.registro_actual
          ? `Estado: ${cursoIntroEstado.registro_actual.resultado_display}`
          : cursoIntroEstado.cohortes_disponibles.length
            ? "Inscripciones abiertas."
            : "Consultá el estado e inscribite."
      : "Consultá el curso introductorio.";
    const cursoIntroCard: SectionCard = {
      title: "Curso Introductorio",
      subtitle,
      icon: <VerifiedUser />,
      path: "/estudiantes/curso-introductorio",
      status: cursoIntroEstado?.aprobado ? "success" : undefined,
      disabled: cursoIntroEstado?.aprobado ?? false,
    };
    return baseSections.map((section) => {
      if (section.title !== "Inscripciones") {
        return section;
      }
      return {
        ...section,
        items: [...section.items, cursoIntroCard],
      };
    });
  }, [cursoIntroEstado, isStudent]);

  return (
    <Box>
      <PageHero
        title="Estudiantes"
        subtitle="Acá podés gestionar tus solicitudes y trámites del sistema."
      />

      {alertas && alertas.length > 0 && (
        <Stack spacing={2} sx={{ mb: 4, mt: 2 }}>
          <Alert severity="error" variant="filled" sx={{ borderRadius: 2 }}>
            <AlertTitle>Atención: Problemas con correlatividades</AlertTitle>
            Tenés materias cursando con regularidades de correlativas vencidas o inválidas.
          </Alert>
          {alertas.map((alerta, index) => (
            <Paper key={index} sx={{ p: 2, borderLeft: "6px solid #d32f2f", bgcolor: "#fff5f5" }}>
              <Typography variant="subtitle1" fontWeight="bold" color="error.main">
                {alerta.materia_actual}
              </Typography>
              <Typography variant="body2">
                La correlativa <strong>{alerta.materia_correlativa}</strong> presenta el siguiente problema: <em>{alerta.motivo}</em>.
              </Typography>
            </Paper>
          ))}
        </Stack>
      )}

      <Stack spacing={1.5} sx={{ mb: 4 }}>
        <SectionTitlePill title="Próximos eventos" sx={{ mt: 3 }} />
        <Typography variant="body2" color="text.secondary">
          Mantenete al día con las fechas importantes del ciclo académico.
        </Typography>
        <Grid container spacing={2} sx={{ mt: 1 }}>
          {!ventanas ? (
            <Grid item xs={12}>
              <Typography variant="body2" color="text.secondary">Cargando eventos...</Typography>
            </Grid>
          ) : dynamicEvents.length === 0 ? (
            <Grid item xs={12}>
              <Typography variant="body2" color="text.secondary">No hay eventos próximos.</Typography>
            </Grid>
          ) : (
            dynamicEvents.map((event) => {
              const isActive = event.status === 'active';
              const isFuture = event.status === 'future';
              const VIBRANT_GREEN = "#2D8C3C";

              return (
                <Grid item xs={12} sm={6} md={4} key={event.id || event.title}>
                  <Box
                    onClick={() => event.path && navigate(event.path)}
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      p: 1.5,
                      borderRadius: 2,
                      border: `1px solid rgba(183,105,78,0.25)`,
                      cursor: event.path ? "pointer" : "default",
                      backgroundColor: "#fff",
                      transition: "all 0.2s ease",
                      "&:hover": event.path ? {
                        transform: "translateY(-2px)",
                        boxShadow: 2,
                        borderColor: INSTITUTIONAL_TERRACOTTA
                      } : {},
                    }}
                  >
                    <Box sx={{
                      mr: 2,
                      color: INSTITUTIONAL_TERRACOTTA,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      opacity: 0.8
                    }}>
                      {/* Simulating the skeletal icon style from mockup */}
                      {React.cloneElement(event.icon as React.ReactElement, { sx: { fontSize: 48 } })}
                    </Box>

                    <Box sx={{ flexGrow: 1 }}>
                      <Typography variant="subtitle2" fontWeight={800} sx={{ lineHeight: 1.1, mb: 0.2, fontSize: '1rem' }}>
                        {event.title}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                        {event.subtitle}
                      </Typography>

                      <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap">
                        {isActive && (
                          <Box component="span" sx={{
                            bgcolor: VIBRANT_GREEN,
                            color: 'white',
                            fontSize: '0.6rem',
                            fontWeight: 800,
                            px: 0.8,
                            py: 0.2,
                            borderRadius: '3px',
                            textTransform: 'uppercase',
                          }}>
                            Abierto
                          </Box>
                        )}
                        {isFuture && (
                          <Box component="span" sx={{
                            bgcolor: INSTITUTIONAL_TERRACOTTA,
                            color: 'white',
                            fontSize: '0.6rem',
                            fontWeight: 800,
                            px: 0.8,
                            py: 0.2,
                            borderRadius: '3px',
                            textTransform: 'uppercase',
                          }}>
                            Próximamente
                          </Box>
                        )}

                        <Stack direction="row" spacing={0.5} alignItems="center">
                          <CalendarMonth sx={{ fontSize: 14, color: 'text.secondary', opacity: 0.7 }} />
                          <Typography variant="caption" sx={{ fontSize: '0.65rem' }}>
                            <Box component="span" color="text.secondary">Desde:</Box> {formatDateShort(event.desde)}
                          </Typography>
                        </Stack>

                        <Stack direction="row" spacing={0.5} alignItems="center">
                          <Assignment sx={{ fontSize: 14, color: 'text.secondary', opacity: 0.7 }} />
                          <Typography variant="caption" sx={{ fontSize: '0.65rem' }}>
                            <Box component="span" color="text.secondary">Hasta:</Box> {formatDateShort(event.hasta)}
                          </Typography>
                        </Stack>
                      </Stack>
                    </Box>

                    {event.path && (
                      <Box sx={{ ml: 1, color: 'text.secondary', opacity: 0.5 }}>
                        <CompareArrows sx={{ fontSize: 16, transform: 'rotate(-90deg)' }} />
                      </Box>
                    )}
                  </Box>
                </Grid>
              );
            })
          )}
        </Grid>
      </Stack>

      {sections.map(section => (
        <Box key={section.title} sx={{ mb: 4 }}>
          <SectionTitlePill title={section.title} />
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            {section.subtitle}
          </Typography>
          <Grid container spacing={2}>
            {section.items.map(item => {
              const isDisabled = Boolean(item.disabled);
              const cardSx = {
                ...squareCardStyles,
                ...(item.status === "success"
                  ? {
                    borderColor: "rgba(46,125,50,0.6)",
                    backgroundColor: "#e8f5e9",
                  }
                  : {}),
                cursor: item.path && !isDisabled ? "pointer" : "default",
                opacity: isDisabled ? 0.85 : 1,
              };
              return (
                <Grid item xs={12} sm={6} md={4} lg={3} key={item.title} sx={{ display: "flex" }}>
                  <Card
                    variant="outlined"
                    onClick={() => {
                      if (!isDisabled) {
                        navigate(item.path);
                      }
                    }}
                    sx={cardSx}
                  >
                    <CardContent sx={{ flexGrow: 1 }}>
                      <Stack spacing={1.5}>
                        <Stack direction="row" spacing={1.5} alignItems="center">
                          <Box sx={iconWrapperStyles}>{item.icon}</Box>
                          <Typography variant="subtitle2" fontWeight={600}>
                            {item.title}
                          </Typography>
                        </Stack>
                        <Typography variant="caption" color="text.secondary">
                          {item.subtitle}
                        </Typography>
                      </Stack>
                    </CardContent>
                  </Card>
                </Grid>
              );
            })}
          </Grid>
        </Box>
      ))}
    </Box>
  );
}
