import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import MenuBookIcon from "@mui/icons-material/MenuBook";
import ScheduleIcon from "@mui/icons-material/Schedule";
import AssessmentIcon from "@mui/icons-material/Assessment";
import MarkEmailUnreadIcon from "@mui/icons-material/MarkEmailUnread";
import ChecklistIcon from "@mui/icons-material/Checklist";
import AssignmentTurnedInIcon from "@mui/icons-material/AssignmentTurnedIn";
import SchoolIcon from "@mui/icons-material/School";
import ArticleIcon from "@mui/icons-material/Article";
import GavelIcon from "@mui/icons-material/Gavel";
import DescriptionIcon from "@mui/icons-material/Description";
import TaskAltIcon from "@mui/icons-material/TaskAlt";
import DateRangeIcon from "@mui/icons-material/DateRange";
import SummarizeIcon from "@mui/icons-material/Summarize";
import InsightsIcon from "@mui/icons-material/Insights";
import PeopleIcon from "@mui/icons-material/People";
import LinkIcon from "@mui/icons-material/Link";
import AssignmentIndIcon from "@mui/icons-material/AssignmentInd";
import EventAvailableIcon from "@mui/icons-material/EventAvailable";
import FactCheckIcon from "@mui/icons-material/FactCheck";
import HourglassBottomIcon from "@mui/icons-material/HourglassBottom";
import WorkspacesIcon from "@mui/icons-material/Workspaces";

import type { SectionCardProps } from "@/components/secretaria/SectionCard";

export const DASHBOARD_ITEMS = {
  STUDENT_MANAGEMENT: {
    title: "Gestionar estudiantes",
    subtitle: "Revisión de legajos, actualización de datos y seguimiento.",
    icon: <PeopleIcon />,
    path: "/secretaria/estudiantes",
  },
  PROFESORADO_ABM: {
    title: "Cargar profesorados",
    subtitle: "Crear y administrar carreras y sus datos generales.",
    icon: <SchoolIcon />,
    path: "/secretaria/profesorado",
  },
  PLANES_ESTUDIO_ABM: {
    title: "Planes de estudio",
    subtitle: "Cargar o editar la estructura académica vigente.",
    icon: <ArticleIcon />,
    path: "/secretaria/profesorado",
  },
  MATERIAS_ABM: {
    title: "Materias",
    subtitle: "Gestioná los espacios curriculares por profesorado.",
    icon: <MenuBookIcon />,
    path: "/secretaria/profesorado",
  },
  CORRELATIVIDADES_ABM: {
    title: "Correlatividades",
    subtitle: "Definí requisitos y trayectos previos por materia.",
    icon: <LinkIcon />,
    path: "/secretaria/correlatividades",
  },
  FORMALIZAR_INSCRIPCION: {
    title: "Formalizar inscripción",
    subtitle: "Confirmá preinscripciones y documentación presentada.",
    icon: <AssignmentIndIcon />,
    path: "/secretaria/confirmar-inscripcion",
  },
  TRAJECTORY: {
    title: "Trayectoria del estudiante",
    subtitle: "Consultá el avance de cada cohorte (solo lectura).",
    icon: <TrendingUpIcon />,
    path: "/alumnos/trayectoria",
  },
  CURSO_INTRO_PANEL: {
    title: "Curso introductorio",
    subtitle: "Gestioná cohortes, registros y asistencia en un solo lugar.",
    icon: <EventAvailableIcon />,
    path: "/secretaria/curso-introductorio",
  },
  CURSO_INTRO_LISTADO: {
    title: "Listado de inscriptos CI",
    subtitle: "Reporte filtrable por turno o profesorado.",
    icon: <FactCheckIcon />,
    path: "/secretaria/curso-introductorio?view=inscriptos",
  },
  CURSO_INTRO_PENDIENTES: {
    title: "Estudiantes sin CI aprobado",
    subtitle: "Detectá pendientes para convocarlos y completar el circuito.",
    icon: <HourglassBottomIcon />,
    path: "/secretaria/curso-introductorio?view=pendientes",
  },
  ANALYTICOS: {
    title: "Analíticos y certificados",
    subtitle: "Gestioná los pedidos y emití constancias cuando estén listas.",
    icon: <MenuBookIcon />,
    path: "/secretaria/analiticos",
  },
  HORARIOS_PUBLICADOS: {
    title: "Horarios publicados",
    subtitle: "Visualizá las comisiones asignadas por profesorado.",
    icon: <ScheduleIcon />,
    path: "/secretaria/horarios",
  },
  REPORTES: {
    title: "Reportes institucionales",
    subtitle: "Tableros e informes para reuniones de gestión.",
    icon: <AssessmentIcon />,
    path: "/reportes",
  },
  MENSAJES: {
    title: "Mensajes institucionales",
    subtitle: "Comunicate con estudiantes o equipos docentes.",
    icon: <MarkEmailUnreadIcon />,
    path: "/mensajes",
  },
  EQUIV_PENDING_DOCS: {
    title: "Documentación recibida",
    subtitle: "Carga y seguimiento del material entregado por el estudiante.",
    icon: <ChecklistIcon />,
    path: "/secretaria/pedidos-equivalencias?workflow=pending_docs",
  },
  EQUIV_WORKFLOW_TITULOS: {
    title: "Registro de notas / disposiciones",
    subtitle: "Completá los datos finales antes de emitir la disposición.",
    icon: <AssignmentTurnedInIcon />,
    path: "/secretaria/pedidos-equivalencias?workflow=titulos",
  },
  EQUIV_DISPOSICIONES: {
    title: "Disposiciones otorgadas",
    subtitle: "Consultá las resoluciones emitidas para cada estudiante.",
    icon: <SchoolIcon />,
    path: "/secretaria/pedidos-equivalencias?view=disposiciones",
  },
  EQUIV_BANDEJA_REVIEW: {
    title: "Bandeja de pedidos",
    subtitle: "Accedé a los anexos pendientes para emitir dictamen.",
    icon: <ChecklistIcon />,
    path: "/secretaria/pedidos-equivalencias?workflow=review",
  },
  EQUIV_LISTADO_GENERAL: {
    title: "Pedidos de equivalencias",
    subtitle: "Seguimiento general del circuito de equivalencias.",
    icon: <SchoolIcon />,
    path: "/secretaria/pedidos-equivalencias",
  },
  REGULARIDAD_CARGA: {
    title: "Planillas de regularidad",
    subtitle: "Generá y completá las planillas de cursada habilitadas.",
    icon: <ArticleIcon />,
    path: "/secretaria/carga-notas?tab=regularidad",
  },
  REGULARIDAD_CONSULTA: {
    title: "Planillas de regularidad",
    subtitle: "Consultá las planillas registradas por los equipos docentes.",
    icon: <ArticleIcon />,
    path: "/titulos/planillas-regularidad",
  },
  PLANILLAS_FINALES_CONSULTA: {
    title: "Planillas de mesas finales",
    subtitle: "Revisá las actas finales emitidas.",
    icon: <SummarizeIcon />,
    path: "/titulos/planillas-finales",
  },
  ACTAS_FINALES: {
    title: "Actas finales",
    subtitle: "Cargá o consultá las calificaciones de mesas finales.",
    icon: <GavelIcon />,
    path: "/secretaria/carga-notas?tab=finales&scope=finales",
  },
  ACTA_MANUAL: {
    title: "Acta manual / extraordinaria",
    subtitle: "Generá un acta especial cuando el circuito lo requiere.",
    icon: <DescriptionIcon />,
    path: "/secretaria/actas-examen",
  },
  EQUIV_CARGA_VALIDADA: {
    title: "Carga de equivalencias",
    subtitle: "Registra equivalencias validando correlatividades y pendientes.",
    icon: <AssignmentTurnedInIcon />,
    path: "/secretaria/pedidos-equivalencias?workflow=titulos",
  },
  DOCENTE_ASISTENCIA: {
    title: "Control de asistencia docente",
    subtitle: "Registrá o consultá tu asistencia en el campus.",
    icon: <TaskAltIcon />,
    path: "/docentes/asistencia",
  },
  HABILITAR_FECHAS: {
    title: "Habilitar / controlar fechas",
    subtitle: "Autorizá periodos de inscripción, mesas y trámites especiales.",
    icon: <DateRangeIcon />,
    path: "/secretaria/habilitar-fechas",
  },
  ACTAS_Y_NOTAS_GENERAL: {
    title: "Actas y notas",
    subtitle: "Consultá el estado de planillas y actas finales.",
    icon: <GavelIcon />,
    path: "/secretaria/carga-notas",
  },
  EQUIV_REPORTES: {
    title: "Reportes de equivalencias",
    subtitle: "Analizá métricas y exportá listados para auditorías.",
    icon: <InsightsIcon />,
    path: "/reportes",
  },
  DOCENTE_MIS_COMISIONES: {
    title: "Mis comisiones",
    subtitle: "Consulta las materias asignadas y sus inscriptos.",
    icon: <WorkspacesIcon />,
    path: "/docentes/mis-materias",
  },
  EQUIVALENCIAS_GESTION: {
    title: "Gestión de equivalencias",
    subtitle: "Bandeja de pedidos, disposiciones y reportes.",
    icon: <SchoolIcon />,
    path: "/secretaria/pedidos-equivalencias",
  },
} satisfies Record<string, SectionCardProps>;

export type DashboardItemKey = keyof typeof DASHBOARD_ITEMS;
