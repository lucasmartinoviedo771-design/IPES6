import client from "./client";

export interface CorrelativaCaidaItem {
    estudiante_id: number;
    dni: string;
    apellido_nombre: string;
    materia_actual: string;
    materia_correlativa: string;
    motivo: string;
}

export const getCorrelativasCaidas = async (anio?: number): Promise<CorrelativaCaidaItem[]> => {
    const params = anio ? { anio } : {};
    const response = await client.get<CorrelativaCaidaItem[]>("/alumnos/reportes/correlativas-caidas", { params });
    return response.data;
};

export const getMisAlertas = async (): Promise<CorrelativaCaidaItem[]> => {
    const response = await client.get<CorrelativaCaidaItem[]>("/alumnos/me/alertas");
    return response.data;
};
