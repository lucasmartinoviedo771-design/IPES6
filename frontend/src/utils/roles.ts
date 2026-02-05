import { User } from "@/context/AuthContext";

type Role = string;

let globalRoleOverride: string | null = null;

export const setGlobalRoleOverride = (role: string | null) => {
  globalRoleOverride = role ? role.toLowerCase().trim() : null;
};

export const getGlobalRoleOverride = () => globalRoleOverride;

const normalizeRoles = (roles?: string[] | null) =>
  (roles ?? []).map((r) => r.toLowerCase().trim()).filter(Boolean);

const collectRoles = (user: User | null | undefined): Set<string> => {
  const set = new Set<string>();

  if (globalRoleOverride) {
    const r = globalRoleOverride.toLowerCase().trim();
    set.add(r);
    if (r.includes("estudiante")) set.add("estudiante");
    if (r.startsWith("bedel")) set.add("bedel");
    if (r.startsWith("secretaria")) set.add("secretaria");
    if (r.startsWith("coordinador")) set.add("coordinador");
    return set;
  }

  if (!user) return set;

  normalizeRoles(user.roles).forEach((role) => {
    set.add(role);
    if (role.includes("estudiante")) set.add("estudiante");
    if (role.startsWith("bedel")) set.add("bedel");
    if (role.startsWith("secretaria")) set.add("secretaria");
    if (role.startsWith("coordinador")) set.add("coordinador");
  });

  if (user.is_staff || user.is_superuser) {
    set.add("admin");
  }

  // Debug log to trace 403 issues
  if (import.meta.env.DEV) {
    console.debug("[Roles] User:", user.dni, "Roles:", Array.from(set));
  }

  return set;
};

export const hasRole = (user: User | null | undefined, role: Role): boolean => {
  if (!role) return true;
  const bag = collectRoles(user);
  let r = role.toLowerCase().trim();
  if (r.includes("estudiante")) r = "estudiante";
  return bag.has(r);
};

export const hasAnyRole = (user: User | null | undefined, roles: Role[]): boolean => {
  if (!roles || roles.length === 0) return true;
  const bag = collectRoles(user);
  if (user?.is_superuser) return true;

  return roles.some((role) => {
    let r = role.toLowerCase().trim();
    if (r.includes("estudiante")) r = "estudiante";
    return bag.has(r);
  });
};

export const hasAllRoles = (user: User | null | undefined, roles: Role[]): boolean => {
  if (!roles || roles.length === 0) return true;
  const bag = collectRoles(user);
  if (user?.is_superuser) return true;

  return roles.every((role) => {
    let r = role.toLowerCase().trim();
    if (r.includes("estudiante")) r = "estudiante";
    return bag.has(r);
  });
};

export const isOnlyEstudiante = (user: User | null | undefined): boolean => {
  const bag = collectRoles(user);
  if (!bag.has("estudiante")) return false;

  const managementRoles = [
    "admin",
    "secretaria",
    "bedel",
    "docente",
    "coordinador",
    "tutor",
    "jefes",
    "jefa_aaee",
    "equivalencias",
    "titulos",
    "consulta",
  ];
  return !managementRoles.some((r) => bag.has(r));
};

export const getDefaultHomeRoute = (user: User | null | undefined): string => {
  if (!user) return "/login";
  const bag = collectRoles(user);
  if (bag.size === 0) return "/login";

  if (isOnlyEstudiante(user)) {
    return "/estudiantes";
  }

  if (bag.has("secretaria") || bag.has("bedel") || bag.has("jefa_aaee")) {
    return "/secretaria";
  }

  const management = ["admin", "docente", "coordinador", "tutor", "jefes"];
  if (management.some(r => bag.has(r))) {
    return "/dashboard";
  }

  return "/dashboard";
};
