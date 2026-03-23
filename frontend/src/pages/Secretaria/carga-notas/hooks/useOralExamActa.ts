import { useEffect, useState } from "react";
import { enqueueSnackbar } from "notistack";
import { isAxiosError } from "axios";
import {
  ActaOralDTO,
  GuardarActaOralPayload,
  MesaResumenDTO,
  guardarActaOral,
  listarActasOrales,
  obtenerActaOral,
} from "@/api/cargaNotas";
import { MesaPlanillaDTO } from "@/api/estudiantes";
import { OralActFormValues, OralActFormTopic } from "@/components/secretaria/OralExamActaDialog";
import { OralTopicScore, generarActaExamenOralPDF } from "@/utils/actaOralPdf";
import { FinalRowState } from "../types";

const createTopicRow = (tema = "", score?: string | null): OralActFormTopic => ({
  id: `${Date.now()}-${Math.random()}`,
  tema,
  score: (score as OralTopicScore | "") || "",
});

const ensureTopicRowsFromApi = (
  topics: ActaOralDTO["temas_estudiante"] | undefined,
  min: number,
): OralActFormTopic[] => {
  const rows = (topics ?? []).map((item) => createTopicRow(item.tema ?? "", item.score ?? null));
  while (rows.length < min) {
    rows.push(createTopicRow());
  }
  return rows;
};

function mapActaOralDtoToFormValues(dto: ActaOralDTO): OralActFormValues {
  return {
    actaNumero: dto.acta_numero ?? "",
    folioNumero: dto.folio_numero ?? "",
    fecha: dto.fecha ?? "",
    curso: dto.curso ?? "",
    notaFinal: dto.nota_final ?? "",
    observaciones: dto.observaciones ?? "",
    temasEstudiante: ensureTopicRowsFromApi(dto.temas_estudiante, 3),
    temasDocente: ensureTopicRowsFromApi(dto.temas_docente, 4),
  };
}

function mapFormValuesToOralPayload(values: OralActFormValues): GuardarActaOralPayload {
  const normalize = (rows: OralActFormTopic[]) =>
    rows
      .filter((row) => row.tema.trim())
      .map((row) => ({
        tema: row.tema.trim(),
        score: row.score || null,
      }));

  return {
    acta_numero: values.actaNumero || null,
    folio_numero: values.folioNumero || null,
    fecha: values.fecha || null,
    curso: values.curso || null,
    nota_final: values.notaFinal || null,
    observaciones: values.observaciones || null,
    temas_estudiante: normalize(values.temasEstudiante),
    temas_docente: normalize(values.temasDocente),
  };
}

export function useOralExamActa(
  finalSelectedMesaId: number | null,
  finalRows: FinalRowState[],
  finalReadOnly: boolean,
  selectedMesaResumen: MesaResumenDTO | null,
  finalPlanilla: MesaPlanillaDTO | null,
  selectedMesaCursoLabel: string,
  tribunalInfo: { presidente: string | null; vocal1: string | null; vocal2: string | null },
) {
  const [oralActDrafts, setOralActDrafts] = useState<Record<number, OralActFormValues>>({});
  const [oralDialogRow, setOralDialogRow] = useState<FinalRowState | null>(null);
  const [oralActaLoading, setOralActaLoading] = useState(false);
  const [oralActaSaving, setOralActaSaving] = useState(false);
  const [downloadingOralBatch, setDownloadingOralBatch] = useState(false);

  useEffect(() => {
    setOralActDrafts({});
    setOralDialogRow(null);
  }, [finalSelectedMesaId]);

  const handleOpenOralActa = async (row: FinalRowState) => {
    if (finalReadOnly) {
      enqueueSnackbar(
        "Solo los docentes del tribunal pueden gestionar las actas orales de esta mesa.",
        { variant: "warning" },
      );
      return;
    }
    if (!finalSelectedMesaId) {
      enqueueSnackbar("Selecciona una mesa para generar el acta oral.", { variant: "warning" });
      return;
    }
    setOralDialogRow(row);
    if (oralActDrafts[row.inscripcionId]) {
      return;
    }
    setOralActaLoading(true);
    try {
      const data = await obtenerActaOral(finalSelectedMesaId, row.inscripcionId);
      setOralActDrafts((prev) => ({
        ...prev,
        [row.inscripcionId]: mapActaOralDtoToFormValues(data),
      }));
    } catch (error) {
      if (!isAxiosError(error) || error.response?.status !== 404) {
        enqueueSnackbar("No se pudo cargar el acta oral.", { variant: "error" });
      }
    } finally {
      setOralActaLoading(false);
    }
  };

  const handleCloseOralActa = () => {
    setOralDialogRow(null);
  };

  const handleSaveOralActa = async (values: OralActFormValues) => {
    if (!oralDialogRow || !finalSelectedMesaId) {
      enqueueSnackbar("Selecciona una mesa para registrar el acta oral.", { variant: "warning" });
      throw new Error("Mesa no seleccionada");
    }
    if (finalReadOnly) {
      enqueueSnackbar(
        "Solo los docentes del tribunal pueden registrar actas orales para esta mesa.",
        { variant: "warning" },
      );
      throw new Error("Sin permisos");
    }
    setOralActaSaving(true);
    try {
      await guardarActaOral(
        finalSelectedMesaId,
        oralDialogRow.inscripcionId,
        mapFormValuesToOralPayload(values),
      );
      setOralActDrafts((prev) => ({
        ...prev,
        [oralDialogRow.inscripcionId]: values,
      }));
      enqueueSnackbar("Acta oral guardada correctamente.", { variant: "success" });
    } catch (error) {
      enqueueSnackbar("No se pudo guardar el acta oral.", { variant: "error" });
      throw error;
    } finally {
      setOralActaSaving(false);
    }
  };

  const handleDownloadAllOralActas = async () => {
    if (finalReadOnly) {
      enqueueSnackbar(
        "Solo los docentes del tribunal pueden descargar las actas orales de esta mesa.",
        { variant: "warning" },
      );
      return;
    }
    if (!finalSelectedMesaId) {
      enqueueSnackbar("Selecciona una mesa para descargar las actas orales.", { variant: "warning" });
      return;
    }
    setDownloadingOralBatch(true);
    try {
      const actas = await listarActasOrales(finalSelectedMesaId);
      if (!actas.length) {
        enqueueSnackbar("No hay actas orales registradas para esta mesa.", { variant: "info" });
        return;
      }
      const carrera = selectedMesaResumen?.profesorado_nombre ?? "";
      const unidadCurricular = finalPlanilla?.materia_nombre ?? selectedMesaResumen?.materia_nombre ?? "";
      const cursoLabel = selectedMesaCursoLabel;
      actas.forEach((acta) => {
        const temasEstudiante = (acta.temas_estudiante ?? []).map((item) => ({
          tema: item.tema,
          score: (item.score as OralTopicScore | undefined) || undefined,
        }));
        const temasDocente = (acta.temas_docente ?? []).map((item) => ({
          tema: item.tema,
          score: (item.score as OralTopicScore | undefined) || undefined,
        }));
        generarActaExamenOralPDF({
          actaNumero: acta.acta_numero ?? undefined,
          folioNumero: acta.folio_numero ?? undefined,
          fecha: acta.fecha ?? undefined,
          carrera,
          unidadCurricular,
          curso: acta.curso || cursoLabel,
          estudiante: `${acta.estudiante} - DNI ${acta.dni}`,
          tribunal: tribunalInfo,
          temasElegidosEstudiante: temasEstudiante,
          temasSugeridosDocente: temasDocente,
          notaFinal: acta.nota_final ?? undefined,
          observaciones: acta.observaciones ?? undefined,
        });
      });
      enqueueSnackbar("Actas orales descargadas.", { variant: "success" });
    } catch (error) {
      enqueueSnackbar("No se pudieron descargar las actas orales.", { variant: "error" });
    } finally {
      setDownloadingOralBatch(false);
    }
  };

  return {
    oralActDrafts,
    oralDialogRow,
    oralActaLoading,
    oralActaSaving,
    downloadingOralBatch,
    handleOpenOralActa,
    handleCloseOralActa,
    handleSaveOralActa,
    handleDownloadAllOralActas,
    mapActaOralDtoToFormValues,
    mapFormValuesToOralPayload,
  };
}

export { createTopicRow, ensureTopicRowsFromApi, mapActaOralDtoToFormValues, mapFormValuesToOralPayload };
