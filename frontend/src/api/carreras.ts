import { client } from "@/api/client";

export interface Carrera {
  id: number;
  nombre: string;
  activo: boolean;
  inscripcion_abierta: boolean;
  duracion_anios?: number;
}

export async function fetchCarreras(): Promise<Carrera[]> {
  const { data } = await client.get("/profesorados?vigentes=true");
  return data as Carrera[];
}

export interface CarreraDetalle extends Carrera {
  duracion_anios: number;
}

export interface PlanDetalle {
  id: number;
  profesorado_id: number;
  resolucion: string;
  anio_inicio: number;
  anio_fin: number | null;
  vigente: boolean;
}

export async function obtenerCarrera(profesoradoId: number): Promise<CarreraDetalle> {
  const { data } = await client.get<CarreraDetalle>(`/profesorados/${profesoradoId}`);
  return data;
}

export async function obtenerPlanCarrera(planId: number): Promise<PlanDetalle> {
  const { data } = await client.get<PlanDetalle>(`/profesorados/planes/${planId}`);
  return data;
}

