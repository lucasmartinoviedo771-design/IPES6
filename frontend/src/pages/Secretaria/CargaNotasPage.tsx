import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import BackButton from "@/components/ui/BackButton";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { enqueueSnackbar } from "notistack";
import { useSearchParams, useNavigate } from "react-router-dom";
import {
  ComisionOptionDTO,
  GuardarRegularidadPayload,
  MateriaOptionDTO,
  RegularidadPlanillaDTO,
  guardarPlanillaRegularidad,
  gestionarCierreRegularidad,
  obtenerPlanillaRegularidad,
} from "@/api/cargaNotas";
import RegularidadPlanillaEditor from "@/components/secretaria/RegularidadPlanillaEditor";
import OralExamActaDialog, { OralActFormValues } from "@/components/secretaria/OralExamActaDialog";
import { PageHero } from "@/components/ui/GradientTitles";
import FinalConfirmationDialog from "@/components/ui/FinalConfirmationDialog";
import GestionComisionesDialog from "./components/GestionComisionesDialog";
import { INSTITUTIONAL_TERRACOTTA, INSTITUTIONAL_TERRACOTTA_DARK } from "@/styles/institutionalColors";

import { FiltersState, FinalFiltersState } from "./carga-notas/types";
import { useRegularidadFilters } from "./carga-notas/hooks/useRegularidadFilters";
import { useFinalExamFilters } from "./carga-notas/hooks/useFinalExamFilters";
import { useFinalExamPlanilla } from "./carga-notas/hooks/useFinalExamPlanilla";
import { useFinalExamPersist } from "./carga-notas/hooks/useFinalExamPersist";
import { useOralExamActa } from "./carga-notas/hooks/useOralExamActa";
import RegularidadFiltersPanel from "./carga-notas/components/RegularidadFiltersPanel";
import RegularidadComisionesGrid from "./carga-notas/components/RegularidadComisionesGrid";
import FinalExamFiltersPanel from "./carga-notas/components/FinalExamFiltersPanel";
import FinalExamMesasGrid from "./carga-notas/components/FinalExamMesasGrid";
import FinalExamPlanillaSection from "./carga-notas/components/FinalExamPlanillaSection";
import OralActasSection from "./carga-notas/components/OralActasSection";

const CargaNotasPage: React.FC = () => {
  const [filters, setFilters] = useState<FiltersState>({
    profesoradoId: null,
    planId: null,
    anio: null,
    cuatrimestre: null,
    anioCursada: null,
    materiaId: null,
    comisionId: null,
  });

  const [planilla, setPlanilla] = useState<RegularidadPlanillaDTO | null>(null);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const scope = searchParams.get("scope");
  const isFinalsMode = scope === "finales";

  const [loadingPlanilla, setLoadingPlanilla] = useState(false);
  const [saving, setSaving] = useState(false);
  const [regularidadConfirmOpen, setRegularidadConfirmOpen] = useState(false);
  const [regularidadPendingPayload, setRegularidadPendingPayload] = useState<GuardarRegularidadPayload | null>(null);
  const [regularidadCierreLoading, setRegularidadCierreLoading] = useState(false);
  const [defaultFechaCierre, setDefaultFechaCierre] = useState<string>(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [defaultObservaciones, setDefaultObservaciones] = useState<string>("");
  const [gestionComisionesOpen, setGestionComisionesOpen] = useState(false);

  const [finalFilters, setFinalFilters] = useState<FinalFiltersState>({
    ventanaId: "",
    tipo: "FIN",
    modalidad: "REG",
    profesoradoId: null,
    planId: null,
    materiaId: null,
    anio: null,
    cuatrimestre: null,
    estadoPlanilla: "TODAS",
    anioMesa: null,
  });

  const [finalSearch, setFinalSearch] = useState<string>("");

  // --- Regularidad Filters Hook ---
  const {
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
  } = useRegularidadFilters(filters, setFilters);

  // --- Final Exam Filters Hook ---
  const {
    ventanasFinales,
    finalPlanes,
    finalMaterias,
    loadingFinalPlanes,
    loadingFinalMaterias,
    finalAvailableAnios,
    finalCuatrimestreOptions,
    finalMateriasFiltradas,
  } = useFinalExamFilters(finalFilters, setFinalFilters, profesorados, isFinalsMode);

  // --- Final Exam Planilla Hook ---
  const {
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
  } = useFinalExamPlanilla(finalFilters, isFinalsMode);

  // --- Final Exam Persist Hook ---
  const {
    finalSaving,
    finalCierreLoading,
    finalConfirmOpen,
    finalSuccess,
    setFinalSuccess,
    handleFinalSaveClick: handleFinalSaveClickBase,
    executeGuardarFinalPlanilla,
    cancelFinalConfirm,
    handleFinalPlanillaCierre,
  } = useFinalExamPersist(
    finalSelectedMesaId,
    finalRows,
    finalPlanilla,
    fetchFinalPlanilla,
    setFinalPlanilla,
    setFinalCondiciones,
    setFinalRows,
    mapEstudianteToFinalRow,
    setFinalPermissionDenied,
    setFinalError,
  );

  const handleFinalSaveClick = () => handleFinalSaveClickBase(finalPermissionDenied);

  // --- Oral Exam Acta Hook ---
  const {
    oralActDrafts,
    oralDialogRow,
    oralActaLoading,
    oralActaSaving,
    downloadingOralBatch,
    handleOpenOralActa,
    handleCloseOralActa,
    handleSaveOralActa,
    handleDownloadAllOralActas,
  } = useOralExamActa(
    finalSelectedMesaId,
    finalRows,
    finalReadOnly,
    selectedMesaResumen,
    finalPlanilla,
    selectedMesaCursoLabel,
    tribunalInfo,
  );

  // --- Regularidad state and handlers ---
  const selectedComision = useMemo(
    () => filteredComisiones.find((c) => c.id === filters.comisionId) || null,
    [filteredComisiones, filters.comisionId]
  );
  const regularidadReadOnly = planilla ? !planilla.puede_editar : false;

  const fetchPlanilla = useCallback(
    async (comisionId: number) => {
      setLoadingPlanilla(true);
      try {
        const data = await obtenerPlanillaRegularidad(comisionId);
        setPlanilla(data);
        setDefaultFechaCierre(new Date().toISOString().slice(0, 10));
        setDefaultObservaciones("");
      } catch (error) {
        setPlanilla(null);
        enqueueSnackbar("No se pudo cargar la planilla de regularidad.", { variant: "error" });
      } finally {
        setLoadingPlanilla(false);
      }
    },
    [enqueueSnackbar]
  );

  useEffect(() => {
    if (!filters.comisionId) {
      setPlanilla(null);
      return;
    }
    fetchPlanilla(filters.comisionId);
  }, [filters.comisionId, fetchPlanilla]);

  const persistRegularidad = async (payload: GuardarRegularidadPayload) => {
    setSaving(true);
    try {
      await guardarPlanillaRegularidad(payload);
      enqueueSnackbar("Notas de regularidad guardadas correctamente.", { variant: "success" });
      setDefaultFechaCierre(payload.fecha_cierre ?? "");
      setDefaultObservaciones(payload.observaciones_generales ?? "");
      await fetchPlanilla(payload.comision_id);
    } catch (error: any) {
      const message =
        error?.response?.data?.message || "No se pudieron guardar las notas de regularidad.";
      enqueueSnackbar(message, { variant: "error" });
    } finally {
      setSaving(false);
    }
  };

  const handleGuardarRegularidad = async (payload: GuardarRegularidadPayload) => {
    setRegularidadPendingPayload(payload);
    setRegularidadConfirmOpen(true);
  };

  const confirmRegularidadSave = async () => {
    if (!regularidadPendingPayload) return;
    await persistRegularidad(regularidadPendingPayload);
    setRegularidadPendingPayload(null);
    setRegularidadConfirmOpen(false);
  };

  const handleRegularidadCierre = async (accion: "cerrar" | "reabrir") => {
    if (!selectedComision) return;
    setRegularidadCierreLoading(true);
    try {
      await gestionarCierreRegularidad(selectedComision.id, accion);
      enqueueSnackbar(
        accion === "cerrar" ? "Planilla cerrada correctamente." : "Planilla reabierta correctamente.",
        { variant: "success" }
      );
      await fetchPlanilla(selectedComision.id);
    } catch (error: any) {
      const message = error?.response?.data?.message || "No se pudo actualizar el estado de cierre.";
      enqueueSnackbar(message, { variant: "error" });
    } finally {
      setRegularidadCierreLoading(false);
    }
  };

  const cancelRegularidadConfirm = () => {
    if (saving) return;
    setRegularidadConfirmOpen(false);
    setRegularidadPendingPayload(null);
  };

  // --- Derived values for planilla table ---
  const filteredFinalRows = useMemo(() => {
    const term = finalSearch.trim();
    if (!term) {
      return finalRows;
    }
    const normalizedTerm = term.toLowerCase();
    const numericTerm = term.replace(/\D/g, "");
    return finalRows.filter((row) => {
      const matchesNombre = row.apellidoNombre.toLowerCase().includes(normalizedTerm);
      const dniDigits = row.dni.replace(/\D/g, "");
      const matchesDni = numericTerm ? dniDigits.includes(numericTerm) : false;
      return matchesNombre || matchesDni;
    });
  }, [finalRows, finalSearch]);

  const hasFinalSearch = finalSearch.trim().length > 0;
  const totalFinalRows = finalRows.length;
  const visibleFinalRows = filteredFinalRows.length;

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, bgcolor: "#f5f5f5", minHeight: "100vh" }}>
      <BackButton fallbackPath="/secretaria" sx={{ mb: 2 }} />
      <Stack gap={3}>
        <PageHero
          title={isFinalsMode ? "Actas de Examen Final" : "Planilla de Regularidad"}
          subtitle={
            isFinalsMode
              ? "Gestioná las mesas de examen, inscribí estudiantes y cargá las notas finales."
              : "Gestioná la planilla de regularidad y promoción de las comisiones."
          }
        />

        {!isFinalsMode && (
          <>
            <RegularidadFiltersPanel
              filters={filters}
              setFilters={setFilters}
              profesorados={profesorados}
              planes={planes}
              materias={materias}
              allComisiones={allComisiones}
              loadingProfesorados={loadingProfesorados}
              loadingPlanes={loadingPlanes}
              loadingComisiones={loadingComisiones}
              uniqueAnios={uniqueAnios}
              uniqueCuatrimestres={uniqueCuatrimestres}
              uniqueAniosCursada={uniqueAniosCursada}
              materiaOptions={materiaOptions}
              onGestionComisionesClick={() => setGestionComisionesOpen(true)}
            />

            {filters.planId && filters.materiaId && (
              <RegularidadComisionesGrid
                filteredComisiones={filteredComisiones}
                selectedComisionId={filters.comisionId}
                setFilters={setFilters}
              />
            )}

            {selectedComision ? (
              loadingPlanilla ? (
                <Paper
                  variant="outlined"
                  sx={{
                    p: 6,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <CircularProgress />
                </Paper>
              ) : planilla ? (
                <Stack spacing={2}>
                  {planilla.esta_cerrada ? (
                    <Alert severity={planilla.puede_editar ? "info" : "warning"}>
                      Planilla cerrada el{" "}
                      {planilla.cerrada_en ? new Date(planilla.cerrada_en).toLocaleString("es-AR") : "fecha desconocida"}
                      {planilla.cerrada_por ? ` por ${planilla.cerrada_por}` : ""}.
                      {!planilla.puede_editar && " Solo secretaría o admin pueden editarla o reabrirla."}
                    </Alert>
                  ) : (
                    <Alert severity="info">
                      Cuando finalices la carga, cerrá la planilla para bloquear nuevas ediciones.
                    </Alert>
                  )}
                  <RegularidadPlanillaEditor
                    comisionId={selectedComision.id}
                    planilla={planilla}
                    situaciones={planilla.situaciones}
                    defaultFechaCierre={defaultFechaCierre}
                    defaultObservaciones={defaultObservaciones}
                    saving={saving}
                    onSave={handleGuardarRegularidad}
                    readOnly={regularidadReadOnly}
                  />
                  <Box display="flex" justifyContent="flex-end" gap={1} flexWrap="wrap">
                    {planilla.puede_cerrar && (
                      <Button
                        variant="outlined"
                        sx={{
                          color: INSTITUTIONAL_TERRACOTTA,
                          borderColor: INSTITUTIONAL_TERRACOTTA,
                          '&:hover': { borderColor: INSTITUTIONAL_TERRACOTTA_DARK, bgcolor: 'rgba(183,105,78,0.05)' }
                        }}
                        onClick={() => handleRegularidadCierre("cerrar")}
                        disabled={regularidadCierreLoading}
                      >
                        {regularidadCierreLoading ? "Cerrando..." : "Cerrar planilla"}
                      </Button>
                    )}
                    {planilla.puede_reabrir && (
                      <Button
                        variant="contained"
                        onClick={() => handleRegularidadCierre("reabrir")}
                        disabled={regularidadCierreLoading}
                      >
                        {regularidadCierreLoading ? "Actualizando..." : "Reabrir planilla"}
                      </Button>
                    )}
                  </Box>
                </Stack>
              ) : (
                <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 } }}>
                  <Typography color="text.secondary">
                    No pudimos obtener la planilla de regularidad para la comisión seleccionada.
                  </Typography>
                </Paper>
              )
            ) : filters.materiaId ? (
              <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 } }}>
                <Typography color="text.secondary">
                  Seleccioná una comisión para continuar con la carga de notas.
                </Typography>
              </Paper>
            ) : null}
          </>
        )}

        {isFinalsMode && (
          <Stack gap={3}>
            <Paper sx={{ p: 3 }}>
              <Stack gap={3}>
                <FinalExamFiltersPanel
                  finalFilters={finalFilters}
                  setFinalFilters={setFinalFilters}
                  profesorados={profesorados}
                  ventanasFinales={ventanasFinales}
                  finalPlanes={finalPlanes}
                  finalMaterias={finalMaterias}
                  loadingFinalPlanes={loadingFinalPlanes}
                  loadingFinalMaterias={loadingFinalMaterias}
                  finalAvailableAnios={finalAvailableAnios}
                  finalCuatrimestreOptions={finalCuatrimestreOptions}
                  finalMateriasFiltradas={finalMateriasFiltradas}
                  finalError={finalError}
                  setFinalError={setFinalError}
                  finalSuccess={finalSuccess}
                  setFinalSuccess={setFinalSuccess}
                />

                <FinalExamMesasGrid
                  finalMesas={finalMesas}
                  finalSelectedMesaId={finalSelectedMesaId}
                  finalLoadingMesas={finalLoadingMesas}
                  finalLoadingPlanilla={finalLoadingPlanilla}
                  estadoPlanilla={finalFilters.estadoPlanilla}
                  onOpenFinalPlanilla={handleOpenFinalPlanilla}
                />

                <FinalExamPlanillaSection
                  finalPlanilla={finalPlanilla}
                  finalLoadingPlanilla={finalLoadingPlanilla}
                  finalSelectedMesaId={finalSelectedMesaId}
                  finalCondiciones={finalCondiciones}
                  finalRows={finalRows}
                  filteredFinalRows={filteredFinalRows}
                  finalReadOnly={finalReadOnly}
                  finalPermissionDenied={finalPermissionDenied}
                  finalSaving={finalSaving}
                  finalCierreLoading={finalCierreLoading}
                  finalSearch={finalSearch}
                  setFinalSearch={setFinalSearch}
                  totalFinalRows={totalFinalRows}
                  visibleFinalRows={visibleFinalRows}
                  hasFinalSearch={hasFinalSearch}
                  downloadingOralBatch={downloadingOralBatch}
                  onRowChange={handleFinalRowChange}
                  onOpenOralActa={handleOpenOralActa}
                  onFinalSaveClick={handleFinalSaveClick}
                  onFinalPlanillaCierre={handleFinalPlanillaCierre}
                  onDownloadAllOralActas={handleDownloadAllOralActas}
                />
              </Stack>
            </Paper>

            <OralActasSection />
          </Stack>
        )}
      </Stack>
      <FinalConfirmationDialog
        open={regularidadConfirmOpen}
        onConfirm={confirmRegularidadSave}
        onCancel={cancelRegularidadConfirm}
        contextText="Nuevos Registros"
        loading={saving}
      />
      <FinalConfirmationDialog
        open={finalConfirmOpen}
        onConfirm={executeGuardarFinalPlanilla}
        onCancel={cancelFinalConfirm}
        contextText="Nuevos Registros"
        loading={finalSaving}
      />
      {oralDialogRow && (
        <OralExamActaDialog
          open
          onClose={handleCloseOralActa}
          estudianteNombre={oralDialogRow.apellidoNombre}
          estudianteDni={oralDialogRow.dni}
          carrera={selectedMesaResumen?.profesorado_nombre ?? ""}
          unidadCurricular={finalPlanilla?.materia_nombre ?? selectedMesaResumen?.materia_nombre ?? ""}
          curso={selectedMesaCursoLabel}
          fechaMesa={finalPlanilla?.fecha ?? selectedMesaResumen?.fecha ?? null}
          tribunal={tribunalInfo}
          existingValues={oralActDrafts[oralDialogRow.inscripcionId]}
          defaultNota={oralDialogRow.nota}
          loading={oralActaLoading && !oralActDrafts[oralDialogRow.inscripcionId]}
          saving={oralActaSaving}
          onSave={handleSaveOralActa}
        />
      )}
      <GestionComisionesDialog
        open={gestionComisionesOpen}
        onClose={() => setGestionComisionesOpen(false)}
        materiaId={filters.materiaId ?? 0}
        anioLectivo={filters.anio ?? new Date().getFullYear()}
        materiaNombre={materias.find((m) => m.id === filters.materiaId)?.nombre ?? ""}
        planId={filters.planId ?? 0}
        anioCursada={materias.find((m) => m.id === filters.materiaId)?.anio ?? 1}
      />
    </Box>
  );
};

export default CargaNotasPage;
