import { useMemo } from "react";

import RoleDashboard, { RoleDashboardSection } from "@/components/roles/RoleDashboard";
import { DASHBOARD_ITEMS } from "@/components/roles/dashboardItems";
import type { SectionCardProps } from "@/components/secretaria/SectionCard";
import { useAuth } from "@/context/AuthContext";
import { hasAnyRole } from "@/utils/roles";

export default function BedelesIndex() {
  const { user } = useAuth();

  const canManageStudents = hasAnyRole(user, ["admin", "secretaria", "bedel"]);
  const canManageStructure = hasAnyRole(user, ["admin", "secretaria", "bedel"]);
  const canFormalize = hasAnyRole(user, ["admin", "secretaria", "bedel"]);
  const canManageAnaliticos = hasAnyRole(user, ["admin", "secretaria", "bedel", "tutor"]);
  const canManageEquivalencias = hasAnyRole(user, ["admin", "secretaria", "bedel"]);
  const canCursoIntro = hasAnyRole(user, ["admin", "secretaria", "bedel", "curso_intro"]);
  const canManageNotas = hasAnyRole(user, ["admin", "secretaria", "bedel"]);

  const cursoIntroItems = useMemo<SectionCardProps[]>(
    () =>
      canCursoIntro
        ? [
            DASHBOARD_ITEMS.CURSO_INTRO_PANEL,
            DASHBOARD_ITEMS.CURSO_INTRO_LISTADO,
            DASHBOARD_ITEMS.CURSO_INTRO_PENDIENTES,
          ]
        : [],
    [canCursoIntro],
  );

  const sections: RoleDashboardSection[] = useMemo(
    () => [
      {
        title: "Usuarios y roles",
        items: canManageStudents ? [DASHBOARD_ITEMS.STUDENT_MANAGEMENT] : [],
      },
      {
        title: "Estructura académica",
        items: canManageStructure
          ? [
              DASHBOARD_ITEMS.PROFESORADO_ABM,
              DASHBOARD_ITEMS.PLANES_ESTUDIO_ABM,
              DASHBOARD_ITEMS.MATERIAS_ABM,
              DASHBOARD_ITEMS.CORRELATIVIDADES_ABM,
            ]
          : [],
      },
      {
        title: "Gestión académica - Bedeles",
        items: [
          ...(canFormalize ? [DASHBOARD_ITEMS.FORMALIZAR_INSCRIPCION] : []),
          ...(canManageAnaliticos ? [DASHBOARD_ITEMS.ANALYTICOS] : []),
          ...(canManageEquivalencias ? [DASHBOARD_ITEMS.EQUIV_LISTADO_GENERAL] : []),
          ...cursoIntroItems,
        ],
      },
      {
        title: "Carga de notas",
        items: canManageNotas
          ? [
              DASHBOARD_ITEMS.REGULARIDAD_CARGA,
              DASHBOARD_ITEMS.ACTAS_FINALES,
              DASHBOARD_ITEMS.EQUIV_DISPOSICIONES,
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
      cursoIntroItems,
    ],
  );

  return (
    <RoleDashboard
      title="Bedeles"
      subtitle="Accesos rápidos a la operatoria diaria del equipo de bedelía."
      sections={sections}
    />
  );
}
