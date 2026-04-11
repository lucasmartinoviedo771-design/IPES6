/**
 * @module API/Estudiantes/Trayectoria
 * @description Cliente para la gestión de la Trayectoria Académica y Documentación.
 * Proporciona acceso al "Cartón del Alumno", historiales, horarios consolidados
 * y generación de certificados oficiales.
 */

import { client } from "@/api/client";
import {
  HistorialEstudianteDTO,
  TrayectoriaDTO,
  HorarioTablaDTO,
  ConstanciaExamenDTO,
} from "./types";

/**
 * Recupera el historial cronológico de eventos académicos del estudiante.
 * @param params Soporta filtrado por DNI (solo para administradores).
 */
export async function obtenerHistorialEstudiante(params?: { dni?: string }): Promise<HistorialEstudianteDTO> {
  const { data } = await client.get<HistorialEstudianteDTO>(`/estudiantes/historial`, { params });
  return data;
}

/**
 * Obtiene la Trayectoria Académica consolidada ("Cartón del Alumno").
 * Integra cursadas, finales, equivalencias y recomendaciones de cursada.
 */
export async function obtenerTrayectoriaEstudiante(params?: { dni?: string }): Promise<TrayectoriaDTO> {
  const { data } = await client.get<TrayectoriaDTO>(`/estudiantes/trayectoria`, { params });
  return data;
}

/**
 * Consulta la grilla horaria vigente para el estudiante.
 * Permite filtrar por cohorte, plan y turno para resolver colisiones horarias.
 */
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

/**
 * Lista las constancias de examen final emitidas para el estudiante.
 */
export async function obtenerConstanciasExamen(params?: { dni?: string }): Promise<ConstanciaExamenDTO[]> {
  const { data } = await client.get<ConstanciaExamenDTO[]>(`/estudiantes/constancias-examen`, { params });
  return data;
}

/**
 * Genera y descarga la Constancia de Examen en formato PDF usando WeasyPrint (backend).
 */
export async function descargarConstanciaExamenPDF(params: {
  inscripcion_id: number;
  destinatario?: string;
  dni?: string;
}): Promise<Blob> {
  const { inscripcion_id, ...queryParams } = params;
  const response = await client.get(
    `/estudiantes/constancias-examen/${inscripcion_id}/pdf`,
    { params: queryParams, responseType: "blob" },
  );
  return response.data as Blob;
}

/**
 * Genera y descarga el Certificado de Alumno Regular en formato PDF (Blob).
 */
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
