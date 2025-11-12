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
import {
  ICON_GRADIENT,
  INSTITUTIONAL_GREEN,
  INSTITUTIONAL_TERRACOTTA,
} from "@/styles/institutionalColors";
import { PageHero, SectionTitlePill } from "@/components/ui/GradientTitles";

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
    <Grid item xs={12} sm={6} md={4} lg={3} sx={{ display: "flex" }}>
      <Card
        onClick={() => navigate(path)}
        sx={{
          width: "100%",
          minHeight: 110,
          cursor: "pointer",
          borderRadius: 10,
          border: `1px solid ${INSTITUTIONAL_GREEN}55`,
          backgroundColor: "#fff",
          boxShadow: "0 10px 20px rgba(125,127,110,0.15)",
          transition: "all 0.2s ease",
          "&:hover": {
            borderColor: INSTITUTIONAL_TERRACOTTA,
            boxShadow: "0 15px 35px rgba(183,105,78,0.35)",
            transform: "translateY(-4px)",
          },
        }}
      >
        <CardContent sx={{ height: "100%", display: "flex" }}>
          <Stack spacing={1.5} sx={{ width: "100%" }}>
            <Stack direction="row" spacing={1.5} alignItems="center">
              <Box
                sx={{
                  width: 56,
                  height: 56,
                  borderRadius: 8,
                  backgroundImage: ICON_GRADIENT,
                  color: "common.white",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 30,
                  boxShadow: "0 10px 20px rgba(183,105,78,0.55)",
                  flexShrink: 0,
                }}
              >
                {icon}
              </Box>
              <Typography variant="subtitle1" fontWeight={600} noWrap>
                {title}
              </Typography>
            </Stack>
            <Typography variant="body2" color="text.secondary" sx={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
              {subtitle}
            </Typography>
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
              path: "/secretaria/profesorado",
            },
            {
              title: "Materias",
              subtitle: "Gestionar materias dentro del plan.",
              icon: <ArticleIcon />,
              path: "/secretaria/profesorado",
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
              {
                title: "Pedidos de equivalencias",
                subtitle: "Descargá notas o exportá el listado completo.",
                icon: <SchoolIcon />,
                path: "/secretaria/pedidos-equivalencias",
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
      <PageHero
        title="Secretaría"
        subtitle="Centro de operaciones agrupado por módulos"
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
