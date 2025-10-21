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
import ClassIcon from "@mui/icons-material/Class";

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
          width: '100%', textAlign: 'left', p: 2, borderRadius: 2,
          border: '2px solid', borderColor: 'divider',
          transition: 'all .15s ease', alignSelf: 'stretch', height: '100%',
          '&:hover': {
            bgcolor: 'rgba(46,125,50,0.05)',
            borderColor: 'success.main'
          },
          '&:focus-visible': {
            outline: 'none',
            bgcolor: 'rgba(46,125,50,0.08)',
            borderColor: 'success.main',
            boxShadow: '0 0 0 3px rgba(46,125,50,0.2)'
          },
          '&:hover .qa-icon, &:focus-visible .qa-icon': {
            color: 'success.main'
          }
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Box className="qa-icon" sx={{ fontSize: 40, color: 'text.secondary', transition: 'color .15s ease' }}>{icon}</Box>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="h6">{title}</Typography>
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
                minHeight: '3em'
              }}
            >
              {description}
            </Typography>
          </Box>
        </Box>
      </ButtonBase>
    </Grid>
  );
};

export default function SecretariaIndex() {
  return (
    <Stack gap={3}>
      <Typography variant="h5" fontWeight={800}>Secretaría</Typography>
      <Typography color="text.secondary">Centro de operaciones agrupado por módulos</Typography>

      {/* Usuarios y roles */}
      <Stack gap={1}>
        <Typography variant="subtitle1" fontWeight={700}>Usuarios y roles</Typography>
        <Grid container spacing={2} alignItems="stretch" justifyContent="flex-start">
          <QuickActionCard
            title="Cargar Docentes"
            description="Alta y edición de docentes del sistema."
            icon={<PersonIcon />}
            path="/secretaria/docentes"
          />
          <QuickActionCard
            title="Asignar Rol"
            description="Gestionar permisos y roles de usuarios."
            icon={<AssignmentIndIcon />}
            path="/secretaria/asignar-rol"
          />
        </Grid>
      </Stack>

      {/* Estructura académica */}
      <Stack gap={1}>
        <Typography variant="subtitle1" fontWeight={700}>Estructura académica</Typography>
        <Grid container spacing={2} alignItems="stretch" justifyContent="flex-start">
          <QuickActionCard
            title="Cargar Profesorado"
            description="Crear y administrar profesorados/carreras."
            icon={<SchoolIcon />}
            path="/secretaria/profesorado"
          />
          <QuickActionCard
            title="Planes de Estudio"
            description="Ver y cargar planes por profesorado."
            icon={<LibraryBooksIcon />}
            path="/secretaria/profesorado"
          />
          <QuickActionCard
            title="Materias"
            description="Gestionar materias dentro del plan."
            icon={<ArticleIcon />}
            path="/secretaria/profesorado"
          />
          <QuickActionCard
            title="Correlatividades"
            description="Definir requisitos y correlatividades entre materias."
            icon={<LinkIcon />}
            path="/secretaria/correlatividades"
          />
        </Grid>
      </Stack>

      {/* Gestión académica */}
      <Stack gap={1}>
        <Typography variant="subtitle1" fontWeight={700}>Gestión académica</Typography>
        <Grid container spacing={2} alignItems="stretch" justifyContent="flex-start">
          <QuickActionCard
            title="Formalizar Inscripción"
            description="Confirmar preinscripción presencial: edición de datos y documentación."
            icon={<AssignmentIndIcon />}
            path="/secretaria/confirmar-inscripcion"
          />
          <QuickActionCard
            title="Cargar Horario"
            description="Armar y publicar horarios de cursada."
            icon={<EventNoteIcon />}
            path="/secretaria/horarios"
          />
          <QuickActionCard
            title="Comisiones"
            description="Crear y administrar comisiones por materia y turno."
            icon={<ClassIcon />}
            path="/secretaria/comisiones"
          />
          <QuickActionCard
            title="Mesas de Examen"
            description="Crear y gestionar mesas por periodo."
            icon={<EventNoteIcon />}
            path="/secretaria/mesas"
          />
          <QuickActionCard
            title="Pedidos de Analítico"
            description="Listar, crear por DNI y descargar PDF."
            icon={<ArticleIcon />}
            path="/secretaria/analiticos"
          />
          <QuickActionCard
            title="Carga de Notas"
            description="Planilla de regularidad/promoción y registro de notas."
            icon={<FactCheckIcon />}
            path="/secretaria/carga-notas"
          />
          <QuickActionCard
            title="Cátedra - Docente"
            description="Asignar docentes a cátedras y comisiones."
            icon={<SchoolOutlinedIcon />}
            path="/secretaria/catedra-docente"
          />
          <QuickActionCard
            title="Habilitar Fechas"
            description="Configurar periodos y fechas clave."
            icon={<EventAvailableIcon />}
            path="/secretaria/habilitar-fechas"
          />
        </Grid>
      </Stack>
    </Stack>
  );
}
