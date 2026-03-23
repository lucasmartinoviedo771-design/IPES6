import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useSnackbar } from "notistack";
import dayjs from "dayjs";
import "dayjs/locale/es";
import {
  DocenteClasesResponse,
  DocenteClase,
  fetchDocenteClases,
} from "@/api/asistencia";
import { Option, DateOption, ordenarPorLabel } from "./types";

dayjs.locale("es");

interface UseDocentesAsistenciaParams {
  puedeVerDocentes: boolean;
  esDocenteSolo: boolean;
  userDni: string | undefined;
}

export const useDocentesAsistencia = ({
  puedeVerDocentes,
  esDocenteSolo,
  userDni,
}: UseDocentesAsistenciaParams) => {
  const { enqueueSnackbar } = useSnackbar();
  const today = useMemo(() => dayjs().format("YYYY-MM-DD"), []);

  const [docenteDni, setDocenteDni] = useState("");
  const [docenteDesde, setDocenteDesde] = useState(today);
  const [docenteHasta, setDocenteHasta] = useState(today);
  const [docenteDiaSemana, setDocenteDiaSemana] = useState("");
  const [docenteClases, setDocenteClases] = useState<DocenteClase[]>([]);
  const [docenteInfo, setDocenteInfo] = useState<DocenteClasesResponse["docente"] | null>(null);
  const [cargandoDocente, setCargandoDocente] = useState(false);
  const [docenteProfesorado, setDocenteProfesorado] = useState<Option | null>(null);
  const [docentePlan, setDocentePlan] = useState<Option | null>(null);
  const [docenteMateria, setDocenteMateria] = useState<Option | null>(null);
  const [docenteComision, setDocenteComision] = useState<Option | null>(null);
  const [docenteFecha, setDocenteFecha] = useState<DateOption | null>(null);
  const [docAutoFetched, setDocAutoFetched] = useState(false);

  const docenteProfesOptions = useMemo<Option[]>(() => {
    const map = new Map<number, string>();
    for (const clase of docenteClases) {
      if (clase.profesorado_id && clase.profesorado_nombre) {
        map.set(clase.profesorado_id, clase.profesorado_nombre);
      }
    }
    return Array.from(map.entries())
      .map(([id, label]) => ({ id, label }))
      .sort(ordenarPorLabel);
  }, [docenteClases]);

  const docentePlanOptions = useMemo<Option[]>(() => {
    let filtered = docenteClases;
    if (docenteProfesorado) filtered = filtered.filter((c) => c.profesorado_id === docenteProfesorado.id);
    const map = new Map<number, string>();
    for (const clase of filtered) {
      if (clase.plan_id && clase.plan_resolucion) {
        map.set(clase.plan_id, clase.plan_resolucion);
      }
    }
    return Array.from(map.entries())
      .map(([id, label]) => ({ id, label }))
      .sort(ordenarPorLabel);
  }, [docenteClases, docenteProfesorado]);

  const docenteMateriaOptions = useMemo<Option[]>(() => {
    let filtered = docenteClases;
    if (docenteProfesorado) filtered = filtered.filter((c) => c.profesorado_id === docenteProfesorado.id);
    if (docentePlan) filtered = filtered.filter((c) => c.plan_id === docentePlan.id);
    const map = new Map<number, string>();
    for (const clase of filtered) {
      map.set(clase.materia_id, clase.materia);
    }
    return Array.from(map.entries())
      .map(([id, label]) => ({ id, label }))
      .sort(ordenarPorLabel);
  }, [docenteClases, docenteProfesorado, docentePlan]);

  const docenteComisionOptions = useMemo<Option[]>(() => {
    let filtered = docenteClases;
    if (docenteProfesorado) filtered = filtered.filter((c) => c.profesorado_id === docenteProfesorado.id);
    if (docentePlan) filtered = filtered.filter((c) => c.plan_id === docentePlan.id);
    if (docenteMateria) filtered = filtered.filter((c) => c.materia_id === docenteMateria.id);
    return filtered
      .map((clase) => ({ id: clase.comision_id, label: `${clase.comision} - ${dayjs(clase.fecha).format("DD/MM")}` }))
      .sort(ordenarPorLabel);
  }, [docenteClases, docenteProfesorado, docentePlan, docenteMateria]);

  const docenteFechaOptions = useMemo<DateOption[]>(() => {
    let filtered = docenteClases;
    if (docenteProfesorado) filtered = filtered.filter((c) => c.profesorado_id === docenteProfesorado.id);
    if (docentePlan) filtered = filtered.filter((c) => c.plan_id === docentePlan.id);
    if (docenteMateria) filtered = filtered.filter((c) => c.materia_id === docenteMateria.id);
    if (docenteComision) filtered = filtered.filter((c) => c.comision_id === docenteComision.id);
    const seen = new Set<string>();
    const options: DateOption[] = [];
    for (const clase of filtered) {
      if (!seen.has(clase.fecha)) {
        seen.add(clase.fecha);
        options.push({ id: clase.fecha, label: dayjs(clase.fecha).format("dddd DD/MM/YYYY") });
      }
    }
    return options.sort((a, b) => a.id.localeCompare(b.id));
  }, [docenteClases, docenteProfesorado, docentePlan, docenteMateria, docenteComision]);

  useEffect(() => {
    setDocentePlan(null);
    setDocenteMateria(null);
    setDocenteComision(null);
    setDocenteFecha(null);
  }, [docenteProfesorado]);

  useEffect(() => {
    setDocenteMateria(null);
    setDocenteComision(null);
    setDocenteFecha(null);
  }, [docentePlan]);

  useEffect(() => {
    setDocenteComision(null);
    setDocenteFecha(null);
  }, [docenteMateria]);

  useEffect(() => {
    setDocenteFecha(null);
  }, [docenteComision]);

  useEffect(() => {
    if (docenteProfesorado && !docenteProfesOptions.some((opt) => opt.id === docenteProfesorado.id)) {
      setDocenteProfesorado(null);
    } else if (!docenteProfesorado && docenteProfesOptions.length === 1) {
      setDocenteProfesorado(docenteProfesOptions[0]);
    }
  }, [docenteProfesorado, docenteProfesOptions]);

  useEffect(() => {
    if (docentePlan && !docentePlanOptions.some((opt) => opt.id === docentePlan.id)) {
      setDocentePlan(null);
    } else if (!docentePlan && docentePlanOptions.length === 1) {
      setDocentePlan(docentePlanOptions[0]);
    }
  }, [docentePlan, docentePlanOptions]);

  useEffect(() => {
    if (docenteMateria && !docenteMateriaOptions.some((opt) => opt.id === docenteMateria.id)) {
      setDocenteMateria(null);
    } else if (!docenteMateria && docenteMateriaOptions.length === 1) {
      setDocenteMateria(docenteMateriaOptions[0]);
    }
  }, [docenteMateria, docenteMateriaOptions]);

  useEffect(() => {
    if (docenteComision && !docenteComisionOptions.some((opt) => opt.id === docenteComision.id)) {
      setDocenteComision(null);
    } else if (!docenteComision && docenteComisionOptions.length === 1) {
      setDocenteComision(docenteComisionOptions[0]);
    }
  }, [docenteComision, docenteComisionOptions]);

  useEffect(() => {
    if (docenteFecha && !docenteFechaOptions.some((opt) => opt.id === docenteFecha.id)) {
      setDocenteFecha(null);
    } else if (!docenteFecha && docenteFechaOptions.length === 1) {
      setDocenteFecha(docenteFechaOptions[0]);
    }
  }, [docenteFecha, docenteFechaOptions]);

  const ejecutarBusquedaDocente = useCallback(
    async (dni: string) => {
      if (!puedeVerDocentes) {
        enqueueSnackbar("No tenes permisos para consultar asistencia de docentes.", { variant: "warning" });
        return;
      }
      if (!dni) {
        enqueueSnackbar("Ingresa un DNI de docente.", { variant: "info" });
        return;
      }
      setCargandoDocente(true);
      try {
        const params: { fecha?: string; desde: string; hasta: string; dia_semana?: number } = {
          desde: docenteDesde,
          hasta: docenteHasta,
        };
        if (docenteDiaSemana !== "") {
          const dia = Number(docenteDiaSemana);
          if (Number.isNaN(dia) || dia < 0 || dia > 6) {
            enqueueSnackbar("El dia debe estar entre 0 y 6.", { variant: "warning" });
            setCargandoDocente(false);
            return;
          }
          params.dia_semana = dia;
        }
        const data = await fetchDocenteClases(dni, params);
        setDocenteClases(data.clases);
        setDocenteInfo(data.docente);
        if (data.clases.length === 0) {
          enqueueSnackbar("No hay clases programadas en el rango seleccionado.", { variant: "info" });
        }
      } catch (error) {
        enqueueSnackbar("No se pudo obtener la asistencia de docentes.", { variant: "error" });
      } finally {
        setCargandoDocente(false);
      }
    },
    [docenteDesde, docenteHasta, docenteDiaSemana, enqueueSnackbar, puedeVerDocentes],
  );

  const handleBuscarDocente = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await ejecutarBusquedaDocente(docenteDni.trim());
  };

  useEffect(() => {
    if (esDocenteSolo && userDni) {
      setDocenteDni(userDni);
    }
  }, [esDocenteSolo, userDni]);

  useEffect(() => {
    if (esDocenteSolo && userDni && !docAutoFetched) {
      setDocAutoFetched(true);
      ejecutarBusquedaDocente(userDni);
    }
  }, [esDocenteSolo, userDni, docAutoFetched, ejecutarBusquedaDocente]);

  const docenteClasesFiltradas = useMemo(() => {
    let filtered = docenteClases;
    if (docenteProfesorado) filtered = filtered.filter((c) => c.profesorado_id === docenteProfesorado.id);
    if (docentePlan) filtered = filtered.filter((c) => c.plan_id === docentePlan.id);
    if (docenteMateria) filtered = filtered.filter((c) => c.materia_id === docenteMateria.id);
    if (docenteComision) filtered = filtered.filter((c) => c.comision_id === docenteComision.id);
    if (docenteFecha) filtered = filtered.filter((c) => c.fecha === docenteFecha.id);
    return filtered;
  }, [docenteClases, docenteProfesorado, docentePlan, docenteMateria, docenteComision, docenteFecha]);

  return {
    docenteDni,
    setDocenteDni,
    docenteDesde,
    setDocenteDesde,
    docenteHasta,
    setDocenteHasta,
    docenteDiaSemana,
    setDocenteDiaSemana,
    docenteClases,
    docenteInfo,
    cargandoDocente,
    docenteProfesorado,
    setDocenteProfesorado,
    docentePlan,
    setDocentePlan,
    docenteMateria,
    setDocenteMateria,
    docenteComision,
    setDocenteComision,
    docenteFecha,
    setDocenteFecha,
    docenteProfesOptions,
    docentePlanOptions,
    docenteMateriaOptions,
    docenteComisionOptions,
    docenteFechaOptions,
    docenteClasesFiltradas,
    handleBuscarDocente,
  };
};
