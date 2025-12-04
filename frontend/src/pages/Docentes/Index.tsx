import RoleDashboard, { RoleDashboardSection } from "@/components/roles/RoleDashboard";
import { DASHBOARD_ITEMS } from "@/components/roles/dashboardItems";

const sections: RoleDashboardSection[] = [
  {
    title: "Actas y calificaciones",
    items: [
      {
        ...DASHBOARD_ITEMS.REGULARIDAD_CARGA,
        subtitle: "Completa o revisa las planillas de cursada habilitadas.",
      },
      {
        ...DASHBOARD_ITEMS.ACTAS_FINALES,
        subtitle: "Carga las notas finales de la mesa en la que integrás el tribunal.",
      },
      DASHBOARD_ITEMS.ACTA_MANUAL,
    ],
  },
  {
    title: "Operativa diaria",
    items: [
      {
        ...DASHBOARD_ITEMS.DOCENTE_ASISTENCIA,
        subtitle: "Registra o consulta tu asistencia en el campus.",
      },
      {
        ...DASHBOARD_ITEMS.MENSAJES,
        subtitle: "Comunicate con Secretaría o con tus estudiantes.",
      },
      {
        title: "Mis comisiones",
        subtitle: "Consulta las materias asignadas y los inscriptos.",
        icon: DASHBOARD_ITEMS.MATERIAS_ABM.icon,
        path: "/docentes/mis-materias",
      },
      {
        title: "Demo Tomar Asistencia",
        subtitle: "Vista previa de la pantalla de toma de asistencia.",
        icon: DASHBOARD_ITEMS.DOCENTE_ASISTENCIA.icon,
        path: "/docentes/demo-asistencia",
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
