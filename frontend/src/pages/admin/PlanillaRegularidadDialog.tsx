import React, { useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Grid,
  Box,
  TextField,
  MenuItem,
  Typography,
  IconButton,
  FormControlLabel,
  Checkbox,
  Divider,
  Tooltip,
  CircularProgress,
  Alert,
  Autocomplete,
  Chip,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { useForm, Controller, useFieldArray } from 'react-hook-form';
import { useMutation, useQuery } from '@tanstack/react-query';
import { enqueueSnackbar } from 'notistack';

import {
  crearPlanillaRegularidad,
  fetchRegularidadMetadata,
  RegularidadMetadataMateria,
  RegularidadMetadataPlantilla,
  RegularidadMetadataProfesorado,
  PlanillaRegularidadCreatePayload,
  PlanillaRegularidadCreateResult,
} from '@/api/primeraCarga';

type PlanillaDocenteFormValues = {
  docente_id?: number | null;
  nombre: string;
  dni: string;
  rol: string;
  orden?: number | null;
};

type PlanillaFilaFormValues = {
  orden: number | null;
  dni: string;
  apellido_nombre: string;
  nota_final: string;
  asistencia: string;
  situacion: string;
  excepcion: boolean;
  datos: Record<string, string>;
};

type PlanillaFormValues = {
  profesoradoId: number | '';
  materiaId: number | '';
  plantillaId: number | '';
  fecha: string;
  folio: string;
  planResolucion: string;
  observaciones: string;
  docentes: PlanillaDocenteFormValues[];
  filas: PlanillaFilaFormValues[];
  dry_run: boolean;
};

interface PlanillaRegularidadDialogProps {
  open: boolean;
  onClose: () => void;
  onCreated?: (result: PlanillaRegularidadCreateResult, dryRun: boolean) => void;
}

const DEFAULT_DOCENTE: PlanillaDocenteFormValues = {
  docente_id: null,
  nombre: '',
  dni: '',
  rol: 'profesor',
  orden: null,
};

const buildDefaultRow = (index: number): PlanillaFilaFormValues => ({
  orden: index + 1,
  dni: '',
  apellido_nombre: '',
  nota_final: '',
  asistencia: '',
  situacion: '',
  excepcion: false,
  datos: {},
});

const buildDefaultRows = (count = 10): PlanillaFilaFormValues[] =>
  Array.from({ length: count }, (_, idx) => buildDefaultRow(idx));

const regimenToDictado: Record<string, string> = {
  ANU: 'ANUAL',
  ANUAL: 'ANUAL',
  PCU: '1C',
  SCU: '2C',
  '1C': '1C',
  '2C': '2C',
};

const REGIMEN_LABELS: Record<string, string> = {
  ANU: 'Anual',
  ANUAL: 'Anual',
  PCU: '1° cuatrimestre',
  SCU: '2° cuatrimestre',
  '1C': '1° cuatrimestre',
  '2C': '2° cuatrimestre',
};

const DICTADO_LABELS: Record<string, string> = {
  ANUAL: 'Anual',
  '1C': '1° cuatrimestre',
  '2C': '2° cuatrimestre',
};

const FORMATO_SLUG_MAP: Record<string, string> = {
  ASI: 'asignatura',
  MOD: 'modulo',
  TAL: 'taller',
  PRA: 'taller',
  LAB: 'taller',
  SEM: 'taller',
};

const SITUACION_PLACEHOLDER = 'Seleccionar';

const formatColumnLabel = (label?: string) => {
  if (!label) {
    return '';
  }
  const normalized = label.normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
  return normalized.replace(/º|°/g, '').replace(/\s+/g, ' ').trim();
};

const todayIso = () => new Date().toISOString().slice(0, 10);

const PlanillaRegularidadDialog: React.FC<PlanillaRegularidadDialogProps> = ({ open, onClose, onCreated }) => {
  const {
    control,
    handleSubmit,
    watch,
    reset,
    setValue,
    getValues,
  } = useForm<PlanillaFormValues>({
    defaultValues: {
      profesoradoId: '',
      materiaId: '',
      plantillaId: '',
      fecha: todayIso(),
      folio: '',
      planResolucion: '',
      observaciones: '',
      docentes: [DEFAULT_DOCENTE],
      filas: buildDefaultRows(),
      dry_run: false,
    },
  });

  const metadataQuery = useQuery({
    queryKey: ['primera-carga', 'regularidades', 'metadata'],
    queryFn: fetchRegularidadMetadata,
    enabled: open,
    staleTime: 1000 * 60 * 10,
    retry: false,
  });

  useEffect(() => {
    if (open) {
      metadataQuery.refetch();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const profesoradoId = watch('profesoradoId');
  const materiaId = watch('materiaId');
  const plantillaId = watch('plantillaId');
  const fechaSeleccionada = watch('fecha');
  const docentesForm = watch('docentes');

  const headerCellSx = {
    fontWeight: 600,
    fontSize: '0.75rem',
    textTransform: 'uppercase',
    backgroundColor: 'grey.100',
    border: '1px solid',
    borderColor: 'grey.300',
    whiteSpace: 'nowrap',
  };

  const bodyCellSx = {
    border: '1px solid',
    borderColor: 'grey.200',
    px: 1,
    py: 0.75,
    verticalAlign: 'middle',
  };

  const {
    fields: docenteFields,
    append: appendDocente,
    remove: removeDocente,
  } = useFieldArray({
    control,
    name: 'docentes',
  });

  const {
    fields: filaFields,
    append: appendFila,
    remove: removeFila,
    replace: replaceFilas,
  } = useFieldArray({
    control,
    name: 'filas',
  });



  const mutation = useMutation({
    mutationFn: crearPlanillaRegularidad,
    onSuccess: (data, variables) => {
      enqueueSnackbar(data.message, { variant: 'success' });
      if (typeof data.data?.regularidades_registradas === 'number') {
        const count = data.data.regularidades_registradas;
        const messageDetalle = variables.dry_run
          ? `Simuladas ${count} regularidades.`
          : `${count} regularidades registradas.`;
        enqueueSnackbar(
          messageDetalle,
          { variant: 'info' },
        );
      }
      if (data.data?.warnings?.length) {
        data.data.warnings.forEach((warning) => {
          if (warning) {
            enqueueSnackbar(warning, { variant: 'warning' });
          }
        });
      }
      if (!variables.dry_run && data.data?.pdf_url) {
        const base = import.meta.env.VITE_API_BASE || window.location.origin;
        const mediaBase = base.replace(/\/api\/?$/, '/');
        let targetUrl = data.data.pdf_url;
        if (!/^https?:\/\//i.test(targetUrl)) {
          try {
            targetUrl = new URL(targetUrl, mediaBase).toString();
          } catch (error) {
            // fallback to original relative URL if URL construction fails
          }
        }
        window.open(targetUrl, '_blank', 'noopener,noreferrer');
      }
      onCreated?.(data.data, !!variables.dry_run);
      onClose();
    },
    onError: (error: any) => {
      const message = error?.response?.data?.message ?? 'No se pudo generar la planilla.';
      enqueueSnackbar(message, { variant: 'error' });
    },
  });

  const profesorados: RegularidadMetadataProfesorado[] = metadataQuery.data?.profesorados ?? [];

  const selectedProfesorado = useMemo(
    () => profesorados.find((p) => p.id === Number(profesoradoId)),
    [profesorados, profesoradoId],
  );

  const materias = useMemo<RegularidadMetadataMateria[]>(() => {
    if (!selectedProfesorado) {
      return [];
    }
    return selectedProfesorado.planes.flatMap((plan) => plan.materias);
  }, [selectedProfesorado]);

  useEffect(() => {
    setValue('materiaId', '');
    setValue('plantillaId', '');
    setValue('planResolucion', '');
  }, [profesoradoId, setValue]);

  const selectedMateria = useMemo(
    () => materias.find((m) => m.id === Number(materiaId)),
    [materias, materiaId],
  );

  const materiaAnioLabel = useMemo(() => {
    if (!selectedMateria) {
      return null;
    }
    const anio = selectedMateria.anio_cursada;
    if (!anio) {
      return null;
    }
    return `${anio}°`;
  }, [selectedMateria]);

  const plantillasDisponibles = useMemo<RegularidadMetadataPlantilla[]>(() => {
    if (!selectedMateria) {
      return [];
    }
    const slug = FORMATO_SLUG_MAP[selectedMateria.formato] ?? selectedMateria.formato.toLowerCase();
    const expectedDictado = regimenToDictado[selectedMateria.regimen] ?? 'ANUAL';
    const candidatas = (metadataQuery.data?.plantillas ?? []).filter(
      (plantilla) =>
        plantilla.formato.slug.toLowerCase() === slug &&
        plantilla.dictado.toUpperCase() === expectedDictado.toUpperCase(),
    );
    if (candidatas.length) {
      return candidatas;
    }
    return (metadataQuery.data?.plantillas ?? []).filter(
      (plantilla) => plantilla.formato.slug.toLowerCase() === slug,
    );
  }, [selectedMateria, metadataQuery.data?.plantillas]);

  useEffect(() => {
    if (selectedMateria) {
      setValue('planResolucion', selectedMateria.plan_resolucion || '');
      const currentPlantilla = plantillasDisponibles.find((plantilla) => plantilla.id === Number(getValues('plantillaId')));
      if (!currentPlantilla) {
        setValue('plantillaId', plantillasDisponibles[0]?.id ?? '');
      }
    } else {
      setValue('plantillaId', '');
      setValue('planResolucion', '');
    }
  }, [selectedMateria, plantillasDisponibles, setValue, getValues]);

  const selectedPlantilla = useMemo(
    () => plantillasDisponibles.find((p) => p.id === Number(plantillaId)),
    [plantillasDisponibles, plantillaId],
  );

  const dictadoLabel = useMemo(() => {
    if (!selectedPlantilla) {
      return null;
    }
    return DICTADO_LABELS[selectedPlantilla.dictado] ?? selectedPlantilla.dictado;
  }, [selectedPlantilla]);

  const docentesOptions = useMemo(() => metadataQuery.data?.docentes ?? [], [metadataQuery.data?.docentes]);
  const docentesMap = useMemo(() => {
    const map = new Map<number, { id: number; nombre: string; dni?: string | null }>();
    docentesOptions.forEach((doc) => map.set(doc.id, doc));
    return map;
  }, [docentesOptions]);

  const estudiantesMetadata = useMemo(() => metadataQuery.data?.estudiantes ?? [], [metadataQuery.data?.estudiantes]);
  const estudiantePorDni = useMemo(() => {
    const map = new Map<string, { apellido_nombre: string; profesorados: number[] }>();
    estudiantesMetadata.forEach((est) => {
      map.set(est.dni, { apellido_nombre: est.apellido_nombre, profesorados: est.profesorados });
    });
    return map;
  }, [estudiantesMetadata]);

  const columnasDinamicas = selectedPlantilla?.columnas ?? [];
  const situacionesDisponibles = selectedPlantilla?.situaciones ?? [];

  const previewCodigo = useMemo(() => {
    if (!selectedProfesorado || !fechaSeleccionada) {
      return null;
    }
    const day = fechaSeleccionada.replace(/-/g, '');
    return `PRP${String(selectedProfesorado.id).padStart(2, '0')}${selectedProfesorado.acronimo}${day}XXX`;
  }, [selectedProfesorado, fechaSeleccionada]);

  const onSubmit = (values: PlanillaFormValues) => {
    if (!selectedProfesorado) {
      enqueueSnackbar('Debe seleccionar un profesorado.', { variant: 'warning' });
      return;
    }
    if (!selectedMateria) {
      enqueueSnackbar('Debe seleccionar una unidad curricular.', { variant: 'warning' });
      return;
    }
    if (!selectedPlantilla) {
      enqueueSnackbar('Debe seleccionar una plantilla de planilla.', { variant: 'warning' });
      return;
    }

    const filasPreparadas = values.filas
      .map((fila, index) => ({
        ...fila,
        index,
        tieneDatos:
          fila.dni.trim() ||
          fila.apellido_nombre.trim() ||
          fila.nota_final.trim() ||
          fila.asistencia.trim() ||
          fila.situacion.trim(),
      }))
      .filter((fila) => fila.tieneDatos);

    if (filasPreparadas.length === 0) {
      enqueueSnackbar('Debe completar al menos una fila de estudiante.', { variant: 'warning' });
      return;
    }

    for (const fila of filasPreparadas) {
      if (!fila.dni.trim() || !fila.apellido_nombre.trim() || !fila.nota_final.trim() || !fila.asistencia.trim()) {
        enqueueSnackbar(`Complete todos los campos obligatorios en la fila ${fila.index + 1}.`, { variant: 'warning' });
        return;
      }
      if (!fila.situacion.trim()) {
        enqueueSnackbar(`Seleccione la situación académica en la fila ${fila.index + 1}.`, { variant: 'warning' });
        return;
      }
    }

    let filasPayload: PlanillaRegularidadCreatePayload['filas'];
    try {
      filasPayload = filasPreparadas.map<PlanillaRegularidadCreatePayload['filas'][number]>((fila, idx) => {
      const datosLimpios: Record<string, string> = {};
      columnasDinamicas.forEach((col) => {
        const valor = fila.datos?.[col.key];
        const stringValor = valor !== undefined && valor !== null ? String(valor).trim() : '';
        if (!stringValor) {
          if (!col.optional) {
            throw new Error(`Completa el campo "${col.label}" en la fila ${fila.index + 1}.`);
          }
        } else {
          datosLimpios[col.key] = stringValor;
        }
      });

        const asistenciaNumero = Number(fila.asistencia);
        if (Number.isNaN(asistenciaNumero) || asistenciaNumero < 0 || asistenciaNumero > 100) {
          throw new Error(`La asistencia de la fila ${fila.index + 1} debe estar entre 0 y 100.`);
        }

        const notaNumero = Number(fila.nota_final);
        if (Number.isNaN(notaNumero)) {
          throw new Error(`La nota final de la fila ${fila.index + 1} debe ser numérica.`);
        }

        return {
          orden: fila.orden ?? idx + 1,
          dni: fila.dni.trim(),
          apellido_nombre: fila.apellido_nombre.trim(),
          nota_final: notaNumero,
          asistencia: asistenciaNumero,
          situacion: fila.situacion.trim(),
          excepcion: fila.excepcion ?? false,
          datos: datosLimpios,
        };
      });
    } catch (error: any) {
      enqueueSnackbar(error.message ?? 'Verifique los datos de las filas cargadas.', { variant: 'error' });
      return;
    }

    const docentesPayload =
      values.docentes
        ?.map((docente, idx) => ({
          docente_id: docente.docente_id ?? null,
          nombre: docente.nombre.trim(),
          dni: docente.dni.trim() || null,
          rol: docente.rol || 'profesor',
          orden: docente.orden ?? idx + 1,
        }))
        .filter((docente) => docente.nombre.length > 0) ?? [];

    const payload: PlanillaRegularidadCreatePayload = {
      profesorado_id: Number(selectedProfesorado.id),
      materia_id: Number(selectedMateria.id),
      plantilla_id: Number(selectedPlantilla.id),
      dictado: selectedPlantilla.dictado,
      fecha: values.fecha,
      folio: values.folio || undefined,
      plan_resolucion: values.planResolucion || selectedMateria.plan_resolucion,
      observaciones: values.observaciones || undefined,
      docentes: docentesPayload,
      filas: filasPayload,
      dry_run: values.dry_run,
    };

    mutation.mutate(payload);
  };

  const handleAddRow = (count = 1) => {
    const currentLength = filaFields.length;
    const nuevos = Array.from({ length: count }, (_, idx) => buildDefaultRow(currentLength + idx));
    appendFila(nuevos);
  };

  const handleClearRows = () => {
    replaceFilas(buildDefaultRows());
  };

  const handleAddDocente = () => {
    appendDocente({ ...DEFAULT_DOCENTE });
  };

  const handleRemoveDocente = (index: number) => {
    removeDocente(index);
  };

  const handleStudentDniBlur = (index: number, rawValue: string) => {
    const dni = (rawValue || '').trim();
    if (!dni) {
      return;
    }
    const match = estudiantePorDni.get(dni);
    if (!match) {
      return;
    }
    if (selectedProfesorado && !match.profesorados.includes(selectedProfesorado.id)) {
      return;
    }
    setValue(`filas.${index}.apellido_nombre`, match.apellido_nombre, { shouldDirty: true });
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
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
      <DialogTitle>Generar planilla de regularidad / promoción</DialogTitle>
      <DialogContent dividers>
        {metadataQuery.isLoading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        )}
        {metadataQuery.error && (
          <Alert severity="error">
            No se pudo cargar la información inicial. Actualice la página o vuelva a intentar.
          </Alert>
        )}
        {!metadataQuery.isLoading && metadataQuery.data && (
          <Box component="form" sx={{ mt: 1 }} onSubmit={handleSubmit(onSubmit)}>
            <Typography variant="subtitle1" gutterBottom>
              Datos generales
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6} md={4}>
                <Controller
                  control={control}
                  name="profesoradoId"
                  rules={{ required: true }}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      select
                      label="Profesorado"
                      fullWidth
                      size="small"
                      required
                    >
                      {profesorados.map((prof) => (
                        <MenuItem key={prof.id} value={prof.id}>
                          {prof.nombre}
                        </MenuItem>
                      ))}
                    </TextField>
                  )}
                />
              </Grid>
              <Grid item xs={12} sm={6} md={4}>
                <Controller
                  control={control}
                  name="materiaId"
                  rules={{ required: true }}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      select
                      label="Unidad curricular"
                      fullWidth
                      size="small"
                      required
                      disabled={!selectedProfesorado}
                    >
                      {materias.map((materia) => (
                        <MenuItem key={materia.id} value={materia.id}>
                          {materia.nombre} ({materia.anio_cursada ?? '-'}°)
                        </MenuItem>
                      ))}
                    </TextField>
                  )}
                />
              </Grid>
              <Grid item xs={12} sm={6} md={4}>
                <Controller
                  control={control}
                  name="plantillaId"
                  rules={{ required: true }}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      select
                      label="Plantilla"
                      fullWidth
                      size="small"
                      required
                      disabled={!selectedMateria}
                      helperText={
                        selectedPlantilla
                          ? `${selectedPlantilla.formato.nombre} - ${selectedPlantilla.dictado}`
                          : 'Selecciona unidad curricular para habilitar'
                      }
                    >
                      {plantillasDisponibles.map((plantilla) => (
                        <MenuItem key={plantilla.id} value={plantilla.id}>
                          {plantilla.nombre}
                        </MenuItem>
                      ))}
                    </TextField>
                  )}
                />
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Controller
                  control={control}
                  name="fecha"
                  rules={{ required: true }}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      type="date"
                      label="Fecha de la planilla"
                      InputLabelProps={{ shrink: true }}
                      fullWidth
                      size="small"
                      required
                    />
                  )}
                />
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Controller
                  control={control}
                  name="folio"
                  render={({ field }) => (
                    <TextField {...field} label="Folio" fullWidth size="small" />
                  )}
                />
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Controller
                  control={control}
                  name="planResolucion"
                  render={({ field }) => (
                    <TextField
                      {...field}
                      label="Resolución del plan"
                      fullWidth
                      size="small"
                      helperText="Se sugiere mantener la resolución de la unidad curricular."
                    />
                  )}
                />
              </Grid>
              <Grid item xs={12}>
                <Controller
                  control={control}
                  name="observaciones"
                  render={({ field }) => (
                    <TextField
                      {...field}
                      label="Observaciones"
                      fullWidth
                      size="small"
                      multiline
                      minRows={2}
                    />
                  )}
                />
              </Grid>
              <Grid item xs={12}>
                <Controller
                  control={control}
                  name="dry_run"
                  render={({ field }) => (
                    <FormControlLabel
                      control={<Checkbox {...field} checked={field.value} />}
                      label="Dry-run (simular sin guardar ni generar PDF)"
                    />
                  )}
                />
              </Grid>
            </Grid>

            {selectedMateria && selectedPlantilla && (
              <Box sx={{ mt: 1.5, display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {materiaAnioLabel ? (
                  <Chip size="small" label={`Año: ${materiaAnioLabel}`} variant="outlined" />
                ) : null}
                <Chip
                  size="small"
                  label={`Formato: ${selectedPlantilla.formato.nombre}`}
                  variant="outlined"
                />
                <Chip
                  size="small"
                  label={`Dictado: ${dictadoLabel || selectedPlantilla.dictado}`}
                  variant="outlined"
                />
                <Chip
                  size="small"
                  label={`Regimen: ${REGIMEN_LABELS[selectedMateria.regimen] ?? selectedMateria.regimen}`}
                  variant="outlined"
                />
              </Box>
            )}

            {selectedPlantilla?.descripcion ? (
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                {selectedPlantilla.descripcion}
              </Typography>
            ) : null}

            {situacionesDisponibles.length > 0 && (
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                Situaciones habilitadas: {situacionesDisponibles.map((s) => s.label || s.codigo).join(', ')}
              </Typography>
            )}

            {previewCodigo && (
              <Box sx={{ mt: 1.5 }}>
                <Typography variant="caption" color="text.secondary">
                  Vista previa del código (se asigna automáticamente al guardar): {previewCodigo}
                </Typography>
              </Box>
            )}

            <Divider sx={{ my: 2 }} />

            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
              <Typography variant="subtitle1">Docentes / Firmantes</Typography>
              <Button size="small" startIcon={<AddCircleOutlineIcon />} onClick={handleAddDocente}>
                Agregar firmante
              </Button>
            </Box>

            {docenteFields.length === 0 && (
              <Alert severity="info" sx={{ mb: 2 }}>
                Agrega al menos al docente responsable y al bedel responsable antes de generar la planilla.
              </Alert>
            )}

            <Grid container spacing={1}>
              {docenteFields.map((field, index) => (
                <React.Fragment key={field.id}>
                  <Grid item xs={12} md={5}>
                    <Controller
                      control={control}
                      name={`docentes.${index}.nombre`}
                      render={({ field: controllerField }) => {
                        const currentDocente = docentesForm?.[index];
                        const selectedOption = currentDocente?.docente_id
                          ? docentesMap.get(currentDocente.docente_id)
                          : null;
                        const autoValue =
                          selectedOption ||
                          (controllerField.value
                            ? { id: -1, nombre: controllerField.value, dni: currentDocente?.dni }
                            : null);
                        return (
                          <Autocomplete
                            options={docentesOptions}
                            freeSolo
                            value={autoValue}
                            onChange={(_, value) => {
                              if (!value) {
                                controllerField.onChange('');
                                setValue(`docentes.${index}.docente_id`, null, { shouldDirty: true });
                                setValue(`docentes.${index}.dni`, '', { shouldDirty: true });
                                return;
                              }
                              if (typeof value === 'string') {
                                controllerField.onChange(value);
                                setValue(`docentes.${index}.docente_id`, null, { shouldDirty: true });
                                setValue(`docentes.${index}.dni`, '', { shouldDirty: true });
                              } else {
                                controllerField.onChange(value.nombre);
                                setValue(`docentes.${index}.docente_id`, value.id, { shouldDirty: true });
                                setValue(`docentes.${index}.dni`, value.dni || '', { shouldDirty: true });
                              }
                            }}
                            onInputChange={(_, value, reason) => {
                              if (reason === 'input') {
                                controllerField.onChange(value);
                                const currentSelected = currentDocente?.docente_id
                                  ? docentesMap.get(currentDocente.docente_id)
                                  : null;
                                if (!currentSelected || value !== currentSelected.nombre) {
                                  setValue(`docentes.${index}.docente_id`, null, { shouldDirty: true });
                                  setValue(`docentes.${index}.dni`, '', { shouldDirty: true });
                                }
                              }
                            }}
                            isOptionEqualToValue={(option, value) => {
                              if (typeof value === 'string') {
                                return option.nombre === value;
                              }
                              if (typeof option === 'string') {
                                return option === (value as any).nombre;
                              }
                              return option.id === (value as any).id;
                            }}
                            getOptionLabel={(option) => {
                              if (typeof option === 'string') {
                                return option;
                              }
                              return option.nombre;
                            }}
                            renderInput={(params) => (
                              <TextField
                                {...params}
                                label="Nombre y apellido"
                                size="small"
                                required
                              />
                            )}
                          />
                        );
                      }}
                    />
                  </Grid>
                  <Grid item xs={12} md={2.5}>
                    <Controller
                      control={control}
                      name={`docentes.${index}.docente_id`}
                      render={() => <></>}
                    />
                    <Controller
                      control={control}
                      name={`docentes.${index}.dni`}
                      render={({ field: controllerField }) => (
                        <TextField
                          {...controllerField}
                          value={controllerField.value ?? ''}
                          label="DNI"
                          fullWidth
                          size="small"
                          inputProps={{ maxLength: 10, inputMode: 'numeric' }}
                        />
                      )}
                    />
                  </Grid>
                  <Grid item xs={12} md={2}>
                    <Controller
                      control={control}
                      name={`docentes.${index}.rol`}
                      render={({ field: controllerField }) => (
                        <TextField
                          {...controllerField}
                          value={controllerField.value ?? 'profesor'}
                          select
                          label="Rol"
                          fullWidth
                          size="small"
                        >
                          <MenuItem value="profesor">Profesor/a</MenuItem>
                          <MenuItem value="bedel">Bedel</MenuItem>
                          <MenuItem value="otro">Otro</MenuItem>
                        </TextField>
                      )}
                    />
                  </Grid>
                  <Grid item xs={12} md={1.5}>
                    <Controller
                      control={control}
                      name={`docentes.${index}.orden`}
                      render={({ field: controllerField }) => (
                        <TextField
                          {...controllerField}
                          value={controllerField.value ?? ''}
                          label="Orden"
                          type="number"
                          fullWidth
                          size="small"
                          inputProps={{ min: 1 }}
                        />
                      )}
                    />
                  </Grid>
                  <Grid
                    item
                    xs={12}
                    md={1}
                    sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <Tooltip title="Quitar firmante">
                      <span>
                        <IconButton
                          color="error"
                          size="small"
                          onClick={() => handleRemoveDocente(index)}
                          disabled={docenteFields.length === 1}
                        >
                          <DeleteOutlineIcon fontSize="small" />
                        </IconButton>
                      </span>
                    </Tooltip>
                  </Grid>
                </React.Fragment>
              ))}
            </Grid>

            <Divider sx={{ my: 2 }} />

            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
              <Typography variant="subtitle1">Detalle de estudiantes</Typography>
              <Box>
                <Tooltip title="Agregar una fila">
                  <IconButton color="primary" size="small" onClick={() => handleAddRow(1)}>
                    <AddCircleOutlineIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Agregar 5 filas">
                  <IconButton color="primary" size="small" onClick={() => handleAddRow(5)}>
                    <ContentCopyIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Restablecer filas (limpiar)">
                  <IconButton color="warning" size="small" onClick={handleClearRows}>
                    <DeleteOutlineIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Box>
            </Box>

            <TableContainer component={Paper} variant="outlined" sx={{ mt: 1 }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ ...headerCellSx, width: 60 }} rowSpan={2}>
                      N°
                    </TableCell>
                    <TableCell sx={{ ...headerCellSx, minWidth: 240 }} rowSpan={2}>
                      Alumnos
                    </TableCell>
                    <TableCell sx={{ ...headerCellSx, width: 140 }} rowSpan={2}>
                      DNI
                    </TableCell>
                    <TableCell
                      sx={{ ...headerCellSx, textAlign: 'center' }}
                      colSpan={Math.max(columnasDinamicas.length, 0) + 1}
                    >
                      Nota de trabajos prácticos
                    </TableCell>
                    <TableCell sx={{ ...headerCellSx, width: 130, textAlign: 'center' }} colSpan={1}>
                      Asistencia
                    </TableCell>
                    <TableCell sx={{ ...headerCellSx, width: 90, textAlign: 'center' }} colSpan={1}>
                      Excepción
                    </TableCell>
                    <TableCell sx={{ ...headerCellSx, minWidth: 200 }} rowSpan={2}>
                      Situación académica
                    </TableCell>
                    <TableCell sx={{ ...headerCellSx, width: 56 }} rowSpan={2} />
                  </TableRow>
                  <TableRow>
                    {columnasDinamicas.map((col) => (
                      <TableCell sx={{ ...headerCellSx, minWidth: 140 }} key={col.key}>
                        <Typography variant="body2" sx={{ fontSize: '0.75rem' }}>
                          {formatColumnLabel(col.label)}
                        </Typography>
                        {col.optional ? (
                          <Typography variant="caption" color="text.secondary">
                            Opcional
                          </Typography>
                        ) : null}
                      </TableCell>
                    ))}
                    <TableCell sx={{ ...headerCellSx, width: 110 }}>Nota final</TableCell>
                    <TableCell sx={{ ...headerCellSx, width: 130 }}>%</TableCell>
                    <TableCell sx={{ ...headerCellSx, width: 90 }}>Si/No</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filaFields.map((field, index) => (
                    <TableRow key={field.id}>
                      <TableCell sx={{ ...bodyCellSx, width: 60 }}>
                        <Controller
                          control={control}
                          name={`filas.${index}.orden`}
                          render={({ field: controllerField }) => (
                            <TextField
                              {...controllerField}
                              value={controllerField.value ?? ''}
                              type="number"
                              size="small"
                              fullWidth
                              inputProps={{ min: 1, max: 999 }}
                            />
                          )}
                        />
                      </TableCell>
                      <TableCell sx={{ ...bodyCellSx, minWidth: 240 }}>
                        <Controller
                          control={control}
                          name={`filas.${index}.apellido_nombre`}
                          render={({ field: controllerField }) => (
                            <TextField
                              {...controllerField}
                              value={controllerField.value ?? ''}
                              size="small"
                              fullWidth
                              placeholder="Apellido y nombre"
                              required
                            />
                          )}
                        />
                      </TableCell>
                      <TableCell sx={{ ...bodyCellSx, width: 140 }}>
                        <Controller
                          control={control}
                          name={`filas.${index}.dni`}
                          render={({ field: controllerField }) => (
                            <TextField
                              {...controllerField}
                              value={controllerField.value ?? ''}
                              size="small"
                              fullWidth
                              placeholder="DNI"
                              inputProps={{ maxLength: 8, inputMode: 'numeric' }}
                              onBlur={(event) => {
                                controllerField.onBlur();
                                handleStudentDniBlur(index, event.target.value);
                              }}
                              onChange={(event) => {
                                controllerField.onChange(event);
                                const value = event.target.value.trim();
                                if (value.length >= 7) {
                                  handleStudentDniBlur(index, value);
                                }
                              }}
                              required
                            />
                          )}
                        />
                      </TableCell>
                      {columnasDinamicas.map((col) => (
                        <TableCell sx={{ ...bodyCellSx, minWidth: 140 }} key={`${field.id}-${col.key}`}>
                          <Controller
                            control={control}
                            name={`filas.${index}.datos.${col.key}`}
                            render={({ field: controllerField }) => (
                              <TextField
                                {...controllerField}
                                value={controllerField.value ?? ''}
                                size="small"
                                fullWidth
                                placeholder={
                                  col.optional
                                    ? `${formatColumnLabel(col.label)} (opt)`
                                    : formatColumnLabel(col.label)
                                }
                                type={col.type === 'number' ? 'number' : 'text'}
                                inputProps={col.type === 'number' ? { step: '0.1' } : undefined}
                                required={!col.optional}
                              />
                            )}
                          />
                        </TableCell>
                      ))}
                      <TableCell sx={{ ...bodyCellSx, width: 110 }}>
                        <Controller
                          control={control}
                          name={`filas.${index}.nota_final`}
                          render={({ field: controllerField }) => (
                            <TextField
                              {...controllerField}
                              value={controllerField.value ?? ''}
                              size="small"
                              fullWidth
                              placeholder="6"
                              type="number"
                              inputProps={{ min: 0, max: 10, step: '0.1' }}
                              required
                            />
                          )}
                        />
                      </TableCell>
                      <TableCell sx={{ ...bodyCellSx, width: 130 }}>
                        <Controller
                          control={control}
                          name={`filas.${index}.asistencia`}
                          render={({ field: controllerField }) => (
                            <TextField
                              {...controllerField}
                              value={controllerField.value ?? ''}
                              size="small"
                              fullWidth
                              placeholder="80"
                              type="number"
                              inputProps={{ min: 0, max: 100 }}
                              required
                            />
                          )}
                        />
                      </TableCell>
                      <TableCell sx={{ ...bodyCellSx, width: 90, textAlign: 'center' }}>
                        <Controller
                          control={control}
                          name={`filas.${index}.excepcion`}
                          render={({ field: controllerField }) => {
                            const { value, onChange, ...rest } = controllerField;
                            return (
                              <Checkbox
                                {...rest}
                                checked={Boolean(value)}
                                onChange={(event) => onChange(event.target.checked)}
                                size="small"
                                sx={{ p: 0 }}
                              />
                            );
                          }}
                        />
                      </TableCell>
                      <TableCell sx={{ ...bodyCellSx, minWidth: 200 }}>
                        <Controller
                          control={control}
                          name={`filas.${index}.situacion`}
                          render={({ field: controllerField }) => (
                            <Autocomplete
                              options={situacionesDisponibles}
                              fullWidth
                              size="small"
                              disabled={!situacionesDisponibles.length}
                              value={
                                situacionesDisponibles.find((s) => s.codigo === controllerField.value) || null
                              }
                              onChange={(_, value) => controllerField.onChange(value?.codigo || '')}
                              getOptionLabel={(option) => option?.label || option?.codigo || ''}
                              renderOption={(props, option) => {
                                const { key, ...restProps } = props as any;
                                return (
                                  <li key={key} {...restProps}>
                                    <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                                      <Typography variant="body2">{option.label || option.codigo}</Typography>
                                      {option.descripcion ? (
                                        <Typography variant="caption" color="text.secondary">
                                          {option.descripcion}
                                        </Typography>
                                      ) : null}
                                    </Box>
                                  </li>
                                );
                              }}
                              isOptionEqualToValue={(option, value) => option?.codigo === value?.codigo}
                              renderInput={(params) => (
                                <TextField
                                  {...params}
                                  size="small"
                                  label="Situación"
                                  placeholder={SITUACION_PLACEHOLDER}
                                  InputLabelProps={{ shrink: true }}
                                  required
                                />
                              )}
                              noOptionsText="Sin opciones"
                            />
                          )}
                        />
                      </TableCell>
                      <TableCell sx={{ ...bodyCellSx, width: 56, textAlign: 'center' }}>
                        <Tooltip title="Eliminar fila">
                          <span>
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => removeFila(index)}
                              disabled={filaFields.length <= 1}
                            >
                              <DeleteOutlineIcon fontSize="small" />
                            </IconButton>
                          </span>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancelar</Button>
        <Button
          onClick={handleSubmit(onSubmit)}
          variant="contained"
          disabled={mutation.isPending || metadataQuery.isLoading}
        >
          {mutation.isPending ? 'Generando...' : 'Generar planilla'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default PlanillaRegularidadDialog;
