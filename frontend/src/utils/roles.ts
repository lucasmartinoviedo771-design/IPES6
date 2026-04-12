/**
 * @module Utils/Roles
 * @description Utilidades para la gestión de Roles y Permisos en el lado del cliente (RBAC).
 * Implementa la normalización de roles dinámicos, el sistema de simulación (Override) 
 * y la lógica de enrutamiento basada en privilegios institucionales.
 */

import { User } from "@/context/AuthContext";

/** Tipo base para identificadores de roles */
type Role = string;

/** Almacena el rol simulado actual (Impersonation) */
let globalRoleOverride: string | null = null;

/**
 * Establece un rol temporal para la sesión actual.
 * @internal Usado exclusivamente por AuthContext.
 */
export const setGlobalRoleOverride = (role: string | null) => {
  globalRoleOverride = role ? role.toLowerCase().trim() : null;
};

/**
 * Obtiene el rol simulado actual.
 */
export const getGlobalRoleOverride = () => globalRoleOverride;

/**
 * Limpia y normaliza una lista de roles crudos.
 */
const normalizeRoles = (roles?: string[] | null) =>
  (roles ?? []).map((r) => r.toLowerCase().trim()).filter(Boolean);

/**
 * Motor central de recolección de privilegios.
 * Expande roles base (como 'bedel_informatica' -> 'bedel') para simplificar 
 * chequeos de permisos en componentes.
 */
const collectRoles = (user: User | null | undefined): Set<string> => {
  const set = new Set<string>();

  // Prioridad 1: Simulación activa (Impersonation)
  if (globalRoleOverride) {
    const r = globalRoleOverride.toLowerCase().trim();
    set.add(r);
    // Auto-expansión de roles conocidos para consistencia en la UI simulada
    if (r.includes("estudiante")) set.add("estudiante");
    if (r.startsWith("bedel")) set.add("bedel");
    if (r.startsWith("secretaria")) set.add("secretaria");
    if (r.startsWith("coordinador")) set.add("coordinador");
    return set;
  }

  // Prioridad 2: Roles reales del usuario
  if (!user) return set;

  normalizeRoles(user.roles).forEach((role) => {
    set.add(role);
    // Expansión semántica: 'bedel-secundaria' otorga capacidades de 'bedel' genérico
    if (role.includes("estudiante")) set.add("estudiante");
    if (role.startsWith("bedel")) set.add("bedel");
    if (role.startsWith("secretaria")) set.add("secretaria");
    if (role.startsWith("coordinador")) set.add("coordinador");
  });

  // Privilegios administrativos absolutos
  if (user.is_superuser) {
    set.add("admin");
  }

  if (import.meta.env.DEV) {
    console.debug("[Roles] User:", user.dni, "Effective Roles:", Array.from(set));
  }

  return set;
};

/**
 * Verifica si el usuario posee un rol específico.
 */
export const hasRole = (user: User | null | undefined, role: Role): boolean => {
  if (!role) return true;
  const bag = collectRoles(user);
  let r = role.toLowerCase().trim();
  if (r.includes("estudiante")) r = "estudiante";
  return bag.has(r);
};

/**
 * Verifica si el usuario posee al menos uno de los roles listados.
 */
export const hasAnyRole = (user: User | null | undefined, roles: Role[]): boolean => {
  if (!roles || roles.length === 0) return true;
  const bag = collectRoles(user);
  if (user?.is_superuser && !getGlobalRoleOverride()) return true;

  return roles.some((role) => {
    let r = role.toLowerCase().trim();
    if (r.includes("estudiante")) r = "estudiante";
    return bag.has(r);
  });
};

/**
 * Verifica si el usuario cumple con todos los roles requeridos.
 */
export const hasAllRoles = (user: User | null | undefined, roles: Role[]): boolean => {
  if (!roles || roles.length === 0) return true;
  const bag = collectRoles(user);
  if (user?.is_superuser && !getGlobalRoleOverride()) return true;

  return roles.every((role) => {
    let r = role.toLowerCase().trim();
    if (r.includes("estudiante")) r = "estudiante";
    return bag.has(r);
  });
};

/**
 * Determina si el usuario es estrictamente un estudiante sin roles de gestión.
 */
export const isOnlyEstudiante = (user: User | null | undefined): boolean => {
  const bag = collectRoles(user);
  if (!bag.has("estudiante")) return false;

  const managementRoles = [
    "admin", "secretaria", "bedel", "docente", "coordinador", "tutor", 
    "jefes", "jefa_aaee", "equivalencias", "titulos", "consulta",
  ];
  return !managementRoles.some((r) => bag.has(r));
};

/**
 * Calcula la ruta de inicio (Home) según la jerarquía de roles.
 */
export const getDefaultHomeRoute = (user: User | null | undefined): string => {
  if (!user) return "/login";
  const bag = collectRoles(user);
  if (bag.size === 0) return "/login";

  // 1. Administradores (Dashboard central)
  if (bag.has("admin")) return "/dashboard";

  // 2. Secretaría (Centro de operaciones)
  if (bag.has("secretaria")) return "/secretaria";

  // 3. Bedelía (Gestión operativa)
  if (bag.has("bedel")) return "/bedeles";

  // 4. Docentes (Mis materias y actas)
  if (bag.has("docente")) return "/docentes";

  // 5. Coordinación
  if (bag.has("coordinador")) return "/coordinacion";

  // 6. Tutorías
  if (bag.has("tutor")) return "/tutorias";

  // 7. Jefatura / Jefa A.A.E.E.
  if (bag.has("jefes") || bag.has("jefa_aaee")) return "/jefatura";

  // 8. Títulos y Certificaciones
  if (bag.has("titulos")) return "/titulos";

  // 9. Equivalencias (Módulo específico)
  if (bag.has("equivalencias")) return "/equivalencias";

  // 10. Curso Introductorio
  if (bag.has("curso_intro")) return "/curso-introductorio";

  // 11. Estudiantes (Autogestión)
  if (bag.has("estudiante")) return "/estudiantes";

  // Fallback para roles no contemplados o staff básico
  return "/dashboard";
};
