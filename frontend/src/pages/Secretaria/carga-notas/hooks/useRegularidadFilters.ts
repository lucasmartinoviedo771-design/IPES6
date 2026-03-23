import { useEffect, useMemo, useState } from "react";
import { enqueueSnackbar } from "notistack";
import {
  ComisionOptionDTO,
  MateriaOptionDTO,
  PlanDTO,
  ProfesoradoDTO,
  listarPlanes,
  listarProfesorados,
  obtenerDatosCargaNotas,
} from "@/api/cargaNotas";
import { FiltersState } from "../types";

export function useRegularidadFilters(
  filters: FiltersState,
  setFilters: React.Dispatch<React.SetStateAction<FiltersState>>,
) {
  const [profesorados, setProfesorados] = useState<ProfesoradoDTO[]>([]);
  const [planes, setPlanes] = useState<PlanDTO[]>([]);
  const [materias, setMaterias] = useState<MateriaOptionDTO[]>([]);
  const [allComisiones, setAllComisiones] = useState<ComisionOptionDTO[]>([]);
  const [loadingProfesorados, setLoadingProfesorados] = useState(false);
  const [loadingPlanes, setLoadingPlanes] = useState(false);
  const [loadingComisiones, setLoadingComisiones] = useState(false);

  useEffect(() => {
    const loadProfesorados = async () => {
      setLoadingProfesorados(true);
      try {
        const data = await listarProfesorados();
        setProfesorados(data);
      } catch (error) {
        enqueueSnackbar("No se pudieron obtener los profesorados.", { variant: "error" });
      } finally {
        setLoadingProfesorados(false);
      }
    };
    loadProfesorados();
  }, []);

  useEffect(() => {
    const profesoradoId = filters.profesoradoId;
    if (!profesoradoId) {
      setPlanes([]);
      setFilters((prev) => ({ ...prev, planId: null, materiaId: null, comisionId: null, anio: null, cuatrimestre: null, anioCursada: null }));
      return;
    }
    const loadPlanes = async () => {
      setLoadingPlanes(true);
      try {
        const data = await listarPlanes(profesoradoId);
        setPlanes(data);
      } catch (error) {
        enqueueSnackbar("No se pudieron obtener los planes de estudio.", { variant: "error" });
      } finally {
        setLoadingPlanes(false);
      }
    };
    loadPlanes();
  }, [filters.profesoradoId]);

  useEffect(() => {
    const planId = filters.planId;
    if (!planId) {
      setMaterias([]);
      setAllComisiones([]);
      setFilters((prev) => ({ ...prev, materiaId: null, comisionId: null, anio: null, cuatrimestre: null, anioCursada: null }));
      return;
    }
    const loadDatos = async () => {
      setLoadingComisiones(true);
      try {
        const data = await obtenerDatosCargaNotas({
          plan_id: planId,
        });
        setMaterias(data.materias);
        setAllComisiones(data.comisiones);
      } catch (error) {
        enqueueSnackbar("No se pudieron obtener los datos de comisiones.", { variant: "error" });
      } finally {
        setLoadingComisiones(false);
      }
    };
    loadDatos();
  }, [filters.planId]);

  const uniqueAnios = useMemo(() => {
    const set = new Set<number>();
    allComisiones.forEach((c) => {
      if (c.anio) {
        set.add(c.anio);
      }
    });
    return Array.from(set).sort((a, b) => b - a);
  }, [allComisiones]);

  const uniqueCuatrimestres = useMemo(() => {
    const set = new Set<string>();
    allComisiones.forEach((c) => {
      const clave = c.cuatrimestre ? c.cuatrimestre : "ANU";
      set.add(clave);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [allComisiones]);

  const uniqueAniosCursada = useMemo(() => {
    const set = new Set<number>();
    materias.forEach((m) => {
      if (m.anio) {
        set.add(m.anio);
      }
    });
    return Array.from(set).sort((a, b) => a - b);
  }, [materias]);

  useEffect(() => {
    if (!filters.planId) return;
    if (!filters.anio && uniqueAnios.length === 1) {
      setFilters((prev) => ({
        ...prev,
        anio: uniqueAnios[0],
      }));
    }
  }, [filters.planId, filters.anio, uniqueAnios]);

  useEffect(() => {
    if (!filters.planId) return;
    if (!filters.cuatrimestre && uniqueCuatrimestres.length === 1) {
      setFilters((prev) => ({
        ...prev,
        cuatrimestre: uniqueCuatrimestres[0],
      }));
    }
  }, [filters.planId, filters.cuatrimestre, uniqueCuatrimestres]);

  const materiaOptions = useMemo(() => {
    let base = materias;
    if (filters.cuatrimestre) {
      base = base.filter((m) => {
        const clave = m.cuatrimestre ? m.cuatrimestre : "ANU";
        return clave === filters.cuatrimestre;
      });
    }
    if (filters.anioCursada) {
      base = base.filter((m) => m.anio === filters.anioCursada);
    }
    return base;
  }, [materias, filters.anio, filters.cuatrimestre, filters.anioCursada]);

  const filteredComisiones = useMemo(() => {
    let base = allComisiones;
    if (filters.materiaId) {
      base = base.filter((c) => c.materia_id === filters.materiaId);
    }
    if (filters.anio) {
      base = base.filter((c) => c.anio === filters.anio);
    }
    if (filters.cuatrimestre) {
      base = base.filter((c) => {
        const clave = c.cuatrimestre ? c.cuatrimestre : "ANU";
        return clave === filters.cuatrimestre;
      });
    }
    if (filters.anioCursada) {
      // Necesitamos saber el anio de cursada de la materia de esta comision
      // Podemos usar 'materias' para buscarlo
      const materiaMap = new Map(materias.map(m => [m.id, m.anio]));
      base = base.filter((c) => {
        const anioMateria = materiaMap.get(c.materia_id);
        return anioMateria === filters.anioCursada;
      });
    }
    return base;
  }, [allComisiones, filters.materiaId, filters.anio, filters.cuatrimestre, filters.anioCursada, materias]);

  useEffect(() => {
    if (!filters.materiaId) {
      if (filters.comisionId) {
        setFilters((prev) => ({ ...prev, comisionId: null }));
      }
      return;
    }

    const exists = materiaOptions.some((m) => m.id === filters.materiaId);
    if (!exists) {
      setFilters((prev) => ({ ...prev, materiaId: null, comisionId: null }));
    }
  }, [materiaOptions, filters.materiaId, filters.comisionId]);

  useEffect(() => {
    if (!filters.materiaId) {
      if (filters.comisionId) {
        setFilters((prev) => ({ ...prev, comisionId: null }));
      }
      return;
    }
    if (!filteredComisiones.length) {
      if (filters.comisionId) {
        setFilters((prev) => ({ ...prev, comisionId: null }));
      }
      return;
    }
    // Auto-seleccionar si hay exactamente una comisión (la "A" por defecto)
    if (filteredComisiones.length === 1) {
      if (filters.comisionId !== filteredComisiones[0].id) {
        setFilters((prev) => ({ ...prev, comisionId: filteredComisiones[0].id }));
      }
    } else {
      // Si hay múltiples, solo reseteamos si la seleccionada ya no es válida
      // Esto obliga al usuario a elegir explícitamente entre "A" y "B"
      if (filters.comisionId && !filteredComisiones.some((c) => c.id === filters.comisionId)) {
        setFilters((prev) => ({ ...prev, comisionId: null }));
      }
    }
  }, [filteredComisiones, filters.materiaId, filters.comisionId]);

  return {
    profesorados,
    planes,
    materias,
    allComisiones,
    loadingProfesorados,
    loadingPlanes,
    loadingComisiones,
    uniqueAnios,
    uniqueCuatrimestres,
    uniqueAniosCursada,
    materiaOptions,
    filteredComisiones,
  };
}
