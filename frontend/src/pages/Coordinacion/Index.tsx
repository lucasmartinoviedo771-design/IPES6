import AssessmentIcon from "@mui/icons-material/Assessment";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import LinkIcon from "@mui/icons-material/Link";
import MarkEmailUnreadIcon from "@mui/icons-material/MarkEmailUnread";
import ScheduleIcon from "@mui/icons-material/Schedule";

import RoleDashboard, { RoleDashboardSection } from "@/components/roles/RoleDashboard";

const sections: RoleDashboardSection[] = [
  {
    title: "Planificación académica",
    items: [
      {
        title: "Horarios y comisiones",
        subtitle: "Organiza las comisiones y publica horarios oficiales.",
        icon: <ScheduleIcon />,
        path: "/secretaria/horarios",
      },
      {
        title: "Mesas de examen",
        subtitle: "Coordina mesas ordinarias, extraordinarias y especiales.",
        icon: <CalendarMonthIcon />,
        path: "/secretaria/mesas",
      },
      {
        title: "Planes y correlatividades",
        subtitle: "Revisa requisitos académicos y solicita ajustes.",
        icon: <LinkIcon />,
        path: "/secretaria/correlatividades",
      },
    ],
  },
  {
    title: "Seguimiento e informes",
    items: [
      {
        title: "Reportes y tableros",
        subtitle: "Analiza indicadores de cursada, mesas y equivalencias.",
        icon: <AssessmentIcon />,
        path: "/reportes",
      },
      {
        title: "Mensajes institucionales",
        subtitle: "Comparte novedades con equipos docentes o estudiantes.",
        icon: <MarkEmailUnreadIcon />,
        path: "/mensajes",
      },
    ],
  },
];

export default function CoordinacionIndex() {
  return (
    <RoleDashboard
      title="Coordinación académica"
      subtitle="Accesos diarios para la planificación de carreras y el seguimiento institucional."
      sections={sections}
    />
  );
}
