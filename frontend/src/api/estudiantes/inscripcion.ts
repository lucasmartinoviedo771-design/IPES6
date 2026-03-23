import { client } from "@/api/client";
import { fetchVentanas } from "@/api/ventanas";
import {
  InscripcionMateriaPayload,
  CambioComisionPayload,
  CancelarInscripcionPayload,
  MesaExamenPayload,
  GenericResponse,
  ApiResponseDTO,
  VentanaInscripcion,
  MateriaPlanDTO,
  HistorialEstudianteDTO,
  MateriaInscriptaItemDTO,
  EquivalenciaItemDTO,
  MesaListadoParams,
  MesaListadoItemDTO,
  MesaPlanillaDTO,
  TrayectoriaCarreraDetalleDTO,
} from "./types";

export const solicitarInscripcionMateria = (payload: InscripcionMateriaPayload) =>
  client.post<GenericResponse>("/estudiantes/inscripcion-materia", payload).then(res => res.data);

export const solicitarCambioComision = (payload: CambioComisionPayload) =>
  client.post<GenericResponse>("/estudiantes/cambio-comision", payload).then(res => res.data);

export const cancelarInscripcionMateria = (payload: CancelarInscripcionPayload) => {
  const { inscripcion_id, dni } = payload;
  const body = dni ? { dni } : {};
  return client.post<ApiResponseDTO>(`/estudiantes/inscripcion-materia/${inscripcion_id}/cancelar`, body).then(res => res.data);
};

export const solicitarPedidoAnalitico = (payload: { motivo: 'equivalencia' | 'beca' | 'control' | 'otro'; motivo_otro?: string; dni?: string; cohorte?: number; profesorado_id?: number; plan_id?: number; }) =>
  client.post<GenericResponse>("/estudiantes/pedido_analitico", payload).then(res => res.data);

export const solicitarMesaExamen = (payload: MesaExamenPayload) =>
  client.post<GenericResponse>("/estudiantes/mesa-examen", payload).then(res => res.data);

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

export async function obtenerMateriasPlanEstudiante(params?: { dni?: string; plan_id?: number; profesorado_id?: number }): Promise<MateriaPlanDTO[]> {
  const { data } = await client.get<MateriaPlanDTO[]>(`/estudiantes/materias-plan`, { params });
  return data;
}

export async function obtenerCarrerasActivas(params?: { dni?: string }): Promise<TrayectoriaCarreraDetalleDTO[]> {
  const { data } = await client.get<TrayectoriaCarreraDetalleDTO[]>(`/estudiantes/carreras-activas`, { params });
  return data;
}

export async function obtenerMateriasInscriptas(params?: { anio?: number; dni?: string }): Promise<MateriaInscriptaItemDTO[]> {
  const { data } = await client.get<MateriaInscriptaItemDTO[]>(`/estudiantes/materias-inscriptas`, { params });
  return data;
}

export async function obtenerEquivalencias(materia_id: number): Promise<EquivalenciaItemDTO[]> {
  const { data } = await client.get<EquivalenciaItemDTO[]>(`/estudiantes/equivalencias`, { params: { materia_id } });
  return data;
}

export async function listarMesas(params?: MesaListadoParams): Promise<MesaListadoItemDTO[]> {
  const { data } = await client.get<MesaListadoItemDTO[]>(`/estudiantes/mesas`, { params });
  return data;
}

export async function inscribirMesa(payload: { mesa_id: number; dni?: string }): Promise<{ message: string }> {
  const { data } = await client.post<{ message: string }>(`/estudiantes/inscribir_mesa`, payload);
  return data;
}

export async function obtenerMesaPlanilla(mesaId: number): Promise<MesaPlanillaDTO> {
  const { data } = await client.get<MesaPlanillaDTO>(`/estudiantes/mesas/${mesaId}/planilla`);
  return data;
}

export async function actualizarMesaPlanilla(mesaId: number, payload: {
  estudiantes: Array<{
    inscripcion_id: number;
    fecha_resultado?: string | null;
    condicion?: string | null;
    nota?: number | null;
    folio?: string | null;
    libro?: string | null;
    observaciones?: string | null;
    cuenta_para_intentos?: boolean | null;
  }>
}): Promise<ApiResponseDTO> {
  const { data } = await client.post<ApiResponseDTO>(`/estudiantes/mesas/${mesaId}/planilla`, payload);
  return data;
}

export async function gestionarMesaPlanillaCierre(mesaId: number, accion: "cerrar" | "reabrir"): Promise<ApiResponseDTO> {
  const { data } = await client.post<ApiResponseDTO>(`/estudiantes/mesas/${mesaId}/cierre`, { accion });
  return data;
}
