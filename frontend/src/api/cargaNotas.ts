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

export type RegularidadAlumnoDTO = {
  inscripcion_id: number;
  alumno_id: number;
  orden: number;
  apellido_nombre: string;
  dni: string;
  nota_tp: number | null;
  nota_final: number | null;
  asistencia: number | null;
  excepcion: boolean;
  situacion: string | null;
  observaciones: string | null;
};

export type SituacionOptionDTO = {
  alias: string;
  codigo: string;
  descripcion: string;
};

export type RegularidadPlanillaDTO = {
  materia_id: number;
  materia_nombre: string;
  formato: string;
  comision_id: number;
  comision_codigo: string;
  anio: number;
  turno: string;
  situaciones: SituacionOptionDTO[];
  alumnos: RegularidadAlumnoDTO[];
};

export type RegularidadAlumnoPayload = {
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
  alumnos: RegularidadAlumnoPayload[];
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

  const { data } = await client.get<DatosCargaNotasDTO>("/alumnos/carga-notas/comisiones", {
    params: query,
  });
  return data;
}

export async function obtenerPlanillaRegularidad(comisionId: number) {
  const { data } = await client.get<RegularidadPlanillaDTO>("/alumnos/carga-notas/regularidad", {
    params: { comision_id: comisionId },
  });
  return data;
}

export async function guardarPlanillaRegularidad(payload: GuardarRegularidadPayload) {
  const { data } = await client.post("/alumnos/carga-notas/regularidad", payload);
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
  nota_opciones: ActaNotaOption[];
};

export type ActaDocentePayload = {
  rol: string;
  docente_id?: number | null;
  nombre: string;
  dni?: string | null;
};

export type ActaAlumnoPayload = {
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
  alumnos: ActaAlumnoPayload[];
  total_aprobados?: number;
  total_desaprobados?: number;
  total_ausentes?: number;
};

export type ActaCreateResult = {
  id: number;
  codigo: string;
};

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
  temas_alumno: OralTopicDTO[];
  temas_docente: OralTopicDTO[];
};

export type ActaOralListItemDTO = ActaOralDTO & {
  inscripcion_id: number;
  alumno: string;
  dni: string;
};

export type GuardarActaOralPayload = {
  acta_numero?: string | null;
  folio_numero?: string | null;
  fecha?: string | null;
  curso?: string | null;
  nota_final?: string | null;
  observaciones?: string | null;
  temas_alumno: OralTopicDTO[];
  temas_docente: OralTopicDTO[];
};

export async function fetchActaMetadata(): Promise<ActaMetadataDTO> {
  const { data } = await client.get<ApiResponse<ActaMetadataDTO>>(
    "/alumnos/carga-notas/actas/metadata",
  );
  return data.data;
}

export async function crearActaExamen(payload: ActaCreatePayload) {
  const { data } = await client.post<ApiResponse<ActaCreateResult>>(
    "/alumnos/carga-notas/actas",
    payload,
  );
  return data;
}

export async function obtenerActaOral(
  mesaId: number,
  inscripcionId: number,
): Promise<ActaOralDTO> {
  const { data } = await client.get<ActaOralDTO>(
    `/alumnos/carga-notas/mesas/${mesaId}/oral-actas/${inscripcionId}`,
  );
  return data;
}

export async function guardarActaOral(
  mesaId: number,
  inscripcionId: number,
  payload: GuardarActaOralPayload,
) {
  const { data } = await client.post<ApiResponse<null>>(
    `/alumnos/carga-notas/mesas/${mesaId}/oral-actas/${inscripcionId}`,
    payload,
  );
  return data;
}

export async function listarActasOrales(mesaId: number): Promise<ActaOralListItemDTO[]> {
  const { data } = await client.get<ActaOralListItemDTO[]>(
    `/alumnos/carga-notas/mesas/${mesaId}/oral-actas`,
  );
  return data;
}
