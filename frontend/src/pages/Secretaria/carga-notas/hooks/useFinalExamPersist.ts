import { useState } from "react";
import { enqueueSnackbar } from "notistack";
import { isAxiosError } from "axios";
import {
  actualizarMesaPlanilla,
  gestionarMesaPlanillaCierre,
  MesaPlanillaEstudianteDTO,
  MesaPlanillaDTO,
  obtenerMesaPlanilla,
} from "@/api/estudiantes";
import { FinalRowState, FinalPlanillaPayload } from "../types";

export function useFinalExamPersist(
  finalSelectedMesaId: number | null,
  finalRows: FinalRowState[],
  finalPlanilla: MesaPlanillaDTO | null,
  refetchPlanilla: (mesaId: number) => Promise<void>,
  setFinalPlanilla: (planilla: MesaPlanillaDTO) => void,
  setFinalCondiciones: (condiciones: MesaPlanillaDTO["condiciones"]) => void,
  setFinalRows: (rows: FinalRowState[]) => void,
  mapEstudianteToFinalRow: (estudiante: MesaPlanillaEstudianteDTO) => FinalRowState,
  setFinalPermissionDenied: (value: boolean) => void,
  setFinalError: (value: string | null) => void,
) {
  const [finalSaving, setFinalSaving] = useState(false);
  const [finalCierreLoading, setFinalCierreLoading] = useState(false);
  const [finalConfirmOpen, setFinalConfirmOpen] = useState(false);
  const [finalPendingPayload, setFinalPendingPayload] = useState<{ mesaId: number; payload: FinalPlanillaPayload } | null>(null);
  const [finalSuccess, setFinalSuccess] = useState<string | null>(null);

  const buildFinalPlanillaPayload = (): { mesaId: number; payload: FinalPlanillaPayload } | null => {
    if (!finalSelectedMesaId) {
      enqueueSnackbar("Selecciona una mesa para guardar las notas de finales.", { variant: "warning" });
      return null;
    }
    if (!finalRows.length) {
      enqueueSnackbar("No hay inscripciones para guardar.", { variant: "warning" });
      return null;
    }

    for (const row of finalRows) {
      if (!row.condicion) {
        enqueueSnackbar(`Falta seleccionar la condición de ${row.apellidoNombre}.`, { variant: "warning" });
        return null;
      }
      if (row.nota.trim() !== "") {
        const notaParse = Number.parseFloat(row.nota.replace(",", "."));
        if (Number.isNaN(notaParse)) {
          enqueueSnackbar(`La nota de ${row.apellidoNombre} no es válida.`, { variant: "warning" });
          return null;
        }
      }
    }

    const payload: FinalPlanillaPayload = {
      estudiantes: finalRows.map((row) => {
        const notaValor =
          row.nota.trim() === "" ? null : Number.parseFloat(row.nota.replace(",", "."));
        return {
          inscripcion_id: row.inscripcionId,
          fecha_resultado: row.fechaResultado || null,
          condicion: row.condicion || null,
          nota: notaValor,
          folio: row.folio.trim() === "" ? null : row.folio.trim(),
          libro: row.libro.trim() === "" ? null : row.libro.trim(),
          observaciones: row.observaciones.trim() === "" ? null : row.observaciones.trim(),
          cuenta_para_intentos: row.cuentaParaIntentos,
        };
      }),
    };

    return { mesaId: finalSelectedMesaId, payload };
  };

  const finalPermissionDenied = false; // passed in via closure; kept here for type-check reference only

  const handleFinalSaveClick = (permissionDenied: boolean) => {
    if (permissionDenied) {
      enqueueSnackbar(
        "Solo los docentes del tribunal o el personal autorizado pueden guardar la planilla de esta mesa.",
        { variant: "warning" },
      );
      return;
    }
    const pending = buildFinalPlanillaPayload();
    if (!pending) {
      return;
    }
    setFinalPendingPayload(pending);
    setFinalConfirmOpen(true);
  };

  const executeGuardarFinalPlanilla = async () => {
    if (!finalPendingPayload) return;
    const { mesaId, payload } = finalPendingPayload;

    setFinalSaving(true);
    setFinalError(null);
    setFinalSuccess(null);
    try {
      await actualizarMesaPlanilla(mesaId, payload);
      enqueueSnackbar("Planilla de finales guardada correctamente.", { variant: "success" });
      setFinalSuccess("Planilla guardada correctamente.");
      const refreshed = await obtenerMesaPlanilla(mesaId);
      if (mesaId === finalSelectedMesaId) {
        setFinalPlanilla(refreshed);
        setFinalCondiciones(refreshed.condiciones);
        setFinalRows(refreshed.estudiantes.map((estudiante) => mapEstudianteToFinalRow(estudiante)));
        setFinalPermissionDenied(false);
      }
    } catch (error) {
      if (isAxiosError(error) && error.response?.status === 403) {
        const message =
          "Solo los docentes que integran el tribunal o el personal autorizado pueden guardar la planilla de esta mesa.";
        setFinalError(message);
        setFinalPermissionDenied(true);
        enqueueSnackbar(message, { variant: "warning" });
      } else {
        setFinalPermissionDenied(false);
        setFinalError("No se pudieron guardar las notas de la mesa seleccionada.");
        enqueueSnackbar("No se pudieron guardar las notas de la mesa.", { variant: "error" });
      }
    } finally {
      setFinalSaving(false);
      setFinalConfirmOpen(false);
      setFinalPendingPayload(null);
    }
  };

  const cancelFinalConfirm = () => {
    if (finalSaving) return;
    setFinalConfirmOpen(false);
    setFinalPendingPayload(null);
  };

  const handleFinalPlanillaCierre = async (accion: "cerrar" | "reabrir") => {
    if (!finalSelectedMesaId) return;
    setFinalCierreLoading(true);
    try {
      await gestionarMesaPlanillaCierre(finalSelectedMesaId, accion);
      enqueueSnackbar(
        accion === "cerrar" ? "Planilla cerrada correctamente." : "Planilla reabierta correctamente.",
        { variant: "success" }
      );
      await refetchPlanilla(finalSelectedMesaId);
    } catch (error: any) {
      const message =
        error?.response?.data?.message || "No se pudo actualizar el estado de cierre de la planilla.";
      enqueueSnackbar(message, { variant: "error" });
    } finally {
      setFinalCierreLoading(false);
    }
  };

  return {
    finalSaving,
    finalCierreLoading,
    finalConfirmOpen,
    finalPendingPayload,
    finalSuccess,
    setFinalSuccess,
    buildFinalPlanillaPayload,
    handleFinalSaveClick,
    executeGuardarFinalPlanilla,
    cancelFinalConfirm,
    handleFinalPlanillaCierre,
  };
}
