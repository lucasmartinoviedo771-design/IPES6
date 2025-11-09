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

export interface AlumnoClaseListado {
  clase_id: number;
  fecha: string;
  materia: string;
  comision: string;
  turno?: string | null;
  horario?: string | null;
  estado_clase: string;
  total_alumnos: number;
  presentes: number;
  ausentes: number;
  ausentes_justificados: number;
}

export interface AlumnoClasesResponse {
  clases: AlumnoClaseListado[];
}

export async function fetchAlumnoClases(params: {
  comision_id?: number;
  materia_id?: number;
  desde?: string;
  hasta?: string;
}): Promise<AlumnoClasesResponse> {
  const { data } = await client.get<AlumnoClasesResponse>(`/asistencia/alumnos/clases`, {
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

export interface AlumnoResumen {
  estudiante_id: number;
  dni: string;
  nombre: string;
  apellido: string;
  estado: string;
  justificada: boolean;
}

export interface ClaseAlumnoDetalle {
  clase_id: number;
  comision: string;
  fecha: string;
  horario?: string | null;
  materia: string;
  docentes: string[];
  alumnos: AlumnoResumen[];
}

export async function fetchClaseAlumnos(claseId: number): Promise<ClaseAlumnoDetalle> {
  const { data } = await client.get<ClaseAlumnoDetalle>(`/asistencia/alumnos/clases/${claseId}`);
  return data;
}

export interface RegistrarAsistenciaAlumnosPayload {
  presentes: number[];
  observaciones?: string;
}

export async function registrarAsistenciaAlumnos(claseId: number, payload: RegistrarAsistenciaAlumnosPayload) {
  await client.post(`/asistencia/alumnos/clases/${claseId}/registrar`, payload);
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
  const { data } = await client.post(`/asistencia/alumnos/justificaciones`, payload);
  return data;
}

export async function aprobarJustificacion(justificacionId: number) {
  const { data } = await client.post(`/asistencia/alumnos/justificaciones/${justificacionId}/aprobar`);
  return data;
}
