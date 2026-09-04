import { useQuery } from "@tanstack/react-query";
import {
	getStudentsSummary,
	getStudentsAtRisk,
	getPreinscripcionesSummary,
	getPreinscripcionesEvolucion,
	getTeacherAttendanceSummary,
	getTeacherAttendanceByWeekday,
	getTeachersDesgranamiento,
	getTeacherWorkload,
	getAcademicPerformancePorMateria,
	getAcademicPerformancePorComisiones,
	getAcademicPerformanceCohortes,
	getAuditoriaDashboard,
	type StudentsSummaryResponse,
	type StudentsAtRiskResponse,
	type PreinscripcionesSummaryResponse,
	type PreinscripcionEvolucionItem,
	type TeacherAttendanceSummaryResponse,
	type WeekdayAbsenceItem,
	type DesgranamientoCatedraResponse,
	type TeacherWorkloadResponse,
	type AcademicPerformancePorMateriaResponse,
	type AcademicPerformancePorComisionesResponse,
	type AcademicPerformanceCohortesResponse,
	type AuditoriaDashboardResponse,
} from "@/api/analytics";

export const useAnalyticsSummary = (params: {
	anio?: number;
	profesorado_id?: number;
}) => {
	return useQuery<StudentsSummaryResponse>({
		queryKey: ["analytics", "studentsSummary", params],
		queryFn: () => getStudentsSummary(params),
		staleTime: 1000 * 60 * 5, // 5 minutos de caché
	});
};

export const useEstudiantesAtRisk = (params: {
	nivel: string;
	profesorado_id?: number;
	motivo?: string;
	page?: number;
}) => {
	return useQuery<StudentsAtRiskResponse>({
		queryKey: ["analytics", "studentsAtRisk", params],
		queryFn: () => getStudentsAtRisk(params),
		staleTime: 1000 * 60 * 2, // 2 minutos
	});
};

export const usePreinscripcionesSummary = (params: {
	anio?: number;
	profesorado_id?: number;
}) => {
	return useQuery<PreinscripcionesSummaryResponse>({
		queryKey: ["analytics", "preinscripcionesSummary", params],
		queryFn: () => getPreinscripcionesSummary(params),
		staleTime: 1000 * 60 * 5,
	});
};

export const usePreinscripcionesEvolucion = (params: {
	anio?: number;
	profesorado_id?: number;
	agrupacion?: "semana" | "mes";
}) => {
	return useQuery<PreinscripcionEvolucionItem[]>({
		queryKey: ["analytics", "preinscripcionesEvolucion", params],
		queryFn: () => getPreinscripcionesEvolucion(params),
		staleTime: 1000 * 60 * 5,
	});
};

export const useTeacherAttendanceSummary = (params: {
	anio?: number;
	profesorado_id?: number;
	docente_id?: number;
}) => {
	return useQuery<TeacherAttendanceSummaryResponse>({
		queryKey: ["analytics", "teacherAttendanceSummary", params],
		queryFn: () => getTeacherAttendanceSummary(params),
		staleTime: 1000 * 60 * 5,
	});
};

export const useTeacherAttendanceByWeekday = (params: {
	anio?: number;
	profesorado_id?: number;
	docente_id?: number;
}) => {
	return useQuery<WeekdayAbsenceItem[]>({
		queryKey: ["analytics", "teacherAttendanceByWeekday", params],
		queryFn: () => getTeacherAttendanceByWeekday(params),
		staleTime: 1000 * 60 * 5,
	});
};

export const useTeachersDesgranamiento = (params: {
	anio?: number;
	profesorado_id?: number;
	materia_id?: number;
}) => {
	return useQuery<DesgranamientoCatedraResponse>({
		queryKey: ["analytics", "teachersDesgranamiento", params],
		queryFn: () => getTeachersDesgranamiento(params),
		staleTime: 1000 * 60 * 5,
	});
};

export const useTeacherWorkload = (docenteId?: number) => {
	return useQuery<TeacherWorkloadResponse>({
		queryKey: ["analytics", "teacherWorkload", docenteId],
		queryFn: () => getTeacherWorkload(docenteId),
		staleTime: 1000 * 60 * 5,
	});
};

export const useAcademicPerformancePorMateria = (params: {
	profesorado_id?: number;
}) => {
	return useQuery<AcademicPerformancePorMateriaResponse>({
		queryKey: ["analytics", "academicPerformancePorMateria", params],
		queryFn: () => getAcademicPerformancePorMateria(params),
		staleTime: 1000 * 60 * 10,
	});
};

export const useAcademicPerformancePorComisiones = (params: {
	profesorado_id?: number;
}) => {
	return useQuery<AcademicPerformancePorComisionesResponse>({
		queryKey: ["analytics", "academicPerformancePorComisiones", params],
		queryFn: () => getAcademicPerformancePorComisiones(params),
		staleTime: 1000 * 60 * 10,
	});
};

export const useAcademicPerformanceCohortes = (params: {
	profesorado_id?: number;
}) => {
	return useQuery<AcademicPerformanceCohortesResponse>({
		queryKey: ["analytics", "academicPerformanceCohortes", params],
		queryFn: () => getAcademicPerformanceCohortes(params),
		staleTime: 1000 * 60 * 10,
	});
};

export const useAuditoriaDashboard = () => {
	return useQuery<AuditoriaDashboardResponse>({
		queryKey: ["analytics", "auditoriaDashboard"],
		queryFn: () => getAuditoriaDashboard(),
		staleTime: 1000 * 60 * 5,
	});
};
