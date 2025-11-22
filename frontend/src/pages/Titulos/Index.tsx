import RoleDashboard, { RoleDashboardSection } from "@/components/roles/RoleDashboard";
import { DASHBOARD_ITEMS } from "@/components/roles/dashboardItems";

const sections: RoleDashboardSection[] = [
  {
    title: "Documentación de Títulos",
    items: [
      DASHBOARD_ITEMS.EQUIV_WORKFLOW_TITULOS,
      DASHBOARD_ITEMS.ANALYTICOS,
      {
        ...DASHBOARD_ITEMS.ACTAS_FINALES,
        subtitle: "Verifica el acta de examen asociada antes de emitir la disposición.",
      },
      DASHBOARD_ITEMS.REGULARIDAD_CONSULTA,
      DASHBOARD_ITEMS.PLANILLAS_FINALES_CONSULTA,
    ],
  },
  {
    title: "Notificaciones y seguimiento",
    items: [
      {
        ...DASHBOARD_ITEMS.MENSAJES,
        subtitle: "Comunica disponibilidad de certificados o retiros.",
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
