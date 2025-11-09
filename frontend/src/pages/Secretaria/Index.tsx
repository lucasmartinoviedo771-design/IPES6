import {
  Box,
  Grid,
  Typography,
  Stack,
  Card,
  CardContent,
} from "@mui/material";
import { useNavigate } from "react-router-dom";
import PersonAddIcon from "@mui/icons-material/PersonAdd";
import AssignmentIndIcon from "@mui/icons-material/AssignmentInd";
import PeopleIcon from "@mui/icons-material/People";
import SchoolIcon from "@mui/icons-material/School";
import MenuBookIcon from "@mui/icons-material/MenuBook";
import ArticleIcon from "@mui/icons-material/Article";
import LinkIcon from "@mui/icons-material/Link";
import EventIcon from "@mui/icons-material/Event";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import RecordVoiceOverIcon from "@mui/icons-material/RecordVoiceOver";
import DateRangeIcon from "@mui/icons-material/DateRange";
import GavelIcon from "@mui/icons-material/Gavel";
import { useAuth } from "@/context/AuthContext";
import { hasAnyRole } from "@/utils/roles";

type SectionItem = {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  path: string;
};

type Section = {
  title: string;
  items: SectionItem[];
};

const SectionCard: React.FC<SectionItem> = ({ title, subtitle, icon, path }) => {
  const navigate = useNavigate();
  return (
    <Grid item xs={12} sm={6} md={2.4} lg={2.5} sx={{ display: "flex" }}>
      <Card
        onClick={() => navigate(path)}
        sx={{
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
            transform: "translateY(-4px)",
          },
        }}
      >
        <CardContent>
          <Stack spacing={2}>
            <Box
              sx={{
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
              }}
            >
              {icon}
            </Box>
            <Box>
              <Typography variant="subtitle1" fontWeight={600}>
                {title}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {subtitle}
              </Typography>
            </Box>
          </Stack>
        </CardContent>
      </Card>
    </Grid>
  );
};

export default function SecretariaIndex() {
  const { user } = useAuth();

  const canManageDocentes = hasAnyRole(user, ["admin", "secretaria"]);
  const canAssignRoles = hasAnyRole(user, ["admin", "secretaria"]);
  const canManageStructure = hasAnyRole(user, ["admin", "secretaria", "bedel"]);
  const canFormalize = hasAnyRole(user, ["admin", "secretaria", "bedel"]);
  const canManageHorarios = hasAnyRole(user, ["admin", "secretaria"]);
  const canManageMesas = hasAnyRole(user, ["admin", "secretaria", "bedel"]);
  const canManageAnaliticos = hasAnyRole(user, ["admin", "secretaria", "bedel", "tutor"]);
  const canManageNotas = hasAnyRole(user, ["admin", "secretaria", "bedel"]);
  const canManageCatDoc = hasAnyRole(user, ["admin", "secretaria"]);
  const canManageVentanas = hasAnyRole(user, ["admin", "secretaria", "jefa_aaee"]);
  const canManageStudents = hasAnyRole(user, ["admin", "secretaria", "bedel"]);

  const sections: Section[] = [
    {
      title: "Usuarios y roles",
      items: [
        ...(canManageDocentes
          ? [
              {
                title: "Cargar Docentes",
                subtitle: "Alta y edición de docentes del sistema.",
                icon: <PersonAddIcon />,
                path: "/secretaria/docentes",
              },
            ]
          : []),
        ...(canAssignRoles
          ? [
              {
                title: "Asignar Rol",
                subtitle: "Gestionar permisos y roles de usuarios.",
                icon: <AssignmentIndIcon />,
                path: "/secretaria/asignar-rol",
              },
            ]
          : []),
        ...(canManageStudents
          ? [
              {
                title: "Gestión de Estudiantes",
                subtitle: "Revisión y actualización de legajos y datos personales.",
                icon: <PeopleIcon />,
                path: "/secretaria/estudiantes",
              },
            ]
          : []),
      ],
    },
    {
      title: "Estructura académica",
      items: canManageStructure
        ? [
            {
              title: "Cargar Profesorado",
              subtitle: "Crear y administrar profesorados/carreras.",
              icon: <SchoolIcon />,
              path: "/secretaria/profesorado",
            },
            {
              title: "Planes de Estudio",
              subtitle: "Ver y cargar planes por profesorado.",
              icon: <MenuBookIcon />,
              path: "/secretaria/planes",
            },
            {
              title: "Materias",
              subtitle: "Gestionar materias dentro del plan.",
              icon: <ArticleIcon />,
              path: "/secretaria/materias",
            },
            {
              title: "Correlatividades",
              subtitle: "Definir requisitos y correlatividades entre materias.",
              icon: <LinkIcon />,
              path: "/secretaria/correlatividades",
            },
          ]
        : [],
    },
    {
      title: "Gestión académica - Estudiantes",
      items: [
        ...(canFormalize
          ? [
              {
                title: "Formalizar Inscripción",
                subtitle: "Confirmar preinscripción presencial, datos y documentación.",
                icon: <AssignmentIndIcon />,
                path: "/secretaria/confirmar-inscripcion",
              },
            ]
          : []),
        ...(canManageAnaliticos
          ? [
              {
                title: "Pedidos de Analítico",
                subtitle: "Listar, crear por DNI y descargar PDF.",
                icon: <MenuBookIcon />,
                path: "/secretaria/analiticos",
              },
            ]
          : []),
        ...(canManageNotas
          ? [
              {
                title: "Planillas de regularidad",
                subtitle: "Generar y completar planillas de cursada.",
                icon: <MenuBookIcon />,
                path: "/secretaria/carga-notas",
              },
              {
                title: "Actas finales",
                subtitle: "Registrar actas y calificaciones de mesas finales.",
                icon: <GavelIcon />,
                path: "/secretaria/carga-notas?tab=finales&scope=finales",
              },
            ]
          : []),
      ],
    },
    {
      title: "Gestión académica - Secretaría",
      items: [
        ...(canManageHorarios
          ? [
              {
                title: "Cargar Horario",
                subtitle: "Armar y publicar horarios de cursada.",
                icon: <EventIcon />,
                path: "/secretaria/horarios",
              },
            ]
          : []),
        ...(canManageMesas
          ? [
              {
                title: "Mesas de Examen",
                subtitle: "Crear y gestionar mesas por período.",
                icon: <CalendarMonthIcon />,
                path: "/secretaria/mesas",
              },
            ]
          : []),
        ...(canManageCatDoc
          ? [
              {
                title: "Cátedra - Docente",
                subtitle: "Asignar docentes a cátedras y comisiones.",
                icon: <RecordVoiceOverIcon />,
                path: "/secretaria/catedra-docente",
              },
            ]
          : []),
        ...(canManageVentanas
          ? [
              {
                title: "Habilitar Fechas",
                subtitle: "Configurar períodos y fechas clave.",
                icon: <DateRangeIcon />,
                path: "/secretaria/habilitar-fechas",
              },
            ]
          : []),
      ],
    },
  ];

  const visibleSections = sections.filter((section) => section.items.length > 0);

  return (
    <Stack gap={4}>
      <Box>
        <Typography variant="h5" fontWeight={800}>
          Secretaría
        </Typography>
        <Typography color="text.secondary">Centro de operaciones agrupado por módulos</Typography>
      </Box>

      {visibleSections.map((section) => (
        <Box key={section.title}>
          <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>
            {section.title}
          </Typography>
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
