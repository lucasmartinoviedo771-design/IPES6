import { client, AppAxiosRequestConfig } from "@/api/client";
import {
  ApiResponseDTO,
  EstudianteAdminListParams,
  EstudianteAdminListResponseDTO,
  EstudianteDocumentacionListResponseDTO,
  EstudianteAdminDetailDTO,
  EstudianteAdminUpdatePayload,
  EstudianteDocumentacionUpdatePayload,
  EstudianteDocumentacionBulkUpdatePayload,
} from "./types";

export async function fetchEstudiantesAdmin(params: EstudianteAdminListParams = {}): Promise<EstudianteAdminListResponseDTO> {
  const { data } = await client.get<EstudianteAdminListResponseDTO>("/estudiantes/admin/estudiantes", { params });
  return data;
}

export async function fetchAniosIngreso(carrera_id?: number | ""): Promise<number[]> {
  const { data } = await client.get<number[]>("/estudiantes/admin/estudiantes/anios-ingreso", {
    params: { carrera_id: carrera_id || undefined }
  });
  return data;
}

export async function fetchEstudiantesDocumentacion(params: { q?: string; carrera_id?: number; estado_academico?: string; limit?: number; offset?: number } = {}): Promise<EstudianteDocumentacionListResponseDTO> {
  const { data } = await client.get<EstudianteDocumentacionListResponseDTO>("/estudiantes/admin/estudiantes-documentacion", { params });
  return data;
}

export async function fetchEstudianteAdminDetail(dni: string, config?: AppAxiosRequestConfig): Promise<EstudianteAdminDetailDTO> {
  const { data } = await client.get<EstudianteAdminDetailDTO>(`/estudiantes/admin/estudiantes/${dni}`, config as any);
  return data;
}

export async function updateEstudianteAdmin(dni: string, payload: EstudianteAdminUpdatePayload): Promise<EstudianteAdminDetailDTO> {
  const { data } = await client.put<EstudianteAdminDetailDTO>(`/estudiantes/admin/estudiantes/${dni}`, payload);
  return data;
}

export async function eliminarEstudianteAdmin(dni: string): Promise<ApiResponseDTO> {
  const { data } = await client.delete<ApiResponseDTO>(`/estudiantes/admin/estudiantes/${dni}`);
  return data;
}

export async function fetchPerfilCompletar(): Promise<EstudianteAdminDetailDTO> {
  const { data } = await client.get<EstudianteAdminDetailDTO>("/estudiantes/perfil/completar");
  return data;
}

export async function completarPerfil(payload: EstudianteAdminUpdatePayload): Promise<EstudianteAdminDetailDTO> {
  const { data } = await client.put<EstudianteAdminDetailDTO>("/estudiantes/perfil/completar", payload);
  return data;
}

export async function bulkUpdateEstudianteDocumentacion(payload: EstudianteDocumentacionBulkUpdatePayload): Promise<ApiResponseDTO> {
  const { data } = await client.patch<ApiResponseDTO>(`/estudiantes/admin/estudiantes-documentacion-bulk`, payload);
  return data;
}

export async function updateEstudianteDocumentacion(dni: string, payload: EstudianteDocumentacionUpdatePayload): Promise<ApiResponseDTO> {
  const { data } = await client.patch<ApiResponseDTO>(`/estudiantes/admin/estudiantes-documentacion/${dni}`, payload);
  return data;
}

export function getExportDocumentacionExcelUrl(params: { q?: string; carrera_id?: number } = {}): string {
  const query = new URLSearchParams(params as any).toString();
  return `${client.defaults.baseURL}/estudiantes/admin/estudiantes-documentacion/export/excel?${query}`;
}

export function getExportDocumentacionPdfUrl(params: { q?: string; carrera_id?: number } = {}): string {
  const query = new URLSearchParams(params as any).toString();
  return `${client.defaults.baseURL}/estudiantes/admin/estudiantes-documentacion/export/pdf?${query}`;
}
export async function resetPasswordEstudiante(dni: string): Promise<ApiResponseDTO> {
  const { data } = await client.post<ApiResponseDTO>(`/estudiantes/admin/estudiantes/${dni}/reset-password`);
  return data;
}

export async function autorizarRendirEstudiante(
  dni: string,
  payload: { autorizado: boolean; observacion?: string | null; materias_autorizadas?: number[] }
): Promise<ApiResponseDTO> {
  const { data } = await client.patch<ApiResponseDTO>(
    `/estudiantes/admin/estudiantes/${dni}/autorizar-rendir`,
    payload
  );
  return data;
}
