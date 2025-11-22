import { client } from "@/api/client";

export interface DocenteDTO {
  id: number;
  nombre: string;
  apellido: string;
  dni: string;
  email: string | null;
  telefono: string | null;
  cuil: string | null;
}

export async function listarDocentes(): Promise<DocenteDTO[]> {
  const { data } = await client.get<DocenteDTO[]>("/docentes");
  return data;
}
