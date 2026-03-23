import { useMemo } from "react";
import { hasAnyRole } from "@/utils/roles";
import { ROLE_NAV_MAP } from "./constants";

type User = Parameters<typeof hasAnyRole>[0];

export const useNavPermissions = (user: User, roleOverride: string | null) => {
  const allowedNavSet = useMemo(() => {
    if (!roleOverride) return null;
    const entries = ROLE_NAV_MAP[roleOverride];
    if (!entries || entries.length === 0) {
      return null;
    }
    return new Set(entries);
  }, [roleOverride]);

  const isNavAllowed = (key: string, defaultValue: boolean) => {
    if (roleOverride) {
      return allowedNavSet ? allowedNavSet.has(key) : false;
    }
    return defaultValue;
  };

  const dashboardVisible = isNavAllowed("dashboard", hasAnyRole(user, [
    "admin", "secretaria", "bedel", "jefa_aaee", "jefes", "tutor", "coordinador", "consulta"
  ]));
  const canPreins = isNavAllowed("preinscripciones", hasAnyRole(user, ["admin", "secretaria", "bedel"]));
  const canSeeCarreras = isNavAllowed("carreras", hasAnyRole(user, [
    "admin", "secretaria", "bedel", "coordinador", "tutor", "jefes", "jefa_aaee"
  ]));
  const canSeeReportes = isNavAllowed("reportes", hasAnyRole(user, [
    "admin", "secretaria", "bedel", "jefa_aaee", "jefes", "tutor", "coordinador"
  ]));
  const canSecretaria = isNavAllowed("secretaria", hasAnyRole(user, [
    "admin", "secretaria", "bedel", "jefa_aaee", "jefes", "tutor", "coordinador"
  ]));
  const canBedeles = isNavAllowed("bedeles", hasAnyRole(user, [
    "admin", "secretaria", "bedel", "jefa_aaee", "jefes", "tutor", "coordinador"
  ]));
  const canDocentesPanel = isNavAllowed("docentes", hasAnyRole(user, ["docente", "secretaria", "admin", "bedel"]));
  const canTutoriasPanel = isNavAllowed("tutorias", hasAnyRole(user, ["tutor", "secretaria", "admin", "bedel"]));
  const canEquivalenciasPanel = isNavAllowed("equivalencias", hasAnyRole(user, ["equivalencias", "secretaria", "admin", "bedel"]));
  const canTitulosPanel = isNavAllowed("titulos", hasAnyRole(user, ["titulos", "secretaria", "admin"]));
  const canCoordinacionPanel = isNavAllowed("coordinacion", hasAnyRole(user, ["coordinador", "jefes", "jefa_aaee", "secretaria", "admin"]));
  const canJefaturaPanel = isNavAllowed("jefatura", hasAnyRole(user, ["jefes", "jefa_aaee", "secretaria", "admin"]));
  const canAsistenciaReportes = isNavAllowed("asistencia", hasAnyRole(user, ["admin", "secretaria", "bedel"]));
  const canCursoIntro = isNavAllowed("cursoIntro", hasAnyRole(user, ["admin", "secretaria", "bedel", "curso_intro"]));
  const canEstudiantePortal = isNavAllowed("estudiante", hasAnyRole(user, ["estudiante"]));
  const canEstudiantePanel = isNavAllowed("estudiante", hasAnyRole(user, [
    "admin", "secretaria", "bedel", "tutor", "jefes", "jefa_aaee", "coordinador"
  ]));
  const canPrimeraCarga = isNavAllowed("primeraCarga", hasAnyRole(user, ["admin", "secretaria", "bedel"]));
  const canUseMessages = isNavAllowed("mensajes", !!user);

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
  };
};
