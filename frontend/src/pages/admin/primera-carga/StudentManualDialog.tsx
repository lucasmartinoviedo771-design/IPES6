import React, { useEffect, useMemo, useState } from 'react';
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import FormControlLabel from "@mui/material/FormControlLabel";
import Grid from "@mui/material/Grid";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useForm, Controller } from 'react-hook-form';
import { useMutation, useQuery } from '@tanstack/react-query';
import { enqueueSnackbar } from 'notistack';

import { crearEstudianteInicial, EstudianteInicialPayload } from '@/api/primeraCarga';
import { fetchEstudianteAdminDetail } from '@/api/estudiantes';
import { listarProfesorados, ProfesoradoDTO } from '@/api/cargaNotas';

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

  const profesorados = useMemo<ProfesoradoDTO[]>(
    () => profesoradosQuery.data ?? [],
    [profesoradosQuery.data],
  );

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
      await fetchEstudianteAdminDetail(dni, { suppressErrorToast: true });
      dniExiste = true;
    } catch (error: any) {
      const status = error.status || error?.response?.status;
      if (status === 404) {
        dniExiste = false;
      } else {
        abortar = true;
        enqueueSnackbar('No se pudo verificar el DNI. Intentá nuevamente.', { variant: 'error' });
      }
    } finally {
      setCheckingDni(false);
    }

    if (abortar) return;

    if (dniExiste) {
      enqueueSnackbar(`Ya existe un estudiante registrado con el DNI ${dni}.`, {
        variant: 'warning',
      });
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

  const isSaving = mutation.isPending || checkingDni;

  return (
    <Dialog
      open={open}
      onClose={(event, reason) => {
        if (reason && reason === 'backdropClick') return;
        onClose();
      }}
      disableEscapeKeyDown
      maxWidth="md"
      fullWidth
    >
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
                  rules={{ required: 'Seleccioná un profesorado.' }}
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
                  render={({ field }) => <TextField {...field} label="Teléfono" fullWidth />}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <Controller
                  name="domicilio"
                  control={control}
                  render={({ field }) => <TextField {...field} label="Domicilio" fullWidth />}
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
                  render={({ field }) => <TextField {...field} label="Cohorte" fullWidth />}
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <Controller
                  name="genero"
                  control={control}
                  render={({ field }) => <TextField {...field} label="Género" fullWidth />}
                />
              </Grid>
              <Grid item xs={12}>
                <Controller
                  name="rol_extra"
                  control={control}
                  render={({ field }) => <TextField {...field} label="Rol extra" fullWidth />}
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
                  render={({ field }) => <TextField {...field} label="CUIL" fullWidth />}
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
            <Alert severity="error">
              {(mutation.error as any)?.response?.data?.message ||
                'No se pudo guardar el estudiante.'}
            </Alert>
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
          {checkingDni ? 'Verificando...' : mutation.isPending ? 'Guardando...' : 'Guardar estudiante'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default StudentManualDialog;
