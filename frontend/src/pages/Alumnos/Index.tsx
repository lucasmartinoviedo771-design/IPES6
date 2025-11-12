import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  Stack,
  Paper,
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
import { PageHero, SectionTitlePill } from "@/components/ui/GradientTitles";
import {
  ICON_GRADIENT,
  INSTITUTIONAL_GREEN,
  INSTITUTIONAL_TERRACOTTA,
} from "@/styles/institutionalColors";

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
        title: "Pedido de equivalencias",
        subtitle: "Genera la nota (Anexo A/B) para tramitar equivalencias.",
        icon: <Assignment />,
        path: "/alumnos/pedido-equivalencias",
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

export default function AlumnosIndex() {
  const navigate = useNavigate();

  return (
    <Box>
      <PageHero
        title="Estudiantes"
        subtitle="Acá podés gestionar tus solicitudes y trámites del sistema."
      />

      <Stack spacing={1.5} sx={{ mb: 4 }}>
        <SectionTitlePill title="Próximos eventos" sx={{ mt: 3 }} />
        <Typography variant="body2" color="text.secondary">
          Mantenete al día con las fechas importantes del ciclo académico.
        </Typography>
        <Stack spacing={1}>
          {upcomingEvents.map((event) => (
            <Box
              key={event.title}
              onClick={() => event.path && navigate(event.path)}
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                px: 2,
                py: 1.5,
                borderRadius: 2,
                border: "1px solid rgba(125,127,110,0.25)",
                cursor: event.path ? "pointer" : "default",
                backgroundColor: "#fff",
                transition: "transform 0.2s ease",
                "&:hover": event.path ? { transform: "translateY(-1px)" } : {},
              }}
            >
              <Stack direction="row" spacing={2} alignItems="center">
                <Box sx={{ ...iconWrapperStyles, width: 40, height: 40 }}>{event.icon}</Box>
                <Box>
                  <Typography variant="subtitle2" fontWeight={600}>
                    {event.title}
                  </Typography>
                  <Stack direction="row" spacing={0.5} alignItems="center">
                    <AccessTime fontSize="small" sx={{ color: INSTITUTIONAL_TERRACOTTA }} />
                    <Typography variant="body2" color="text.secondary">
                      {event.date}
                    </Typography>
                  </Stack>
                </Box>
              </Stack>
              {event.path && (
                <Typography variant="caption" color={INSTITUTIONAL_TERRACOTTA}>
                  Ver detalle →
                </Typography>
              )}
            </Box>
          ))}
        </Stack>
      </Stack>

      {sections.map(section => (
        <Box key={section.title} sx={{ mb: 4 }}>
          <SectionTitlePill title={section.title} />
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            {section.subtitle}
          </Typography>
          <Grid container spacing={2}>
            {section.items.map(item => (
              <Grid item xs={12} sm={6} md={4} lg={3} key={item.title} sx={{ display: "flex" }}>
                <Card
                  variant="outlined"
                  onClick={() => navigate(item.path)}
                  sx={squareCardStyles}
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
            ))}
          </Grid>
        </Box>
      ))}
    </Box>
  );
}
