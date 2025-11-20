import RoleDashboard, { RoleDashboardSection } from "@/components/roles/RoleDashboard";
import { DASHBOARD_ITEMS } from "@/components/roles/dashboardItems";

const sections: RoleDashboardSection[] = [
  {
    title: "Acompañamiento académico",
    items: [
      DASHBOARD_ITEMS.TRAJECTORY,
      DASHBOARD_ITEMS.CURSO_INTRO_PENDIENTES,
      {
        ...DASHBOARD_ITEMS.ANALYTICOS,
        subtitle: "Revisa el estado para acompañar casos especiales.",
      },
      {
        ...DASHBOARD_ITEMS.MENSAJES,
        title: "Mensajes a estudiantes",
        subtitle: "Envío de recordatorios o comunicados institucionales.",
      },
    ],
  },
  {
    title: "Circuito de equivalencias",
    items: [
      DASHBOARD_ITEMS.EQUIV_PENDING_DOCS,
      DASHBOARD_ITEMS.EQUIV_WORKFLOW_TITULOS,
      {
        ...DASHBOARD_ITEMS.EQUIV_DISPOSICIONES,
        subtitle: "Consulta los dictámenes emitidos para informar al estudiante.",
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
