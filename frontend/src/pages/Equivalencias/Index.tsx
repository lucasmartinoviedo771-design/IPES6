import ArticleIcon from "@mui/icons-material/Article";
import ChecklistIcon from "@mui/icons-material/Checklist";
import InsightsIcon from "@mui/icons-material/Insights";

import RoleDashboard, { RoleDashboardSection } from "@/components/roles/RoleDashboard";

const sections: RoleDashboardSection[] = [
  {
    title: "Evaluación y dictamen",
    items: [
      {
        title: "Bandeja de pedidos",
        subtitle: "Accede a los anexos A/B pendientes para emitir el dictamen.",
        icon: <ChecklistIcon />,
        path: "/secretaria/pedidos-equivalencias?workflow=review",
      },
      {
        title: "Disposiciones registradas",
        subtitle: "Consulta o descarga las disposiciones emitidas para cada estudiante.",
        icon: <ArticleIcon />,
        path: "/secretaria/pedidos-equivalencias?view=disposiciones",
      },
      {
        title: "Reportes de equivalencias",
        subtitle: "Analiza métricas y exporta listados para reuniones o auditorías.",
        icon: <InsightsIcon />,
        path: "/reportes",
      },
    ],
  },
];

export default function EquivalenciasIndex() {
  return (
    <RoleDashboard
      title="Equipo de equivalencias"
      subtitle="Accesos directos para evaluar pedidos y emitir disposiciones."
      sections={sections}
    />
  );
}
