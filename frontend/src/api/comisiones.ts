import { client } from "@/api/client";

export type TurnoDTO = {
  id: number;
  nombre: string;
};

export type MateriaDTO = {
  id: number;
  nombre: string;
  anio_cursada: number;
  regimen: string;
  formato: string;
  permite_mesa_libre: boolean;
};

export type ComisionDTO = {
  id: number;
  materia_id: number;
  materia_nombre: string;
  plan_id: number;
  plan_resolucion: string;
  profesorado_id: number;
  profesorado_nombre: string;
  anio_lectivo: number;
  codigo: string;
  turno_id: number;
  turno_nombre: string;
  docente_id: number | null;
  docente_nombre: string | null;
  horario_id: number | null;
  cupo_maximo: number | null;
  estado: string;
  observaciones: string | null;
};

export type ComisionPayload = {
  materia_id: number;
  anio_lectivo: number;
  codigo: string;
  turno_id: number;
  docente_id?: number | null;
  horario_id?: number | null;
  cupo_maximo?: number | null;
  estado?: string;
  observaciones?: string | null;
};

export async function listarTurnos(): Promise<TurnoDTO[]> {
  const { data } = await client.get<TurnoDTO[]>("/turnos");
  return data;
}

export async function listarMaterias(planId: number): Promise<MateriaDTO[]> {
  const { data } = await client.get<MateriaDTO[]>(`/planes/${planId}/materias`);
  return data;
}

export async function listarComisiones(params: {
  profesorado_id?: number | null;
  plan_id?: number | null;
  materia_id?: number | null;
  anio_lectivo?: number | null;
  turno_id?: number | null;
  estado?: string | null;
}): Promise<ComisionDTO[]> {
  const query: Record<string, unknown> = {};
  if (params.profesorado_id) query.profesorado_id = params.profesorado_id;
  if (params.plan_id) query.plan_id = params.plan_id;
  if (params.materia_id) query.materia_id = params.materia_id;
  if (params.anio_lectivo) query.anio_lectivo = params.anio_lectivo;
  if (params.turno_id) query.turno_id = params.turno_id;
  if (params.estado) query.estado = params.estado;

  const { data } = await client.get<ComisionDTO[]>("/comisiones", {
    params: query,
  });
  return data;
}

export async function crearComision(payload: ComisionPayload): Promise<ComisionDTO> {
  const body: Record<string, unknown> = {
    materia_id: payload.materia_id,
    anio_lectivo: payload.anio_lectivo,
    codigo: payload.codigo,
    turno_id: payload.turno_id,
  };

  if (payload.docente_id) body.docente_id = payload.docente_id;
  if (payload.horario_id) body.horario_id = payload.horario_id;
  if (payload.cupo_maximo !== undefined && payload.cupo_maximo !== null) {
    body.cupo_maximo = payload.cupo_maximo;
  }
  if (payload.estado) body.estado = payload.estado;
  if (payload.observaciones) body.observaciones = payload.observaciones;

  const { data } = await client.post<ComisionDTO>("/comisiones", body);
  return data;
}

export async function actualizarComision(
  comisionId: number,
  payload: ComisionPayload,
): Promise<ComisionDTO> {
  const body: Record<string, unknown> = {
    materia_id: payload.materia_id,
    anio_lectivo: payload.anio_lectivo,
    codigo: payload.codigo,
    turno_id: payload.turno_id,
    docente_id: payload.docente_id ?? null,
    horario_id: payload.horario_id ?? null,
    cupo_maximo:
      payload.cupo_maximo !== undefined ? payload.cupo_maximo : null,
    estado: payload.estado,
    observaciones: payload.observaciones ?? "",
  };

  const { data } = await client.put<ComisionDTO>(
    `/comisiones/${comisionId}`,
    body,
  );
  return data;
}

export async function generarComisiones(payload: {
  plan_id: number;
  anio_lectivo: number;
  turnos?: number[];
  cantidad?: number;
  estado?: string;
}): Promise<ComisionDTO[]> {
  const body: Record<string, unknown> = {
    plan_id: payload.plan_id,
    anio_lectivo: payload.anio_lectivo,
    cantidad: payload.cantidad ?? 1,
  };
  if (payload.turnos && payload.turnos.length) {
    body.turnos = payload.turnos;
  }
  if (payload.estado) {
    body.estado = payload.estado;
  }

  const { data } = await client.post<ComisionDTO[]>("/comisiones/generar", body);
  return data;
}
