import { client, AppAxiosRequestConfig } from "@/api/client";
import { fetchVentanas, VentanaDto } from "@/api/ventanas";

// Schemas de entrada (payloads)
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

export type PedidoEquivalenciaMateriaPayload = {
  id?: number;
  nombre: string;
  formato?: string;
  anio_cursada?: string;
  nota?: string;
};

export type PedidoEquivalenciaPayload = {
  tipo: 'ANEXO_A' | 'ANEXO_B';
  ciclo_lectivo?: string;
  profesorado_destino_id?: number;
  profesorado_destino_nombre?: string;
  plan_destino_id?: number;
  plan_destino_resolucion?: string;
  profesorado_origen_nombre?: string;
  plan_origen_resolucion?: string;
  establecimiento_origen?: string;
  establecimiento_localidad?: string;
  establecimiento_provincia?: string;
  materias: PedidoEquivalenciaMateriaPayload[];
};

export type PedidoEquivalenciaMateriaDTO = {
  id: number;
  nombre: string;
  formato?: string | null;
  anio_cursada?: string | null;
  nota?: string | null;
  resultado?: "pendiente" | "otorgada" | "rechazada" | null;
  observaciones?: string | null;
};

export type PedidoEquivalenciaDTO = {
  id: number;
  tipo: 'ANEXO_A' | 'ANEXO_B';
  estado: 'draft' | 'final';
  estado_display: string;
  workflow_estado: 'draft' | 'pending_docs' | 'review' | 'titulos' | 'notified';
  workflow_estado_display?: string;
  ciclo_lectivo?: string | null;
  profesorado_destino_id?: number | null;
  profesorado_destino_nombre?: string | null;
  plan_destino_id?: number | null;
  plan_destino_resolucion?: string | null;
  profesorado_origen_nombre?: string | null;
  plan_origen_resolucion?: string | null;
  establecimiento_origen?: string | null;
  establecimiento_localidad?: string | null;
  establecimiento_provincia?: string | null;
  ventana_id: number;
  ventana_label: string;
  created_at: string;
  updated_at: string;
  bloqueado_en?: string | null;
  puede_editar: boolean;
  estudiante_dni: string;
  estudiante_nombre?: string | null;
  requiere_tutoria?: boolean;
  documentacion_presentada?: boolean;
  documentacion_detalle?: string | null;
  documentacion_cantidad?: number | null;
  documentacion_registrada_en?: string | null;
  evaluacion_observaciones?: string | null;
  evaluacion_registrada_en?: string | null;
  resultado_final?: 'pendiente' | 'otorgada' | 'denegada' | 'mixta';
  titulos_documento_tipo?: 'ninguno' | 'nota' | 'disposicion' | 'ambos';
  titulos_nota_numero?: string | null;
  titulos_nota_fecha?: string | null;
  titulos_disposicion_numero?: string | null;
  titulos_disposicion_fecha?: string | null;
  titulos_observaciones?: string | null;
  titulos_registrado_en?: string | null;
  timeline?: {
    formulario_descargado_en?: string | null;
    inscripcion_verificada_en?: string | null;
    documentacion_registrada_en?: string | null;
    evaluacion_registrada_en?: string | null;
    titulos_registrado_en?: string | null;
    notificado_en?: string | null;
  } | null;
  materias: PedidoEquivalenciaMateriaDTO[];
};

export type EquivalenciaMateriaPendienteDTO = {
  id: number;
  nombre: string;
  anio: number;
  plan_id: number;
};

export type EquivalenciaDisposicionDetalleDTO = {
  id: number;
  materia_id: number;
  materia_nombre: string;
  nota: string;
};

export type EquivalenciaDisposicionDTO = {
  id: number;
  origen: "primera_carga" | "secretaria";
  estudiante_dni: string;
  estudiante_nombre: string;
  numero_disposicion: string;
  fecha_disposicion: string;
  profesorado_id: number;
  profesorado_nombre: string;
  plan_id: number;
  plan_resolucion: string;
  observaciones?: string | null;
  creado_por?: string | null;
  creado_en: string;
  detalles: EquivalenciaDisposicionDetalleDTO[];
};

export type EquivalenciaDisposicionPayload = {
  dni: string;
  profesorado_id: number;
  plan_id: number;
  numero_disposicion: string;
  fecha_disposicion: string;
  observaciones?: string | null;
  detalles: Array<{
    materia_id: number;
    nota: string;
  }>;
};

export async function listarPedidosEquivalencia(params: { dni?: string; estado?: 'draft' | 'final'; profesorado_id?: number; ventana_id?: number; workflow_estado?: string } = {}): Promise<PedidoEquivalenciaDTO[]> {
  const { data } = await client.get<PedidoEquivalenciaDTO[]>("/estudiantes/equivalencias/pedidos", { params });
  return data;
}

export async function crearPedidoEquivalencia(payload: PedidoEquivalenciaPayload, params: { dni?: string } = {}): Promise<PedidoEquivalenciaDTO> {
  const { data } = await client.post<PedidoEquivalenciaDTO>("/estudiantes/equivalencias/pedidos", payload, { params });
  return data;
}

export async function actualizarPedidoEquivalencia(id: number, payload: PedidoEquivalenciaPayload): Promise<PedidoEquivalenciaDTO> {
  const { data } = await client.put<PedidoEquivalenciaDTO>(`/estudiantes/equivalencias/pedidos/${id}`, payload);
  return data;
}

export async function eliminarPedidoEquivalencia(id: number): Promise<ApiResponseDTO> {
  const { data } = await client.delete<ApiResponseDTO>(`/estudiantes/equivalencias/pedidos/${id}`);
  return data;
}

export async function descargarNotaPedidoEquivalencia(id: number): Promise<Blob> {
  const { data } = await client.post<Blob>(`/estudiantes/equivalencias/pedidos/${id}/nota`, {}, { responseType: "blob" });
  return data;
}

export async function enviarPedidoEquivalencia(id: number): Promise<PedidoEquivalenciaDTO> {
  const { data } = await client.post<PedidoEquivalenciaDTO>(`/estudiantes/equivalencias/pedidos/${id}/enviar`);
  return data;
}

export async function registrarDocumentacionEquivalencia(
  id: number,
  payload: { presentada: boolean; cantidad?: number | null; detalle?: string | null },
): Promise<PedidoEquivalenciaDTO> {
  const { data } = await client.post<PedidoEquivalenciaDTO>(
    `/estudiantes/equivalencias/pedidos/${id}/documentacion`,
    payload,
  );
  return data;
}

export async function registrarEvaluacionEquivalencia(
  id: number,
  payload: { materias: Array<{ id: number; resultado: 'otorgada' | 'rechazada'; observaciones?: string | null }>; observaciones?: string | null },
): Promise<PedidoEquivalenciaDTO> {
  const { data } = await client.post<PedidoEquivalenciaDTO>(
    `/estudiantes/equivalencias/pedidos/${id}/evaluacion`,
    payload,
  );
  return data;
}

export async function registrarTitulosEquivalencia(
  id: number,
  payload: { nota_numero?: string | null; nota_fecha?: string | null; disposicion_numero?: string | null; disposicion_fecha?: string | null; observaciones?: string | null },
): Promise<PedidoEquivalenciaDTO> {
  const { data } = await client.post<PedidoEquivalenciaDTO>(
    `/estudiantes/equivalencias/pedidos/${id}/titulos`,
    payload,
  );
  return data;
}

export async function notificarPedidoEquivalencia(id: number, payload: { mensaje?: string | null } = {}): Promise<PedidoEquivalenciaDTO> {
  const { data } = await client.post<PedidoEquivalenciaDTO>(
    `/estudiantes/equivalencias/pedidos/${id}/notificar`,
    payload,
  );
  return data;
}

export async function exportarPedidosEquivalencia(params: { ventana_id?: number; profesorado_id?: number; estado?: 'draft' | 'final' } = {}): Promise<Blob> {
  const { data } = await client.get<Blob>(`/estudiantes/equivalencias/export`, { params, responseType: "blob" });
  return data;
}

export async function fetchMateriasPendientesEquivalencia(params: { dni: string; profesorado_id: number; plan_id: number }): Promise<EquivalenciaMateriaPendienteDTO[]> {
  const { data } = await client.get<EquivalenciaMateriaPendienteDTO[]>(
    "/estudiantes/equivalencias/disposiciones/materias",
    { params },
  );
  return data;
}

export async function crearDisposicionEquivalencia(payload: EquivalenciaDisposicionPayload): Promise<EquivalenciaDisposicionDTO> {
  const { data } = await client.post<EquivalenciaDisposicionDTO>(
    "/estudiantes/equivalencias/disposiciones",
    payload,
  );
  return data;
}

export async function listarDisposicionesEquivalencia(params: { dni?: string } = {}): Promise<EquivalenciaDisposicionDTO[]> {
  const { data } = await client.get<EquivalenciaDisposicionDTO[]>(
    "/estudiantes/equivalencias/disposiciones",
    { params },
  );
  return data;
}

export const solicitarMesaExamen = (payload: MesaExamenPayload) =>
  client.post<GenericResponse>("/estudiantes/mesa-examen", payload).then(res => res.data);

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
  profesorado_id?: number;
  plan_id?: number;
};

export type HistorialEstudianteDTO = {
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
  profesorado_id?: number | null;
  profesorado_nombre?: string | null;
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
  carreras_detalle?: TrayectoriaCarreraDetalleDTO[];
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

export type TrayectoriaCarreraDetalleDTO = {
  profesorado_id: number;
  nombre: string;
  planes: {
    id: number;
    resolucion?: string | null;
    vigente: boolean;
  }[];
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
  formato?: string | null;
  formato_display?: string | null;
  regularidad?: CartonEventoDTO | null;
  final?: CartonEventoDTO | null;
  finales?: CartonEventoDTO[] | null;
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

export async function obtenerMateriasPlanEstudiante(params?: { dni?: string; plan_id?: number; profesorado_id?: number }): Promise<MateriaPlanDTO[]> {
  const { data } = await client.get<MateriaPlanDTO[]>(`/estudiantes/materias-plan`, { params });
  return data;
}

export async function obtenerCarrerasActivas(params?: { dni?: string }): Promise<TrayectoriaCarreraDetalleDTO[]> {
  const { data } = await client.get<TrayectoriaCarreraDetalleDTO[]>(`/estudiantes/carreras-activas`, { params });
  return data;
}

export async function descargarCertificadoRegular(params: {
  profesorado_id: number;
  plan_id: number;
  dni?: string;
}): Promise<Blob> {
  const response = await client.get(`/estudiantes/certificados/estudiante-regular`, {
    params,
    responseType: "blob",
  });
  return response.data as Blob;
}

export type HorarioMateriaCeldaDTO = {
  materia_id: number;
  materia_nombre: string;
  comisiones: string[];
  docentes: string[];
  observaciones?: string | null;
  regimen: string;
  cuatrimestre?: string | null;
  es_cuatrimestral: boolean;
};

export type HorarioDiaDTO = {
  numero: number;
  nombre: string;
};

export type HorarioFranjaDTO = {
  orden: number;
  desde: string;
  hasta: string;
};

export type HorarioCeldaDTO = {
  dia_numero: number;
  franja_orden: number;
  dia: string;
  desde: string;
  hasta: string;
  materias: HorarioMateriaCeldaDTO[];
};

export type HorarioTablaDTO = {
  key: string;
  profesorado_id: number;
  profesorado_nombre: string;
  plan_id: number;
  plan_resolucion?: string | null;
  anio_plan: number;
  anio_plan_label: string;
  turno_id: number;
  turno_nombre: string;
  cuatrimestres: string[];
  dias: HorarioDiaDTO[];
  franjas: HorarioFranjaDTO[];
  celdas: HorarioCeldaDTO[];
  observaciones?: string | null;
};

export async function obtenerHorarioEstudiante(params?: {
  profesorado_id?: number;
  plan_id?: number;
  turno_id?: number;
  anio_plan?: number;
  cuatrimestre?: string;
  dni?: string;
}): Promise<HorarioTablaDTO[]> {
  const { data } = await client.get<HorarioTablaDTO[]>(`/estudiantes/horarios`, { params });
  return data;
}

export async function obtenerHistorialEstudiante(params?: { dni?: string }): Promise<HistorialEstudianteDTO> {
  const { data } = await client.get<HistorialEstudianteDTO>(`/estudiantes/historial`, { params });
  return data;
}

export async function obtenerTrayectoriaEstudiante(params?: { dni?: string }): Promise<TrayectoriaDTO> {
  const { data } = await client.get<TrayectoriaDTO>(`/estudiantes/trayectoria`, { params });
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
  const { data } = await client.get<MateriaInscriptaItemDTO[]>(`/estudiantes/materias-inscriptas`, { params });
  return data;
}

export async function obtenerEquivalencias(materia_id: number): Promise<EquivalenciaItemDTO[]> {
  const { data } = await client.get<EquivalenciaItemDTO[]>(`/estudiantes/equivalencias`, { params: { materia_id } });
  return data;
}

// Mesas de examen (estudiante)
type MesaListadoParams = {
  tipo?: 'FIN' | 'EXT' | 'ESP';
  modalidad?: 'REG' | 'LIB';
  ventana_id?: number;
  profesorado_id?: number;
  plan_id?: number;
  anio?: number;
  cuatrimestre?: string;
  materia_id?: number;
  dni?: string;
};

export type MesaPlanillaCondicionDTO = {
  value: string;
  label: string;
  cuenta_para_intentos: boolean;
};

export type MesaPlanillaEstudianteDTO = {
  inscripcion_id: number;
  estudiante_id: number;
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
  materia_anio?: number | null;
  regimen?: string | null;
  profesorado_id?: number | null;
  profesorado_nombre?: string | null;
  plan_id?: number | null;
  plan_resolucion?: string | null;
  tipo: string;
  modalidad: string;
  fecha: string;
  hora_desde?: string | null;
  hora_hasta?: string | null;
  mesa_codigo?: string | null;
  tribunal_presidente?: string | null;
  tribunal_vocal1?: string | null;
  tribunal_vocal2?: string | null;
  condiciones: MesaPlanillaCondicionDTO[];
  estudiantes: MesaPlanillaEstudianteDTO[];
  esta_cerrada: boolean;
  cerrada_en?: string | null;
  cerrada_por?: string | null;
  puede_editar: boolean;
  puede_cerrar: boolean;
  puede_reabrir: boolean;
};

export type MesaMateriaResumenDTO = {
  id: number;
  nombre: string;
};

export type MesaListadoItemDTO = {
  id: number;
  materia_id: number;
  materia_nombre?: string;
  materia?: MesaMateriaResumenDTO;
  tipo: "FIN" | "EXT" | "ESP";
  modalidad: "REG" | "LIB";
  fecha: string;
  hora_desde?: string | null;
  hora_hasta?: string | null;
  aula?: string | null;
  correlativas_aprob?: number[];
  correlativas_regular?: number[];
  codigo?: string | null;
};

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

export type ConstanciaExamenDTO = {
  inscripcion_id: number;
  estudiante: string;
  dni: string;
  materia: string;
  materia_anio?: number | null;
  profesorado?: string | null;
  profesorado_id?: number | null;
  plan_resolucion?: string | null;
  mesa_codigo?: string | null;
  mesa_fecha: string;
  mesa_hora_desde?: string | null;
  mesa_hora_hasta?: string | null;
  mesa_tipo: string;
  mesa_modalidad: string;
  condicion: string;
  condicion_display: string;
  nota?: string | null;
  folio?: string | null;
  libro?: string | null;
  tribunal_presidente?: string | null;
  tribunal_vocal1?: string | null;
  tribunal_vocal2?: string | null;
};

export async function obtenerConstanciasExamen(params?: { dni?: string }): Promise<ConstanciaExamenDTO[]> {
  const { data } = await client.get<ConstanciaExamenDTO[]>(`/estudiantes/constancias-examen`, { params });
  return data;
}

// --- Administración de estudiantes ---

export interface EstudianteAdminDocumentacionDTO {
  dni_legalizado?: boolean;
  fotos_4x4?: boolean;
  certificado_salud?: boolean;
  folios_oficio?: number;
  titulo_secundario_legalizado?: boolean;
  certificado_titulo_en_tramite?: boolean;
  analitico_legalizado?: boolean;
  certificado_estudiante_regular_sec?: boolean;
  adeuda_materias?: boolean;
  adeuda_materias_detalle?: string;
  escuela_secundaria?: string;
  es_certificacion_docente?: boolean;
  titulo_terciario_univ?: boolean;
  incumbencia?: boolean;
}

export interface EstudianteAdminListItemDTO {
  dni: string;
  apellido: string;
  nombre: string;
  email?: string | null;
  telefono?: string | null;
  estado_legajo: string;
  estado_legajo_display: string;
  carreras: string[];
  activo?: boolean;
  legajo?: string | null;
}

export interface EstudianteAdminListResponseDTO {
  total: number;
  items: EstudianteAdminListItemDTO[];
}

export interface EstudianteAdminDetailDTO {
  dni: string;
  apellido: string;
  nombre: string;
  email?: string | null;
  telefono?: string | null;
  domicilio?: string | null;
  fecha_nacimiento?: string | null;
  lugar_nacimiento?: string | null;
  estado_legajo: string;
  estado_legajo_display: string;
  must_change_password: boolean;
  activo?: boolean;
  carreras: string[];
  legajo?: string | null;
  datos_extra: Record<string, unknown>;
  documentacion?: EstudianteAdminDocumentacionDTO | null;
  condicion_calculada?: string | null;
  curso_introductorio_aprobado?: boolean | null;
  libreta_entregada?: boolean | null;
  genero?: string | null;
}

export interface EstudianteAdminUpdatePayload {
  dni?: string | null;
  apellido?: string | null;
  nombre?: string | null;
  email?: string | null;
  telefono?: string | null;
  domicilio?: string | null;
  estado_legajo?: string | null;
  must_change_password?: boolean | null;
  fecha_nacimiento?: string | null;
  lugar_nacimiento?: string | null;
  documentacion?: Partial<EstudianteAdminDocumentacionDTO>;
  anio_ingreso?: string | null;
  genero?: string | null;
  rol_extra?: string | null;
  observaciones?: string | null;
  cuil?: string | null;
  curso_introductorio_aprobado?: boolean | null;
  libreta_entregada?: boolean | null;
}

type EstudianteAdminListParams = {
  q?: string;
  carrera_id?: number;
  estado_legajo?: string;
  limit?: number;
  offset?: number;
};

export async function fetchEstudiantesAdmin(params: EstudianteAdminListParams = {}): Promise<EstudianteAdminListResponseDTO> {
  const { data } = await client.get<EstudianteAdminListResponseDTO>("/estudiantes/admin/estudiantes", { params });
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
