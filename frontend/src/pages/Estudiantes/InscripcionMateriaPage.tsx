import React, { useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import Typography from "@mui/material/Typography";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import BackButton from "@/components/ui/BackButton";
import FinalConfirmationDialog from "@/components/ui/FinalConfirmationDialog";
import { aceptarResidenciaCondicional } from "@/api/estudiantes/inscripcion";
import type { MateriaEvaluada } from "./inscripcion-materia/types";

import { useQueryClient } from "@tanstack/react-query";
import { useInscripcionMateria } from "./inscripcion-materia/useInscripcionMateria";
import PageHeader from "./inscripcion-materia/PageHeader";
import MateriasHabilitadasPanel from "./inscripcion-materia/MateriasHabilitadasPanel";
import MateriasBloqueadasAccordion from "./inscripcion-materia/MateriasBloqueadasAccordion";
import MateriasInscriptasPanel from "./inscripcion-materia/MateriasInscriptasPanel";

const InscripcionMateriaPage: React.FC = () => {
  const {
    // state
    dniInput,
    setDniInput,
    dniFiltro,
    setDniFiltro,
    anioFiltro,
    selectedCarreraId,
    selectedPlanId,
    info,
    err,
    confirmInscripcionOpen,
    // computed
    puedeGestionar,
    shouldFetchInscriptas,
    requiereSeleccionEstudiante,
    carrerasDisponibles,
    planesDisponibles,
    aniosDisponibles,
    ventana,
    ventanaActiva,
    puedeInscribirse,
    periodoLabel,
    profesoradoNombre,
    queryError,
    loadingEstudiante,
    isVentanaLoading,
    // evaluated data
    habilitadasPorAnio,
    bloqueadasPorTipo,
    materiasCondicionales,
    aprobadasFiltradas,
    inscriptasDetalle,
    // mutation state
    mInscribir,
    pendingMateriaId,
    mCancelar,
    cancelarVars,
    mBaja,
    // handlers
    handleAnioChange,
    handleCarreraChange,
    handlePlanChange,
    handleInscribir,
    confirmInscripcion,
    cancelInscripcionConfirm,
    handleCancelar,
    handleBaja,
  } = useInscripcionMateria();

  const [tabValue, setTabValue] = useState(0);
  const [condicionalPendiente, setCondicionalPendiente] = useState<MateriaEvaluada | null>(null);
  const [condicionalLoading, setCondicionalLoading] = useState(false);
  const [condicionalError, setCondicionalError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const handleAceptarCondicional = async () => {
    if (!condicionalPendiente) return;
    const faltanteId = condicionalPendiente.pendienteId;
    if (!faltanteId) return;
    setCondicionalLoading(true);
    setCondicionalError(null);
    try {
      await aceptarResidenciaCondicional({
        materia_residencia_id: condicionalPendiente.id,
        materia_pendiente_id: faltanteId,
        ...(dniFiltro ? { dni: dniFiltro } : {}),
      });
      setCondicionalPendiente(null);
      await queryClient.invalidateQueries({ queryKey: ["historial-estudiante"] });
      await queryClient.invalidateQueries({ queryKey: ["materias-inscriptas"] });
      await queryClient.invalidateQueries({ queryKey: ["carreras-activas"] });
      await queryClient.invalidateQueries({ queryKey: ["materias-plan"] });
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setCondicionalError(msg || "Error al registrar la inscripción condicional.");
    } finally {
      setCondicionalLoading(false);
    }
  };

  if (loadingEstudiante || isVentanaLoading) {
    return <Skeleton variant="rectangular" height={160} />;
  }

  const handleTabChange = (_: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  return (
    <>
      <Box sx={{ p: 3, bgcolor: "#f9f5ea", minHeight: "100vh" }}>
        <Stack spacing={3} maxWidth={1180} mx="auto">
          <BackButton fallbackPath="/estudiantes" />

          <PageHeader
            profesoradoNombre={profesoradoNombre}
            periodoLabel={periodoLabel}
            ventana={ventana}
            puedeInscribirse={puedeInscribirse}
            isVentanaLoading={isVentanaLoading}
            puedeGestionar={puedeGestionar}
            dniInput={dniInput}
            dniFiltro={dniFiltro}
            setDniInput={setDniInput}
            setDniFiltro={setDniFiltro}
            anioFiltro={anioFiltro}
            aniosDisponibles={aniosDisponibles}
            handleAnioChange={handleAnioChange}
            shouldFetchInscriptas={shouldFetchInscriptas}
            carrerasDisponibles={carrerasDisponibles}
            selectedCarreraId={selectedCarreraId}
            handleCarreraChange={handleCarreraChange}
            planesDisponibles={planesDisponibles}
            selectedPlanId={selectedPlanId}
            handlePlanChange={handlePlanChange}
          />

          {requiereSeleccionEstudiante && (
            <Alert severity="info">
              Ingresa un DNI para gestionar inscripciones de otro estudiante.
            </Alert>
          )}

          {queryError && (
            <Alert severity="error">
              No se pudieron cargar los datos de inscripción. Verifica el DNI e intenta nuevamente.
            </Alert>
          )}

          {err && <Alert severity="error">{err}</Alert>}
          {info && <Alert severity="success">{info}</Alert>}

          <Box sx={{ borderBottom: 1, borderColor: 'divider', mt: 2 }}>
            <Tabs 
              value={tabValue} 
              onChange={handleTabChange} 
              aria-label="Categorías de inscripción"
              variant="scrollable"
              scrollButtons="auto"
              sx={{
                '& .MuiTab-root': { fontWeight: 600, fontSize: '0.95rem', textTransform: 'none' },
                '& .Mui-selected': { color: '#B7694E' },
                '& .MuiTabs-indicator': { backgroundColor: '#B7694E' }
              }}
            >
              <Tab label="Inscripción Abierta" />
              <Tab label="Pendientes por Correlativa" />
              <Tab label="Oferta Futura / Otros Periodos" />
              <Tab label="Historia Académica" />
            </Tabs>
          </Box>

          {tabValue === 0 && (
            <Stack spacing={3}>
               <MateriasInscriptasPanel
                inscriptasDetalle={inscriptasDetalle}
                ventanaActiva={ventanaActiva}
                mCancelarIsPending={mCancelar.isPending}
                cancelarVars={cancelarVars}
                onCancelar={handleCancelar}
                onBaja={handleBaja}
                mBajaIsPending={mBaja.isPending}
              />

              {/* Residencias con inscripción condicional disponible */}
              {materiasCondicionales.length > 0 && (
                <Box>
                  <Alert severity="warning" icon={<WarningAmberIcon />} sx={{ mb: 2 }}>
                    Las siguientes materias de Residencia admiten inscripción <strong>condicional</strong>.
                    Adeudás una materia que debés aprobar en las mesas extraordinarias de mayo.
                  </Alert>
                  <Stack spacing={1.5}>
                    {materiasCondicionales.map((mat) => (
                      <Card key={mat.id} variant="outlined" sx={{ borderColor: "#e6a817", bgcolor: "#fffbf0" }}>
                        <CardContent sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", py: 1.5, "&:last-child": { pb: 1.5 } }}>
                          <Box>
                            <Typography fontWeight={600}>{mat.nombre}</Typography>
                            <Typography variant="body2" color="text.secondary">
                              {mat.motivos[0]}
                            </Typography>
                          </Box>
                          <Stack direction="row" spacing={1} alignItems="center">
                            <Chip label="Condicional" color="warning" size="small" />
                            <Button
                              variant="contained"
                              size="small"
                              disabled={!puedeInscribirse}
                              onClick={() => setCondicionalPendiente(mat)}
                              sx={{ bgcolor: "#e6a817", "&:hover": { bgcolor: "#c88c00" } }}
                            >
                              Inscribirme
                            </Button>
                          </Stack>
                        </CardContent>
                      </Card>
                    ))}
                  </Stack>
                </Box>
              )}

              <MateriasHabilitadasPanel
                habilitadasPorAnio={habilitadasPorAnio}
                puedeInscribirse={puedeInscribirse}
                mInscribirIsPending={mInscribir.isPending}
                pendingMateriaId={pendingMateriaId}
                onInscribir={handleInscribir}
              />
            </Stack>
          )}

          {tabValue === 1 && (
            <MateriasBloqueadasAccordion
              bloqueadasPorTipo={{
                correlativas: bloqueadasPorTipo.correlativas,
                choque: bloqueadasPorTipo.choque,
                inscripta: [],
                periodo: [],
                otro: bloqueadasPorTipo.otro,
                condicional_residencia: [],
              }}
              aprobadasFiltradas={[]}
            />
          )}

          {tabValue === 2 && (
            <MateriasBloqueadasAccordion
              bloqueadasPorTipo={{
                correlativas: [],
                choque: [],
                inscripta: [],
                periodo: bloqueadasPorTipo.periodo,
                otro: [],
                condicional_residencia: [],
              }}
              aprobadasFiltradas={[]}
              customTitle="Materias fuera de período de inscripción"
            />
          )}

          {tabValue === 3 && (
            <MateriasBloqueadasAccordion
              bloqueadasPorTipo={{
                correlativas: [], choque: [], inscripta: [], periodo: [], otro: [], condicional_residencia: []
              }}
              aprobadasFiltradas={aprobadasFiltradas}
              customTitle="Trayectoria de materias aprobadas"
            />
          )}
        </Stack>
      </Box>

      <FinalConfirmationDialog
        open={confirmInscripcionOpen}
        onConfirm={confirmInscripcion}
        onCancel={cancelInscripcionConfirm}
        contextText="Nuevos Registros"
        loading={mInscribir.isPending}
      />

      {/* Modal de confirmación para inscripción condicional de Residencia */}
      <Dialog open={!!condicionalPendiente} onClose={() => !condicionalLoading && setCondicionalPendiente(null)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1, color: "#b45309" }}>
          <WarningAmberIcon /> Inscripción condicional a Residencia
        </DialogTitle>
        <DialogContent>
          {condicionalPendiente && (
            <Stack spacing={2}>
              <Typography>
                Tu inscripción a <strong>{condicionalPendiente.nombre}</strong> es <strong>condicional</strong>.
              </Typography>
              <Alert severity="warning">
                Adeudás <strong>{condicionalPendiente.motivos[0]?.replace("Podés inscribirte condicionalmente. Adeudás: ", "")}</strong>.
                Tenés hasta las mesas extraordinarias de <strong>mayo</strong> para aprobarla (fecha límite: <strong>01/06/{new Date().getFullYear()}</strong>).
              </Alert>
              <Typography color="error.main" fontWeight={600}>
                Si al 01/06 no aprobás esa materia, tu cursada de Residencia caerá automáticamente.
              </Typography>
              {condicionalError && <Alert severity="error">{condicionalError}</Alert>}
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setCondicionalPendiente(null)} disabled={condicionalLoading}>
            No, cancelar
          </Button>
          <Button
            variant="contained"
            onClick={handleAceptarCondicional}
            disabled={condicionalLoading}
            sx={{ bgcolor: "#e6a817", "&:hover": { bgcolor: "#c88c00" } }}
          >
            {condicionalLoading ? "Registrando..." : "Sí, acepto la condición"}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default InscripcionMateriaPage;
