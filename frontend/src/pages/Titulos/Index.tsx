import GavelIcon from "@mui/icons-material/Gavel";
import MenuBookIcon from "@mui/icons-material/MenuBook";
import NotificationsActiveIcon from "@mui/icons-material/NotificationsActive";
import MarkEmailUnreadIcon from "@mui/icons-material/MarkEmailUnread";
import DescriptionIcon from "@mui/icons-material/Description";

import RoleDashboard, { RoleDashboardSection } from "@/components/roles/RoleDashboard";

const sections: RoleDashboardSection[] = [
  {
    title: "Documentación de Títulos",
    items: [
      {
        title: "Registro de notas / disposiciones",
        subtitle: "Completa los datos finales de cada equivalencia aprobada.",
        icon: <GavelIcon />,
        path: "/secretaria/pedidos-equivalencias?workflow=titulos",
      },
      {
        title: "Analíticos y certificados",
        subtitle: "Coordina la emisión de analíticos y constancias asociadas.",
        icon: <MenuBookIcon />,
        path: "/secretaria/analiticos",
      },
      {
        title: "Actas finales registradas",
        subtitle: "Verifica el acta de examen asociada antes de emitir la disposición.",
        icon: <DescriptionIcon />,
        path: "/secretaria/carga-notas?tab=finales&scope=finales",
      },
    ],
  },
  {
    title: "Notificaciones y seguimiento",
    items: [
      {
        title: "Pedidos listos para notificar",
        subtitle: "Controla qué equivalencias pueden informarse al estudiante.",
        icon: <NotificationsActiveIcon />,
        path: "/secretaria/pedidos-equivalencias?workflow=notified",
      },
      {
        title: "Mensajes institucionales",
        subtitle: "Comunica disponibilidad de certificados o retiros.",
        icon: <MarkEmailUnreadIcon />,
        path: "/mensajes",
      },
    ],
  },
];

export default function TitulosIndex() {
  return (
    <RoleDashboard
      title="Títulos"
      subtitle="Panel de trabajo del Departamento de Títulos y certificaciones."
      sections={sections}
    />
  );
}
