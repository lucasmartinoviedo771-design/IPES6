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

export function getExportDocumentacionExcelUrl(params: { q?: string; carrera_id?: number; estado_academico?: string; limit?: number } = {}): string {
  const clean = Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== ""));
  const query = new URLSearchParams(clean as any).toString();
  return `${client.defaults.baseURL}/estudiantes/admin/estudiantes-documentacion/export/excel?${query}`;
}

export function getExportDocumentacionPdfUrl(params: { q?: string; carrera_id?: number; estado_academico?: string; limit?: number } = {}): string {
  const clean = Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== ""));
  const query = new URLSearchParams(clean as any).toString();
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

export async function agregarCarreraEstudiante(
  dni: string,
  payload: { profesorado_id: number; anio_ingreso?: number | null }
): Promise<EstudianteAdminDetailDTO> {
  const { data } = await client.post<EstudianteAdminDetailDTO>(
    `/estudiantes/admin/estudiantes/${dni}/carreras`,
    payload
  );
  return data;
}

export type EstudianteGlobalResultDTO = {
  dni: string;
  apellido: string;
  nombre: string;
  carreras: { nombre: string; estado_academico: string }[];
};

export async function buscarEstudiantesGlobal(q: string): Promise<EstudianteGlobalResultDTO[]> {
  const { data } = await client.get<EstudianteGlobalResultDTO[]>(
    `/estudiantes/admin/estudiantes/buscar-global`,
    { params: { q } }
  );
  return data;
}

export type ResguardoMateriaItemDTO = {
  tipo: "REG" | "EQUIV";
  dni: string;
  nombre: string;
  profesorado: string | null;
  materia: string;
  situacion: string;
  motivos: string[];
};

export async function fetchResguardoMaterias(params: {
  profesorado_id?: number;
  dni?: string;
} = {}): Promise<ResguardoMateriaItemDTO[]> {
  const { data } = await client.get<ResguardoMateriaItemDTO[]>(
    "/estudiantes/admin/resguardo-materias",
    { params }
  );
  return data;
}

export type RecalcularResguardoResult = {
  ok: boolean;
  regularidades_marcadas: number;
  regularidades_liberadas: number;
  equivalencias_marcadas: number;
  equivalencias_liberadas: number;
};

export async function recalcularResguardo(params: {
  profesorado_id?: number;
  solo_activos?: boolean;
} = {}): Promise<RecalcularResguardoResult> {
  const { data } = await client.post<RecalcularResguardoResult>(
    "/estudiantes/admin/resguardo-materias/recalcular",
    null,
    { params }
  );
  return data;
}
