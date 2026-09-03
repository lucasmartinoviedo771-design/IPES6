/**
 * @module API/Analytics
 * @description Cliente API para los endpoints de Business Intelligence y Alerta Temprana.
 */

import { api } from "./client";

export interface SemaforoBreakdown {
	rojo: number;
	amarillo: number;
	verde: number;
	total_evaluados: number;
}

export interface StudentsSummaryResponse {
	total_matriculados: number;
	por_estado_academico: Record<string, number>;
	promedio_general_notas: number | null;
	promedio_asistencia: number | null;
	regularidades_por_situacion: Record<string, number>;
	semaforo: SemaforoBreakdown;
	fecha_actualizacion: string | null;
}

export interface StudentAtRiskItem {
	estudiante_id: number;
	dni: string;
	nombre_completo: string;
	profesorado: string | null;
	email: string | null;
	telefono: string | null;
	nivel_riesgo: "rojo" | "amarillo" | "verde";
	motivos: string[];
	fecha_calculo: string;
}

export interface StudentsAtRiskResponse {
	items: StudentAtRiskItem[];
	count: number;
}

export interface TeacherComisionWorkload {
	comision_id: number;
	codigo: string;
	materia: string;
	profesorado: string;
	anio_lectivo: number;
	horas_semanales: number;
	inscriptos_activos: number;
	rol_en_comision: string;
}

export interface TeacherWorkloadResponse {
	docente_id: number;
	dni: string;
	nombre_completo: string;
	horas_semanales_totales: number;
	total_estudiantes_a_cargo: number;
	comisiones_activas: TeacherComisionWorkload[];
	participacion_tribunales: number;
	asistencia_resumen: Record<string, number>;
	nota_historica: string;
}

export const getStudentsSummary = async (params?: {
	anio?: number;
	profesorado_id?: number;
}): Promise<StudentsSummaryResponse> => {
	return api.get("/analytics/students/summary/", { params });
};

export const getStudentsAtRisk = async (params: {
	nivel: string;
	profesorado_id?: number;
	page?: number;
}): Promise<StudentAtRiskItem[]> => {
	return api.get("/analytics/students/at-risk/", { params });
};

export const getExportStudentsAtRiskUrl = (params: {
	nivel: string;
	profesorado_id?: number;
}): string => {
	const query = new URLSearchParams({
		nivel: params.nivel,
		export: "csv",
	});
	if (params.profesorado_id) {
		query.set("profesorado_id", params.profesorado_id.toString());
	}
	return `/api/analytics/students/at-risk/?${query.toString()}`;
};
