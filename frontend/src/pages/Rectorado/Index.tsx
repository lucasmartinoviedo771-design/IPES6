import RoleDashboard, { RoleDashboardSection } from "@/components/roles/RoleDashboard";
import { DASHBOARD_ITEMS } from "@/components/roles/dashboardItems";

const sections: RoleDashboardSection[] = [
  {
    title: "Supervisión institucional",
    items: [
      DASHBOARD_ITEMS.STUDENT_MANAGEMENT,
      DASHBOARD_ITEMS.HORARIO_CURSADA,
      DASHBOARD_ITEMS.ACTAS_Y_NOTAS_GENERAL,
    ],
  },
  {
    title: "Mesas y actas",
    items: [
      DASHBOARD_ITEMS.ACTAS_FINALES,
      DASHBOARD_ITEMS.ACTA_MANUAL,
    ],
  },
  {
    title: "Informes y comunicación",
    items: [
      DASHBOARD_ITEMS.REPORTES,
      DASHBOARD_ITEMS.MENSAJES,
    ],
  },
];

export default function RectoradoIndex() {
  return (
    <RoleDashboard
      title="Rectorado"
      subtitle="Vista institucional de gestión académica y supervisión (solo lectura)."
      sections={sections}
    />
  );
}
