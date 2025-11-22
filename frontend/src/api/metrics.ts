import { api } from "./client";

export interface ResumenInscripciones {
    profesorado: string;
    total_preinscripciones: number;
    total_confirmadas: number;
    tasa_conversion: number;
}

export interface ResumenAcademico {
    profesorado: string;
    tasa_aprobacion: number;
    nota_promedio: number | null;
}

export interface ResumenAsistencia {
    profesorado: string;
    tasa_asistencia: number;
}

export const obtenerResumenInscripciones = async (): Promise<ResumenInscripciones[]> => {
    const response = await api.get("/reportes/inscripciones/resumen-por-profesorado/");
    return response.data;
};

export const obtenerResumenAcademico = async (): Promise<ResumenAcademico[]> => {
    const response = await api.get("/reportes/academicos/resumen-por-profesorado/");
    return response.data;
};

export const obtenerResumenAsistencia = async (): Promise<ResumenAsistencia[]> => {
    const response = await api.get("/reportes/asistencia/resumen-por-profesorado/");
    return response.data;
};
