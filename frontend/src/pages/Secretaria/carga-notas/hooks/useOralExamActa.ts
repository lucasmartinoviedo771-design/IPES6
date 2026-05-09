import { useEffect, useState } from "react";
import { enqueueSnackbar } from "notistack";
import { isAxiosError } from "axios";
import {
  ActaOralDTO,
  GuardarActaOralPayload,
  guardarActaOral,
  listarActasOrales,
  obtenerActaOral,
  descargarActaOralPdf,
} from "@/api/cargaNotas";
import { OralActFormValues, OralActFormTopic } from "@/components/secretaria/OralExamActaDialog";
import { OralTopicScore } from "@/utils/actaOralPdf";
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
  finalReadOnly: boolean,
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
      for (const acta of actas) {
        const safeName = acta.estudiante.replace(/\s+/g, "_").replace(/[^\w_-]/g, "");
        await descargarActaOralPdf(finalSelectedMesaId, acta.inscripcion_id, `acta_oral_${safeName}.pdf`);
      }
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
