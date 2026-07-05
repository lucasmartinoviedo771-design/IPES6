/**
 * @module Utils/Roles
 * @description Utilidades para la gestión de Roles y Permisos en el lado del cliente (RBAC).
 * Implementa la normalización de roles dinámicos, el sistema de simulación (Override)
 * y la lógica de enrutamiento basada en privilegios institucionales.
 */

import type { User } from "@/types/auth";

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
const getGlobalRoleOverride = () => globalRoleOverride;

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
const getActiveRole = (): string | null => {
	try {
		return localStorage.getItem("ipes_active_role");
	} catch {
		return null;
	}
};

const collectRoles = (user: User | null | undefined): Set<string> => {
	const set = new Set<string>();

	// Prioridad 1: Simulación activa (Impersonation) o rol seleccionado por usuario multi-rol
	const effectiveOverride = globalRoleOverride || getActiveRole();
	if (effectiveOverride) {
		const r = effectiveOverride.toLowerCase().trim();
		set.add(r);
		if (r.includes("estudiante")) set.add("estudiante");
		if (r === "bedel_secretaria") {
			// no expandir
		} else if (r.startsWith("bedel")) {
			set.add("bedel");
		}
		if (r.startsWith("secretaria")) set.add("secretaria");
		if (r.startsWith("coordinador")) set.add("coordinador");
		if (r.startsWith("tutor")) set.add("tutor");
		if (r === "tutoria" || r === "tutoría") set.add("tutor");
		return set;
	}

	// Prioridad 2: Roles reales del usuario
	if (!user) return set;

	normalizeRoles(user.roles).forEach((role) => {
		set.add(role);
		// Expansión semántica: 'bedel-secundaria' otorga capacidades de 'bedel' genérico
		if (role.includes("estudiante")) set.add("estudiante");
		if (role === "bedel_secretaria") {
			// no expandir
		} else if (role.startsWith("bedel")) {
			set.add("bedel");
		}
		if (role.startsWith("secretaria")) set.add("secretaria");
		if (role.startsWith("coordinador")) set.add("coordinador");
		if (role.startsWith("tutor")) set.add("tutor");
		if (role === "tutoria" || role === "tutoría") set.add("tutor");
	});

	// Privilegios administrativos absolutos
	if (user.is_superuser) {
		set.add("admin");
	}

	if (import.meta.env.DEV) {
		console.debug(
			"[Roles] User:",
			user.dni,
			"Effective Roles:",
			Array.from(set),
		);
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
export const hasAnyRole = (
	user: User | null | undefined,
	roles: Role[],
): boolean => {
	if (!roles || roles.length === 0) return true;
	const bag = collectRoles(user);
	if (bag.has("admin")) return true;
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
export const hasAllRoles = (
	user: User | null | undefined,
	roles: Role[],
): boolean => {
	if (!roles || roles.length === 0) return true;
	const bag = collectRoles(user);
	if (bag.has("admin")) return true;
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
	if (bag.has("bedel") || bag.has("bedel_secretaria")) return "/bedeles";

	// 4. Docentes (Mis asistencias)
	if (bag.has("docente")) return "/docentes/mis-asistencias";

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

	// 11. ATTP / Rectorado
	if (bag.has("attp")) return "/attp";
	if (bag.has("rectorado")) return "/rectorado";

	// 12. Estudiantes (Autogestión)
	if (bag.has("estudiante")) return "/estudiantes";

	// Fallback para roles no contemplados o staff básico
	return "/dashboard";
};

/**
 * Verifica si el usuario tiene una capability específica del sistema IPES6.
 * Lee el campo `capabilities` que devuelve el backend en /profile y /login.
 * Es la función preferida para chequeos de acceso — reemplaza progresivamente a hasAnyRole().
 *
 * @example
 * hasCapability(user, "ver_estudiantes")  // true para admin, secretaria, bedel, etc.
 * hasCapability(user, "admin_sistema")    // true solo para admin
 */
export const hasCapability = (
	user: User | null | undefined,
	capability: string,
): boolean => {
	if (!user) return false;
	// Superusuario sin impersonation siempre puede todo
	if (user.is_superuser && !getGlobalRoleOverride()) return true;
	// Leer capabilities del backend
	const caps = user.capabilities ?? [];
	return caps.includes(capability);
};
