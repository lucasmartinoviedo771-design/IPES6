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
    { suppressErrorToast: true } as any
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
  fecha_inicio?: string | null;
  fecha_fin?: string | null;
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
  filas?: PlanillaRegularidadFilaPayload[];
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
  profesorado_id: number;
  profesorado_nombre: string;
  materia_nombre: string;
  anio_cursada: string;
  dictado?: string;
  fecha: string;
  cantidad_estudiantes: number;
  estado: string;
  folio?: string | null;
  anio_academico: number;
  created_at: string;
}



export const listarHistorialRegularidades = async (params?: { anio?: number, profesorado_id?: number, ordering?: string }): Promise<PlanillaRegularidadListItem[]> => {
  const { data } = await api.get<PlanillaRegularidadListItem[]>(
    '/admin/primera-carga/regularidades/historial',
    { params }
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

export interface RegularidadIndividualPayload {
  dni: string;
  materia_id: number;
  profesorado_id: number;
  plan_id?: number | null;
  fecha: string;
  dictado: string;
  nota_final?: number | null;
  asistencia?: number | null;
  situacion: string;
  excepcion?: boolean;
  observaciones?: string | null;
  force_upgrade?: boolean;
  folio?: string | null;
  docente_id?: number | null;
  docente_nombre?: string | null;
}

export const registrarRegularidadIndividual = async (
  payload: RegularidadIndividualPayload,
): Promise<ApiResponse<PlanillaRegularidadCreateResult>> => {
  const { data } = await api.post<ApiResponse<PlanillaRegularidadCreateResult>>(
    '/admin/primera-carga/regularidades/individual',
    payload,
  );
  return data;
};

// ---------------------------------------------------------------------------
// Mesas Pandemia / Notas Históricas
// ---------------------------------------------------------------------------

export interface MesaPandemiaFila {
  apellido_nombre: string;
  dni?: string;
  nota_raw?: string;         // "7", "AUSENTE", "LIBRE", etc.
  comision_obs?: string;     // comisión / otro profesorado (texto libre)
  observaciones?: string;
}

export interface MesaPandemiaPayload {
  profesorado_id: number;
  materia_id: number;
  fecha: string;             // YYYY-MM-DD
  tipo?: string;             // "FIN" | "EXT" | "ESP"  (default "EXT")
  docente_nombre?: string;
  folio?: string;
  libro?: string;
  observaciones?: string;
  filas: MesaPandemiaFila[];
  dry_run?: boolean;
}

export interface MesaPandemiaFilaResult {
  fila: number;
  dni?: string;
  apellido_nombre?: string;
  nota_raw?: string;
  condicion?: string;
  nota?: number | null;
  estado: 'aprobado' | 'desaprobado' | 'ausente' | 'omitida' | 'error';
  mensaje?: string;
  inscripcion_id?: number;
  mesa_id?: number;
  actualizada?: boolean;
}

export interface MesaPandemiaResult {
  ok: boolean;
  dry_run: boolean;
  mesa_id: number | null;
  materia_nombre: string;
  fecha: string;
  tipo: string;
  total_filas: number;
  procesadas: number;
  omitidas: number;
  errores_count: number;
  warnings: string[];
  results: MesaPandemiaFilaResult[];
}

export const registrarMesaPandemia = async (
  payload: MesaPandemiaPayload,
): Promise<ApiResponse<MesaPandemiaResult>> => {
  const { data } = await api.post<ApiResponse<MesaPandemiaResult>>(
    '/admin/primera-carga/mesas-pandemia',
    payload,
  );
  return data;
};

export interface MesaPandemiaHistoricoItem {
  id: number;
  materia_nombre: string;
  profesorado_nombre: string;
  fecha: string;
  tipo: string;
  cantidad_estudiantes: number;
  docente_presidente: string;
}

export const listarHistoricoMesasPandemia = async (params?: { ordering?: string }): Promise<MesaPandemiaHistoricoItem[]> => {
  const { data } = await api.get<ApiResponse<MesaPandemiaHistoricoItem[]>>(
    '/admin/primera-carga/mesas-pandemia',
    { params }
  );
  return data.data;
};
