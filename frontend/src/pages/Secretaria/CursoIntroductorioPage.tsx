import React from "react";
import Box from "@mui/material/Box";

import { PageHero } from "@/components/ui/GradientTitles";
import BackButton from "@/components/ui/BackButton";

import { useCursoIntroductorio } from "./curso-introductorio/useCursoIntroductorio";
import CohortesTable from "./curso-introductorio/CohortesTable";
import PendientesTable from "./curso-introductorio/PendientesTable";
import RegistrosTable from "./curso-introductorio/RegistrosTable";
import CohorteDialog from "./curso-introductorio/CohorteDialog";
import InscribirDialog from "./curso-introductorio/InscribirDialog";
import AsistenciaDialog from "./curso-introductorio/AsistenciaDialog";
import CierreDialog from "./curso-introductorio/CierreDialog";

const CursoIntroductorioPage: React.FC = () => {
  const {
    // data
    profesorados,
    turnos,
    cohortes,
    cohortesLoading,
    ventanas,
    ventanasLoading,
    pendientes,
    pendientesLoading,
    pendientesProfesoradoId,
    setPendientesProfesoradoId,
    registros,
    registrosLoading,
    registroFiltros,
    setRegistroFiltros,
    cohorteOptions,
    anioOptions,
    // permissions
    puedeGestionarCohortes,
    puedeGestionarRegistros,
    // cohorte dialog
    cohorteDialogOpen,
    cohorteForm,
    setCohorteForm,
    editingCohorteId,
    savingCohorte,
    creatingCohortesTurnos,
    cohorteAccionBloqueada,
    abrirDialogoCohorte,
    cerrarDialogoCohorte,
    handleGuardarCohorte,
    handleCrearCohortesTodosTurnos,
    // inscripción dialog
    inscribirDialogOpen,
    pendienteSeleccionado,
    inscribirForm,
    setInscribirForm,
    inscribiendo,
    abrirDialogoInscripcion,
    cerrarDialogoInscripcion,
    handleInscribir,
    // asistencia dialog
    asistenciaDialogOpen,
    asistenciaValor,
    setAsistenciaValor,
    guardandoAsistencia,
    abrirDialogoAsistencia,
    cerrarDialogoAsistencia,
    handleGuardarAsistencia,
    // cierre dialog
    cierreDialogOpen,
    cierreForm,
    setCierreForm,
    guardandoCierre,
    abrirDialogoCierre,
    cerrarDialogoCierre,
    handleGuardarCierre,
    // loaders
    loadRegistros,
  } = useCursoIntroductorio();

  return (
    <Box sx={{ p: 3 }}>
      <BackButton fallbackPath="/secretaria" />
      <PageHero
        title="Curso introductorio"
        subtitle="Gestioná cohortes, asistencias y resultados del Curso Introductorio."
      />

      <CohortesTable
        cohortes={cohortes}
        cohortesLoading={cohortesLoading}
        puedeGestionarCohortes={puedeGestionarCohortes}
        onNuevaCohorte={() => abrirDialogoCohorte()}
        onEditarCohorte={(cohorte) => abrirDialogoCohorte(cohorte)}
      />

      <PendientesTable
        profesorados={profesorados}
        pendientes={pendientes}
        pendientesLoading={pendientesLoading}
        pendientesProfesoradoId={pendientesProfesoradoId}
        puedeGestionarRegistros={puedeGestionarRegistros}
        cohortesDisponibles={cohortes.length > 0}
        onChangePendientesProfesorado={setPendientesProfesoradoId}
        onInscribir={abrirDialogoInscripcion}
      />

      <RegistrosTable
        profesorados={profesorados}
        turnos={turnos}
        registros={registros}
        registrosLoading={registrosLoading}
        registroFiltros={registroFiltros}
        cohorteOptions={cohorteOptions}
        anioOptions={anioOptions}
        puedeGestionarRegistros={puedeGestionarRegistros}
        onChangeFiltros={setRegistroFiltros}
        onActualizar={loadRegistros}
        onAsistencia={abrirDialogoAsistencia}
        onCierre={abrirDialogoCierre}
      />

      <CohorteDialog
        open={cohorteDialogOpen}
        editingCohorteId={editingCohorteId}
        cohorteForm={cohorteForm}
        setCohorteForm={setCohorteForm}
        cohorteAccionBloqueada={cohorteAccionBloqueada}
        savingCohorte={savingCohorte}
        creatingCohortesTurnos={creatingCohortesTurnos}
        profesorados={profesorados}
        turnos={turnos}
        ventanas={ventanas}
        ventanasLoading={ventanasLoading}
        onCancelar={cerrarDialogoCohorte}
        onGuardar={handleGuardarCohorte}
        onCrearTodosTurnos={handleCrearCohortesTodosTurnos}
      />

      <InscribirDialog
        open={inscribirDialogOpen}
        pendienteSeleccionado={pendienteSeleccionado}
        inscribirForm={inscribirForm}
        setInscribirForm={setInscribirForm}
        inscribiendo={inscribiendo}
        cohorteOptions={cohorteOptions}
        turnos={turnos}
        onCancelar={cerrarDialogoInscripcion}
        onConfirmar={handleInscribir}
      />

      <AsistenciaDialog
        open={asistenciaDialogOpen}
        asistenciaValor={asistenciaValor}
        guardandoAsistencia={guardandoAsistencia}
        onChangeAsistencia={setAsistenciaValor}
        onCancelar={cerrarDialogoAsistencia}
        onGuardar={handleGuardarAsistencia}
      />

      <CierreDialog
        open={cierreDialogOpen}
        cierreForm={cierreForm}
        setCierreForm={setCierreForm}
        guardandoCierre={guardandoCierre}
        onCancelar={cerrarDialogoCierre}
        onGuardar={handleGuardarCierre}
      />
    </Box>
  );
};

export default CursoIntroductorioPage;
