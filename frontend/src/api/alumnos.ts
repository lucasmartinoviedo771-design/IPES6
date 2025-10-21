import { client } from "@/api/client";

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
  comision_actual_id: number;
  comision_nueva_id: number;
}

interface MesaExamenPayload {
  materia_id: number;
  tipo_examen: string; // 'parcial', 'final', 'libre', 'extraordinaria'
}

// Schemas de salida (respuestas)
interface GenericResponse {
  message: string;
}

export const solicitarInscripcionCarrera = (payload: InscripcionCarreraPayload) =>
  client.post<GenericResponse>("/alumnos/inscripcion-carrera", payload).then(res => res.data);

export const solicitarInscripcionMateria = (payload: InscripcionMateriaPayload) =>
  client.post<GenericResponse>("/alumnos/inscripcion-materia", payload).then(res => res.data);

export const solicitarCambioComision = (payload: CambioComisionPayload) =>
  client.post<GenericResponse>("/alumnos/cambio-comision", payload).then(res => res.data);

export const solicitarPedidoAnalitico = (payload: { motivo: 'equivalencia'|'beca'|'control'|'otro'; motivo_otro?: string; dni?: string; cohorte?: number; }) =>
  client.post<GenericResponse>("/alumnos/pedido_analitico", payload).then(res => res.data);

export const solicitarMesaExamen = (payload: MesaExamenPayload) =>
  client.post<GenericResponse>("/alumnos/mesa-examen", payload).then(res => res.data);

// Nuevos tipos y APIs para inscripción a materias
export type VentanaInscripcion = {
  id?: number;
  tipo: string;
  desde: string; // YYYY-MM-DD
  hasta: string; // YYYY-MM-DD
  activo: boolean;
  periodo?: '1C_ANUALES' | '2C';
};

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

export async function obtenerVentanaMaterias(): Promise<VentanaInscripcion | null> {
  try {
    const { data } = await client.get<VentanaInscripcion[]>(`/ventanas`, { params: { tipo: 'MATERIAS' } });
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

export type EquivalenciaItemDTO = {
  materia_id: number;
  materia_nombre: string;
  profesorado: string;
  horarios: { dia: string; desde: string; hasta: string }[];
};

export async function obtenerEquivalencias(materia_id: number): Promise<EquivalenciaItemDTO[]> {
  const { data } = await client.get<EquivalenciaItemDTO[]>(`/alumnos/equivalencias`, { params: { materia_id } });
  return data;
}

// Mesas de examen (alumno)
export async function listarMesas(params?: { tipo?: 'PAR'|'FIN'|'LIB'|'EXT'; ventana_id?: number; }): Promise<any[]> {
  const { data } = await client.get<any[]>(`/alumnos/mesas`, { params });
  return data;
}

export async function inscribirMesa(payload: { mesa_id: number; dni?: string }): Promise<{ message: string }> {
  const { data } = await client.post<{ message: string }>(`/alumnos/inscribir_mesa`, payload);
  return data;
}
