import { client } from "@/api/client";

interface ApiResponse<T> {
  ok: boolean;
  message: string;
  data: T;
}

export type ComisionOptionDTO = {
  id: number;
  materia_id: number;
  materia_nombre: string;
  profesorado_id: number;
  profesorado_nombre: string;
  plan_id: number;
  plan_resolucion: string;
  anio: number;
  cuatrimestre: string | null;
  turno: string;
  codigo: string;
};

export type MateriaOptionDTO = {
  id: number;
  nombre: string;
  anio: number | null;
  cuatrimestre: string | null;
  formato: string | null;
};

export type ProfesoradoDTO = {
  id: number;
  nombre: string;
};

export type PlanDTO = {
  id: number;
  resolucion: string;
};

export type RegularidadEstudianteDTO = {
  inscripcion_id: number;
  estudiante_id: number;
  orden: number;
  apellido_nombre: string;
  dni: string;
  nota_tp: number | null;
  nota_final: number | null;
  asistencia: number | null;
  excepcion: boolean;
  situacion: string | null;
  observaciones: string | null;
  correlativas_caidas: string[];
};

export type SituacionOptionDTO = {
  alias: string;
  codigo: string;
  descripcion: string;
};

export type RegularidadPlanillaDTO = {
  materia_id: number;
  materia_nombre: string;
  materia_anio?: number | null;
  formato: string;
  regimen?: string | null;
  comision_id: number;
  comision_codigo: string;
  anio: number;
  turno: string;
  profesorado_id?: number | null;
  profesorado_nombre?: string | null;
  plan_id?: number | null;
  plan_resolucion?: string | null;
  docentes: string[];
  fecha_cierre?: string | null;
  esta_cerrada: boolean;
  cerrada_en?: string | null;
  cerrada_por?: string | null;
  puede_editar: boolean;
  puede_cerrar: boolean;
  puede_reabrir: boolean;
  situaciones: SituacionOptionDTO[];
  estudiantes: RegularidadEstudianteDTO[];
};

export type RegularidadEstudiantePayload = {
  inscripcion_id: number;
  nota_tp?: number | null;
  nota_final?: number | null;
  asistencia?: number | null;
  excepcion?: boolean;
  situacion: string;
  observaciones?: string | null;
};

export type GuardarRegularidadPayload = {
  comision_id: number;
  fecha_cierre?: string;
  estudiantes: RegularidadEstudiantePayload[];
  observaciones_generales?: string | null;
};

export type DatosCargaNotasDTO = {
  materias: MateriaOptionDTO[];
  comisiones: ComisionOptionDTO[];
};

export type MesaResumenDTO = {
  id: number;
  materia_id: number;
  materia_nombre: string;
  profesorado_id: number | null;
  profesorado_nombre: string | null;
  plan_id: number | null;
  plan_resolucion: string | null;
  anio_cursada: number | null;
  regimen: string | null;
  tipo: string;
  modalidad: string;
  fecha: string;
  hora_desde?: string | null;
  hora_hasta?: string | null;
  aula?: string | null;
  cupo: number;
  codigo?: string | null;
  docentes?: MesaTribunalDocenteDTO[];
};

export type MesaTribunalDocenteDTO = {
  rol: "PRES" | "VOC1" | "VOC2";
  docente_id: number | null;
  nombre: string | null;
  dni: string | null;
};

export async function listarProfesorados() {
  const { data } = await client.get<ProfesoradoDTO[]>("/profesorados/", {
    params: { vigentes: true },
  });
  return data;
}

export async function listarPlanes(profesoradoId: number) {
  const { data } = await client.get<PlanDTO[]>(`/profesorados/${profesoradoId}/planes`);
  return data;
}

export async function obtenerDatosCargaNotas(params: {
  plan_id: number;
  materia_id?: number | null;
  anio?: number | null;
  cuatrimestre?: string | null;
}) {
  const query: Record<string, number | string> = { plan_id: params.plan_id };
  if (params.materia_id) query.materia_id = params.materia_id;
  if (params.anio) query.anio = params.anio;
  if (params.cuatrimestre) query.cuatrimestre = params.cuatrimestre;

  const { data } = await client.get<DatosCargaNotasDTO>("/estudiantes/carga-notas/comisiones", {
    params: query,
  });
  return data;
}

export async function obtenerPlanillaRegularidad(comisionId: number) {
  const { data } = await client.get<RegularidadPlanillaDTO>("/estudiantes/carga-notas/regularidad", {
    params: { comision_id: comisionId },
  });
  return data;
}

export async function guardarPlanillaRegularidad(payload: GuardarRegularidadPayload) {
  const { data } = await client.post("/estudiantes/carga-notas/regularidad", payload);
  return data;
}

export async function gestionarCierreRegularidad(comisionId: number, accion: "cerrar" | "reabrir") {
  const { data } = await client.post<ApiResponse<null>>("/estudiantes/carga-notas/regularidad/cierre", {
    comision_id: comisionId,
    accion,
  });
  return data;
}

export async function listarMesasFinales(params?: {
  ventana_id?: number;
  tipo?: "FIN" | "EXT" | "ESP";
  modalidad?: "REG" | "LIB";
  profesorado_id?: number;
  plan_id?: number;
  anio?: number;
  cuatrimestre?: string;
  materia_id?: number;
  codigo?: string;
}) {
  const { data } = await client.get<MesaResumenDTO[]>("/mesas", {
    params,
  });
  return data;
}

export async function buscarMesaPorCodigo(codigo: string) {
  const term = codigo.trim();
  if (!term) {
    return null;
  }
  const { data } = await client.get<MesaResumenDTO[]>("/mesas", {
    params: { codigo: term },
  });
  return data?.[0] ?? null;
}

export type ActaNotaOption = {
  value: string;
  label: string;
};

export type ActaMetadataMateria = {
  id: number;
  nombre: string;
  anio_cursada: number | null;
  plan_id: number;
  plan_resolucion: string;
};

export type ActaMetadataPlan = {
  id: number;
  resolucion: string;
  materias: ActaMetadataMateria[];
};

export type ActaMetadataProfesorado = {
  id: number;
  nombre: string;
  planes: ActaMetadataPlan[];
};

export type ActaMetadataDocente = {
  id: number;
  nombre: string;
  dni?: string | null;
};

export type ActaMetadataDTO = {
  profesorados: ActaMetadataProfesorado[];
  docentes: ActaMetadataDocente[];
  estudiantes: Array<{ dni: string; apellido_nombre: string }>;
  nota_opciones: ActaNotaOption[];
};

export type ActaDocentePayload = {
  rol: string;
  docente_id?: number | null;
  nombre: string;
  dni?: string | null;
};

export type ActaEstudiantePayload = {
  numero_orden: number;
  permiso_examen?: string | null;
  dni: string;
  apellido_nombre: string;
  examen_escrito?: string | null;
  examen_oral?: string | null;
  calificacion_definitiva: string;
  observaciones?: string | null;
};

export type ActaCreatePayload = {
  tipo: "REG" | "LIB";
  profesorado_id: number;
  materia_id: number;
  fecha: string;
  folio: string;
  libro?: string | null;
  observaciones?: string | null;
  docentes: ActaDocentePayload[];
  estudiantes: ActaEstudiantePayload[];
  total_aprobados?: number;
  total_desaprobados?: number;
  total_ausentes?: number;
};

export type ActaCreateResult = {
  id: number;
  codigo: string;
};

export interface ActaListItemDTO {
  id: number;
  codigo: string;
  fecha: string;
  materia: string;
  libro: string | null;
  folio: string | null;
  total_estudiantes: number;
  created_at: string;
  mesa_id?: number | null;
  esta_cerrada?: boolean;
}

export interface ActaDetailDTO {
  id: number;
  codigo: string;
  fecha: string;
  profesorado: string;
  materia: string;
  materia_anio?: number | null;
  plan_resolucion?: string | null;
  libro: string | null;
  folio: string | null;
  observaciones: string | null;
  total_estudiantes: number;
  total_aprobados: number;
  total_desaprobados: number;
  total_ausentes: number;
  created_by: string | null;
  created_at: string | null;
  mesa_id?: number | null;
  esta_cerrada?: boolean;
  estudiantes: ActaEstudiantePayload[];
  docentes: ActaDocentePayload[];
}

export type ActaFilter = {
  anio?: string;
  materia?: string;
  libro?: string;
  folio?: string;
};

export async function listarActas(filters?: ActaFilter) {
  const params: Record<string, string | number> = {};
  if (filters) {
    if (filters.anio && filters.anio.trim() !== "") params.anio = filters.anio;
    if (filters.materia && filters.materia.trim() !== "") params.materia = filters.materia;
    if (filters.libro && filters.libro.trim() !== "") params.libro = filters.libro;
    if (filters.folio && filters.folio.trim() !== "") params.folio = filters.folio;
  }

  const { data } = await client.get<ActaListItemDTO[]>("/estudiantes/carga-notas/actas", {
    params,
  });
  return data;
}

export async function obtenerActa(actaId: number) {
  const { data } = await client.get<ActaDetailDTO>(`/estudiantes/carga-notas/actas/${actaId}`);
  return data;
}

export async function actualizarCabeceraActa(
  actaId: number,
  payload: { fecha: string; libro?: string | null; folio?: string | null }
) {
  const { data } = await client.put<ApiResponse<null>>(
    `/estudiantes/carga-notas/actas/${actaId}/header`,
    payload
  );
  return data;
}

export type OralTopicDTO = {
  tema: string;
  score?: string | null;
};

export type ActaOralDTO = {
  acta_numero?: string | null;
  folio_numero?: string | null;
  fecha?: string | null;
  curso?: string | null;
  nota_final?: string | null;
  observaciones?: string | null;
  temas_estudiante: OralTopicDTO[];
  temas_docente: OralTopicDTO[];
};

export type ActaOralListItemDTO = ActaOralDTO & {
  inscripcion_id: number;
  estudiante: string;
  dni: string;
};

export type GuardarActaOralPayload = {
  acta_numero?: string | null;
  folio_numero?: string | null;
  fecha?: string | null;
  curso?: string | null;
  nota_final?: string | null;
  observaciones?: string | null;
  temas_estudiante: OralTopicDTO[];
  temas_docente: OralTopicDTO[];
};

export async function fetchActaMetadata(): Promise<ActaMetadataDTO> {
  const { data } = await client.get<ApiResponse<ActaMetadataDTO>>(
    "/estudiantes/carga-notas/actas/metadata",
  );
  return data.data;
}

export async function crearActaExamen(payload: ActaCreatePayload) {
  const { data } = await client.post<ApiResponse<ActaCreateResult>>(
    "/estudiantes/carga-notas/actas",
    payload,
  );
  return data;
}

export async function obtenerActaOral(
  mesaId: number,
  inscripcionId: number,
): Promise<ActaOralDTO> {
  const { data } = await client.get<ActaOralDTO>(
    `/estudiantes/carga-notas/mesas/${mesaId}/oral-actas/${inscripcionId}`,
  );
  return data;
}

export async function guardarActaOral(
  mesaId: number,
  inscripcionId: number,
  payload: GuardarActaOralPayload,
) {
  const { data } = await client.post<ApiResponse<null>>(
    `/estudiantes/carga-notas/mesas/${mesaId}/oral-actas/${inscripcionId}`,
    payload,
  );
  return data;
}

export async function listarActasOrales(mesaId: number): Promise<ActaOralListItemDTO[]> {
  const { data } = await client.get<ActaOralListItemDTO[]>(
    `/estudiantes/carga-notas/mesas/${mesaId}/oral-actas`,
  );
  return data;
}
