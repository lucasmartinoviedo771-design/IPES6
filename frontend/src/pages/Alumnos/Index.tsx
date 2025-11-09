import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  Stack,
} from "@mui/material";
import {
  TrendingUp,
  Event,
  CompareArrows,
  School,
  Assignment,
  CalendarMonth,
  VerifiedUser,
  EventNote,
  AccessTime,
} from "@mui/icons-material";
import { useNavigate } from "react-router-dom";

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
};

type Section = {
  title: string;
  subtitle: string;
  items: SectionCard[];
};

const upcomingEvents: EventCard[] = [
  {
    title: "Inscripción a Materias 2025",
    date: "15 - 28 de Febrero",
    icon: <Assignment />,
    path: "/alumnos/inscripcion-materia",
  },
  {
    title: "Mesa de Examen - Marzo",
    date: "10 - 15 de Marzo",
    icon: <CalendarMonth />,
    path: "/alumnos/mesa-examen",
  },
  {
    title: "Inicio de Clases",
    date: "3 de Marzo 2025",
    icon: <Event />,
  },
  {
    title: "Cambio de Comisión",
    date: "Hasta el 10 de Marzo",
    icon: <CompareArrows />,
    path: "/alumnos/cambio-comision",
  },
];

const sections: Section[] = [
  {
    title: "Trayectoria",
    subtitle: "Explora tu historial de cursada, materias y seguimiento de inscripciones.",
    items: [
      {
        title: "Trayectoria del Estudiante",
        subtitle: "Historial completo, materias y seguimiento de inscripciones.",
        icon: <TrendingUp />,
        path: "/alumnos/trayectoria",
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
        path: "/alumnos/inscripcion-materia",
      },
      {
        title: "Horario de Cursada",
        subtitle: "Consulta tu horario (comisión) y descárgalo en PDF.",
        icon: <Event />,
        path: "/alumnos/horarios",
      },
      {
        title: "Cambio de Comisión",
        subtitle: "Solicita tu cambio de comisión a otra materia.",
        icon: <CompareArrows />,
        path: "/alumnos/cambio-comision",
      },
      {
        title: "Pedido de Analítico",
        subtitle: "Solicita tu certificado analítico.",
        icon: <School />,
        path: "/alumnos/pedido-analitico",
      },
      {
        title: "Mesa de Examen",
        subtitle: "Inscríbete a mesas de examen (plan tabla, finales, libres, ortográficas).",
        icon: <CalendarMonth />,
        path: "/alumnos/mesa-examen",
      },
    ],
  },
  {
    title: "Certificados",
    subtitle: "Genera tus títulos oficiales para tramitar donde lo necesites.",
    items: [
      {
        title: "Constancia de Alumno Regular",
        subtitle: "Descarga tu certificado de alumno regular en un clic.",
        icon: <VerifiedUser />,
        path: "/alumnos/certificado-regular",
      },
    ],
  },
];

const squareCardStyles = {
  width: "100%",
  aspectRatio: "4 / 3",
  minHeight: 110,
  cursor: "pointer",
  borderRadius: 2,
  border: theme => `1px solid ${theme.palette.divider}`,
  display: "flex",
  flexDirection: "column",
  transition: "all 0.2s ease",
  "&:hover": {
    boxShadow: 6,
    transform: "translateY(-3px)",
    borderColor: "primary.main",
  },
};

const iconWrapperStyles = {
  width: 64,
  height: 64,
  borderRadius: 1,
  bgcolor: "primary.main",
  color: "common.white",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 30,
  boxShadow: theme => `0 10px 20px ${theme.palette.primary.main}33`,
};

const eventCardStyles = {
  width: "100%",
  aspectRatio: "4 / 3",
  minHeight: 110,
  borderRadius: 2,
  border: theme => `1px solid ${theme.palette.divider}`,
  display: "flex",
  flexDirection: "column",
  transition: "all 0.2s ease",
};

export default function AlumnosIndex() {
  const navigate = useNavigate();

  return (
    <Box>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" fontWeight="bold" gutterBottom>
          Estudiantes
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Acá puedes gestionar tus solicitudes y trámites del sistema.
        </Typography>
      </Box>

      <Box sx={{ mb: 4 }}>
        <Card sx={{ bgcolor: "primary.main", color: "primary.contrastText" }}>
          <CardContent>
            <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
              <EventNote />
              <Typography variant="h6" fontWeight={600}>
                Próximos eventos
              </Typography>
            </Stack>
            <Typography variant="body2" sx={{ mb: 3, opacity: 0.9 }}>
              Mantente al día con las fechas importantes del ciclo académico.
            </Typography>

            <Grid container spacing={2}>
              {upcomingEvents.map(event => (
                <Grid item xs={12} sm={6} md={2.4} lg={2.5} key={event.title} sx={{ display: "flex" }}>
                  <Card
                    onClick={() => event.path && navigate(event.path)}
                    sx={{
                      ...eventCardStyles,
                      bgcolor: "rgba(255,255,255,0.95)",
                      cursor: event.path ? "pointer" : "default",
                      "&:hover": event.path
                        ? {
                            transform: "translateY(-3px)",
                            boxShadow: 4,
                            borderColor: "primary.main",
                          }
                        : undefined,
                    }}
                  >
                    <CardContent sx={{ flexGrow: 1, display: "flex", flexDirection: "column", gap: 1.5 }}>
                      <Stack spacing={1.5}>
                        <Box sx={iconWrapperStyles}>{event.icon}</Box>
                      </Stack>
                      <Typography variant="subtitle2" fontWeight={600} color="text.primary">
                        {event.title}
                      </Typography>
                      <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: "auto" }}>
                        <AccessTime fontSize="small" color="action" />
                        <Typography variant="caption" color="text.secondary">
                          {event.date}
                        </Typography>
                      </Stack>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </CardContent>
        </Card>
      </Box>

      {sections.map(section => (
        <Box key={section.title} sx={{ mb: 4 }}>
          <Typography variant="h6" fontWeight={600} gutterBottom>
            {section.title}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            {section.subtitle}
          </Typography>
          <Grid container spacing={2}>
            {section.items.map(item => (
              <Grid item xs={12} sm={6} md={2.4} lg={2.5} key={item.title} sx={{ display: "flex" }}>
                <Card
                  variant="outlined"
                  onClick={() => navigate(item.path)}
                  sx={squareCardStyles}
                >
                  <CardContent sx={{ flexGrow: 1 }}>
                    <Stack spacing={1.5}>
                      <Box sx={iconWrapperStyles}>{item.icon}</Box>
                      <Box>
                        <Typography variant="subtitle2" fontWeight={600}>
                          {item.title}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {item.subtitle}
                        </Typography>
                      </Box>
                    </Stack>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Box>
      ))}
    </Box>
  );
}
