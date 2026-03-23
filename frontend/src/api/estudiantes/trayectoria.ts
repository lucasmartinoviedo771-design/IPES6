import { client } from "@/api/client";
import {
  HistorialEstudianteDTO,
  TrayectoriaDTO,
  HorarioTablaDTO,
  ConstanciaExamenDTO,
} from "./types";

export async function obtenerHistorialEstudiante(params?: { dni?: string }): Promise<HistorialEstudianteDTO> {
  const { data } = await client.get<HistorialEstudianteDTO>(`/estudiantes/historial`, { params });
  return data;
}

export async function obtenerTrayectoriaEstudiante(params?: { dni?: string }): Promise<TrayectoriaDTO> {
  const { data } = await client.get<TrayectoriaDTO>(`/estudiantes/trayectoria`, { params });
  return data;
}

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

export async function obtenerConstanciasExamen(params?: { dni?: string }): Promise<ConstanciaExamenDTO[]> {
  const { data } = await client.get<ConstanciaExamenDTO[]>(`/estudiantes/constancias-examen`, { params });
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
