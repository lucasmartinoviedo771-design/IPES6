import React from 'react';
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Button from "@mui/material/Button";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import FormControlLabel from "@mui/material/FormControlLabel";
import Checkbox from "@mui/material/Checkbox";
import Divider from "@mui/material/Divider";
import CircularProgress from "@mui/material/CircularProgress";
import Alert from "@mui/material/Alert";
import Chip from "@mui/material/Chip";

import { PlanillaRegularidadDialogProps } from './planilla-regularidad/types';
import { useRegularidadMetadata } from './planilla-regularidad/hooks/useRegularidadMetadata';
import { usePlanillaForm } from './planilla-regularidad/hooks/usePlanillaForm';
import { usePlanillaHistorial } from './planilla-regularidad/hooks/usePlanillaHistorial';
import { HeaderFields } from './planilla-regularidad/components/HeaderFields';
import { DocentesSection } from './planilla-regularidad/components/DocentesSection';
import { HistorialPanel } from './planilla-regularidad/components/HistorialPanel';
import { FilasTable } from './planilla-regularidad/components/FilasTable';

const PlanillaRegularidadDialog: React.FC<PlanillaRegularidadDialogProps> = ({
  open,
  onClose,
  onCreated,
  planillaId,
  mode = 'create'
}) => {
  const isReadOnly = mode === 'view';

  const [crossLoadEnabled, setCrossLoadEnabled] = React.useState(false);

  // --- Watchers intermedios para pasar a metadata hook ---
  // Se inicializan con valores vacíos; el hook de form los proveerá vía watch
  const [watchedIds, setWatchedIds] = React.useState({
    profesoradoId: '' as number | '',
    materiaId: '' as number | '',
    plantillaId: '' as number | '',
  });

  const metadata = useRegularidadMetadata({
    open,
    crossLoadEnabled,
    profesoradoId: watchedIds.profesoradoId,
    materiaId: watchedIds.materiaId,
    plantillaId: watchedIds.plantillaId,
  });

  const form = usePlanillaForm({
    open,
    onClose,
    onCreated,
    planillaId,
    mode,
    selectedProfesorado: metadata.selectedProfesorado,
    selectedMateria: metadata.selectedMateria,
    selectedPlantilla: metadata.selectedPlantilla,
    columnasDinamicas: metadata.columnasDinamicas,
    situacionesDisponibles: metadata.situacionesDisponibles,
    plantillasDisponibles: metadata.plantillasDisponibles,
    estudiantePorDni: metadata.estudiantePorDni,
    metadataQueryRefetch: metadata.metadataQuery.refetch,
  });

  const historial = usePlanillaHistorial({
    open,
    replaceFilas: form.replaceFilas,
  });

  // Sincronizamos los ids vigilados con el formulario
  const profesoradoId = form.watch('profesoradoId');
  const materiaId = form.watch('materiaId');
  const plantillaId = form.watch('plantillaId');
  const docentesForm = form.watch('docentes');

  React.useEffect(() => {
    setWatchedIds({ profesoradoId, materiaId, plantillaId });
  }, [profesoradoId, materiaId, plantillaId]);

  // previewCodigo necesita la fecha también
  const fechaSeleccionada = form.watch('fecha');
  const previewCodigo = React.useMemo(() => {
    if (!metadata.selectedProfesorado || !fechaSeleccionada) return null;
    const day = fechaSeleccionada.replace(/-/g, '');
    return `PRP${String(metadata.selectedProfesorado.id).padStart(2, '0')}${metadata.selectedProfesorado.acronimo}${day}XXX`;
  }, [metadata.selectedProfesorado, fechaSeleccionada]);

  return (
    <Dialog
      open={open}
      onClose={(event, reason) => {
        if (reason && reason === 'backdropClick') return;
        onClose();
      }}
      disableEscapeKeyDown
      maxWidth={false}
      scroll="paper"
      PaperProps={{
        sx: {
          width: '90vw',
          maxWidth: 'none',
          minWidth: '960px',
          minHeight: '70vh',
          resize: 'both',
          overflow: 'auto',
        },
      }}
    >
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pb: 1 }}>
        <Typography variant="h6" fontWeight={700}>
          {mode === 'view' ? 'Ver Planilla de Regularidad' : mode === 'edit' ? 'Editar Planilla de Regularidad' : 'Generar planilla de regularidad / promoción'}
        </Typography>
        {mode !== 'create' && <Chip label={`MODO: ${mode.toUpperCase()}`} color={mode === 'view' ? 'info' : 'primary'} size="small" variant="filled" />}
      </DialogTitle>
      <DialogContent dividers sx={{ position: 'relative' }}>
        {(form.detailQuery.isLoading || metadata.metadataQuery.isLoading) && (
          <Box sx={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, bgcolor: 'rgba(255,255,255,0.7)', zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CircularProgress size={60} thickness={4} />
          </Box>
        )}
        {metadata.metadataQuery.error && (
          <Alert severity="error">
            No se pudo cargar la información inicial. Actualice la página o vuelva a intentar.
          </Alert>
        )}
        {!metadata.metadataQuery.isLoading && metadata.metadataQuery.data && (
          <Box component="form" sx={{ mt: 1 }} onSubmit={form.handleSubmit(form.onSubmit)}>
            <HeaderFields
              control={form.control}
              setValue={form.setValue}
              isReadOnly={isReadOnly}
              crossLoadEnabled={crossLoadEnabled}
              onCrossLoadChange={setCrossLoadEnabled}
              profesorados={metadata.profesorados}
              materias={metadata.materias}
              plantillasDisponibles={metadata.plantillasDisponibles}
              selectedProfesorado={metadata.selectedProfesorado}
              selectedMateria={metadata.selectedMateria}
              selectedPlantilla={metadata.selectedPlantilla}
              materiaAnioLabel={metadata.materiaAnioLabel}
              dictadoLabel={metadata.dictadoLabel}
              previewCodigo={previewCodigo}
              situacionesDisponibles={metadata.situacionesDisponibles}
              filaFields={form.filaFields}
              calculateSituacionForRow={form.calculateSituacionForRow}
              mode={mode}
            />

            <Divider sx={{ my: 4 }} />

            <DocentesSection
              control={form.control}
              setValue={form.setValue}
              isReadOnly={isReadOnly}
              docenteFields={form.docenteFields}
              docentesForm={docentesForm}
              docentesOptions={metadata.docentesOptions}
              docentesMap={metadata.docentesMap}
              handleAddDocente={form.handleAddDocente}
              handleRemoveDocente={form.handleRemoveDocente}
            />

            <Divider sx={{ my: 4 }} />

            <HistorialPanel
              isReadOnly={isReadOnly}
              selectedMateria={metadata.selectedMateria}
              profesoradoId={profesoradoId}
              historyQuery={historial.historyQuery}
              historyMenuAnchor={historial.historyMenuAnchor}
              isHistoryOpen={historial.isHistoryOpen}
              handleOpenHistory={historial.handleOpenHistory}
              handleCloseHistory={historial.handleCloseHistory}
              handleImportFromPlanilla={historial.handleImportFromPlanilla}
              handleAutoCalculateAll={form.handleAutoCalculateAll}
              handleCopyStudents={form.handleCopyStudents}
              handlePasteStudents={form.handlePasteStudents}
              handleClearRows={form.handleClearRows}
              handleAddRow={form.handleAddRow}
              rowsToAdd={form.rowsToAdd}
              setRowsToAdd={form.setRowsToAdd}
            />

            <FilasTable
              control={form.control}
              setValue={form.setValue}
              watch={form.watch}
              getValues={form.getValues}
              isReadOnly={isReadOnly}
              filaFields={form.filaFields}
              removeFila={form.removeFila}
              columnasDinamicas={metadata.columnasDinamicas}
              situacionesDisponibles={metadata.situacionesDisponibles}
              estudiantesMetadata={metadata.estudiantesMetadata}
              selectedMateria={metadata.selectedMateria}
              handleStudentDniBlur={form.handleStudentDniBlur}
              handleAsistenciaBlur={form.handleAsistenciaBlur}
              calculateSituacionForRow={form.calculateSituacionForRow}
              handleInsertRow={form.handleInsertRow}
            />
          </Box>
        )}
      </DialogContent>
      <DialogActions sx={{ justifyContent: 'space-between', px: 3, pb: 2 }}>
        <FormControlLabel
          control={
            <Checkbox
              checked={form.persistStudents}
              onChange={(e) => form.setPersistStudents(e.target.checked)}
              disabled={mode !== 'create'}
            />
          }
          label="Mantener lista de estudiantes al guardar"
        />
        <Box>
          <Button onClick={onClose} sx={{ mr: 1 }}>{mode === 'view' ? 'Cerrar' : 'Cancelar'}</Button>
          {mode !== 'view' && (
            <Button
              onClick={form.handleSubmit(form.onSubmit)}
              variant="contained"
              disabled={form.mutation.isPending || metadata.metadataQuery.isLoading}
            >
              {form.mutation.isPending
                ? (mode === 'edit' ? 'Guardando...' : 'Generando...')
                : (mode === 'edit' ? 'Guardar Cambios' : 'Generar planilla')}
            </Button>
          )}
        </Box>
      </DialogActions>
    </Dialog>
  );
};

export default PlanillaRegularidadDialog;
