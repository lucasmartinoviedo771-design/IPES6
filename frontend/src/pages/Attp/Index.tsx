import LockResetIcon from "@mui/icons-material/LockReset";
import RoleDashboard, { RoleDashboardSection } from "@/components/roles/RoleDashboard";
import { DASHBOARD_ITEMS } from "@/components/roles/dashboardItems";

const sections: RoleDashboardSection[] = [
  {
    title: "Inscripciones (escritura)",
    items: [
      {
        ...DASHBOARD_ITEMS.FORMALIZAR_INSCRIPCION,
        title: "Inscripción a carreras",
        subtitle: "Formalizá y confirmá inscripciones de aspirantes a profesorados.",
      },
      {
        title: "Primera carga",
        subtitle: "Registro inicial de estudiantes, actas y regularidades históricas.",
        icon: DASHBOARD_ITEMS.ACTAS_FINALES.icon,
        path: "/admin/primera-carga",
      },
      {
        ...DASHBOARD_ITEMS.REGULARIDAD_CARGA,
        title: "Inscripción a E.C.",
        subtitle: "Gestioná la inscripción de estudiantes a espacios curriculares.",
      },
    ],
  },
  {
    title: "Horarios",
    items: [
      DASHBOARD_ITEMS.HORARIOS_PUBLICADOS,
      DASHBOARD_ITEMS.HORARIO_CURSADA,
    ],
  },
  {
    title: "Estudiantes",
    items: [
      {
        title: "Resetear contraseña",
        subtitle: "Restablecé la contraseña de un estudiante usando su DNI.",
        icon: <LockResetIcon />,
        path: "/attp/resetear-password",
      },
    ],
  },
  {
    title: "Consulta y supervisión (solo lectura)",
    items: [
      DASHBOARD_ITEMS.STUDENT_MANAGEMENT,
      DASHBOARD_ITEMS.ACTAS_Y_NOTAS_GENERAL,
      DASHBOARD_ITEMS.REPORTES,
      DASHBOARD_ITEMS.MENSAJES,
    ],
  },
];

export default function AttpIndex() {
  return (
    <RoleDashboard
      title="A.T.T.P."
      subtitle="Gestión de horarios, inscripciones a carreras y espacios curriculares. Consulta en modo solo lectura para el resto."
      sections={sections}
    />
  );
}
