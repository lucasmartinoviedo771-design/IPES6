import { useMemo } from "react";
import { hasCapability, hasAnyRole } from "@/utils/roles";
import { ROLE_NAV_MAP } from "./constants";
import type { User } from "@/context/AuthContext";

/**
 * Hook central de permisos de navegación.
 * Usa el campo `capabilities` del usuario (devuelto por el backend en /profile y /login)
 * como fuente de verdad, eliminando los sets de roles hardcodeados.
 *
 * Compatible con el sistema de roleOverride (impersonation) para admins.
 */
export const useNavPermissions = (user: User, roleOverride: string | null) => {
  // Cuando hay roleOverride activo, restringimos según ROLE_NAV_MAP (para simulación de admin)
  const allowedNavSet = useMemo(() => {
    if (!roleOverride) return null;
    const entries = ROLE_NAV_MAP[roleOverride];
    if (!entries || entries.length === 0) return null;
    return new Set(entries);
  }, [roleOverride]);

  const isNavAllowed = (key: string, capabilityCheck: boolean) => {
    if (roleOverride) {
      return allowedNavSet ? allowedNavSet.has(key) : false;
    }
    return capabilityCheck;
  };

  const can = (capability: string) => hasCapability(user, capability);

  const dashboardVisible     = isNavAllowed("dashboard",     can("ver_dashboard"));
  const canPreins            = isNavAllowed("preinscripciones", can("gestionar_preinscripcion"));
  const canSeeCarreras       = isNavAllowed("carreras",      can("ver_estructura"));
  const canSeeReportes       = isNavAllowed("reportes",      can("ver_reportes") && (can("editar_documentacion") || !can("gestionar_preinscripcion")));
  const canSecretaria        = isNavAllowed("secretaria",    can("ver_estudiantes") && can("editar_documentacion"));
  const canBedeles           = isNavAllowed("bedeles",       can("editar_documentacion") || can("carga_regularidades") || can("ver_documentacion"));
  const canDocentesPanel     = isNavAllowed("docentes",      can("carga_regularidades") || can("editar_estructura"));
  const canTutoriasPanel     = isNavAllowed("tutorias",      can("gestionar_ci") && !can("editar_estudiantes") && !can("gestionar_preinscripcion"));
  const canEquivalenciasPanel = isNavAllowed("equivalencias", can("revisar_equivalencias") || can("gestionar_equivalencias"));
  const canTitulosPanel      = isNavAllowed("titulos",       can("gestionar_titulos") || (can("ver_analiticos") && can("editar_documentacion")));
  const canCoordinacionPanel = isNavAllowed("coordinacion",  can("ver_estructura") && !can("editar_estudiantes") && !can("gestionar_preinscripcion"));
  const canJefaturaPanel     = isNavAllowed("jefatura",      can("ver_reportes") && !can("editar_estudiantes") && !can("gestionar_preinscripcion"));
  const canAsistenciaReportes = isNavAllowed("asistencia",   can("ver_asistencia"));
  const canCursoIntro        = isNavAllowed("cursoIntro",    can("gestionar_ci"));
  const canEstudiantePortal  = isNavAllowed("estudiante",    hasAnyRole(user, ["estudiante"]));
  const canEstudiantePanel   = isNavAllowed("estudiante",    can("ver_estudiantes") && !hasAnyRole(user, ["estudiante"]));
  const canPrimeraCarga      = isNavAllowed("primeraCarga",  can("primera_carga"));
  const canAttpPanel         = isNavAllowed("attp",          !!user?.is_superuser || ((user?.roles ?? []).includes("attp") && !can("editar_estudiantes")));
  const canRectoradoPanel    = isNavAllowed("rectorado",     !!user?.is_superuser || ((user?.roles ?? []).includes("rectorado") && !can("editar_estudiantes")));
  const canUseMessages       = isNavAllowed("mensajes",      can("enviar_mensajes") || !!(user));

  return {
    dashboardVisible,
    canPreins,
    canSeeCarreras,
    canSeeReportes,
    canSecretaria,
    canBedeles,
    canDocentesPanel,
    canTutoriasPanel,
    canEquivalenciasPanel,
    canTitulosPanel,
    canCoordinacionPanel,
    canJefaturaPanel,
    canAsistenciaReportes,
    canCursoIntro,
    canEstudiantePortal,
    canEstudiantePanel,
    canPrimeraCarga,
    canUseMessages,
    canAttpPanel,
    canRectoradoPanel,
  };
};
