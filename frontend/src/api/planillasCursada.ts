import { client } from "./client";

export type FilaCursadaOut = {
  fila_id: number;
  inscripcion_id: number;
  estudiante_id: number;
  orden: number;
  apellido_nombre: string;
  dni: string;
  asistencia_porcentaje: number | null;
  excepcion: boolean;
  columnas_datos: Record<string, unknown>;
  situacion: string;
  en_resguardo: boolean;
};

export type PlanillaCursadaOut = {
  id: number;
  numero: string;
  estado: "BORRADOR" | "CERRADA" | "REABIERTA";
  materia_id: number;
  materia_nombre: string;
  profesorado_id: number;
  profesorado_nombre: string;
  profesorado_destino_id: number;
  profesorado_destino_nombre: string;
  anio_lectivo: number;
  cuatrimestre: string;
  fecha_entrega: string | null;
  filas: FilaCursadaOut[];
};

export type GenerarPlanillasPayload = {
  comision_id: number;
  anio_lectivo: number;
  cuatrimestre: string;
  plantilla_id?: number | null;
};

export type GuardarFilasPayload = {
  filas: {
    fila_id: number;
    asistencia_porcentaje: number | null;
    excepcion: boolean;
    columnas_datos: Record<string, unknown>;
    situacion: string;
  }[];
};

export async function generarPlanillasCursada(
  payload: GenerarPlanillasPayload
): Promise<PlanillaCursadaOut[]> {
  const { data } = await client.post<PlanillaCursadaOut[]>(
    "/estudiantes/planillas-cursada/generar",
    payload
  );
  return data;
}

export async function obtenerPlanillaCursada(
  id: number
): Promise<PlanillaCursadaOut> {
  const { data } = await client.get<PlanillaCursadaOut>(
    `/estudiantes/planillas-cursada/${id}`
  );
  return data;
}

export async function guardarBorradorPlanilla(
  id: number,
  payload: GuardarFilasPayload
): Promise<{ ok: boolean; message: string }> {
  const { data } = await client.patch(
    `/estudiantes/planillas-cursada/${id}/guardar`,
    payload
  );
  return data;
}

export async function cerrarPlanillaCursada(
  id: number
): Promise<{ ok: boolean; message: string }> {
  const { data } = await client.post(
    `/estudiantes/planillas-cursada/${id}/cerrar`
  );
  return data;
}

export async function reabrirPlanillaCursada(
  id: number
): Promise<{ ok: boolean; message: string }> {
  const { data } = await client.post(
    `/estudiantes/planillas-cursada/${id}/reabrir`
  );
  return data;
}

export async function sincronizarPlanilla(
  id: number,
  comision_id: number
): Promise<PlanillaCursadaOut> {
  const { data } = await client.post<PlanillaCursadaOut>(
    `/estudiantes/planillas-cursada/${id}/sincronizar`,
    { comision_id }
  );
  return data;
}
