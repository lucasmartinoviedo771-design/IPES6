import ArticleIcon from "@mui/icons-material/Article";
import DescriptionIcon from "@mui/icons-material/Description";
import GavelIcon from "@mui/icons-material/Gavel";
import MarkEmailUnreadIcon from "@mui/icons-material/MarkEmailUnread";
import ScheduleIcon from "@mui/icons-material/Schedule";

import RoleDashboard, { RoleDashboardSection } from "@/components/roles/RoleDashboard";

const sections: RoleDashboardSection[] = [
  {
    title: "Actas y calificaciones",
    items: [
      {
        title: "Planillas de regularidad",
        subtitle: "Completa o revisa las planillas de cursada habilitadas.",
        icon: <ArticleIcon />,
        path: "/secretaria/carga-notas?tab=regularidad",
      },
      {
        title: "Actas finales (tribunal)",
        subtitle: "Carga las notas finales de la mesa en la que integrás el tribunal.",
        icon: <GavelIcon />,
        path: "/secretaria/carga-notas?tab=finales&scope=finales",
      },
      {
        title: "Acta manual / extraordinaria",
        subtitle: "Genera un acta manual cuando se requiere un circuito especial.",
        icon: <DescriptionIcon />,
        path: "/secretaria/actas-examen",
      },
    ],
  },
  {
    title: "Operativa diaria",
    items: [
      {
        title: "Control de asistencia docente",
        subtitle: "Registra o consulta tu asistencia en el campus.",
        icon: <ScheduleIcon />,
        path: "/docentes/asistencia",
      },
      {
        title: "Mensajes institucionales",
        subtitle: "Comunicate con Secretaría o con tus estudiantes.",
        icon: <MarkEmailUnreadIcon />,
        path: "/mensajes",
      },
    ],
  },
];

export default function DocentesIndex() {
  return (
    <RoleDashboard
      title="Docentes"
      subtitle="Accesos rápidos para el tribunal y la gestión diaria del cuerpo docente."
      sections={sections}
    />
  );
}
