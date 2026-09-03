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
	const res = await api.get("/analytics/students/summary/", { params });
	return res.data;
};

export const getStudentsAtRisk = async (params: {
	nivel: string;
	profesorado_id?: number;
	page?: number;
}): Promise<StudentsAtRiskResponse> => {
	const res = await api.get("/analytics/students/at-risk/", { params });
	return res.data;
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

// ==========================================
// SOLAPA PREINSCRIPCIONES
// ==========================================

export interface PreinscripcionCarreraItem {
	profesorado_id: number;
	profesorado_nombre: string;
	total: number;
}

export interface PreinscripcionesSummaryResponse {
	total: number;
	por_estado: Record<string, number>;
	por_profesorado: PreinscripcionCarreraItem[];
}

export interface PreinscripcionEvolucionItem {
	periodo: string;
	total: number;
}

export const getPreinscripcionesSummary = async (params?: {
	anio?: number;
	profesorado_id?: number;
}): Promise<PreinscripcionesSummaryResponse> => {
	const res = await api.get("/analytics/preinscripciones/summary/", { params });
	return res.data;
};

export const getPreinscripcionesEvolucion = async (params?: {
	anio?: number;
	profesorado_id?: number;
	agrupacion?: "semana" | "mes";
}): Promise<PreinscripcionEvolucionItem[]> => {
	const res = await api.get("/analytics/preinscripciones/evolucion/", { params });
	return res.data;
};

// ==========================================
// SOLAPA DOCENTES
// ==========================================

export interface TeacherAttendanceSummaryResponse {
	docente_id: number | null;
	total_registros: number;
	presentes: number;
	ausentes: number;
	tardes: number;
	justificadas: number;
	porcentaje_asistencia: number;
}

export interface WeekdayAbsenceItem {
	dia_numero: number;
	dia_nombre: string;
	ausencias: number;
}

export interface DesgranamientoCatedraItem {
	materia_id: number;
	materia_nombre: string;
	anio_cursada: number;
	profesorado_nombre: string;
	comision_codigo: string | null;
	docentes: string[];
	hubo_suplencia: boolean;
	total_inscriptos: number;
	muestra_suficiente: boolean;
	tasa_desgranamiento: number | null;
	promedio_desgranamiento_anio: number | null;
	diferencia_vs_promedio: number | null;
}

export interface DesgranamientoCatedraResponse {
	items: DesgranamientoCatedraItem[];
	comisiones_sin_muestra_suficiente: number;
	total_comisiones_analizadas: number;
	nota_metodologica: string;
}

export const getTeacherAttendanceSummary = async (params?: {
	anio?: number;
	docente_id?: number;
}): Promise<TeacherAttendanceSummaryResponse> => {
	const res = await api.get("/analytics/teachers/attendance-summary/", { params });
	return res.data;
};

export const getTeacherAttendanceByWeekday = async (params?: {
	anio?: number;
	docente_id?: number;
}): Promise<WeekdayAbsenceItem[]> => {
	const res = await api.get("/analytics/teachers/attendance-by-weekday/", { params });
	return res.data;
};

export const getTeachersDesgranamiento = async (params?: {
	anio?: number;
	profesorado_id?: number;
	materia_id?: number;
}): Promise<DesgranamientoCatedraResponse> => {
	const res = await api.get("/analytics/teachers/desgranamiento-catedra/", { params });
	return res.data;
};

export const getTeacherWorkload = async (
	docenteId?: number,
): Promise<TeacherWorkloadResponse> => {
	const res = await api.get("/analytics/teachers/workload/", {
		params: docenteId ? { docente_id: docenteId } : undefined,
	});
	return res.data;
};
