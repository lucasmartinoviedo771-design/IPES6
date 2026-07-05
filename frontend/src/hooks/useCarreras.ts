import { useQuery } from "@tanstack/react-query";
import { listarProfesorados } from "@/api/cargaNotas";

type Carrera = { id: number; nombre: string };

/**
 * Hook para obtener el listado de profesorados (carreras) vigentes.
 * Utiliza React Query para cachear los resultados y evitar múltiples llamadas.
 */
export function useCarreras() {
  return useQuery({
    queryKey: ["catalog", "profesorados"],
    queryFn: listarProfesorados,
    staleTime: 1000 * 60 * 10, // 10 minutos de cache fresca
  });
}

// Alias para compatibilidad si es necesario
const useProfesorados = useCarreras;
