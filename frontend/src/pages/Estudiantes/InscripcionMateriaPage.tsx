import React from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";
import BackButton from "@/components/ui/BackButton";
import FinalConfirmationDialog from "@/components/ui/FinalConfirmationDialog";

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
    aprobadasFiltradas,
    inscriptasDetalle,
    // mutation state
    mInscribir,
    pendingMateriaId,
    mCancelar,
    cancelarVars,
    // handlers
    handleAnioChange,
    handleCarreraChange,
    handlePlanChange,
    handleInscribir,
    confirmInscripcion,
    cancelInscripcionConfirm,
    handleCancelar,
  } = useInscripcionMateria();

  if (loadingEstudiante || isVentanaLoading) {
    return <Skeleton variant="rectangular" height={160} />;
  }

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

          <MateriasHabilitadasPanel
            habilitadasPorAnio={habilitadasPorAnio}
            puedeInscribirse={puedeInscribirse}
            mInscribirIsPending={mInscribir.isPending}
            pendingMateriaId={pendingMateriaId}
            onInscribir={handleInscribir}
          />

          <MateriasBloqueadasAccordion
            bloqueadasPorTipo={bloqueadasPorTipo}
            aprobadasFiltradas={aprobadasFiltradas}
          />

          <MateriasInscriptasPanel
            inscriptasDetalle={inscriptasDetalle}
            ventanaActiva={ventanaActiva}
            mCancelarIsPending={mCancelar.isPending}
            cancelarVars={cancelarVars}
            onCancelar={handleCancelar}
          />
        </Stack>
      </Box>

      <FinalConfirmationDialog
        open={confirmInscripcionOpen}
        onConfirm={confirmInscripcion}
        onCancel={cancelInscripcionConfirm}
        contextText="Nuevos Registros"
        loading={mInscribir.isPending}
      />
    </>
  );
};

export default InscripcionMateriaPage;
