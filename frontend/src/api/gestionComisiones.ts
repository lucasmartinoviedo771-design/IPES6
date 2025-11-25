import { client as api } from "@/api/client";

export interface ComisionGestionDTO {
    id: number;
    codigo: string;
    anio_lectivo: number;
    turno_nombre: string;
    cantidad_inscriptos: number;
    cupo_maximo: number | null;
}

export const listarComisionesGestion = async (materiaId: number, anioLectivo: number): Promise<ComisionGestionDTO[]> => {
    const response = await api.get(`/alumnos/comisiones/materia/${materiaId}/anio/${anioLectivo}`);
    return response.data;
};

export const crearComision = async (materiaId: number, anioLectivo: number, codigo: string, cupoMaximo?: number) => {
    const response = await api.post("/alumnos/comisiones/crear", {
        materia_id: materiaId,
        anio_lectivo: anioLectivo,
        codigo,
        cupo_maximo: cupoMaximo,
    });
    return response.data;
};

export const crearComisionMasiva = async (planId: number, anioCursada: number, anioLectivo: number, codigo: string, cupoMaximo?: number) => {
    const response = await api.post("/alumnos/comisiones/crear-masiva", {
        plan_id: planId,
        anio_cursada: anioCursada,
        anio_lectivo: anioLectivo,
        codigo,
        cupo_maximo: cupoMaximo,
    });
    return response.data;
};

export const distribuirAlumnos = async (comisionOrigenId: number, comisionDestinoId: number, porcentaje: number) => {
    const response = await api.post("/alumnos/comisiones/distribuir", {
        comision_origen_id: comisionOrigenId,
        comision_destino_id: comisionDestinoId,
        porcentaje,
    });
    return response.data;
};
