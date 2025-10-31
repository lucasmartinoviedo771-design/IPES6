import { client } from "@/api/client";

export interface AsignarRolResponse {
  success: boolean;
  user_id: number;
  username: string;
  role: string;
  profesorados?: number[] | null;
}

export interface AsignarRolPayload {
  role: string;
  profesorados?: number[];
}

export async function asignarRolADocente(
  docenteId: number,
  payload: AsignarRolPayload,
): Promise<AsignarRolResponse> {
  const { data } = await client.post<AsignarRolResponse>(`/docentes/${docenteId}/roles`, payload);
  return data;
}
