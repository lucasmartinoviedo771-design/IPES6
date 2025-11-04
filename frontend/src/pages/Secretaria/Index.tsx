import { Box, Grid, Typography, Stack, ButtonBase } from "@mui/material";
import { useNavigate } from "react-router-dom";
import SchoolIcon from "@mui/icons-material/School";
import LibraryBooksIcon from "@mui/icons-material/LibraryBooks";
import ArticleIcon from "@mui/icons-material/Article";
import PersonIcon from "@mui/icons-material/Person";
import AssignmentIndIcon from "@mui/icons-material/AssignmentInd";
import EventNoteIcon from "@mui/icons-material/EventNote";
import SchoolOutlinedIcon from "@mui/icons-material/SchoolOutlined";
import EventAvailableIcon from "@mui/icons-material/EventAvailable";
import LinkIcon from "@mui/icons-material/Link";
import FactCheckIcon from "@mui/icons-material/FactCheck";
import PeopleAltIcon from "@mui/icons-material/PeopleAlt";
import GavelIcon from "@mui/icons-material/Gavel";
import { useAuth } from "@/context/AuthContext";
import { hasAnyRole } from "@/utils/roles";

interface QuickActionProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  path: string;
}

const QuickActionCard: React.FC<QuickActionProps> = ({ title, description, icon, path }) => {
  const navigate = useNavigate();
  return (
    <Grid item xs={12} sm={6} md={4} lg={3}>
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
          alignSelf: "stretch",
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
          <Box className="qa-icon" sx={{ fontSize: 40, color: "text.secondary", transition: "color .15s ease" }}>
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

  const userCards: QuickActionProps[] = [];
  if (canManageDocentes) {
    userCards.push({
      title: "Cargar Docentes",
      description: "Alta y edición de docentes del sistema.",
      icon: <PersonIcon />,
      path: "/secretaria/docentes",
    });
  }
  if (canAssignRoles) {
    userCards.push({
      title: "Asignar Rol",
      description: "Gestionar permisos y roles de usuarios.",
      icon: <AssignmentIndIcon />,
      path: "/secretaria/asignar-rol",
    });
  }
  if (canManageStudents) {
    userCards.push({
      title: "Gestión de Estudiantes",
      description: "Revisión y actualización de legajos y datos personales.",
      icon: <PeopleAltIcon />,
      path: "/secretaria/estudiantes",
    });
  }

  const structureCards: QuickActionProps[] = [];
  if (canManageStructure) {
    structureCards.push(
      {
        title: "Cargar Profesorado",
        description: "Crear y administrar profesorados/carreras.",
        icon: <SchoolIcon />,
        path: "/secretaria/profesorado",
      },
      {
        title: "Planes de Estudio",
        description: "Ver y cargar planes por profesorado.",
        icon: <LibraryBooksIcon />,
        path: "/secretaria/profesorado",
      },
      {
        title: "Materias",
        description: "Gestionar materias dentro del plan.",
        icon: <ArticleIcon />,
        path: "/secretaria/profesorado",
      },
      {
        title: "Correlatividades",
        description: "Definir requisitos y correlatividades entre materias.",
        icon: <LinkIcon />,
        path: "/secretaria/correlatividades",
      }
    );
  }

  const academicCards: QuickActionProps[] = [];
  if (canFormalize) {
    academicCards.push({
      title: "Formalizar Inscripción",
      description: "Confirmar preinscripción presencial: edición de datos y documentación.",
      icon: <AssignmentIndIcon />,
      path: "/secretaria/confirmar-inscripcion",
    });
  }
  if (canManageHorarios) {
    academicCards.push({
      title: "Cargar Horario",
      description: "Armar y publicar horarios de cursada.",
      icon: <EventNoteIcon />,
      path: "/secretaria/horarios",
    });
  }
  if (canManageMesas) {
    academicCards.push({
      title: "Mesas de Examen",
      description: "Crear y gestionar mesas por periodo.",
      icon: <EventNoteIcon />,
      path: "/secretaria/mesas",
    });
  }
  if (canManageAnaliticos) {
    academicCards.push({
      title: "Pedidos de Analítico",
      description: "Listar, crear por DNI y descargar PDF.",
      icon: <ArticleIcon />,
      path: "/secretaria/analiticos",
    });
  }
  if (canManageNotas) {
    academicCards.push({
      title: "Carga de Notas",
      description: "Planilla de regularidad/promoción y registro de notas.",
      icon: <FactCheckIcon />,
      path: "/secretaria/carga-notas",
    });
    academicCards.push({
      title: "Cargar Finales",
      description: "Registrar actas de mesas finales.",
      icon: <GavelIcon />,
      path: "/secretaria/actas-examen",
    });
  }
  if (canManageCatDoc) {
    academicCards.push({
      title: "Cátedra - Docente",
      description: "Asignar docentes a cátedras y comisiones.",
      icon: <SchoolOutlinedIcon />,
      path: "/secretaria/catedra-docente",
    });
  }
  if (canManageVentanas) {
    academicCards.push({
      title: "Habilitar Fechas",
      description: "Configurar periodos y fechas clave.",
      icon: <EventAvailableIcon />,
      path: "/secretaria/habilitar-fechas",
    });
  }

  return (
    <Stack gap={3}>
      <Typography variant="h5" fontWeight={800}>Secretaría</Typography>
      <Typography color="text.secondary">Centro de operaciones agrupado por módulos</Typography>

      {userCards.length > 0 && (
        <Stack gap={1}>
          <Typography variant="subtitle1" fontWeight={700}>Usuarios y roles</Typography>
          <Grid container spacing={2} alignItems="stretch" justifyContent="flex-start">
            {userCards.map((card) => (
              <QuickActionCard key={card.title} {...card} />
            ))}
          </Grid>
        </Stack>
      )}

      {structureCards.length > 0 && (
        <Stack gap={1}>
          <Typography variant="subtitle1" fontWeight={700}>Estructura académica</Typography>
          <Grid container spacing={2} alignItems="stretch" justifyContent="flex-start">
            {structureCards.map((card) => (
              <QuickActionCard key={card.title} {...card} />
            ))}
          </Grid>
        </Stack>
      )}

      {academicCards.length > 0 && (
        <Stack gap={1}>
          <Typography variant="subtitle1" fontWeight={700}>Gestión académica</Typography>
          <Grid container spacing={2} alignItems="stretch" justifyContent="flex-start">
            {academicCards.map((card) => (
              <QuickActionCard key={card.title} {...card} />
            ))}
          </Grid>
        </Stack>
      )}
    </Stack>
  );
}
