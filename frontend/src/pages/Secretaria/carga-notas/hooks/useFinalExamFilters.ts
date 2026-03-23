import { useEffect, useMemo, useState } from "react";
import { enqueueSnackbar } from "notistack";
import {
  MateriaOptionDTO,
  PlanDTO,
  ProfesoradoDTO,
  listarPlanes,
  obtenerDatosCargaNotas,
} from "@/api/cargaNotas";
import { fetchVentanas, VentanaDto } from "@/api/ventanas";
import { FinalFiltersState, cuatrimestreLabel } from "../types";

export function useFinalExamFilters(
  finalFilters: FinalFiltersState,
  setFinalFilters: React.Dispatch<React.SetStateAction<FinalFiltersState>>,
  profesorados: ProfesoradoDTO[],
  isFinalsMode: boolean,
) {
  const [ventanasFinales, setVentanasFinales] = useState<VentanaDto[]>([]);
  const [finalPlanes, setFinalPlanes] = useState<PlanDTO[]>([]);
  const [finalMaterias, setFinalMaterias] = useState<MateriaOptionDTO[]>([]);
  const [loadingFinalPlanes, setLoadingFinalPlanes] = useState(false);
  const [loadingFinalMaterias, setLoadingFinalMaterias] = useState(false);

  useEffect(() => {
    const loadVentanasFinales = async () => {
      try {
        const data = await fetchVentanas();
        const filtered = (data || []).filter((ventana) =>
          ["MESAS_FINALES", "MESAS_EXTRA"].includes(ventana.tipo)
        );
        setVentanasFinales(filtered);
        setFinalFilters((prev) => {
          if (prev.ventanaId || !filtered.length) {
            return prev;
          }
          return { ...prev, ventanaId: String(filtered[0].id) };
        });
      } catch (error) {
        enqueueSnackbar("No se pudieron obtener las ventanas de mesas.", { variant: "error" });
      }
    };
    loadVentanasFinales();
  }, []);

  useEffect(() => {
    if (!isFinalsMode) {
      return;
    }
    const profesoradoId = finalFilters.profesoradoId;
    if (!profesoradoId) {
      setFinalPlanes([]);
      setFinalFilters((prev) => ({
        ...prev,
        planId: null,
        materiaId: null,
        anio: null,
        cuatrimestre: null,
      }));
      return;
    }
    const loadFinalPlanes = async () => {
      setLoadingFinalPlanes(true);
      try {
        const data = await listarPlanes(profesoradoId);
        setFinalPlanes(data);
      } catch (error) {
        enqueueSnackbar("No se pudieron obtener los planes para el profesorado seleccionado.", { variant: "error" });
        setFinalPlanes([]);
      } finally {
        setLoadingFinalPlanes(false);
      }
    };
    loadFinalPlanes();
  }, [isFinalsMode, finalFilters.profesoradoId]);

  useEffect(() => {
    if (!isFinalsMode) {
      return;
    }
    const planId = finalFilters.planId;
    if (!planId) {
      setFinalMaterias([]);
      setFinalFilters((prev) => ({
        ...prev,
        materiaId: null,
        anio: null,
        cuatrimestre: null,
      }));
      return;
    }
    const loadFinalMaterias = async () => {
      setLoadingFinalMaterias(true);
      try {
        const data = await obtenerDatosCargaNotas({
          plan_id: planId,
        });
        setFinalMaterias(data.materias);
      } catch (error) {
        enqueueSnackbar("No se pudieron obtener las materias del plan seleccionado.", { variant: "error" });
        setFinalMaterias([]);
      } finally {
        setLoadingFinalMaterias(false);
      }
    };
    loadFinalMaterias();
  }, [isFinalsMode, finalFilters.planId]);

  const finalAvailableAnios = useMemo(() => {
    const set = new Set<number>();
    finalMaterias.forEach((materia) => {
      if (typeof materia.anio === "number" && materia.anio !== null) {
        set.add(materia.anio);
      }
    });
    return Array.from(set).sort((a, b) => a - b);
  }, [finalMaterias]);

  const finalCuatrimestreOptions = useMemo(() => {
    const set = new Set<string>();
    finalMaterias.forEach((materia) => {
      if (materia.cuatrimestre) {
        set.add(materia.cuatrimestre);
      }
    });
    return Array.from(set)
      .sort((a, b) => a.localeCompare(b))
      .map((value) => ({
        value,
        label: cuatrimestreLabel[value] || value,
      }));
  }, [finalMaterias]);

  const finalMateriasFiltradas = useMemo(() => {
    let base = finalMaterias;
    if (finalFilters.anio) {
      base = base.filter((materia) => materia.anio === finalFilters.anio);
    }
    if (finalFilters.cuatrimestre) {
      base = base.filter((materia) => materia.cuatrimestre === finalFilters.cuatrimestre);
    }
    return base;
  }, [finalMaterias, finalFilters.anio, finalFilters.cuatrimestre]);

  useEffect(() => {
    if (!isFinalsMode) return;
    if (!finalFilters.planId) return;
    if (!finalFilters.anio && finalAvailableAnios.length === 1) {
      setFinalFilters((prev) => ({
        ...prev,
        anio: finalAvailableAnios[0],
      }));
    }
  }, [isFinalsMode, finalAvailableAnios, finalFilters.anio, finalFilters.planId]);

  useEffect(() => {
    if (!isFinalsMode) return;
    if (!finalFilters.planId) return;
    if (!finalFilters.cuatrimestre && finalCuatrimestreOptions.length === 1) {
      setFinalFilters((prev) => ({
        ...prev,
        cuatrimestre: finalCuatrimestreOptions[0]?.value ?? null,
      }));
    }
  }, [isFinalsMode, finalCuatrimestreOptions, finalFilters.cuatrimestre, finalFilters.planId]);

  return {
    ventanasFinales,
    finalPlanes,
    finalMaterias,
    loadingFinalPlanes,
    loadingFinalMaterias,
    finalAvailableAnios,
    finalCuatrimestreOptions,
    finalMateriasFiltradas,
  };
}
