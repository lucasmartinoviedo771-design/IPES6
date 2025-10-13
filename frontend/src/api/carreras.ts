import { client } from "@/api/client";

export interface Carrera {
  id: number;
  nombre: string;
  activo: boolean;
  inscripcion_abierta: boolean;
}

export async function fetchCarreras(): Promise<Carrera[]> {
  const { data } = await client.get("/profesorados?vigentes=true");
  return data as Carrera[];
}

