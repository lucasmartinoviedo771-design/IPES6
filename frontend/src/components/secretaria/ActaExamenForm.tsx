import React from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

import OralExamActaDialog from "@/components/secretaria/OralExamActaDialog";
import FinalConfirmationDialog from "@/components/ui/FinalConfirmationDialog";

import { ActaExamenFormProps } from './acta-examen-form/types';
import { useActaExamenForm } from './acta-examen-form/useActaExamenForm';
import { BuscarMesaSection } from './acta-examen-form/BuscarMesaSection';
import { EncabezadoActaSection } from './acta-examen-form/EncabezadoActaSection';
import { TribunalSection } from './acta-examen-form/TribunalSection';
import { ResultadosTable } from './acta-examen-form/ResultadosTable';

const ActaExamenForm: React.FC<ActaExamenFormProps> = ({
  strict = true,
  title = "Generar acta de examen",
  subtitle = "Complete los datos del acta y registre los resultados obtenidos por cada estudiante.",
  successMessage = "Acta generada correctamente.",
  initialEstudiantes = [],
  headerAction,
  editId,
}) => {
  const f = useActaExamenForm({ strict, successMessage, editId });

  if (f.metadataQuery.isLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
        <CircularProgress />
      </Box>
    );
  }

  if (f.metadataQuery.isError || !f.metadata) {
    return (
      <Alert severity="error">
        No se pudo cargar la información inicial para generar actas de examen.
      </Alert>
    );
  }

  return (
    <>
      <Stack spacing={3} sx={{ p: { xs: 1, md: 3 } }}>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={2}>
          <Box>
            <Typography variant="h4" fontWeight={700}>{title}</Typography>
            <Typography color="text.secondary">{subtitle}</Typography>
          </Box>
          {headerAction && <Box>{headerAction}</Box>}
        </Stack>

        <BuscarMesaSection
          mesaCodigo={f.mesaCodigo}
          setMesaCodigo={f.setMesaCodigo}
          mesaBuscando={f.mesaBuscando}
          mesaBusquedaError={f.mesaBusquedaError}
          mesaSeleccionada={f.mesaSeleccionada}
          onBuscar={f.handleBuscarMesa}
        />

        <EncabezadoActaSection
          tipo={f.tipo}
          setTipo={f.setTipo}
          profesoradoId={f.profesoradoId}
          setProfesoradoId={f.setProfesoradoId}
          setPlanId={f.setPlanId}
          setMateriaId={f.setMateriaId}
          profesorados={f.profesorados}
          planesDisponibles={f.planesDisponibles}
          planId={f.planId}
          setPlanId2={f.setPlanId2}
          selectedProfesorado={f.selectedProfesorado}
          materiasDisponibles={f.materiasDisponibles}
          materiaId={f.materiaId}
          selectedPlan={f.selectedPlan}
          fecha={f.fecha}
          setFecha={f.setFecha}
          folio={f.folio}
          setFolio={f.setFolio}
          libro={f.libro}
          setLibro={f.setLibro}
          observaciones={f.observaciones}
          setObservaciones={f.setObservaciones}
        />

        <TribunalSection
          docentes={f.docentes}
          docenteOptions={f.docenteOptions}
          onDocenteInputChange={f.handleDocenteInputChange}
        />

        <ResultadosTable
          estudiantes={f.estudiantes}
          notaOptions={f.notaOptions}
          loadingEstudianteDni={f.loadingEstudianteDni}
          initialEstudiantes={initialEstudiantes}
          estudiantesMetadata={f.metadata?.estudiantes ?? []}
          strict={strict}
          summary={f.summary}
          onAgregar={f.handleAgregarEstudiante}
          onEliminar={f.handleEliminarEstudiante}
          onDniChange={f.handleEstudianteDniChange}
          onUpdateEstudiante={f.updateEstudiante}
          onOpenOralActa={f.handleOpenOralActa}
        />

        <Stack direction="row" justifyContent="flex-end">
          <Button
            variant="contained"
            size="large"
            onClick={f.handleSubmit}
            disabled={f.isSaving}
            startIcon={f.isSaving ? <CircularProgress size={18} color="inherit" /> : undefined}
          >
            {f.isSaving
              ? (f.isEditing ? "Actualizando..." : "Generando...")
              : (f.isEditing ? "Actualizar acta" : "Generar acta")}
          </Button>
        </Stack>
      </Stack>

      {f.oralDialogEstudiante && (
        <OralExamActaDialog
          open
          onClose={() => f.setOralDialogEstudiante(null)}
          estudianteNombre={f.oralDialogEstudiante.apellido_nombre || "Estudiante/a"}
          estudianteDni={f.oralDialogEstudiante.dni || "-"}
          carrera={f.selectedProfesorado?.nombre ?? ""}
          unidadCurricular={f.selectedMateria?.nombre ?? ""}
          curso={f.mesaSeleccionada?.codigo ?? ""}
          fechaMesa={f.fecha}
          tribunal={f.tribunalInfo}
          existingValues={f.oralActDrafts[f.oralDialogEstudiante.internoId]}
          defaultNota={f.oralDialogEstudiante.calificacion_definitiva}
          loading={false}
          saving={false}
          onSave={f.handleSaveOralActa}
        />
      )}

      <FinalConfirmationDialog
        open={f.confirmActaOpen}
        onConfirm={f.handleConfirmActaSubmit}
        onCancel={f.handleCancelActaSubmit}
        contextText={f.confirmActaContext}
        loading={f.isSaving}
      />
    </>
  );
};

export default ActaExamenForm;
