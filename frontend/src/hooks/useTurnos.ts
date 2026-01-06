import { useQuery } from "@tanstack/react-query";
import { listarTurnos } from "@/api/comisiones";

/**
 * Hook para obtener el listado de turnos.
 */
export function useTurnos() {
    return useQuery({
        queryKey: ["catalog", "turnos"],
        queryFn: listarTurnos,
        staleTime: 1000 * 60 * 30, // Los turnos casi nunca cambian (30 min)
    });
}
