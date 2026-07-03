import { useMemo } from "react";
import Stack from "@mui/material/Stack";

import RoleDashboard, { RoleDashboardSection } from "@/components/roles/RoleDashboard";
import { DASHBOARD_ITEMS } from "@/components/roles/dashboardItems";
import { useAuth } from "@/context/AuthContext";
import { hasCapability } from "@/utils/roles";
import ResidenciasCondicionalesWidget from "@/components/dashboard/ResidenciasCondicionalesWidget";

export default function BedelesIndex() {
  const { user } = useAuth();

  const canManageStudents = hasCapability(user, "ver_estudiantes");
  const canManageStructure = hasCapability(user, "ver_estructura");
  const canFormalize = hasCapability(user, "gestionar_preinscripcion");
  const canManageAnaliticos = hasCapability(user, "ver_analiticos");
  const canManageEquivalencias = hasCapability(user, "ver_documentacion");
  const canCursoIntro = hasCapability(user, "gestionar_ci");
  const canManageNotas = hasCapability(user, "carga_regularidades") || hasCapability(user, "carga_finales") || hasCapability(user, "acta_manual");

  const sections: RoleDashboardSection[] = useMemo(
    () => [
      {
        title: "Usuarios y roles",
        items: canManageStudents
          ? [DASHBOARD_ITEMS.STUDENT_MANAGEMENT, DASHBOARD_ITEMS.STUDENT_DOCUMENTATION]
          : [],
      },
      {
        title: "Estructura académica",
        items: canManageStructure
          ? [
            DASHBOARD_ITEMS.CARRERAS_VIEW,
            DASHBOARD_ITEMS.PROFESORADO_ABM,
            DASHBOARD_ITEMS.CORRELATIVIDADES_ABM,
          ]
          : [],
      },
      {
        title: "Gestión académica",
        items: [
          ...(canFormalize ? [DASHBOARD_ITEMS.PREINSCRIPCIONES, DASHBOARD_ITEMS.FORMALIZAR_INSCRIPCION] : []),
          ...(canManageAnaliticos ? [DASHBOARD_ITEMS.ANALYTICOS] : []),
          ...(canManageEquivalencias ? [DASHBOARD_ITEMS.EQUIV_LISTADO_GENERAL] : []),
          ...(canManageStructure ? [DASHBOARD_ITEMS.DOCENTE_MIS_COMISIONES, DASHBOARD_ITEMS.CORRELATIVIDADES_ANALISIS, DASHBOARD_ITEMS.AUDITORIA_INCONSISTENCIAS, DASHBOARD_ITEMS.RESGUARDO_MATERIAS] : []),
        ],
      },
      {
        title: "Horarios",
        items: [DASHBOARD_ITEMS.HORARIO_CURSADA],
      },
      ...(canCursoIntro
        ? [
          {
            title: "Gestión académica - CI",
            items: [DASHBOARD_ITEMS.CURSO_INTRO_PANEL],
          } satisfies RoleDashboardSection,
        ]
        : []),
      {
        title: "Carga de notas",
        items: canManageNotas
          ? [
            DASHBOARD_ITEMS.REGULARIDAD_CARGA,
            DASHBOARD_ITEMS.ACTAS_FINALES,
            DASHBOARD_ITEMS.ACTA_MANUAL,
            DASHBOARD_ITEMS.EQUIV_CARGA_VALIDADA,
          ]
          : [],
      },
    ],
    [
      canFormalize,
      canManageAnaliticos,
      canManageEquivalencias,
      canManageNotas,
      canManageStudents,
      canManageStructure,
      canCursoIntro,
    ],
  );

  return (
    <Stack spacing={4}>
      <RoleDashboard
        title="Bedeles"
        subtitle="Accesos rápidos a la operatoria diaria del equipo de bedelía."
        sections={sections}
      />
      <ResidenciasCondicionalesWidget />
    </Stack>
  );
}
