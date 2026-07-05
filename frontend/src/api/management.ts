import { api } from "./client";

interface DashboardPreinsEstado {
	estado: string;
	total: number;
}

interface DashboardPreinsDetalle {
	id: number;
	codigo: string;
	estudiante: string;
	carrera: string | null;
	fecha: string | null;
}

interface DashboardPreinscripciones {
	total: number;
	por_estado: DashboardPreinsEstado[];
	recientes: DashboardPreinsDetalle[];
}

export interface GlobalOverviewOut {
	preinscripciones: DashboardPreinscripciones;
	// Agregaremos otros campos según sea necesario, pero para los cards de preins solo estos bastan
}

export const getGlobalOverview = async (
	profesoradoId?: number,
	anio?: number,
): Promise<GlobalOverviewOut> => {
	const params: Record<string, unknown> = {};
	if (profesoradoId) params.profesorado_id = profesoradoId;
	if (anio) params.anio = anio;
	const { data } = await api.get<GlobalOverviewOut>("/overview", { params });
	return data;
};
