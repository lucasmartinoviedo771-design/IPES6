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
    set.add(globalRoleOverride);
    return set;
  }
  if (!user) {
    return set;
  }
  normalizeRoles(user.roles).forEach((r) => set.add(r));
  if (user.is_staff || user.is_superuser) {
    set.add("admin");
  }
  return set;
};

export const hasRole = (user: User | null | undefined, role: Role): boolean => {
  if (!role) return true;
  const roles = collectRoles(user);
  return roles.has(role.toLowerCase().trim());
};

export const hasAnyRole = (user: User | null | undefined, roles: Role[]): boolean => {
  if (!roles || roles.length === 0) {
    return true;
  }
  const bag = collectRoles(user);
  if (user?.is_superuser) {
    return true;
  }
  return roles.some((role) => bag.has(role.toLowerCase().trim()));
};

export const hasAllRoles = (user: User | null | undefined, roles: Role[]): boolean => {
  if (!roles || roles.length === 0) {
    return true;
  }
  const bag = collectRoles(user);
  if (user?.is_superuser) {
    return true;
  }
  return roles.every((role) => bag.has(role.toLowerCase().trim()));
};

export const isOnlyStudent = (user: User | null | undefined): boolean => {
  const bag = collectRoles(user);
  if (!bag.size) {
    return false;
  }
  return bag.has("alumno") && bag.size === 1;
};

export const getDefaultHomeRoute = (user: User | null | undefined): string => {
  const bag = collectRoles(user);
  if (!bag.size) {
    return "/login";
  }
  const isStudentOnly = bag.has("alumno") && bag.size === 1;
  if (isStudentOnly) {
    return "/alumnos";
  }
  if (bag.has("secretaria") || bag.has("bedel") || bag.has("jefa_aaee")) {
    return "/secretaria";
  }
  if (bag.has("admin")) {
    return "/dashboard";
  }
  return "/alumnos";
};
