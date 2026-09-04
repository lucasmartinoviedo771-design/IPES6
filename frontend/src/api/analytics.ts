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
	motivo?: string;
	page?: number;
}): Promise<StudentsAtRiskResponse> => {
	const res = await api.get("/analytics/students/at-risk/", { params });
	return res.data;
};

export const getExportStudentsAtRiskUrl = (params: {
	nivel: string;
	profesorado_id?: number;
	motivo?: string;
}): string => {
	const query = new URLSearchParams({
		nivel: params.nivel,
		export: "csv",
	});
	if (params.profesorado_id) {
		query.set("profesorado_id", params.profesorado_id.toString());
	}
	if (params.motivo) {
		query.set("motivo", params.motivo);
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
	profesorado_id?: number;
	docente_id?: number;
}): Promise<TeacherAttendanceSummaryResponse> => {
	const res = await api.get("/analytics/teachers/attendance-summary/", { params });
	return res.data;
};

export const getTeacherAttendanceByWeekday = async (params?: {
	anio?: number;
	profesorado_id?: number;
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

// ==========================================
// SOLAPA RENDIMIENTO ACADÉMICO
// ==========================================

export interface RendimientoMateriaItem {
	materia_id: number;
	materia_nombre: string;
	profesorado: string;
	total_estudiantes: number;
	promedio_nota: number | null;
	tasa_aprobacion: number;
	tasa_desaprobacion: number;
	distribucion_notas: Record<string, number>;
}

export interface AcademicPerformancePorMateriaResponse {
	items: RendimientoMateriaItem[];
	profesorado_id: number | null;
	profesorado_nombre: string | null;
	promedio_general: number | null;
	tasa_aprobacion_general: number;
}

export interface RendimientoComisionItem {
	comision_codigo: string;
	materia_nombre: string;
	docentes: string[];
	total_inscritos: number;
	promedio_nota: number | null;
	tasa_aprobacion: number;
	tasa_desaprobacion: number;
	estudiantes_riesgo: number;
}

export interface AcademicPerformancePorComisionesResponse {
	items: RendimientoComisionItem[];
	profesorado_id: number | null;
	total_comisiones: number;
	promedio_general_notas: number | null;
}

export interface RendimientoCohortesItem {
	cohorte: number;
	total_estudiantes: number;
	promedio_general: number | null;
	tasa_aprobacion: number;
	distribucion: Record<string, number>;
}

export interface AcademicPerformanceCohortesResponse {
	items: RendimientoCohortesItem[];
	profesorado_id: number | null;
	comparacion_historica: Record<string, number>;
}

export const getAcademicPerformancePorMateria = async (params?: {
	profesorado_id?: number;
}): Promise<AcademicPerformancePorMateriaResponse> => {
	const res = await api.get("/analytics/academic-performance/por-materia/", { params });
	return res.data;
};

export const getAcademicPerformancePorComisiones = async (params?: {
	profesorado_id?: number;
}): Promise<AcademicPerformancePorComisionesResponse> => {
	const res = await api.get("/analytics/academic-performance/por-comisiones/", { params });
	return res.data;
};

export const getAcademicPerformanceCohortes = async (params?: {
	profesorado_id?: number;
}): Promise<AcademicPerformanceCohortesResponse> => {
	const res = await api.get("/analytics/academic-performance/comparacion-cohortes/", { params });
	return res.data;
};

// ==========================================
// SOLAPA AUDITORÍA
// ==========================================

export interface LoginPorDiaItem {
	fecha: string;
	total_logins: number;
	usuarios_unicos: number;
}

export interface TopAccionesItem {
	accion: string;
	cantidad: number;
	porcentaje: number;
}

export interface TopUsuariosItem {
	usuario: string;
	total_acciones: number;
	ultimos_accesos: string | null;
}

export interface AlertaCriticaItem {
	id: number;
	fecha: string;
	tipo: string;
	mensaje: string;
	entidad_afectada: string | null;
	resuelto: boolean;
}

export interface AuditoriaResumenOut {
	total_eventos_7d: number;
	logins_7d: number;
	acciones_crud_7d: number;
	alertas_sin_resolver: number;
	eventos_hoy: number;
	hora_pico: string | null;
}

export interface AuditoriaEvolucionItem {
	fecha: string;
	logins: number;
	acciones_crud: number;
	errores: number;
}

export interface AuditoriaDashboardResponse {
	resumen: AuditoriaResumenOut;
	logins_por_dia: LoginPorDiaItem[];
	top_acciones: TopAccionesItem[];
	top_usuarios: TopUsuariosItem[];
	alertas_criticas: AlertaCriticaItem[];
	evolucion_7d: AuditoriaEvolucionItem[];
}

export const getAuditoriaDashboard = async (): Promise<AuditoriaDashboardResponse> => {
	const res = await api.get("/analytics/auditoria/dashboard/");
	return res.data;
};

// ==========================================
// SOLAPA AUSENTISMO CONSOLIDADO
// ==========================================

export interface AusentismoEvolucionItem {
	fecha: string;
	tasa_ausentismo: number;
	total_clases: number;
	ausencias: number;
	tardias: number;
	estudiantes_sin_registro: number;
}

export interface AusentismoCatedraItem {
	codigo_comision: string;
	materia: string;
	docentes: string[];
	tasa_ausentismo_actual: number;
	tasa_ausentismo_promedio_7d: number;
	estudiantes_en_riesgo: number;
	total_estudiantes: number;
	tendencia: "estable" | "mejorando" | "empeorando";
}

export interface AusentismoConsolidadoResponse {
	profesorado_id: number | null;
	profesorado_nombre: string | null;
	resumen: {
		tasa_promedio: number;
		tasa_maxima: number;
		catedras_criticas: number;
	};
	evolucion: AusentismoEvolucionItem[];
	catedras: AusentismoCatedraItem[];
	estudiantes_criticos: number;
	fecha_inicio: string | null;
	fecha_fin: string | null;
}

export const getAusentismoConsolidado = async (params?: {
	profesorado_id?: number;
	dias?: number;
}): Promise<AusentismoConsolidadoResponse> => {
	const res = await api.get("/analytics/ausentismo/consolidado/", { params });
	return res.data;
};
