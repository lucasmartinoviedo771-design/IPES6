import { useQuery } from "@tanstack/react-query";
import { api } from "@/api/client";

export type Carrera = { id: number; nombre: string };

async function tryEndpoints(): Promise<Carrera[]> {
  const paths = [
    "/profesorados?vigentes=true",        // API principal actual
    "/carreras?vigentes=true",            // Ninja montado en raiz
    "/preinscriptions/carreras?vigentes=true", // Ninja montado bajo preinscriptions
    "/carreras",                          // Django fallback (este patch)
    "/core/carreras"                      // antiguo
  ];
  for (const p of paths) {
    try {
      const { data } = await api.get(p);
      if (Array.isArray(data)) return data;
      if (data?.results) return data.results.map((r:any)=>({id:r.id, nombre:r.nombre}));
    } catch (_error) {
      // sigue al siguiente endpoint
    }
  }
  return [];
}

export function useCarreras() {
  return useQuery({
    queryKey: ["carreras"],
    queryFn: tryEndpoints,
    staleTime: 60_000,
  });
}
