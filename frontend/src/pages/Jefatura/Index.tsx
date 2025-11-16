import AssessmentIcon from "@mui/icons-material/Assessment";
import DateRangeIcon from "@mui/icons-material/DateRange";
import GavelIcon from "@mui/icons-material/Gavel";
import MarkEmailUnreadIcon from "@mui/icons-material/MarkEmailUnread";
import SchoolIcon from "@mui/icons-material/School";

import RoleDashboard, { RoleDashboardSection } from "@/components/roles/RoleDashboard";

const sections: RoleDashboardSection[] = [
  {
    title: "Supervisión académica",
    items: [
      {
        title: "Habilitar / controlar fechas",
        subtitle: "Autoriza periodos de inscripción, mesas y trámites especiales.",
        icon: <DateRangeIcon />,
        path: "/secretaria/habilitar-fechas",
      },
      {
        title: "Pedidos de equivalencias",
        subtitle: "Revisa el avance del circuito y desbloquea casos excepcionales.",
        icon: <SchoolIcon />,
        path: "/secretaria/pedidos-equivalencias",
      },
      {
        title: "Actas y notas",
        subtitle: "Consulta el estado de planillas y actas finales.",
        icon: <GavelIcon />,
        path: "/secretaria/carga-notas",
      },
    ],
  },
  {
    title: "Informes y comunicación",
    items: [
      {
        title: "Reportes institucionales",
        subtitle: "Tableros y exportaciones para reuniones de gestión.",
        icon: <AssessmentIcon />,
        path: "/reportes",
      },
      {
        title: "Mensajes y avisos",
        subtitle: "Canal oficial para comunicados a equipos y estudiantes.",
        icon: <MarkEmailUnreadIcon />,
        path: "/mensajes",
      },
    ],
  },
];

export default function JefaturaIndex() {
  return (
    <RoleDashboard
      title="Jefatura / Dirección"
      subtitle="Resumen operativo para jefaturas, dirección y áreas de gestión."
      sections={sections}
    />
  );
}
