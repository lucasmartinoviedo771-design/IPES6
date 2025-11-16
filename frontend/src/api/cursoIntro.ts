import { client } from "@/api/client";

export type CursoIntroCohorteDTO = {
  id: number;
  nombre?: string | null;
  anio_academico: number;
  profesorado_id?: number | null;
  profesorado_nombre?: string | null;
  turno_id?: number | null;
  turno_nombre?: string | null;
  ventana_id?: number | null;
  ventana_tipo?: string | null;
  fecha_inicio?: string | null;
  fecha_fin?: string | null;
  cupo?: number | null;
  observaciones?: string | null;
};

export type CursoIntroCohortePayload = {
  nombre?: string | null;
  anio_academico: number;
  profesorado_id?: number | null;
  turno_id?: number | null;
  ventana_id?: number | null;
  fecha_inicio?: string | null;
  fecha_fin?: string | null;
  cupo?: number | null;
  observaciones?: string | null;
};

export type CursoIntroRegistroDTO = {
  id: number;
  estudiante_id: number;
  estudiante_nombre: string;
  estudiante_dni: string;
  profesorado_id?: number | null;
  profesorado_nombre?: string | null;
  cohorte_id?: number | null;
  cohorte_nombre?: string | null;
  turno_id?: number | null;
  turno_nombre?: string | null;
  resultado: string;
  resultado_display: string;
  asistencias_totales?: number | null;
  nota_final?: number | null;
  observaciones?: string | null;
  es_historico: boolean;
  resultado_at?: string | null;
};

export type CursoIntroRegistroFilters = {
  cohorte_id?: number;
  profesorado_id?: number;
  turno_id?: number;
  resultado?: string;
  anio?: number;
};

export type CursoIntroPendienteDTO = {
  estudiante_id: number;
  estudiante_dni: string;
  estudiante_nombre: string;
  profesorados: Array<{ id: number | null; nombre: string; anio_ingreso?: number | null }>;
  anio_ingreso?: number | null;
};

export type CursoIntroVentanaDTO = {
  id: number;
  desde: string;
  hasta: string;
  activo: boolean;
  periodo?: string | null;
};

export type CursoIntroEstadoDTO = {
  aprobado: boolean;
  registro_actual?: CursoIntroRegistroDTO | null;
  cohortes_disponibles: CursoIntroCohorteDTO[];
  ventanas: CursoIntroVentanaDTO[];
};

export async function fetchCursoIntroCohortes(): Promise<CursoIntroCohorteDTO[]> {
  const { data } = await client.get<CursoIntroCohorteDTO[]>("/alumnos/curso-intro/cohortes");
  return data;
}

export async function crearCursoIntroCohorte(payload: CursoIntroCohortePayload): Promise<CursoIntroCohorteDTO> {
  const { data } = await client.post<CursoIntroCohorteDTO>("/alumnos/curso-intro/cohortes", payload);
  return data;
}

export async function actualizarCursoIntroCohorte(
  cohorteId: number,
  payload: CursoIntroCohortePayload,
): Promise<CursoIntroCohorteDTO> {
  const { data } = await client.put<CursoIntroCohorteDTO>(`/alumnos/curso-intro/cohortes/${cohorteId}`, payload);
  return data;
}

export async function listarCursoIntroRegistros(
  filters: CursoIntroRegistroFilters = {},
): Promise<CursoIntroRegistroDTO[]> {
  const params: Record<string, number | string> = {};
  if (filters.cohorte_id) params.cohorte_id = filters.cohorte_id;
  if (filters.profesorado_id) params.profesorado_id = filters.profesorado_id;
  if (filters.turno_id) params.turno_id = filters.turno_id;
  if (filters.resultado) params.resultado = filters.resultado;
  if (filters.anio) params.anio = filters.anio;
  const { data } = await client.get<CursoIntroRegistroDTO[]>("/alumnos/curso-intro/registros", { params });
  return data;
}

export async function listarCursoIntroPendientes(
  profesoradoId?: number,
): Promise<CursoIntroPendienteDTO[]> {
  const params: Record<string, number> = {};
  if (profesoradoId) params.profesorado_id = profesoradoId;
  const { data } = await client.get<CursoIntroPendienteDTO[]>("/alumnos/curso-intro/pendientes", { params });
  return data;
}

export async function inscribirCursoIntro(payload: {
  cohorte_id: number;
  estudiante_id: number;
  profesorado_id?: number;
  turno_id?: number;
}): Promise<CursoIntroRegistroDTO> {
  const { data } = await client.post<CursoIntroRegistroDTO>("/alumnos/curso-intro/registros", payload);
  return data;
}

export async function registrarCursoIntroAsistencia(
  registroId: number,
  asistencias_totales: number,
): Promise<CursoIntroRegistroDTO> {
  const { data } = await client.post<CursoIntroRegistroDTO>(
    `/alumnos/curso-intro/registros/${registroId}/asistencia`,
    { asistencias_totales },
  );
  return data;
}

export async function cerrarCursoIntroRegistro(
  registroId: number,
  payload: { nota_final?: number; asistencias_totales?: number; resultado: string; observaciones?: string },
): Promise<CursoIntroRegistroDTO> {
  const body: Record<string, unknown> = { resultado: payload.resultado };
  if (payload.nota_final !== undefined) body.nota_final = payload.nota_final;
  if (payload.asistencias_totales !== undefined) body.asistencias_totales = payload.asistencias_totales;
  if (payload.observaciones !== undefined) body.observaciones = payload.observaciones;
  const { data } = await client.post<CursoIntroRegistroDTO>(
    `/alumnos/curso-intro/registros/${registroId}/cierre`,
    body,
  );
  return data;
}

export async function fetchCursoIntroEstado(): Promise<CursoIntroEstadoDTO> {
  const { data } = await client.get<CursoIntroEstadoDTO>("/alumnos/curso-intro/estado");
  return data;
}

export async function autoInscribirCursoIntro(payload: {
  cohorte_id: number;
  profesorado_id?: number | null;
  turno_id?: number | null;
}): Promise<CursoIntroRegistroDTO> {
  const { data } = await client.post<CursoIntroRegistroDTO>("/alumnos/curso-intro/auto-inscripcion", payload);
  return data;
}
