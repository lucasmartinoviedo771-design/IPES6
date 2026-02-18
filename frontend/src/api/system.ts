import { api } from "./client";

export interface SystemLog {
    id: number;
    tipo: string;
    mensaje: string;
    metadata: Record<string, any>;
    resuelto: boolean;
    created_at: string;
}

export const getSystemLogs = async (resuelto: boolean = false): Promise<SystemLog[]> => {
    const { data } = await api.get<SystemLog[]>("/system/logs", { params: { resuelto } });
    return data;
};

export const resolveSystemLog = async (id: number): Promise<void> => {
    await api.post(`/system/logs/${id}/resolve`);
};
