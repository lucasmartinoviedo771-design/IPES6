import { Box, Grid, Stack } from "@mui/material";
import PeopleIcon from "@mui/icons-material/People";
import SchoolIcon from "@mui/icons-material/School";
import MenuBookIcon from "@mui/icons-material/MenuBook";
import ArticleIcon from "@mui/icons-material/Article";
import LinkIcon from "@mui/icons-material/Link";
import AssignmentIndIcon from "@mui/icons-material/AssignmentInd";
import EventAvailableIcon from "@mui/icons-material/EventAvailable";
import FactCheckIcon from "@mui/icons-material/FactCheck";
import HourglassBottomIcon from "@mui/icons-material/HourglassBottom";
import TaskAltIcon from "@mui/icons-material/TaskAlt";
import GavelIcon from "@mui/icons-material/Gavel";
import { useAuth } from "@/context/AuthContext";
import { hasAnyRole } from "@/utils/roles";
import { PageHero, SectionTitlePill } from "@/components/ui/GradientTitles";
import SectionCard, {
  SectionCardProps,
} from "@/components/secretaria/SectionCard";

type Section = {
  title: string;
  items: SectionCardProps[];
};

export default function BedelesIndex() {
  const { user } = useAuth();

  const canManageStudents = hasAnyRole(user, ["admin", "secretaria", "bedel"]);
  const canManageStructure = hasAnyRole(user, ["admin", "secretaria", "bedel"]);
  const canFormalize = hasAnyRole(user, ["admin", "secretaria", "bedel"]);
  const canManageAnaliticos = hasAnyRole(user, [
    "admin",
    "secretaria",
    "bedel",
    "tutor",
  ]);
  const canManageEquivalencias = hasAnyRole(user, [
    "admin",
    "secretaria",
    "bedel",
  ]);
  const canCursoIntro = hasAnyRole(user, [
    "admin",
    "secretaria",
    "bedel",
    "curso_intro",
  ]);
  const canManageNotas = hasAnyRole(user, ["admin", "secretaria", "bedel"]);

  const sections: Section[] = [
    {
      title: "Usuarios y roles",
      items: [
        ...(canManageStudents
          ? [
              {
                title: "Gestionar estudiantes",
                subtitle: "Revisión de legajos y actualización de datos.",
                icon: <PeopleIcon />,
                path: "/secretaria/estudiantes",
              },
            ]
          : []),
      ],
    },
    {
      title: "Estructura académica",
      items:
        canManageStructure
          ? [
              {
                title: "Cargar profesorado",
                subtitle: "Crear y administrar profesorados/carreras.",
                icon: <SchoolIcon />,
                path: "/secretaria/profesorado",
              },
              {
                title: "Planes de estudio",
                subtitle: "Ver y cargar planes por profesorado.",
                icon: <ArticleIcon />,
                path: "/secretaria/profesorado",
              },
              {
                title: "Materias",
                subtitle: "Gestionar materias dentro del plan.",
                icon: <MenuBookIcon />,
                path: "/secretaria/profesorado",
              },
              {
                title: "Correlatividades",
                subtitle: "Definir requisitos y correlatividades.",
                icon: <LinkIcon />,
                path: "/secretaria/correlatividades",
              },
            ]
          : [],
    },
    {
      title: "Gestión académica - Bedeles",
      items: [
        ...(canFormalize
          ? [
              {
                title: "Formalizar inscripción",
                subtitle: "Confirmar preinscripción y documentación.",
                icon: <AssignmentIndIcon />,
                path: "/secretaria/confirmar-inscripcion",
              },
            ]
          : []),
        ...(canManageAnaliticos
          ? [
              {
                title: "Pedidos de analítico",
                subtitle: "Listar, cargar por DNI y descargar PDF.",
                icon: <MenuBookIcon />,
                path: "/secretaria/analiticos",
              },
            ]
          : []),
        ...(canManageEquivalencias
          ? [
              {
                title: "Pedidos de equivalencia",
                subtitle: "Seguimiento y descarga de notas.",
                icon: <SchoolIcon />,
                path: "/secretaria/pedidos-equivalencias",
              },
            ]
          : []),
        ...(canCursoIntro
          ? [
              {
                title: "Curso introductorio",
                subtitle: "Gestioná inscripciones, cohortes y asistencia.",
                icon: <EventAvailableIcon />,
                path: "/secretaria/curso-introductorio",
              },
              {
                title: "Listado de inscriptos CI",
                subtitle: "Reporte filtrado por turno o profesorado.",
                icon: <FactCheckIcon />,
                path: "/secretaria/curso-introductorio?view=inscriptos",
              },
              {
                title: "Estudiantes sin CI aprobado",
                subtitle: "Detectá pendientes para convocarlos.",
                icon: <HourglassBottomIcon />,
                path: "/secretaria/curso-introductorio?view=pendientes",
              },
            ]
          : []),
      ],
    },
    {
      title: "Carga de notas",
      items:
        canManageNotas
          ? [
              {
                title: "Planillas de regularidad",
                subtitle: "Generar y completar planillas de cursada.",
                icon: <ArticleIcon />,
                path: "/secretaria/carga-notas",
              },
              {
                title: "Actas finales",
                subtitle: "Registrar actas y calificaciones de mesas.",
                icon: <GavelIcon />,
                path: "/secretaria/carga-notas?tab=finales&scope=finales",
              },
              {
                title: "Notas por equivalencias",
                subtitle: "Cargar disposiciones y finales otorgados.",
                icon: <TaskAltIcon />,
                path: "/secretaria/pedidos-equivalencias?view=disposiciones",
              },
            ]
          : [],
    },
  ];

  const visibleSections = sections.filter((section) => section.items.length > 0);

  return (
    <Stack gap={4}>
      <PageHero
        title="Bedeles"
        subtitle="Accesos rápidos a la operatoria diaria del equipo de bedelía"
      />

      {visibleSections.map((section) => (
        <Box key={section.title}>
          <SectionTitlePill title={section.title} />
          <Grid container spacing={2}>
            {section.items.map((item) => (
              <SectionCard key={item.title} {...item} />
            ))}
          </Grid>
        </Box>
      ))}
    </Stack>
  );
}
