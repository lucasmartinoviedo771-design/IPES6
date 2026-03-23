import { client } from "@/api/client";
import {
  ApiResponseDTO,
  PedidoEquivalenciaPayload,
  PedidoEquivalenciaDTO,
  EquivalenciaMateriaPendienteDTO,
  EquivalenciaDisposicionPayload,
  EquivalenciaDisposicionDTO,
} from "./types";

export async function listarPedidosEquivalencia(params: { dni?: string; estado?: 'draft' | 'final'; profesorado_id?: number; ventana_id?: number; workflow_estado?: string } = {}): Promise<PedidoEquivalenciaDTO[]> {
  const { data } = await client.get<PedidoEquivalenciaDTO[]>("/estudiantes/equivalencias/pedidos", { params });
  return data;
}

export async function crearPedidoEquivalencia(payload: PedidoEquivalenciaPayload, params: { dni?: string } = {}): Promise<PedidoEquivalenciaDTO> {
  const { data } = await client.post<PedidoEquivalenciaDTO>("/estudiantes/equivalencias/pedidos", payload, { params });
  return data;
}

export async function actualizarPedidoEquivalencia(id: number, payload: PedidoEquivalenciaPayload): Promise<PedidoEquivalenciaDTO> {
  const { data } = await client.put<PedidoEquivalenciaDTO>(`/estudiantes/equivalencias/pedidos/${id}`, payload);
  return data;
}

export async function eliminarPedidoEquivalencia(id: number): Promise<ApiResponseDTO> {
  const { data } = await client.delete<ApiResponseDTO>(`/estudiantes/equivalencias/pedidos/${id}`);
  return data;
}

export async function descargarNotaPedidoEquivalencia(id: number): Promise<Blob> {
  const { data } = await client.post<Blob>(`/estudiantes/equivalencias/pedidos/${id}/nota`, {}, { responseType: "blob" });
  return data;
}

export async function enviarPedidoEquivalencia(id: number): Promise<PedidoEquivalenciaDTO> {
  const { data } = await client.post<PedidoEquivalenciaDTO>(`/estudiantes/equivalencias/pedidos/${id}/enviar`);
  return data;
}

export async function registrarDocumentacionEquivalencia(
  id: number,
  payload: { presentada: boolean; cantidad?: number | null; detalle?: string | null },
): Promise<PedidoEquivalenciaDTO> {
  const { data } = await client.post<PedidoEquivalenciaDTO>(
    `/estudiantes/equivalencias/pedidos/${id}/documentacion`,
    payload,
  );
  return data;
}

export async function registrarEvaluacionEquivalencia(
  id: number,
  payload: { materias: Array<{ id: number; resultado: 'otorgada' | 'rechazada'; observaciones?: string | null }>; observaciones?: string | null },
): Promise<PedidoEquivalenciaDTO> {
  const { data } = await client.post<PedidoEquivalenciaDTO>(
    `/estudiantes/equivalencias/pedidos/${id}/evaluacion`,
    payload,
  );
  return data;
}

export async function registrarTitulosEquivalencia(
  id: number,
  payload: { nota_numero?: string | null; nota_fecha?: string | null; disposicion_numero?: string | null; disposicion_fecha?: string | null; observaciones?: string | null },
): Promise<PedidoEquivalenciaDTO> {
  const { data } = await client.post<PedidoEquivalenciaDTO>(
    `/estudiantes/equivalencias/pedidos/${id}/titulos`,
    payload,
  );
  return data;
}

export async function notificarPedidoEquivalencia(id: number, payload: { mensaje?: string | null } = {}): Promise<PedidoEquivalenciaDTO> {
  const { data } = await client.post<PedidoEquivalenciaDTO>(
    `/estudiantes/equivalencias/pedidos/${id}/notificar`,
    payload,
  );
  return data;
}

export async function exportarPedidosEquivalencia(params: { ventana_id?: number; profesorado_id?: number; estado?: 'draft' | 'final' } = {}): Promise<Blob> {
  const { data } = await client.get<Blob>(`/estudiantes/equivalencias/export`, { params, responseType: "blob" });
  return data;
}

export async function fetchMateriasPendientesEquivalencia(params: { dni: string; profesorado_id: number; plan_id: number }): Promise<EquivalenciaMateriaPendienteDTO[]> {
  const { data } = await client.get<EquivalenciaMateriaPendienteDTO[]>(
    "/estudiantes/equivalencias/disposiciones/materias",
    { params },
  );
  return data;
}

export async function crearDisposicionEquivalencia(payload: EquivalenciaDisposicionPayload): Promise<EquivalenciaDisposicionDTO> {
  const { data } = await client.post<EquivalenciaDisposicionDTO>(
    "/estudiantes/equivalencias/disposiciones",
    payload,
  );
  return data;
}

export async function listarDisposicionesEquivalencia(params: { dni?: string } = {}): Promise<EquivalenciaDisposicionDTO[]> {
  const { data } = await client.get<EquivalenciaDisposicionDTO[]>(
    "/estudiantes/equivalencias/disposiciones",
    { params },
  );
  return data;
}
