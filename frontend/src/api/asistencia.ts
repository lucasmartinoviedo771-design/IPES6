import client from "@/api/client";

export interface DocenteClase {
  id: number;
  fecha: string;
  comision_id: number;
  materia: string;
  materia_id: number;
  comision: string;
  turno: string;
  horario?: string | null;
  aula?: string | null;
  puede_marcar: boolean;
  editable_staff: boolean;
  ya_registrada: boolean;
  registrada_en?: string | null;
  ventana_inicio?: string | null;
  ventana_fin?: string | null;
  umbral_tarde?: string | null;
  plan_id?: number | null;
  plan_resolucion?: string | null;
  profesorado_id?: number | null;
  profesorado_nombre?: string | null;
}

export interface DocenteClasesResponse {
  docente: {
    nombre: string;
    dni: string;
  };
  clases: DocenteClase[];
  historial: Array<{
    fecha: string;
    turno: string;
    estado: string;
    observacion?: string | null;
  }>;
}

export async function fetchDocenteClases(
  dni: string,
  params?: { fecha?: string; desde?: string; hasta?: string; dia_semana?: number },
): Promise<DocenteClasesResponse> {
  const { data } = await client.get<DocenteClasesResponse>(`/asistencia/docentes/${dni}/clases`, { params });
  return data;
}

export interface MarcarDocentePresentePayload {
  dni: string;
  observaciones?: string;
  via?: "docente" | "staff";
  propagar_turno?: boolean;
}

export interface MarcarDocentePresenteResponse {
  clase_id: number;
  estado: string;
  registrada_en: string;
  categoria: "normal" | "tarde";
  alerta: boolean;
  alerta_tipo?: string | null;
  alerta_motivo?: string | null;
  mensaje?: string | null;
  turno?: string | null;
}

export async function marcarDocentePresente(
  claseId: number,
  payload: MarcarDocentePresentePayload,
): Promise<MarcarDocentePresenteResponse> {
  const { data } = await client.post<MarcarDocentePresenteResponse>(
    `/asistencia/docentes/clases/${claseId}/marcar-presente`,
    payload,
  );
  return data;
}

export async function registrarDocenteDni(dni: string, origen = "kiosk") {
  await client.post(`/asistencia/docentes/dni-log`, { dni, origen });
}

export interface EstudianteClaseListado {
  clase_id: number;
  fecha: string;
  materia: string;
  comision: string;
  turno?: string | null;
  horario?: string | null;
  estado_clase: string;
  total_estudiantes: number;
  presentes: number;
  ausentes: number;
  ausentes_justificados: number;
}

export interface EstudianteClasesResponse {
  clases: EstudianteClaseListado[];
}

export async function fetchEstudianteClases(params: {
  comision_id?: number;
  materia_id?: number;
  desde?: string;
  hasta?: string;
}): Promise<EstudianteClasesResponse> {
  const { data } = await client.get<EstudianteClasesResponse>(`/asistencia/estudiantes/clases`, {
    params,
  });
  return data;
}

export interface CalendarioEventoPayload {
  nombre: string;
  tipo: string;
  subtipo?: string | null;
  fecha_desde: string;
  fecha_hasta: string;
  turno_id?: number | null;
  profesorado_id?: number | null;
  plan_id?: number | null;
  comision_id?: number | null;
  docente_id?: number | null;
  aplica_docentes?: boolean;
  aplica_estudiantes?: boolean;
  motivo?: string | null;
  activo?: boolean;
}

export interface CalendarioEvento {
  id: number;
  nombre: string;
  tipo: string;
  subtipo: string;
  fecha_desde: string;
  fecha_hasta: string;
  turno_id?: number | null;
  turno_nombre?: string | null;
  profesorado_id?: number | null;
  profesorado_nombre?: string | null;
  plan_id?: number | null;
  plan_resolucion?: string | null;
  comision_id?: number | null;
  comision_nombre?: string | null;
  docente_id?: number | null;
  docente_nombre?: string | null;
  aplica_docentes: boolean;
  aplica_estudiantes: boolean;
  motivo?: string | null;
  activo: boolean;
  creado_en: string;
}

export async function listCalendarioEventos(params?: {
  desde?: string;
  hasta?: string;
  tipo?: string;
  solo_activos?: boolean;
}): Promise<CalendarioEvento[]> {
  const { data } = await client.get<CalendarioEvento[]>(`/asistencia/calendario/`, {
    params,
  });
  return data;
}

export async function crearCalendarioEvento(payload: CalendarioEventoPayload): Promise<CalendarioEvento> {
  const { data } = await client.post<CalendarioEvento>(`/asistencia/calendario/`, payload);
  return data;
}

export async function actualizarCalendarioEvento(
  eventoId: number,
  payload: CalendarioEventoPayload,
): Promise<CalendarioEvento> {
  const { data } = await client.put<CalendarioEvento>(`/asistencia/calendario/${eventoId}`, payload);
  return data;
}

export async function desactivarCalendarioEvento(eventoId: number): Promise<void> {
  await client.delete(`/asistencia/calendario/${eventoId}`);
}

export interface EstudianteResumen {
  estudiante_id: number;
  dni: string;
  nombre: string;
  apellido: string;
  estado: "presente" | "ausente" | "ausente_justificada" | "tarde";
  justificada: boolean;
  porcentaje_asistencia: number;
}

export interface ClaseNavegacion {
  id: number;
  fecha: string;
  descripcion: string;
  actual: boolean;
}

export interface ClaseEstudianteDetalle {
  clase_id: number;
  comision: string;
  fecha: string;
  horario?: string;
  materia: string;
  docentes: string[];
  docente_presente: boolean;
  docente_categoria_asistencia?: "normal" | "tarde" | "diferida";
  estudiantes: EstudianteResumen[];
  otras_clases: ClaseNavegacion[];
}

export async function fetchClaseEstudiantes(claseId: number): Promise<ClaseEstudianteDetalle> {
  const { data } = await client.get<ClaseEstudianteDetalle>(`/asistencia/estudiantes/clases/${claseId}`);
  return data;
}

export interface RegistrarAsistenciaEstudiantesPayload {
  presentes: number[];
  tardes: number[];
  observaciones?: string;
}

export async function registrarAsistenciaEstudiantes(claseId: number, payload: RegistrarAsistenciaEstudiantesPayload) {
  await client.post(`/asistencia/estudiantes/clases/${claseId}/registrar`, payload);
}

export interface CrearJustificacionPayload {
  tipo: "estudiante" | "docente";
  motivo: string;
  vigencia_desde: string;
  vigencia_hasta: string;
  origen?: "anticipada" | "posterior";
  comision_id: number;
  estudiante_id?: number;
  docente_id?: number;
  observaciones?: string;
  archivo_url?: string;
}

export async function crearJustificacion(payload: CrearJustificacionPayload) {
  const { data } = await client.post(`/asistencia/estudiantes/justificaciones`, payload);
  return data;
}

export async function aprobarJustificacion(justificacionId: number) {
  const { data } = await client.post(`/asistencia/estudiantes/justificaciones/${justificacionId}/aprobar`);
  return data;
}

export interface EstudianteAsistenciaItem {
  id: number;
  fecha: string;
  materia: string;
  comision: string;
  estado: string;
  justificada: boolean;
  observacion?: string | null;
}

export async function fetchMisAsistencias(): Promise<EstudianteAsistenciaItem[]> {
  const { data } = await client.get<EstudianteAsistenciaItem[]>("/asistencia/estudiantes/mis-asistencias");
  return data;
}
