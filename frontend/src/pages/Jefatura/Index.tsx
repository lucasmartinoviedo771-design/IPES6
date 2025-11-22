import RoleDashboard, { RoleDashboardSection } from "@/components/roles/RoleDashboard";
import { DASHBOARD_ITEMS } from "@/components/roles/dashboardItems";

const sections: RoleDashboardSection[] = [
  {
    title: "Supervisión académica",
    items: [
      DASHBOARD_ITEMS.HABILITAR_FECHAS,
      DASHBOARD_ITEMS.EQUIV_LISTADO_GENERAL,
      DASHBOARD_ITEMS.ACTAS_Y_NOTAS_GENERAL,
    ],
  },
  {
    title: "Informes y comunicación",
    items: [
      DASHBOARD_ITEMS.REPORTES,
      {
        ...DASHBOARD_ITEMS.MENSAJES,
        title: "Mensajes y avisos",
        subtitle: "Canal oficial para comunicados a equipos y estudiantes.",
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
