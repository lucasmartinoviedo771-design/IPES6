import { client } from "@/api/client";

export type VentanaDto = {
  id?: number;
  tipo: string;
  desde: string;
  hasta: string;
  activo: boolean;
  periodo?: "1C_ANUALES" | "2C";
};

type VentanaParams = {
  tipo?: string;
};

export async function fetchVentanas(params?: VentanaParams): Promise<VentanaDto[]> {
  const { data } = await client.get<VentanaDto[]>("/ventanas", { params });
  return data;
}
