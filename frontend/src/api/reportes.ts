import client from "./client";

export interface CorrelativaCaidaItem {
    estudiante_id: number;
    dni: string;
    apellido_nombre: string;
    materia_actual: string;
    materia_correlativa: string;
    motivo: string;
}

export interface AuditoriaInconsistenciaItem {
    estudiante: string;
    dni: string;
    carrera: string;
    materia: string;
    evento: string;
    fecha: string;
    prerrequisito: string;
    tipo_corr: string;
    motivo: string;
}

export const getCorrelativasCaidas = async (anio?: number): Promise<CorrelativaCaidaItem[]> => {
    const params = anio ? { anio } : {};
    const response = await client.get<CorrelativaCaidaItem[]>("/estudiantes/reportes/correlativas-caidas/", { params });
    return response.data;
};

export const getMisAlertas = async (): Promise<CorrelativaCaidaItem[]> => {
    const response = await client.get<CorrelativaCaidaItem[]>("/estudiantes/me/alertas/");
    return response.data;
};

export interface AuditoriaFilters {
    profesorado_id?: number;
    search?: string;
    materia_id?: number;
    solo_activos?: boolean;
}

export const getAuditoriaInconsistencias = async (filters: AuditoriaFilters = {}): Promise<AuditoriaInconsistenciaItem[]> => {
    const response = await client.get<AuditoriaInconsistenciaItem[]>("/estudiantes/reportes/auditoria-inconsistencias/", { 
        params: filters 
    });
    return response.data;
};

export const downloadAuditoriaInconsistencias = async (filters: AuditoriaFilters = {}): Promise<void> => {
    // Generate query string
    const params = new URLSearchParams();
    if (filters.profesorado_id) params.append('profesorado_id', filters.profesorado_id.toString());
    if (filters.search) params.append('search', filters.search);
    if (filters.materia_id) params.append('materia_id', filters.materia_id.toString());
    if (filters.solo_activos) params.append('solo_activos', 'true');
    
    const query = params.toString() ? `?${params.toString()}` : "";
    const url = `/estudiantes/reportes/auditoria-inconsistencias/download${query}`;
    
    const token = localStorage.getItem('token');
    const response = await fetch(`${import.meta.env.VITE_API_URL}${url}`, {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });
    const blob = await response.blob();
    const downloadUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.setAttribute('download', `auditoria_inconsistencias_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
};
