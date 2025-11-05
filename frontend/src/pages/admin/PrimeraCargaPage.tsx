
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  CardActions,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControlLabel,
  Checkbox,
  Alert,
  CircularProgress,
  Stack,
  MenuItem,
} from '@mui/material';
import { useForm, Controller } from 'react-hook-form';
import { useMutation, useQuery } from '@tanstack/react-query';
import { enqueueSnackbar } from 'notistack';

import {
  crearEstudianteInicial,
  EstudianteInicialPayload,
  uploadEquivalencias,
} from '@/api/primeraCarga';
import { fetchEstudianteAdminDetail } from '@/api/alumnos';
import { listarProfesorados, ProfesoradoDTO } from '@/api/cargaNotas';
import PlanillaRegularidadDialog from './PlanillaRegularidadDialog';

type UploadDialogProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  description: string;
  uploadFunction: (data: { file: File; dry_run: boolean }) => Promise<any>;
  exampleFileName: string;
};

const UploadDialog: React.FC<UploadDialogProps> = ({
  open,
  onClose,
  title,
  description,
  uploadFunction,
  exampleFileName,
}) => {
  const {
    control,
    handleSubmit,
    register,
    reset,
    formState: { errors },
  } = useForm<{ file: FileList; dry_run: boolean }>({
    defaultValues: { file: undefined as unknown as FileList, dry_run: false },
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const mutation = useMutation({
    mutationFn: uploadFunction,
    onSuccess: (data) => {
      if (data.ok) {
        enqueueSnackbar(data.message, { variant: 'success' });
        if (data.data.errors && data.data.errors.length > 0) {
          const errorBlob = new Blob([data.data.errors.join('\n')], { type: 'text/plain' });
          const errorUrl = URL.createObjectURL(errorBlob);
          const a = document.createElement('a');
          a.href = errorUrl;
          a.download = `errores_${exampleFileName.replace('.csv', '')}_${new Date().toISOString()}.txt`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(errorUrl);
        }
      } else {
        enqueueSnackbar(data.message || 'Error en la importaciÃ³n.', { variant: 'error' });
        if (data.data.errors && data.data.errors.length > 0) {
          const errorBlob = new Blob([data.data.errors.join('\n')], { type: 'text/plain' });
          const errorUrl = URL.createObjectURL(errorBlob);
          const a = document.createElement('a');
          a.href = errorUrl;
          a.download = `errores_${exampleFileName.replace('.csv', '')}_${new Date().toISOString()}.txt`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(errorUrl);
        }
      }
      reset();
      setSelectedFile(null);
      onClose();
    },
    onError: (error: any) => {
      enqueueSnackbar(error?.response?.data?.message || 'Error de red o servidor.', { variant: 'error' });
    },
  });

  const onSubmit = (data: { file: FileList; dry_run: boolean }) => {
    if (data.file?.length > 0) {
      mutation.mutate({ file: data.file[0], dry_run: data.dry_run });
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      setSelectedFile(event.target.files[0]);
    } else {
      setSelectedFile(null);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" mb={2}>
          {description}
        </Typography>
        <Box component="form" onSubmit={handleSubmit(onSubmit)} id={`upload-form-${title}`} noValidate>
          <Controller
            name="file"
            control={control}
            rules={{ required: 'Debe seleccionar un archivo.' }}
            render={({ field }) => (
              <TextField
                type="file"
                fullWidth
                margin="normal"
                label="Seleccionar archivo CSV/Excel"
                InputLabelProps={{ shrink: true }}
                inputProps={{ accept: '.csv' }}
                onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
                  field.onChange(event.target.files);
                  handleFileChange(event);
                }}
                error={!!errors.file}
                helperText={errors.file?.message}
              />
            )}
          />
          <FormControlLabel
            control={<Checkbox {...register('dry_run')} />}
            label="Simular (no guardar cambios)"
          />
        </Box>
        {mutation.isError && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {(mutation.error as any)?.response?.data?.message || 'Error al procesar el archivo.'}
          </Alert>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={mutation.isPending}>
          Cancelar
        </Button>
        <Button
          type="submit"
          form={`upload-form-${title}`}
          variant="contained"
          disabled={mutation.isPending || !selectedFile}
          startIcon={mutation.isPending ? <CircularProgress size={18} color="inherit" /> : undefined}
        >
          {mutation.isPending ? 'Procesando...' : 'Procesar'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

type StudentFormValues = {
  dni: string;
  nombre: string;
  apellido: string;
  profesoradoId: string;
  email: string;
  telefono: string;
  domicilio: string;
  fecha_nacimiento: string;
  estado_legajo: string;
  anio_ingreso: string;
  genero: string;
  rol_extra: string;
  observaciones: string;
  cuil: string;
  cohorte: string;
  is_active: boolean;
  must_change_password: boolean;
  password: string;
};

type StudentDialogProps = {
  open: boolean;
  onClose: () => void;
};

const defaultStudentValues: StudentFormValues = {
  dni: '',
  nombre: '',
  apellido: '',
  profesoradoId: '',
  email: '',
  telefono: '',
  domicilio: '',
  fecha_nacimiento: '',
  estado_legajo: '',
  anio_ingreso: '',
  genero: '',
  rol_extra: '',
  observaciones: '',
  cuil: '',
  cohorte: '',
  is_active: true,
  must_change_password: true,
  password: '',
};

const ESTADO_LEGAJO_OPTIONS = [
  { value: 'COMPLETO', label: 'Completo' },
  { value: 'INCOMPLETO', label: 'Incompleto' },
  { value: 'PENDIENTE', label: 'Pendiente' },
];

const StudentManualDialog: React.FC<StudentDialogProps> = ({ open, onClose }) => {
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<StudentFormValues>({ defaultValues: defaultStudentValues });

  useEffect(() => {
    if (!open) {
      reset(defaultStudentValues);
    }
  }, [open, reset]);

  const [checkingDni, setCheckingDni] = useState(false);
  const profesoradosQuery = useQuery({
    queryKey: ['primera-carga', 'profesorados'],
    queryFn: listarProfesorados,
    enabled: open,
    staleTime: 5 * 60 * 1000,
  });

  const mutation = useMutation({
    mutationFn: (payload: EstudianteInicialPayload) => crearEstudianteInicial(payload),
    onSuccess: (response) => {
      enqueueSnackbar(response.message, { variant: 'success' });
      reset(defaultStudentValues);
    },
    onError: (error: any) => {
      enqueueSnackbar(error?.response?.data?.message || 'No se pudo registrar al estudiante.', {
        variant: 'error',
      });
    },
  });

  const profesorados = useMemo<ProfesoradoDTO[]>(() => profesoradosQuery.data ?? [], [profesoradosQuery.data]);

  const onSubmit = async (values: StudentFormValues) => {
    if (!values.profesoradoId) {
      enqueueSnackbar('Debes seleccionar un profesorado.', { variant: 'warning' });
      return;
    }

    const dni = values.dni.trim();
    if (!dni) {
      enqueueSnackbar('El DNI es obligatorio.', { variant: 'warning' });
      return;
    }

    setCheckingDni(true);
    let dniExiste = false;
    let abortar = false;
    try {
      await fetchEstudianteAdminDetail(dni);
      dniExiste = true;
    } catch (error: any) {
      const status = error?.response?.status;
      if (status === 404) {
        dniExiste = false;
      } else {
        abortar = true;
        enqueueSnackbar('No se pudo verificar el DNI. Intentá nuevamente.', { variant: 'error' });
      }
    } finally {
      setCheckingDni(false);
    }

    if (abortar) {
      return;
    }

    if (dniExiste) {
      enqueueSnackbar(`Ya existe un estudiante registrado con el DNI ${dni}.`, { variant: 'warning' });
      return;
    }

    const payload: EstudianteInicialPayload = {
      dni,
      nombre: values.nombre.trim(),
      apellido: values.apellido.trim(),
      profesorado_id: Number(values.profesoradoId),
      is_active: values.is_active,
      must_change_password: values.must_change_password,
    };

    if (values.email.trim()) payload.email = values.email.trim();
    if (values.telefono.trim()) payload.telefono = values.telefono.trim();
    if (values.domicilio.trim()) payload.domicilio = values.domicilio.trim();
    if (values.fecha_nacimiento) payload.fecha_nacimiento = values.fecha_nacimiento;
    if (values.estado_legajo) payload.estado_legajo = values.estado_legajo;
    if (values.anio_ingreso.trim()) payload.anio_ingreso = values.anio_ingreso.trim();
    if (values.genero.trim()) payload.genero = values.genero.trim();
    if (values.rol_extra.trim()) payload.rol_extra = values.rol_extra.trim();
    if (values.observaciones.trim()) payload.observaciones = values.observaciones.trim();
    if (values.cuil.trim()) payload.cuil = values.cuil.trim();
    if (values.cohorte.trim()) payload.cohorte = values.cohorte.trim();
    if (values.password.trim()) {
      payload.password = values.password.trim();
    } else {
      payload.password = `pass${dni}`;
    }

    mutation.mutate(payload);
  };

  const isSaving = mutation.isLoading || checkingDni;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Registrar estudiante (carga inicial)</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <Typography variant="body2" color="text.secondary">
            Los campos marcados con * son obligatorios.
          </Typography>
          {profesoradosQuery.isError && (
            <Alert severity="error">No se pudo obtener la lista de profesorados.</Alert>
          )}

          <Box component="form" noValidate>
            <Grid container spacing={2}>
              <Grid item xs={12} md={4}>
                <Controller
                  name="dni"
                  control={control}
                  rules={{ required: 'El DNI es obligatorio.' }}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      label="DNI *"
                      fullWidth
                      error={!!errors.dni}
                      helperText={errors.dni?.message}
                    />
                  )}
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <Controller
                  name="apellido"
                  control={control}
                  rules={{ required: 'El apellido es obligatorio.' }}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      label="Apellido *"
                      fullWidth
                      error={!!errors.apellido}
                      helperText={errors.apellido?.message}
                    />
                  )}
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <Controller
                  name="nombre"
                  control={control}
                  rules={{ required: 'El nombre es obligatorio.' }}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      label="Nombre *"
                      fullWidth
                      error={!!errors.nombre}
                      helperText={errors.nombre?.message}
                    />
                  )}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <Controller
                  name="profesoradoId"
                  control={control}
                  rules={{ required: 'SeleccionÃ¡ un profesorado.' }}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      select
                      label="Profesorado *"
                      fullWidth
                      disabled={profesoradosQuery.isLoading || profesoradosQuery.isError}
                      error={!!errors.profesoradoId}
                      helperText={errors.profesoradoId?.message}
                    >
                      {profesorados.map((prof) => (
                        <MenuItem key={prof.id} value={String(prof.id)}>
                          {prof.nombre}
                        </MenuItem>
                      ))}
                    </TextField>
                  )}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <Controller
                  name="estado_legajo"
                  control={control}
                  render={({ field }) => (
                    <TextField {...field} select label="Estado de legajo" fullWidth>
                      <MenuItem value="">
                        <em>No especificado</em>
                      </MenuItem>
                      {ESTADO_LEGAJO_OPTIONS.map((option) => (
                        <MenuItem key={option.value} value={option.value}>
                          {option.label}
                        </MenuItem>
                      ))}
                    </TextField>
                  )}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <Controller
                  name="email"
                  control={control}
                  render={({ field }) => (
                    <TextField {...field} label="Correo electrónico" type="email" fullWidth />
                  )}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <Controller
                  name="telefono"
                  control={control}
                  render={({ field }) => (
                    <TextField {...field} label="Teléfono" fullWidth />
                  )}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <Controller
                  name="domicilio"
                  control={control}
                  render={({ field }) => (
                    <TextField {...field} label="Domicilio" fullWidth />
                  )}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <Controller
                  name="fecha_nacimiento"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      label="Fecha de nacimiento"
                      type="date"
                      InputLabelProps={{ shrink: true }}
                      fullWidth
                    />
                  )}
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <Controller
                  name="anio_ingreso"
                  control={control}
                  render={({ field }) => (
                    <TextField {...field} label="Año de ingreso" fullWidth />
                  )}
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <Controller
                  name="cohorte"
                  control={control}
                  render={({ field }) => (
                    <TextField {...field} label="Cohorte" fullWidth />
                  )}
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <Controller
                  name="genero"
                  control={control}
                  render={({ field }) => (
                    <TextField {...field} label="Género" fullWidth />
                  )}
                />
              </Grid>
              <Grid item xs={12}>
                <Controller
                  name="rol_extra"
                  control={control}
                  render={({ field }) => (
                    <TextField {...field} label="Rol extra" fullWidth />
                  )}
                />
              </Grid>
              <Grid item xs={12}>
                <Controller
                  name="observaciones"
                  control={control}
                  render={({ field }) => (
                    <TextField {...field} label="Observaciones" multiline minRows={2} fullWidth />
                  )}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <Controller
                  name="cuil"
                  control={control}
                  render={({ field }) => (
                    <TextField {...field} label="CUIL" fullWidth />
                  )}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <Controller
                  name="password"
                  control={control}
                  render={({ field }) => (
                    <TextField {...field} label="Contraseña inicial" fullWidth />
                  )}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <Controller
                  name="is_active"
                  control={control}
                  render={({ field }) => (
                    <FormControlLabel
                      control={<Checkbox {...field} checked={field.value} />}
                      label="Activar cuenta"
                    />
                  )}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <Controller
                  name="must_change_password"
                  control={control}
                  render={({ field }) => (
                    <FormControlLabel
                      control={<Checkbox {...field} checked={field.value} />}
                      label="Solicitar cambio de contraseña"
                    />
                  )}
                />
              </Grid>
            </Grid>
          </Box>

          {mutation.isError && (
            <Alert severity="error">{(mutation.error as any)?.response?.data?.message || 'No se pudo guardar el estudiante.'}</Alert>
          )}
          {mutation.isSuccess && (
            <Alert severity="success">{mutation.data.message}</Alert>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={isSaving}>
          Cerrar
        </Button>
        <Button
          onClick={handleSubmit(onSubmit)}
          variant="contained"
          disabled={isSaving}
          startIcon={isSaving ? <CircularProgress size={18} color="inherit" /> : undefined}
        >
          {checkingDni ? 'Verificando...' : mutation.isLoading ? 'Guardando...' : 'Guardar estudiante'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

const PrimeraCargaPage: React.FC = () => {
  const navigate = useNavigate();
  const [openStudentDialog, setOpenStudentDialog] = useState(false);
  const [openPlanillaDialog, setOpenPlanillaDialog] = useState(false);
  const [openEquivalenciasDialog, setOpenEquivalenciasDialog] = useState(false);

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Primera Carga de Datos
      </Typography>
      <Typography variant="body1" color="text.secondary" mb={4}>
        Utilice esta secciÃ³n para realizar cargas iniciales de informaciÃ³n histÃ³rica en el sistema.
      </Typography>

      <Grid container spacing={3}>
        <Grid item xs={12} sm={6} md={4}>
          <Card variant="outlined">
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Carga de Estudiantes
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Registre estudiantes sin preinscripciÃ³n previa completando los datos disponibles.
              </Typography>
            </CardContent>
            <CardActions>
              <Button size="small" onClick={() => setOpenStudentDialog(true)}>
                Registrar estudiante
              </Button>
            </CardActions>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={4}>
          <Card variant="outlined">
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Carga de Regularidades
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Genera planillas para registrar regularidades o promociones histÃ³ricas.
              </Typography>
            </CardContent>
            <CardActions>
              <Button size="small" onClick={() => setOpenPlanillaDialog(true)}>
                Generar planilla
              </Button>
              <Button size="small" onClick={() => navigate('/admin/primera-carga/actas-examen')}>
                Cargar acta de examen
              </Button>
            </CardActions>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={4}>
          <Card variant="outlined">
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Carga de Equivalencias
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Registra de manera masiva las equivalencias curriculares entre espacios.
              </Typography>
            </CardContent>
            <CardActions>
              <Button size="small" onClick={() => setOpenEquivalenciasDialog(true)}>
                Cargar equivalencias
              </Button>
            </CardActions>
          </Card>
        </Grid>
      </Grid>

      <StudentManualDialog open={openStudentDialog} onClose={() => setOpenStudentDialog(false)} />

      <UploadDialog
        open={openEquivalenciasDialog}
        onClose={() => setOpenEquivalenciasDialog(false)}
        title="Cargar Equivalencias"
        description="Suba un archivo CSV/Excel con las equivalencias curriculares."
        uploadFunction={uploadEquivalencias}
        exampleFileName="ejemplo_equivalencias.csv"
      />

      <PlanillaRegularidadDialog
        open={openPlanillaDialog}
        onClose={() => setOpenPlanillaDialog(false)}
      />
    </Box>
  );
};

export default PrimeraCargaPage;
