import React, { useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
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
                '& .Mui-selected': { color: '#8b4513' },
                '& .MuiTabs-indicator': { backgroundColor: '#8b4513' }
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
               {/* Integrando las ya inscriptas dentro de la pestaña activa como solicitaste */}
               <MateriasInscriptasPanel
                inscriptasDetalle={inscriptasDetalle}
                ventanaActiva={ventanaActiva}
                mCancelarIsPending={mCancelar.isPending}
                cancelarVars={cancelarVars}
                onCancelar={handleCancelar}
                onBaja={handleBaja}
                mBajaIsPending={mBaja.isPending}
              />
              
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
                inscripta: [], // No mostramos inscriptas aquí porque están en la Tab 0
                periodo: [],   // No mostramos periodo aquí porque están en la Tab 2
                otro: bloqueadasPorTipo.otro
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
                otro: []
              }}
              aprobadasFiltradas={[]}
              customTitle="Materias fuera de período de inscripción"
            />
          )}

          {tabValue === 3 && (
            <MateriasBloqueadasAccordion
              bloqueadasPorTipo={{
                 correlativas: [], choque: [], inscripta: [], periodo: [], otro: []
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
    </>
  );
};

export default InscripcionMateriaPage;
