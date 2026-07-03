import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import BackButton from "@/components/ui/BackButton";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
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
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  ComisionOptionDTO,
  GuardarRegularidadPayload,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  MateriaOptionDTO,
  RegularidadPlanillaDTO,
  guardarPlanillaRegularidad,
  gestionarCierreRegularidad,
  obtenerPlanillaRegularidad,
} from "@/api/cargaNotas";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import RegularidadPlanillaEditor from "@/components/secretaria/RegularidadPlanillaEditor";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import OralExamActaDialog, { OralActFormValues } from "@/components/secretaria/OralExamActaDialog";
import { PageHero } from "@/components/ui/GradientTitles";
import FinalConfirmationDialog from "@/components/ui/FinalConfirmationDialog";
import GestionComisionesDialog from "./components/GestionComisionesDialog";
import { INSTITUTIONAL_TERRACOTTA, INSTITUTIONAL_TERRACOTTA_DARK } from "@/styles/institutionalColors";
import PlanillaRegularidadDialog from "@/pages/admin/PlanillaRegularidadDialog";
import AssignmentIcon from "@mui/icons-material/Assignment";
import ActaExamenForm from "@/components/secretaria/ActaExamenForm";

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

const CargaNotasPage: React.FC = () => {
  const { roleOverride, user } = useAuth();
  const activeRole = (roleOverride ?? (user?.roles?.[0] ?? "")).toLowerCase();
  const isDocente = activeRole === "docente";

  // Para docentes, forzar siempre filtro de planillas abiertas
  React.useEffect(() => {
    if (isDocente) {
      setFinalFilters(prev => ({ ...prev, estadoPlanilla: "ABIERTAS" }));
    }
  }, [isDocente]);

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
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const navigate = useNavigate();
  const scope = searchParams.get("scope");
  const isFinalsMode = scope === "finales";

  const [loadingPlanilla, setLoadingPlanilla] = useState(false);
  const [saving, setSaving] = useState(false);
  const [regularidadConfirmOpen, setRegularidadConfirmOpen] = useState(false);
  const [regularidadPendingPayload, setRegularidadPendingPayload] = useState<GuardarRegularidadPayload | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [regularidadCierreLoading, setRegularidadCierreLoading] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [defaultFechaCierre, setDefaultFechaCierre] = useState<string>(() =>
    new Date().toISOString().slice(0, 10)
  );
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [defaultObservaciones, setDefaultObservaciones] = useState<string>("");
  const [gestionComisionesOpen, setGestionComisionesOpen] = useState(false);
  const [planillaOpen, setPlanillaOpen] = useState(false);

  const [finalFilters, setFinalFilters] = useState<FinalFiltersState>({
    ventanaId: "",
    tipo: "FIN",
    modalidad: "REG",
    profesoradoId: null,
    planId: null,
    materiaId: null,
    anio: null,
    cuatrimestre: null,
    estadoPlanilla: "ABIERTAS",
    anioMesa: null,
  });

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
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    setFinalSelectedMesaId,
    finalPlanilla,
    setFinalPlanilla,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    handleFinalRowChange,
    handleOpenFinalPlanilla,
    selectedMesaResumen,
    selectedMesaCursoLabel,
    tribunalInfo,
  } = useFinalExamPlanilla(finalFilters, isFinalsMode);

  // --- Final Exam Persist Hook ---
  const {
    finalSaving,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    finalCierreLoading,
    finalConfirmOpen,
    finalSuccess,
    setFinalSuccess,
    handleFinalSaveClick: handleFinalSaveClickBase,
    executeGuardarFinalPlanilla,
    cancelFinalConfirm,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
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

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleFinalSaveClick = () => handleFinalSaveClickBase(finalPermissionDenied);

  // --- Oral Exam Acta Hook ---
  const {
    oralActDrafts,
    oralDialogRow,
    oralActaLoading,
    oralActaSaving,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    downloadingOralBatch,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    handleOpenOralActa,
    handleCloseOralActa,
    handleSaveOralActa,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    handleDownloadAllOralActas,
  } = useOralExamActa(
    finalSelectedMesaId,
    finalReadOnly,
  );

  // --- Regularidad state and handlers ---
  const selectedComision = useMemo(
    () => filteredComisiones.find((c) => c.id === filters.comisionId) || null,
    [filteredComisiones, filters.comisionId]
  );
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const regularidadReadOnly = planilla ? !planilla.puede_editar : false;

  const fetchPlanilla = useCallback(
    async (comisionId: number) => {
      setLoadingPlanilla(true);
      try {
        const data = await obtenerPlanillaRegularidad(comisionId);
        setPlanilla(data);
        setDefaultFechaCierre(new Date().toISOString().slice(0, 10));
        setDefaultObservaciones("");
      } catch (_error) {
        setPlanilla(null);
        enqueueSnackbar("No se pudo cargar la planilla de regularidad.", { variant: "error" });
      } finally {
        setLoadingPlanilla(false);
      }
    },
    [enqueueSnackbar]  // eslint-disable-line react-hooks/exhaustive-deps
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      const message =
        error?.response?.data?.message || "No se pudieron guardar las notas de regularidad.";
      enqueueSnackbar(message, { variant: "error" });
    } finally {
      setSaving(false);
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
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

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
                <Paper
                  variant="outlined"
                  sx={{
                    p: { xs: 4, md: 6 },
                    borderRadius: 4,
                    border: '1px solid rgba(183,105,78,0.2)',
                    background: 'linear-gradient(to bottom, #ffffff, #fafafa)',
                    boxShadow: '0 10px 30px rgba(0,0,0,0.04)',
                  }}
                >
                  <Stack spacing={3} alignItems="center" textAlign="center">
                    <Box
                      sx={{
                        width: 72,
                        height: 72,
                        borderRadius: "50%",
                        bgcolor: "rgba(183,105,78,0.08)",
                        color: INSTITUTIONAL_TERRACOTTA,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        boxShadow: '0 6px 15px rgba(183,105,78,0.1)',
                      }}
                    >
                      <AssignmentIcon sx={{ fontSize: 36 }} />
                    </Box>
                    <Box>
                      <Typography variant="h5" fontWeight={700} color="text.primary">
                        Planilla de Regularidad y Promoción Oficial
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 500, mt: 1.5, lineHeight: 1.6 }}>
                        Utilizá el editor oficial emergente para registrar calificaciones de trabajos prácticos, parciales, asistencia y situaciones académicas finales según el reglamento institucional. La lista de estudiantes activos se auto-completa automáticamente.
                      </Typography>
                    </Box>
                    <Button
                      variant="contained"
                      size="large"
                      sx={{
                        borderRadius: 999,
                        px: 5,
                        py: 1.8,
                        fontSize: "0.95rem",
                        fontWeight: 600,
                        backgroundColor: INSTITUTIONAL_TERRACOTTA,
                        boxShadow: '0 8px 20px rgba(183,105,78,0.3)',
                        transition: 'all 0.2s ease-in-out',
                        '&:hover': {
                          transform: 'translateY(-2px)',
                          boxShadow: '0 10px 25px rgba(183,105,78,0.4)',
                          backgroundColor: INSTITUTIONAL_TERRACOTTA_DARK,
                        }
                      }}
                      onClick={() => setPlanillaOpen(true)}
                    >
                      Cargar / Editar Planilla de Regularidad
                    </Button>
                  </Stack>
                </Paper>
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
                {!isDocente && (
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
                    hideEstadoFilter={isDocente}
                  />
                )}

                <FinalExamMesasGrid
                  finalMesas={finalMesas}
                  finalSelectedMesaId={finalSelectedMesaId}
                  finalLoadingMesas={finalLoadingMesas}
                  finalLoadingPlanilla={finalLoadingPlanilla}
                  estadoPlanilla={finalFilters.estadoPlanilla}
                  onOpenFinalPlanilla={handleOpenFinalPlanilla}
                />

              </Stack>
            </Paper>

            {finalSelectedMesaId && (
              <Stack gap={3}>
                <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 } }}>
                  <ActaExamenForm
                    strict={!isDocente}
                    title={isDocente ? "Carga de calificaciones de mesa" : "Generar acta de examen"}
                    subtitle={isDocente ? "Complete las notas del examen final para los alumnos inscriptos." : undefined}
                    mesaPreseleccionada={selectedMesaResumen}
                    estudiantesPreseleccionados={finalRows.map((r) => ({
                      dni: r.dni,
                      apellido_nombre: r.apellidoNombre,
                      inscripcionId: r.inscripcionId,
                    }))}
                    editId={finalPlanilla?.acta_id || undefined}
                  />
                </Paper>
              </Stack>
            )}
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
          mesaId={finalSelectedMesaId ?? undefined}
          inscripcionId={oralDialogRow.inscripcionId}
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
      <PlanillaRegularidadDialog
        open={planillaOpen}
        onClose={() => setPlanillaOpen(false)}
        defaultProfesoradoId={filters.profesoradoId ?? undefined}
        defaultMateriaId={filters.materiaId ?? undefined}
        scope="standard"
        comisionId={filters.comisionId ?? undefined}
      />
    </Box>
  );
};

export default CargaNotasPage;
