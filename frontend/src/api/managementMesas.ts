import { client as api } from "./client";
import type { SolicitudMesaAdminDTO } from "./estudiantes/types";

export async function listarSolicitudesMesas(params?: {
	ventana_id?: number;
	estado?: string;
}): Promise<SolicitudMesaAdminDTO[]> {
	const { data } = await api.get<SolicitudMesaAdminDTO[]>(
		"/solicitudes_mesas",
		{ params },
	);
	return data;
}

export async function procesarSolicitudMesa(
	solId: number,
	estado: string,
	mesaId?: number,
): Promise<SolicitudMesaAdminDTO> {
	const { data } = await api.post<SolicitudMesaAdminDTO>(
		`/solicitudes_mesas/${solId}/procesar`,
		null,
		{
			params: { estado, mesa_id: mesaId },
		},
	);
	return data;
}

export async function listarMesas(
	params?: Record<string, unknown>,
): Promise<unknown[]> {
	const { data } = await api.get<unknown[]>("/mesas", { params });
	return data;
}

export async function crearMesaDesdeSolicitud(
	payload: Record<string, unknown>,
): Promise<unknown> {
	const { data } = await api.post("/crear_mesa_desde_solicitud", payload);
	return data;
}

export async function actualizarMesa(
	mesaId: number,
	payload: Record<string, unknown>,
): Promise<unknown> {
	const { data } = await api.put(`/mesas/${mesaId}`, payload);
	return data;
}
