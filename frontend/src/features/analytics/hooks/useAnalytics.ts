import { useQuery } from "@tanstack/react-query";
import {
	getStudentsSummary,
	getStudentsAtRisk,
	type StudentsSummaryResponse,
	type StudentAtRiskItem,
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
	page?: number;
}) => {
	return useQuery<StudentAtRiskItem[]>({
		queryKey: ["analytics", "studentsAtRisk", params],
		queryFn: () => getStudentsAtRisk(params),
		staleTime: 1000 * 60 * 2, // 2 minutos
	});
};
