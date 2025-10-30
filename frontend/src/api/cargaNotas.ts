import { client } from "@/api/client";

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
  const query: Record<string, any> = { plan_id: params.plan_id };
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
  tipo?: "FIN" | "EXT";
  modalidad?: "REG" | "LIB";
  profesorado_id?: number;
  plan_id?: number;
  anio?: number;
  cuatrimestre?: string;
  materia_id?: number;
}) {
  const { data } = await client.get<MesaResumenDTO[]>("/mesas", {
    params,
  });
  return data;
}
