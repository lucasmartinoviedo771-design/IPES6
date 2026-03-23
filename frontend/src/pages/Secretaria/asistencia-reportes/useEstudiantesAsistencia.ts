import React, { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSnackbar } from "notistack";
import dayjs from "dayjs";
import "dayjs/locale/es";
import {
  EstudianteClaseListado,
  fetchEstudianteClases,
} from "@/api/asistencia";
import { listarComisiones, listarMaterias, ComisionDTO, MateriaDTO } from "@/api/comisiones";
import { listarPlanes, PlanDetalle } from "@/api/carreras";
import { Option, ordenarPorLabel } from "./types";

dayjs.locale("es");

interface UseEstudiantesAsistenciaParams {
  profesoradoOptions: Option[];
  puedeVerEstudiantes: boolean;
}

export const useEstudiantesAsistencia = ({
  profesoradoOptions,
  puedeVerEstudiantes,
}: UseEstudiantesAsistenciaParams) => {
  const { enqueueSnackbar } = useSnackbar();
  const today = useMemo(() => dayjs().format("YYYY-MM-DD"), []);

  const [estudianteProfesorado, setEstudianteProfesorado] = useState<Option | null>(null);
  const [estudiantePlan, setEstudiantePlan] = useState<Option | null>(null);
  const [estudianteMateria, setEstudianteMateria] = useState<Option | null>(null);
  const [estudianteComision, setEstudianteComision] = useState<Option | null>(null);
  const [estudianteDesde, setEstudianteDesde] = useState(today);
  const [estudianteHasta, setEstudianteHasta] = useState(today);
  const [estudianteResultados, setEstudianteResultados] = useState<EstudianteClaseListado[]>([]);
  const [cargandoEstudiantes, setCargandoEstudiantes] = useState(false);

  const { data: estudiantePlanesData, isLoading: estudiantePlanesLoading } = useQuery<PlanDetalle[]>({
    queryKey: ["asistencia", "planes", estudianteProfesorado?.id ?? 0],
    queryFn: () => listarPlanes(estudianteProfesorado!.id),
    enabled: puedeVerEstudiantes && !!estudianteProfesorado,
    staleTime: 5 * 60 * 1000,
  });

  const estudiantePlanOptions = useMemo<Option[]>(() => {
    if (!estudiantePlanesData) return [];
    return estudiantePlanesData
      .map((plan) => ({ id: plan.id, label: plan.resolucion }))
      .sort(ordenarPorLabel);
  }, [estudiantePlanesData]);

  const { data: estudianteMateriasData, isLoading: estudianteMateriasLoading } = useQuery<MateriaDTO[]>({
    queryKey: ["asistencia", "materias", estudiantePlan?.id ?? 0],
    queryFn: () => listarMaterias(estudiantePlan!.id),
    enabled: puedeVerEstudiantes && !!estudiantePlan,
    staleTime: 5 * 60 * 1000,
  });

  const {
    data: estudianteComisionesData,
    isLoading: estudianteComisionesLoading,
  } = useQuery<ComisionDTO[]>({
    queryKey: ["asistencia", "comisiones", estudianteProfesorado?.id ?? 0, estudiantePlan?.id ?? 0, estudianteMateria?.id ?? 0],
    queryFn: () =>
      listarComisiones({
        profesorado_id: estudianteProfesorado?.id ?? undefined,
        plan_id: estudiantePlan?.id ?? undefined,
        materia_id: estudianteMateria?.id ?? undefined,
      }),
    enabled: puedeVerEstudiantes && !!estudianteProfesorado && !!estudiantePlan,
    staleTime: 2 * 60 * 1000,
  });

  const estudianteMateriaOptions = useMemo<Option[]>(() => {
    if (!estudianteMateriasData) return [];
    return estudianteMateriasData
      .map((materia) => ({ id: materia.id, label: materia.nombre }))
      .sort(ordenarPorLabel);
  }, [estudianteMateriasData]);

  const estudianteComisionOptions = useMemo<Option[]>(() => {
    if (!estudianteComisionesData) return [];
    let filtered = estudianteComisionesData;
    if (estudiantePlan) filtered = filtered.filter((c) => c.plan_id === estudiantePlan.id);
    if (estudianteMateria) filtered = filtered.filter((c) => c.materia_id === estudianteMateria.id);
    return filtered
      .map((c) => ({ id: c.id, label: `${c.materia_nombre} - ${c.codigo}` }))
      .sort(ordenarPorLabel);
  }, [estudianteComisionesData, estudiantePlan, estudianteMateria]);

  useEffect(() => {
    setEstudiantePlan(null);
    setEstudianteMateria(null);
    setEstudianteComision(null);
  }, [estudianteProfesorado]);

  useEffect(() => {
    setEstudianteMateria(null);
    setEstudianteComision(null);
  }, [estudiantePlan]);

  useEffect(() => {
    setEstudianteComision(null);
  }, [estudianteMateria]);

  const handleBuscarEstudiantes = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!puedeVerEstudiantes) {
      enqueueSnackbar("No tenes permisos para consultar asistencia de estudiantes.", { variant: "warning" });
      return;
    }
    if (!estudianteMateria && !estudianteComision) {
      enqueueSnackbar("Selecciona al menos una materia o comision.", { variant: "info" });
      return;
    }
    setCargandoEstudiantes(true);
    try {
      const params: { comision_id?: number; materia_id?: number; desde: string; hasta: string } = {
        desde: estudianteDesde,
        hasta: estudianteHasta,
      };
      if (estudianteComision) {
        params.comision_id = estudianteComision.id;
      } else if (estudianteMateria) {
        params.materia_id = estudianteMateria.id;
      }
      const data = await fetchEstudianteClases(params);
      setEstudianteResultados(data.clases);
      if (data.clases.length === 0) {
        enqueueSnackbar("No encontramos clases para ese rango.", { variant: "info" });
      }
    } catch (error) {
      enqueueSnackbar("No se pudo obtener la asistencia de estudiantes.", { variant: "error" });
    } finally {
      setCargandoEstudiantes(false);
    }
  };

  return {
    estudianteProfesorado,
    setEstudianteProfesorado,
    estudiantePlan,
    setEstudiantePlan,
    estudianteMateria,
    setEstudianteMateria,
    estudianteComision,
    setEstudianteComision,
    estudianteDesde,
    setEstudianteDesde,
    estudianteHasta,
    setEstudianteHasta,
    estudianteResultados,
    cargandoEstudiantes,
    estudiantePlanOptions,
    estudiantePlanesLoading,
    estudianteMateriaOptions,
    estudianteMateriasLoading,
    estudianteComisionOptions,
    estudianteComisionesLoading,
    handleBuscarEstudiantes,
  };
};

