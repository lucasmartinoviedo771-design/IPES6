import React from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { MesaPlanillaCondicionDTO, MesaPlanillaDTO } from "@/api/estudiantes";
import { FinalRowState } from "../types";
import FinalExamPlanillaTable from "./FinalExamPlanillaTable";

type Props = {
  finalPlanilla: MesaPlanillaDTO | null;
  finalLoadingPlanilla: boolean;
  finalSelectedMesaId: number | null;
  finalCondiciones: MesaPlanillaCondicionDTO[];
  finalRows: FinalRowState[];
  filteredFinalRows: FinalRowState[];
  finalReadOnly: boolean;
  finalPermissionDenied: boolean;
  finalSaving: boolean;
  finalCierreLoading: boolean;
  finalSearch: string;
  setFinalSearch: (value: string) => void;
  totalFinalRows: number;
  visibleFinalRows: number;
  hasFinalSearch: boolean;
  downloadingOralBatch: boolean;
  onRowChange: (inscripcionId: number, patch: Partial<FinalRowState>) => void;
  onOpenOralActa: (row: FinalRowState) => void;
  onFinalSaveClick: () => void;
  onFinalPlanillaCierre: (accion: "cerrar" | "reabrir") => void;
  onDownloadAllOralActas: () => void;
};

const FinalExamPlanillaSection: React.FC<Props> = ({
  finalPlanilla,
  finalLoadingPlanilla,
  finalSelectedMesaId,
  finalCondiciones,
  finalRows,
  filteredFinalRows,
  finalReadOnly,
  finalPermissionDenied,
  finalSaving,
  finalCierreLoading,
  finalSearch,
  setFinalSearch,
  totalFinalRows,
  visibleFinalRows,
  hasFinalSearch,
  downloadingOralBatch,
  onRowChange,
  onOpenOralActa,
  onFinalSaveClick,
  onFinalPlanillaCierre,
  onDownloadAllOralActas,
}) => {
  if (!finalSelectedMesaId) return null;

  return (
    <Box>
      {finalLoadingPlanilla ? (
        <Stack alignItems="center" py={4}>
          <CircularProgress size={32} />
        </Stack>
      ) : finalPlanilla ? (
        <Stack gap={2}>
          <Box
            display="flex"
            flexDirection={{ xs: "column", md: "row" }}
            justifyContent="space-between"
            alignItems={{ xs: "flex-start", md: "center" }}
            gap={2}
          >
            <Box>
              <Typography variant="subtitle2" fontWeight={700}>
                {finalPlanilla.materia_nombre} - Mesa #{finalPlanilla.mesa_id}
              </Typography>
              <Typography color="text.secondary">
                {finalPlanilla.fecha ? new Date(finalPlanilla.fecha).toLocaleDateString() : "-"} - {finalPlanilla.tipo === "FIN" ? "Ordinaria" : finalPlanilla.tipo === "EXT" ? "Extraordinaria" : "Especial"} - {finalPlanilla.modalidad === "LIB" ? "Libre" : "Regular"}
              </Typography>
            </Box>
            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={1.5}
              alignItems={{ xs: "stretch", sm: "center" }}
              sx={{ width: { xs: "100%", sm: "auto" } }}
            >
              {totalFinalRows > 0 && (
                <Typography variant="body2" color="text.secondary" sx={{ minWidth: "fit-content" }}>
                  {visibleFinalRows} de {totalFinalRows} inscripciones{hasFinalSearch ? " (filtrado)" : ""}
                </Typography>
              )}
              <Button
                variant="outlined"
                size="small"
                onClick={onDownloadAllOralActas}
                disabled={downloadingOralBatch || finalReadOnly}
                startIcon={
                  downloadingOralBatch ? <CircularProgress size={14} color="inherit" /> : undefined
                }
              >
                {downloadingOralBatch ? "Descargando..." : "Actas orales"}
              </Button>
            </Stack>
          </Box>
          {finalPlanilla.esta_cerrada ? (
            <Alert severity={finalPlanilla.puede_editar ? "info" : "warning"}>
              Planilla cerrada el{" "}
              {finalPlanilla.cerrada_en
                ? new Date(finalPlanilla.cerrada_en).toLocaleString("es-AR")
                : "fecha desconocida"}
              {finalPlanilla.cerrada_por ? ` por ${finalPlanilla.cerrada_por}` : ""}.
              {!finalPlanilla.puede_editar && " Solo secretaría o admin pueden editarla o reabrirla."}
            </Alert>
          ) : (
            <Alert severity="info">
              Cuando confirmes las notas, cerrá la planilla para bloquear nuevas ediciones.
            </Alert>
          )}
          <Box display="flex" justifyContent="flex-end" gap={1} flexWrap="wrap">
            {finalPlanilla.puede_cerrar && (
              <Button
                variant="outlined"
                color="warning"
                onClick={() => onFinalPlanillaCierre("cerrar")}
                disabled={finalCierreLoading}
              >
                {finalCierreLoading ? "Cerrando..." : "Cerrar planilla"}
              </Button>
            )}
            {finalPlanilla.puede_reabrir && false && (
              <Button
                variant="contained"
                onClick={() => onFinalPlanillaCierre("reabrir")}
                disabled={finalCierreLoading}
              >
                {finalCierreLoading ? "Actualizando..." : "Reabrir planilla"}
              </Button>
            )}
          </Box>
          {finalPermissionDenied && (
            <Alert severity="warning">
              Solo los docentes que integran el tribunal o el personal autorizado pueden modificar esta planilla.
            </Alert>
          )}
          {totalFinalRows === 0 ? (
            <Alert severity="info">No hay inscripciones registradas para esta mesa.</Alert>
          ) : visibleFinalRows === 0 ? (
            <Alert severity="info">No se encontraron inscripciones que coincidan con la búsqueda.</Alert>
          ) : (
            <FinalExamPlanillaTable
              filteredFinalRows={filteredFinalRows}
              finalCondiciones={finalCondiciones}
              finalReadOnly={finalReadOnly}
              finalSearch={finalSearch}
              setFinalSearch={setFinalSearch}
              onRowChange={onRowChange}
              onOpenOralActa={onOpenOralActa}
            />
          )}

          <Stack direction={{ xs: "column", sm: "row" }} justifyContent="flex-end" gap={1}>
            <Button
              variant="contained"
              onClick={onFinalSaveClick}
              disabled={finalReadOnly || finalSaving || finalRows.length === 0}
            >
              {finalSaving ? "Guardando..." : "Guardar planilla"}
            </Button>
          </Stack>
        </Stack>
      ) : (
        <Alert severity="info">Seleccioná una mesa para cargar las notas.</Alert>
      )}
    </Box>
  );
};

export default FinalExamPlanillaSection;
