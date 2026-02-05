import { api } from './client';
import { EquivalenciaDisposicionDTO, EquivalenciaDisposicionPayload } from "@/api/estudiantes";

interface UploadResult {
  ok: boolean;
  message: string;
  data: {
    processed: number;
    skipped: number;
    errors: string[];
  };
}

interface UploadData {
  file: File;
  dry_run: boolean;
}



export interface EstudianteInicialPayload {
  dni: string;
  nombre: string;
  apellido: string;
  profesorado_id: number;
  email?: string;
  telefono?: string;
  domicilio?: string;
  fecha_nacimiento?: string;
  estado_legajo?: string;
  anio_ingreso?: string;
  genero?: string;
  rol_extra?: string;
  observaciones?: string;
  cuil?: string;
  cohorte?: string;
  is_active?: boolean;
  must_change_password?: boolean;
  password?: string;
}

export interface EstudianteInicialResult {
  estudiante_id: number;
  dni: string;
  nombre: string;
  created: boolean;
  message: string;
}

export const crearEstudianteInicial = async (
  payload: EstudianteInicialPayload,
): Promise<ApiResponse<EstudianteInicialResult>> => {
  const { data } = await api.post<ApiResponse<EstudianteInicialResult>>(
    '/admin/primera-carga/estudiantes/manual',
    payload,
  );
  return data;
};
export const uploadEquivalencias = async (data: UploadData): Promise<UploadResult> => {
  const formData = new FormData();
  formData.append('file', data.file);
  formData.append('dry_run', String(data.dry_run));

  const response = await api.post<UploadResult>('/admin/primera-carga/equivalencias', formData, { // Changed apiClient.post to api.post
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data;
};

export const registrarDisposicionEquivalenciaPrimeraCarga = async (
  payload: EquivalenciaDisposicionPayload,
): Promise<EquivalenciaDisposicionDTO> => {
  const { data } = await api.post<EquivalenciaDisposicionDTO>(
    "/admin/primera-carga/equivalencias/disposiciones",
    payload,
  );
  return data;
};

export interface RegularidadMetadataMateria {
  id: number;
  nombre: string;
  anio_cursada: number | null;
  formato: string;
  dictado: string | null;
  regimen: string;
  plan_resolucion: string;
}

export interface RegularidadMetadataPlan {
  id: number;
  resolucion: string;
  anio_inicio: number | null;
  anio_fin: number | null;
  vigente: boolean;
  materias: RegularidadMetadataMateria[];
}

export interface RegularidadMetadataProfesorado {
  id: number;
  nombre: string;
  acronimo: string;
  planes: RegularidadMetadataPlan[];
}

export interface RegularidadMetadataPlantilla {
  id: number;
  nombre: string;
  dictado: string;
  descripcion?: string | null;
  columnas: Array<{
    key: string;
    label: string;
    type?: string;
    optional?: boolean;
  }>;
  situaciones: Array<{
    codigo: string;
    label: string;
    descripcion?: string;
    color?: string;
  }>;
  referencias: Array<{
    codigo?: string;
    label?: string;
    descripcion?: string;
  }>;
  formato: {
    slug: string;
    nombre: string;
    metadata?: Record<string, unknown>;
  };
}

export interface RegularidadMetadataResponse {
  profesorados: RegularidadMetadataProfesorado[];
  plantillas: RegularidadMetadataPlantilla[];
  docentes: Array<{
    id: number;
    nombre: string;
    dni?: string | null;
  }>;
  estudiantes: Array<{
    dni: string;
    apellido_nombre: string;
    profesorados: number[];
  }>;
}

export const fetchRegularidadMetadata = async (include_all = false): Promise<RegularidadMetadataResponse> => {
  const { data } = await api.get<ApiResponse<RegularidadMetadataResponse>>(
    '/admin/primera-carga/regularidades/metadata',
    { params: { include_all } }
  );
  return data.data;
};

export interface PlanillaRegularidadDocentePayload {
  docente_id?: number | null;
  nombre: string;
  dni?: string | null;
  rol?: string | null;
  orden?: number | null;
}

export interface PlanillaRegularidadFilaPayload {
  orden?: number | null;
  dni: string;
  apellido_nombre: string;
  nota_final: number | null;
  asistencia: number | null;
  situacion: string;
  excepcion?: boolean;
  datos?: Record<string, string | number | null | undefined>;
}

export interface PlanillaRegularidadCreatePayload {
  profesorado_id: number;
  materia_id: number;
  plantilla_id: number;
  dictado: string;
  fecha: string;
  folio?: string | null;
  plan_resolucion?: string | null;
  observaciones?: string | null;
  datos_adicionales?: Record<string, string>;
  docentes?: PlanillaRegularidadDocentePayload[];
  filas: PlanillaRegularidadFilaPayload[];
  estado?: string;
  dry_run?: boolean;
}

export interface PlanillaRegularidadCreateResult {
  id: number;
  codigo: string;
  numero: number;
  anio_academico: number;
  profesorado_id: number;
  materia_id: number;
  plantilla_id: number;
  dictado: string;
  fecha: string;
  pdf_url?: string | null;
  warnings?: string[];
  regularidades_registradas?: number;
}

interface ApiResponse<T> {
  ok: boolean;
  message: string;
  data: T;
}

export const crearPlanillaRegularidad = async (
  payload: PlanillaRegularidadCreatePayload,
): Promise<ApiResponse<PlanillaRegularidadCreateResult>> => {
  const { data } = await api.post<ApiResponse<PlanillaRegularidadCreateResult>>(
    '/admin/primera-carga/regularidades/planillas',
    payload,
  );
  return data;
};

export interface PlanillaRegularidadListItem {
  id: number;
  codigo: string;
  profesorado_nombre: string;
  materia_nombre: string;
  anio_cursada: string;
  dictado?: string;
  fecha: string;
  cantidad_estudiantes: number;
  estado: string;
  created_at: string;
}

export const listarHistorialRegularidades = async (): Promise<PlanillaRegularidadListItem[]> => {
  const { data } = await api.get<PlanillaRegularidadListItem[]>(
    '/admin/primera-carga/regularidades/historial',
  );
  return data;
};

export interface PlanillaRegularidadDetalle extends PlanillaRegularidadCreateResult {
  profesorado_nombre: string;
  materia_nombre: string;
  folio?: string | null;
  plan_resolucion?: string | null;
  observaciones?: string | null;
  datos_adicionales?: Record<string, string>;
  docentes: PlanillaRegularidadDocentePayload[];
  filas: PlanillaRegularidadFilaPayload[];
  estado: string;
}

export const obtenerPlanillaRegularidadDetalle = async (id: number): Promise<ApiResponse<PlanillaRegularidadDetalle>> => {
  const { data } = await api.get<ApiResponse<PlanillaRegularidadDetalle>>(
    `/admin/primera-carga/regularidades/planillas/${id}`,
  );
  return data;
};

export const actualizarPlanillaRegularidad = async (
  id: number,
  payload: PlanillaRegularidadCreatePayload,
): Promise<ApiResponse<PlanillaRegularidadDetalle>> => {
  const { data } = await api.put<ApiResponse<PlanillaRegularidadDetalle>>(
    `/admin/primera-carga/regularidades/planillas/${id}`,
    payload,
  );
  return data;
};
