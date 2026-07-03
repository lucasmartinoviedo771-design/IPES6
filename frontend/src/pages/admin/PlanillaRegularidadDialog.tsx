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
import Stack from "@mui/material/Stack";
import { Controller } from "react-hook-form";
import { useAuth } from '@/context/AuthContext';
import { hasCapability } from '@/utils/roles';

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
  mode = 'create',
  defaultProfesoradoId,
  defaultMateriaId,
  scope = 'primera_carga',
  comisionId,
}) => {
  const { user } = useAuth();
  const isReadOnly = mode === 'view' || !hasCapability(user, 'carga_regularidades');

  const [crossLoadEnabled, setCrossLoadEnabled] = React.useState(false);

  const [watchedIds, setWatchedIds] = React.useState({
    profesoradoId: (defaultProfesoradoId ?? '') as number | '',
    materiaId: (defaultMateriaId ?? '') as number | '',
    plantillaId: '' as number | '',
    fecha: null as string | null,
  });

  const metadata = useRegularidadMetadata({
    open: open && scope === 'primera_carga',
    crossLoadEnabled,
    profesoradoId: watchedIds.profesoradoId,
    materiaId: watchedIds.materiaId,
    plantillaId: watchedIds.plantillaId,
    selectedFecha: watchedIds.fecha,
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
    defaultProfesoradoId,
    defaultMateriaId,
    scope,
    comisionId,
  });

  const profesorados = React.useMemo(() => {
    if (scope === 'standard' && form.detailQuery.data?.data) {
      const d = form.detailQuery.data.data;
      return [{ id: Number(d.profesorado_id), nombre: d.profesorado_nombre || 'Cargando...', acronimo: '', planes: [] }];
    }
    return metadata.profesorados;
  }, [scope, form.detailQuery.data?.data, metadata.profesorados]);

  const materias = React.useMemo(() => {
    if (scope === 'standard' && form.detailQuery.data?.data) {
      const d = form.detailQuery.data.data;
      return [{
        id: Number(d.materia_id),
        nombre: d.materia_nombre || 'Cargando...',
        anio_cursada: d.materia_anio || null,
        formato: d.formato || '',
        dictado: d.regimen || null,
        regimen: d.regimen || '',
        plan_resolucion: d.plan_resolucion || ''
      }];
    }
    return metadata.materias;
  }, [scope, form.detailQuery.data?.data, metadata.materias]);

  const selectedProfesorado = React.useMemo(() => {
    if (scope === 'standard') {
      return profesorados[0];
    }
    return metadata.selectedProfesorado;
  }, [scope, profesorados, metadata.selectedProfesorado]);

  const selectedMateria = React.useMemo(() => {
    if (scope === 'standard') {
      return materias[0];
    }
    return metadata.selectedMateria;
  }, [scope, materias, metadata.selectedMateria]);

  const selectedPlantilla = React.useMemo(() => {
    if (scope === 'standard' && form.detailQuery.data?.data) {
      const d = form.detailQuery.data.data;
      const formats: Record<string, string> = { ASI: 'Asignatura', MOD: 'Módulo', TAL: 'Taller', PRA: 'Práctica', LAB: 'Laboratorio', SEM: 'Seminario' };
      const dictados: Record<string, string> = { ANU: 'Anual', ANUAL: 'Anual', PCU: '1° Cuatrimestre', SCU: '2° Cuatrimestre', '1C': '1° Cuatrimestre', '2C': '2° Cuatrimestre' };
      const fmtName = formats[(d.formato || '').toUpperCase()] || d.formato || 'Estándar';
      const dictName = dictados[(d.regimen || '').toUpperCase()] || d.regimen || 'Anual';
      return {
        id: 1,
        nombre: `Planilla de ${fmtName}`,
        formato: { nombre: fmtName, slug: d.formato?.toLowerCase() || 'estandar' },
        dictado: dictName,
        columnas: [],
        situaciones: [],
        referencias: [],
        descripcion: `Planilla oficial de cátedra para ${fmtName}.`
      };
    }
    return metadata.selectedPlantilla;
  }, [scope, form.detailQuery.data?.data, metadata.selectedPlantilla]);

  const fechaSeleccionada = form.watch('fecha');
  const watchProfesoradoId = form.watch('profesoradoId');
  const watchMateriaId = form.watch('materiaId');
  const watchPlantillaId = form.watch('plantillaId');
  const docentesForm = form.watch('docentes');

  const historial = usePlanillaHistorial({
    open,
    replaceFilas: form.replaceFilas,
    scope,
  });

  // Actualizamos el puente de estado cuando el formulario cambia
  React.useEffect(() => {
    setWatchedIds({
      profesoradoId: watchProfesoradoId,
      materiaId: watchMateriaId,
      plantillaId: watchPlantillaId,
      fecha: fechaSeleccionada,
    });
  }, [watchProfesoradoId, watchMateriaId, watchPlantillaId, fechaSeleccionada]);

  // previewCodigo necesita la fecha también
  const previewCodigo = React.useMemo(() => {
    const activeProfesorado = scope === 'standard' ? selectedProfesorado : metadata.selectedProfesorado;
    if (!activeProfesorado || !fechaSeleccionada) return null;
    const day = fechaSeleccionada.replace(/-/g, '');
    return `PRP${String(activeProfesorado.id).padStart(2, '0')}${activeProfesorado.acronimo || 'PR'}${day}XXX`;
  }, [scope, selectedProfesorado, metadata.selectedProfesorado, fechaSeleccionada]);

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
        {mode !== 'create' && <Chip label={`MODO: ${scope === 'standard' ? 'OFICIAL / ESTÁNDAR' : mode.toUpperCase()}`} color={scope === 'standard' ? 'success' : mode === 'view' ? 'info' : 'primary'} size="small" variant="filled" />}
      </DialogTitle>
      <DialogContent dividers sx={{ position: 'relative' }}>
        {(form.detailQuery.isLoading || (scope !== 'standard' && metadata.metadataQuery.isLoading)) && (
          <Box sx={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, bgcolor: 'rgba(255,255,255,0.7)', zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CircularProgress size={60} thickness={4} />
          </Box>
        )}
        {scope !== 'standard' && metadata.metadataQuery.error && (
          <Alert severity="error">
            No se pudo cargar la información inicial. Actualice la página o vuelva a intentar.
          </Alert>
        )}
        {form.detailQuery.error && (
          <Alert severity="error">
            No se pudo cargar la planilla. Asegúrese de que la comisión exista y tenga alumnos inscriptos.
          </Alert>
        )}
        {(scope === 'standard' ? (!form.detailQuery.isLoading && !form.detailQuery.isError) : (!metadata.metadataQuery.isLoading && metadata.metadataQuery.data)) && (
          <Box component="form" sx={{ mt: 1 }} onSubmit={form.handleSubmit(form.onSubmit)}>
            <HeaderFields
              control={form.control}
              setValue={form.setValue}
              isReadOnly={isReadOnly || scope === 'standard'}
              crossLoadEnabled={crossLoadEnabled}
              onCrossLoadChange={setCrossLoadEnabled}
              profesorados={profesorados}
              materias={materias}
              plantillasDisponibles={scope === 'standard' ? [] : metadata.plantillasDisponibles}
              selectedProfesorado={selectedProfesorado}
              selectedMateria={selectedMateria}
              selectedPlantilla={selectedPlantilla}
              materiaAnioLabel={scope === 'standard' ? (selectedMateria?.anio_cursada ? `${selectedMateria.anio_cursada}°` : null) : metadata.materiaAnioLabel}
              dictadoLabel={scope === 'standard' ? (selectedPlantilla?.dictado || null) : metadata.dictadoLabel}
              previewCodigo={previewCodigo}
              situacionesDisponibles={form.localSituacionesDisponibles}
              filaFields={form.filaFields}
              calculateSituacionForRow={form.calculateSituacionForRow}
              mode={mode}
              scope={scope}
            />

            <Divider sx={{ my: 4 }} />

            <DocentesSection
              control={form.control}
              setValue={form.setValue}
              isReadOnly={isReadOnly}
              docenteFields={form.docenteFields}
              docentesForm={docentesForm}
              docentesOptions={scope === 'standard' ? [] : metadata.docentesOptions}
              docentesMap={scope === 'standard' ? new Map() : metadata.docentesMap}
              handleAddDocente={form.handleAddDocente}
              handleRemoveDocente={form.handleRemoveDocente}
            />

            <Divider sx={{ my: 4 }} />

            <HistorialPanel
              isReadOnly={isReadOnly}
              selectedMateria={selectedMateria}
              profesoradoId={watchProfesoradoId}
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
              scope={scope}
            />

            <FilasTable
              control={form.control}
              setValue={form.setValue}
              watch={form.watch}
              getValues={form.getValues}
              isReadOnly={isReadOnly}
              filaFields={form.filaFields}
              removeFila={form.removeFila}
              columnasDinamicas={form.localColumnasDinamicas}
              situacionesDisponibles={form.localSituacionesDisponibles}
              estudiantesMetadata={scope === 'standard' ? [] : metadata.estudiantesMetadata}
              selectedMateria={selectedMateria}
              handleStudentDniBlur={form.handleStudentDniBlur}
              handleAsistenciaBlur={form.handleAsistenciaBlur}
              calculateSituacionForRow={form.calculateSituacionForRow}
              handleInsertRow={form.handleInsertRow}
            />
          </Box>
        )}
      </DialogContent>
      <DialogActions sx={{ justifyContent: 'space-between', px: 3, pb: 2 }}>
        <Stack direction="row" spacing={2}>
          {scope === 'primera_carga' && (
            <FormControlLabel
              control={
                <Checkbox
                  checked={form.persistStudents}
                  onChange={(e) => form.setPersistStudents(e.target.checked)}
                  disabled={mode !== 'create'}
                />
              }
              label="Mantener lista de alumnos"
            />
          )}
          {scope === 'primera_carga' && mode !== 'view' && (
            <Controller
              name="force_upgrade"
              control={form.control}
              render={({ field }) => (
                <FormControlLabel
                  control={<Checkbox {...field} checked={field.value} onChange={(e) => field.onChange(e.target.checked)} />}
                  label="Forzar carga (Ignorar advertencias)"
                />
              )}
            />
          )}
        </Stack>
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
