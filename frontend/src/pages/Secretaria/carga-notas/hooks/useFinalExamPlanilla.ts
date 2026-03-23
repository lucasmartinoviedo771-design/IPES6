import { useCallback, useEffect, useMemo, useState } from "react";
import { enqueueSnackbar } from "notistack";
import { isAxiosError } from "axios";
import {
  MesaResumenDTO,
  listarMesasFinales,
} from "@/api/cargaNotas";
import {
  MesaPlanillaEstudianteDTO,
  MesaPlanillaCondicionDTO,
  MesaPlanillaDTO,
  obtenerMesaPlanilla,
} from "@/api/estudiantes";
import { FinalFiltersState, FinalRowState } from "../types";

export function useFinalExamPlanilla(
  finalFilters: FinalFiltersState,
  isFinalsMode: boolean,
) {
  const [finalMesas, setFinalMesas] = useState<MesaResumenDTO[]>([]);
  const [finalSelectedMesaId, setFinalSelectedMesaId] = useState<number | null>(null);
  const [finalPlanilla, setFinalPlanilla] = useState<MesaPlanillaDTO | null>(null);
  const [finalCondiciones, setFinalCondiciones] = useState<MesaPlanillaCondicionDTO[]>([]);
  const [finalRows, setFinalRows] = useState<FinalRowState[]>([]);
  const [finalLoadingMesas, setFinalLoadingMesas] = useState(false);
  const [finalLoadingPlanilla, setFinalLoadingPlanilla] = useState(false);
  const [finalError, setFinalError] = useState<string | null>(null);
  const [finalPermissionDenied, setFinalPermissionDenied] = useState(false);

  const mapEstudianteToFinalRow = (estudiante: MesaPlanillaEstudianteDTO): FinalRowState => ({
    inscripcionId: estudiante.inscripcion_id,
    estudianteId: estudiante.estudiante_id,
    apellidoNombre: estudiante.apellido_nombre,
    dni: estudiante.dni,
    condicion: estudiante.condicion ?? null,
    nota: estudiante.nota !== null && estudiante.nota !== undefined ? String(estudiante.nota) : "",
    fechaResultado: estudiante.fecha_resultado ? estudiante.fecha_resultado.slice(0, 10) : "",
    cuentaParaIntentos: Boolean(estudiante.cuenta_para_intentos),
    folio: estudiante.folio ?? "",
    libro: estudiante.libro ?? "",
    observaciones: estudiante.observaciones ?? "",
  });

  const fetchFinalPlanilla = useCallback(
    async (mesaId: number) => {
      setFinalLoadingPlanilla(true);
      setFinalError(null);
      setFinalPermissionDenied(false);
      try {
        const data = await obtenerMesaPlanilla(mesaId);
        setFinalPlanilla(data);
        setFinalCondiciones(data.condiciones);
        setFinalRows(data.estudiantes.map((estudiante) => mapEstudianteToFinalRow(estudiante)));
        setFinalPermissionDenied(false);
      } catch (error) {
        setFinalPlanilla(null);
        setFinalCondiciones([]);
        setFinalRows([]);
        if (isAxiosError(error) && error.response?.status === 403) {
          const message =
            "Solo los docentes que integran el tribunal o el personal autorizado pueden cargar las notas de esta mesa.";
          setFinalError(message);
          setFinalPermissionDenied(true);
          enqueueSnackbar(message, { variant: "warning" });
        } else {
          setFinalPermissionDenied(false);
          setFinalError("No se pudo cargar la planilla de la mesa seleccionada.");
        }
      } finally {
        setFinalLoadingPlanilla(false);
      }
    },
    [enqueueSnackbar]
  );

  useEffect(() => {
    if (!isFinalsMode) {
      return;
    }

    const params: Record<string, unknown> = {};
    if (finalFilters.ventanaId) params.ventana_id = Number(finalFilters.ventanaId);
    if (finalFilters.tipo) params.tipo = finalFilters.tipo;
    if (finalFilters.modalidad) params.modalidad = finalFilters.modalidad;
    if (finalFilters.profesoradoId) params.profesorado_id = finalFilters.profesoradoId;
    if (finalFilters.planId) params.plan_id = finalFilters.planId;
    if (finalFilters.anio) params.anio = finalFilters.anio;
    if (finalFilters.cuatrimestre) params.cuatrimestre = finalFilters.cuatrimestre;
    if (finalFilters.materiaId) params.materia_id = finalFilters.materiaId;
    if (finalFilters.anioMesa) {
      params.desde = `${finalFilters.anioMesa}-01-01`;
      params.hasta = `${finalFilters.anioMesa}-12-31`;
    }

    const loadMesas = async () => {
      setFinalLoadingMesas(true);
      try {
        const data = await listarMesasFinales(params);
        setFinalMesas(data);
        setFinalSelectedMesaId((prev) => {
          if (!prev) {
            return prev;
          }
          return data.some((mesa) => mesa.id === prev) ? prev : null;
        });
        setFinalPlanilla(null);
        setFinalCondiciones([]);
        setFinalRows([]);
      } catch (error) {
        setFinalMesas([]);
        enqueueSnackbar("No se pudieron obtener las mesas de examen.", { variant: "error" });
      } finally {
        setFinalLoadingMesas(false);
      }
    };

    loadMesas();
  }, [
    isFinalsMode,
    finalFilters.anio,
    finalFilters.anioMesa,
    finalFilters.cuatrimestre,
    finalFilters.modalidad,
    finalFilters.materiaId,
    finalFilters.planId,
    finalFilters.profesoradoId,
    finalFilters.tipo,
    finalFilters.ventanaId,
  ]);

  useEffect(() => {
    if (!isFinalsMode || !finalSelectedMesaId) {
      return;
    }
    fetchFinalPlanilla(finalSelectedMesaId);
  }, [isFinalsMode, finalSelectedMesaId, fetchFinalPlanilla]);

  const condicionFinalPorValor = useMemo(() => {
    const map = new Map<string, MesaPlanillaCondicionDTO>();
    finalCondiciones.forEach((condicion) => {
      map.set(condicion.value, condicion);
    });
    return map;
  }, [finalCondiciones]);

  const finalReadOnly = finalPermissionDenied || (finalPlanilla ? !finalPlanilla.puede_editar : false);

  const handleFinalRowChange = (inscripcionId: number, patch: Partial<FinalRowState>) => {
    if (finalReadOnly) {
      return;
    }
    setFinalRows((prev) =>
      prev.map((row) => {
        if (row.inscripcionId !== inscripcionId) {
          return row;
        }
        const next: FinalRowState = { ...row, ...patch };
        if (patch.condicion !== undefined) {
          const condicion = patch.condicion;
          if (!condicion) {
            next.cuentaParaIntentos = false;
          } else {
            const info = condicionFinalPorValor.get(condicion);
            if (info) {
              next.cuentaParaIntentos = info.cuenta_para_intentos;
            }
          }
        }
        return next;
      })
    );
  };

  const handleOpenFinalPlanilla = (mesaId: number) => {
    if (finalSelectedMesaId === mesaId) {
      // Forzar refresco manual si ya está seleccionada.
      setFinalSelectedMesaId(null);
      setTimeout(() => setFinalSelectedMesaId(mesaId), 0);
    } else {
      setFinalSelectedMesaId(mesaId);
    }
  };

  const selectedMesaResumen = useMemo(() => {
    if (!finalSelectedMesaId) return null;
    return finalMesas.find((mesa) => mesa.id === finalSelectedMesaId) ?? null;
  }, [finalSelectedMesaId, finalMesas]);

  const selectedMesaCursoLabel = useMemo(() => {
    if (!selectedMesaResumen) return "";
    const parts: string[] = [];
    if (selectedMesaResumen.anio_cursada) {
      parts.push(`A\u00f1o ${selectedMesaResumen.anio_cursada}`);
    }
    if (selectedMesaResumen.regimen) {
      parts.push(selectedMesaResumen.regimen);
    }
    if (selectedMesaResumen.modalidad) {
      parts.push(selectedMesaResumen.modalidad === "LIB" ? "Libre" : "Regular");
    }
    return parts.join(" \u00b7 ");
  }, [selectedMesaResumen]);

  const tribunalInfo = useMemo(() => {
    const docentes = selectedMesaResumen?.docentes ?? [];
    const findDoc = (rol: "PRES" | "VOC1" | "VOC2") =>
      docentes.find((item) => item.rol === rol)?.nombre || null;
    return {
      presidente: findDoc("PRES"),
      vocal1: findDoc("VOC1"),
      vocal2: findDoc("VOC2"),
    };
  }, [selectedMesaResumen]);

  return {
    finalMesas,
    finalSelectedMesaId,
    setFinalSelectedMesaId,
    finalPlanilla,
    setFinalPlanilla,
    finalCondiciones,
    setFinalCondiciones,
    finalRows,
    setFinalRows,
    finalLoadingMesas,
    finalLoadingPlanilla,
    finalError,
    setFinalError,
    finalPermissionDenied,
    setFinalPermissionDenied,
    finalReadOnly,
    fetchFinalPlanilla,
    mapEstudianteToFinalRow,
    handleFinalRowChange,
    handleOpenFinalPlanilla,
    selectedMesaResumen,
    selectedMesaCursoLabel,
    tribunalInfo,
  };
}
