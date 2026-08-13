import { client as api } from "./client";

export interface HorarioCargo {
	id: number;
	dia_semana: number;
	dia_nombre: string;
	hora_inicio: string;
	hora_fin: string;
}

export interface HorarioCargoCreate {
	dia_semana: number;
	hora_inicio: string;
	hora_fin: string;
}

export interface AsignacionDocente {
	id: number;
	docente_id: number;
	docente_nombre: string;
	docente_dni: string;
	sit_revista: string;
	sit_revista_display: string;
	fecha_inicio: string;
	fecha_fin: string | null;
	resolucion: string;
	activo: boolean;
}

export interface Cargo {
	id: number;
	codigo_cargo: string;
	codigo_salarial: string;
	nombre: string;
	tipo_cargo: string;
	tipo_cargo_display: string;
	duracion_minutos: number;
	descripcion: string;
	activo: boolean;
	horarios: HorarioCargo[];
	asignaciones: AsignacionDocente[];
}

export interface CargoCreate {
	codigo_cargo: string;
	codigo_salarial?: string;
	nombre: string;
	tipo_cargo?: string;
	duracion_minutos?: number;
	descripcion?: string;
}

export interface AsignarDocenteCreate {
	docente_id: number;
	sit_revista: string;
	fecha_inicio?: string;
	fecha_fin?: string;
	resolucion?: string;
	activo?: boolean;
}

export const fetchCargos = async (): Promise<Cargo[]> => {
	const response = await api.get<Cargo[]>("/asistencia/cargos");
	return response.data;
};

export const createCargo = async (data: CargoCreate): Promise<Cargo> => {
	const response = await api.post<Cargo>("/asistencia/cargos", data);
	return response.data;
};

export const asignarDocenteCargo = async (
	cargoId: number,
	data: AsignarDocenteCreate,
): Promise<any> => {
	const response = await api.post(
		`/asistencia/cargos/${cargoId}/asignar`,
		data,
	);
	return response.data;
};

export const agregarHorarioCargo = async (
	cargoId: number,
	data: HorarioCargoCreate,
	config?: any
): Promise<HorarioCargo> => {
	const response = await api.post<HorarioCargo>(
		`/asistencia/cargos/${cargoId}/horarios`,
		data,
		config
	);
	return response.data;
};

export const updateHorarioCargo = async (
	horarioId: number,
	data: HorarioCargoCreate,
): Promise<HorarioCargo> => {
	const response = await api.put<HorarioCargo>(
		`/asistencia/cargos/horarios/${horarioId}`,
		data,
	);
	return response.data;
};

export const updateCargo = async (
	cargoId: number,
	data: CargoCreate,
): Promise<Cargo> => {
	const response = await api.put<Cargo>(`/asistencia/cargos/${cargoId}`, data);
	return response.data;
};

export const deleteCargo = async (cargoId: number): Promise<void> => {
	await api.delete(`/asistencia/cargos/${cargoId}`);
};

export const deleteHorarioCargo = async (horarioId: number): Promise<void> => {
	await api.delete(`/asistencia/cargos/horarios/${horarioId}`);
};

export const updateAsignacionDocenteCargo = async (
	asignacionId: number,
	data: AsignarDocenteCreate,
): Promise<AsignacionDocente> => {
	const response = await api.put<AsignacionDocente>(
		`/asistencia/cargos/asignaciones/${asignacionId}`,
		data,
	);
	return response.data;
};

export const deleteAsignacionDocenteCargo = async (
	asignacionId: number,
): Promise<void> => {
	await api.delete(`/asistencia/cargos/asignaciones/${asignacionId}`);
};
