import AssignmentTurnedInIcon from "@mui/icons-material/AssignmentTurnedIn";
import DescriptionIcon from "@mui/icons-material/Description";
import Diversity3Icon from "@mui/icons-material/Diversity3";
import EmojiPeopleIcon from "@mui/icons-material/EmojiPeople";
import MarkEmailUnreadIcon from "@mui/icons-material/MarkEmailUnread";
import SchoolIcon from "@mui/icons-material/School";

import RoleDashboard, { RoleDashboardSection } from "@/components/roles/RoleDashboard";

const sections: RoleDashboardSection[] = [
  {
    title: "Circuito de equivalencias",
    items: [
      {
        title: "Documentación recibida",
        subtitle: "Controlá la documentación presentada y registrá observaciones.",
        icon: <DescriptionIcon />,
        path: "/secretaria/pedidos-equivalencias?workflow=pending_docs",
      },
      {
        title: "Seguimiento y notificaciones",
        subtitle: "Enviá avisos a los estudiantes una vez que Títulos finaliza el trámite.",
        icon: <AssignmentTurnedInIcon />,
        path: "/secretaria/pedidos-equivalencias?workflow=titulos",
      },
      {
        title: "Disposiciones otorgadas",
        subtitle: "Listas listas para informar o imprimir según lo requiera el estudiante.",
        icon: <SchoolIcon />,
        path: "/secretaria/pedidos-equivalencias?view=disposiciones",
      },
    ],
  },
  {
    title: "Acompañamiento académico",
    items: [
      {
        title: "Curso introductorio",
        subtitle: "Monitoreá cohortes, asistencia y pendientes del CI.",
        icon: <EmojiPeopleIcon />,
        path: "/secretaria/curso-introductorio",
      },
      {
        title: "Pedidos de analítico / constancias",
        subtitle: "Revisa el estado de pedidos especiales para acompañar trayectorias.",
        icon: <Diversity3Icon />,
        path: "/secretaria/analiticos",
      },
      {
        title: "Mensajes a estudiantes",
        subtitle: "Envía recordatorios y comunicaciones institucionales.",
        icon: <MarkEmailUnreadIcon />,
        path: "/mensajes",
      },
    ],
  },
];

export default function TutoriasIndex() {
  return (
    <RoleDashboard
      title="Tutorías"
      subtitle="Panel operativo para documentar y acompañar las trayectorias estudiantiles."
      sections={sections}
    />
  );
}
