export type RoleAssignment = {
	role: string;
	profesorado_id?: number | null;
	profesorado_nombre?: string | null;
	turno?: string | null;
};

export type User = {
	id?: number;
	dni: string;
	name?: string;
	roles?: string[];
	/** Capacidades derivadas del sistema CAPABILITIES del backend */
	capabilities?: string[];
	is_staff?: boolean;
	is_superuser?: boolean;
	must_change_password?: boolean;
	must_complete_profile?: boolean;
	email?: string;
	profesorado_ids?: number[] | null;
	role_assignments?: RoleAssignment[];
} | null;
