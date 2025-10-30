import { client } from "@/api/client";
import { fetchVentanas, VentanaDto } from "@/api/ventanas";

// Schemas de entrada (payloads)
interface InscripcionCarreraPayload {
  carrera_id: number;
}

interface InscripcionMateriaPayload {
  materia_id: number;
  comision_id?: number;
  dni?: string;
}

interface CambioComisionPayload {
  inscripcion_id: number;
  comision_id: number;
}

interface CancelarInscripcionPayload {
  inscripcion_id: number;
  dni?: string;
}

interface MesaExamenPayload {
  materia_id: number;
  tipo_examen: string; // 'final', 'libre', 'extraordinaria'
}

// Schemas de salida (respuestas)
interface GenericResponse {
  message: string;
}

export interface ApiResponseDTO {
  ok: boolean;
  message: string;
  data?: unknown;
}

export const solicitarInscripcionCarrera = (payload: InscripcionCarreraPayload) =>
  client.post<GenericResponse>("/alumnos/inscripcion-carrera", payload).then(res => res.data);

export const solicitarInscripcionMateria = (payload: InscripcionMateriaPayload) =>
  client.post<GenericResponse>("/alumnos/inscripcion-materia", payload).then(res => res.data);

export const solicitarCambioComision = (payload: CambioComisionPayload) =>
  client.post<GenericResponse>("/alumnos/cambio-comision", payload).then(res => res.data);

export const cancelarInscripcionMateria = (payload: CancelarInscripcionPayload) => {
  const { inscripcion_id, dni } = payload;
  const body = dni ? { dni } : {};
  return client.post<ApiResponseDTO>(`/alumnos/inscripcion-materia/${inscripcion_id}/cancelar`, body).then(res => res.data);
};

export const solicitarPedidoAnalitico = (payload: { motivo: 'equivalencia'|'beca'|'control'|'otro'; motivo_otro?: string; dni?: string; cohorte?: number; }) =>
  client.post<GenericResponse>("/alumnos/pedido_analitico", payload).then(res => res.data);

export const solicitarMesaExamen = (payload: MesaExamenPayload) =>
  client.post<GenericResponse>("/alumnos/mesa-examen", payload).then(res => res.data);

// Nuevos tipos y APIs para inscripción a materias
export type VentanaInscripcion = VentanaDto;

export type HorarioDTO = { dia: string; desde: string; hasta: string };

export type MateriaPlanDTO = {
  id: number;
  nombre: string;
  anio: number;
  cuatrimestre: 'ANUAL' | '1C' | '2C';
  horarios: HorarioDTO[];
  correlativas_regular?: number[];
  correlativas_aprob?: number[];
  profesorado?: string; // opcional para encabezado
};

export type HistorialAlumnoDTO = {
  aprobadas: number[];
  regularizadas: number[];
  inscriptas_actuales: number[];
};

export type TrayectoriaEventoDTO = {
  id: string;
  tipo: 'preinscripcion' | 'inscripcion_materia' | 'regularidad' | 'mesa' | 'tramite' | 'nota';
  fecha: string;
  titulo: string;
  subtitulo?: string;
  detalle?: string;
  estado?: string;
  metadata?: Record<string, string>;
};

export type TrayectoriaMesaDTO = {
  id: number;
  mesa_id: number;
  materia_id: number;
  materia_nombre: string;
  tipo: string;
  tipo_display: string;
  fecha: string;
  estado: string;
  estado_display: string;
  aula?: string | null;
  nota?: string | null;
};

export type RegularidadResumenDTO = {
  id: number;
  materia_id: number;
  materia_nombre: string;
  situacion: string;
  situacion_display: string;
  fecha_cierre: string;
  nota_tp?: number | null;
  nota_final?: number | null;
  asistencia?: number | null;
  excepcion: boolean;
  observaciones?: string | null;
  vigencia_hasta?: string | null;
  vigente?: boolean | null;
  dias_restantes?: number | null;
};

export type MateriaSugeridaDTO = {
  materia_id: number;
  materia_nombre: string;
  anio: number;
  cuatrimestre: string;
  motivos: string[];
  alertas: string[];
};

export type FinalHabilitadoDTO = {
  materia_id: number;
  materia_nombre: string;
  regularidad_fecha: string;
  vigencia_hasta: string | null;
  dias_restantes: number | null;
  comentarios: string[];
};

export type RegularidadVigenciaDTO = {
  materia_id: number;
  materia_nombre: string;
  situacion: string;
  situacion_display: string;
  fecha_cierre: string;
  vigencia_hasta: string;
  dias_restantes: number;
  vigente: boolean;
  intentos_usados: number;
  intentos_max: number;
};

export type RecomendacionesTrayectoriaDTO = {
  materias_sugeridas: MateriaSugeridaDTO[];
  finales_habilitados: FinalHabilitadoDTO[];
  alertas: string[];
};

export type TrayectoriaEstudianteDTO = {
  dni: string;
  legajo?: string | null;
  apellido_nombre: string;
  carreras: string[];
  email?: string | null;
  telefono?: string | null;
  fecha_nacimiento?: string | null;
  lugar_nacimiento?: string | null;
  curso_introductorio?: string | null;
  promedio_general?: string | null;
  libreta_entregada?: boolean | null;
  legajo_estado?: string | null;
  cohorte?: string | null;
  activo?: boolean | null;
  materias_totales?: number | null;
  materias_aprobadas?: number | null;
  materias_regularizadas?: number | null;
  materias_en_curso?: number | null;
  fotoUrl?: string | null;
};

export type CartonEventoDTO = {
  fecha?: string | null;
  condicion?: string | null;
  nota?: string | null;
  folio?: string | null;
  libro?: string | null;
  id_fila?: number | null;
};

export type CartonMateriaDTO = {
  materia_id: number;
  materia_nombre: string;
  anio?: number | null;
  regimen?: string | null;
  regimen_display?: string | null;
  regularidad?: CartonEventoDTO | null;
  final?: CartonEventoDTO | null;
};

export type CartonPlanDTO = {
  profesorado_id: number;
  profesorado_nombre: string;
  plan_id: number;
  plan_resolucion: string;
  materias: CartonMateriaDTO[];
};

export type TrayectoriaDTO = {
  estudiante: TrayectoriaEstudianteDTO;
  historial: TrayectoriaEventoDTO[];
  mesas: TrayectoriaMesaDTO[];
  regularidades: RegularidadResumenDTO[];
  recomendaciones: RecomendacionesTrayectoriaDTO;
  regularidades_vigencia: RegularidadVigenciaDTO[];
  aprobadas: number[];
  regularizadas: number[];
  inscriptas_actuales: number[];
  carton: CartonPlanDTO[];
  updated_at: string;
};

export async function obtenerVentanaMaterias(): Promise<VentanaInscripcion | null> {
  try {
    const data = await fetchVentanas({ tipo: 'MATERIAS' });
    const hoy = new Date();
    const activa = (data || []).find(v => v.activo && new Date(v.desde) <= hoy && new Date(v.hasta) >= hoy);
    return activa || (data && data[0]) || null;
  } catch {
    return null;
  }
}

export async function obtenerMateriasPlanAlumno(params?: { dni?: string; plan_id?: number; profesorado_id?: number }): Promise<MateriaPlanDTO[]> {
  const { data } = await client.get<MateriaPlanDTO[]>(`/alumnos/materias-plan`, { params });
  return data;
}

export async function obtenerHistorialAlumno(params?: { dni?: string }): Promise<HistorialAlumnoDTO> {
  const { data } = await client.get<HistorialAlumnoDTO>(`/alumnos/historial`, { params });
  return data;
}

export async function obtenerTrayectoriaAlumno(params?: { dni?: string }): Promise<TrayectoriaDTO> {
  const { data } = await client.get<TrayectoriaDTO>(`/alumnos/trayectoria`, { params });
  return data;
}

export type ComisionResumenDTO = {
  id: number;
  codigo: string;
  anio_lectivo: number;
  turno_id: number;
  turno: string;
  materia_id: number;
  materia_nombre: string;
  plan_id?: number | null;
  profesorado_id?: number | null;
  profesorado_nombre?: string | null;
  docente?: string | null;
  cupo_maximo?: number | null;
  estado: string;
  horarios: HorarioDTO[];
};

export type MateriaInscriptaItemDTO = {
  inscripcion_id: number;
  materia_id: number;
  materia_nombre: string;
  plan_id?: number | null;
  profesorado_id?: number | null;
  profesorado_nombre?: string | null;
  anio_plan: number;
  anio_academico: number;
  estado: 'CONF' | 'PEND' | 'RECH' | 'ANUL';
  estado_display: string;
  comision_actual?: ComisionResumenDTO | null;
  comision_solicitada?: ComisionResumenDTO | null;
  fecha_creacion: string;
  fecha_actualizacion: string;
};

export type EquivalenciaItemDTO = {
  materia_id: number;
  materia_nombre: string;
  plan_id?: number | null;
  profesorado_id?: number | null;
  profesorado: string;
  cuatrimestre: 'ANUAL' | '1C' | '2C';
  horarios: { dia: string; desde: string; hasta: string }[];
  comisiones: ComisionResumenDTO[];
};

export async function obtenerMateriasInscriptas(params?: { anio?: number; dni?: string }): Promise<MateriaInscriptaItemDTO[]> {
  const { data } = await client.get<MateriaInscriptaItemDTO[]>(`/alumnos/materias-inscriptas`, { params });
  return data;
}

export async function obtenerEquivalencias(materia_id: number): Promise<EquivalenciaItemDTO[]> {
  const { data } = await client.get<EquivalenciaItemDTO[]>(`/alumnos/equivalencias`, { params: { materia_id } });
  return data;
}

// Mesas de examen (alumno)
type MesaListadoParams = {
  tipo?: 'FIN' | 'EXT';
  modalidad?: 'REG' | 'LIB';
  ventana_id?: number;
  profesorado_id?: number;
  plan_id?: number;
  anio?: number;
  cuatrimestre?: string;
  materia_id?: number;
};

export type MesaPlanillaCondicionDTO = {
  value: string;
  label: string;
  cuenta_para_intentos: boolean;
};

export type MesaPlanillaAlumnoDTO = {
  inscripcion_id: number;
  alumno_id: number;
  dni: string;
  apellido_nombre: string;
  condicion?: string | null;
  condicion_display?: string | null;
  nota?: number | null;
  folio?: string | null;
  libro?: string | null;
  fecha_resultado?: string | null;
  cuenta_para_intentos: boolean;
  observaciones?: string | null;
};

export type MesaPlanillaDTO = {
  mesa_id: number;
  materia_id: number;
  materia_nombre: string;
  tipo: string;
  modalidad: string;
  fecha: string;
  condiciones: MesaPlanillaCondicionDTO[];
  alumnos: MesaPlanillaAlumnoDTO[];
};

export async function listarMesas(params?: MesaListadoParams): Promise<any[]> {
  const { data } = await client.get<any[]>(`/alumnos/mesas`, { params });
  return data;
}

export async function inscribirMesa(payload: { mesa_id: number; dni?: string }): Promise<{ message: string }> {
  const { data } = await client.post<{ message: string }>(`/alumnos/inscribir_mesa`, payload);
  return data;
}

export async function obtenerMesaPlanilla(mesaId: number): Promise<MesaPlanillaDTO> {
  const { data } = await client.get<MesaPlanillaDTO>(`/alumnos/mesas/${mesaId}/planilla`);
  return data;
}

export async function actualizarMesaPlanilla(mesaId: number, payload: { alumnos: Array<{
  inscripcion_id: number;
  fecha_resultado?: string | null;
  condicion?: string | null;
  nota?: number | null;
  folio?: string | null;
  libro?: string | null;
  observaciones?: string | null;
  cuenta_para_intentos?: boolean | null;
}> }): Promise<ApiResponseDTO> {
  const { data } = await client.post<ApiResponseDTO>(`/alumnos/mesas/${mesaId}/planilla`, payload);
  return data;
}
