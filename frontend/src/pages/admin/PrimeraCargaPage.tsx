
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
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

import PersonAdd from '@mui/icons-material/PersonAdd';
import FileCopy from '@mui/icons-material/FileCopy';
import CompareArrows from '@mui/icons-material/CompareArrows';
import HistoryIcon from '@mui/icons-material/History';
import FindInPage from '@mui/icons-material/FindInPage';

import {
  crearEstudianteInicial,
  EstudianteInicialPayload,
  registrarDisposicionEquivalenciaPrimeraCarga,
} from '@/api/primeraCarga';
import { EquivalenciaDisposicionPayload, fetchEstudianteAdminDetail } from '@/api/alumnos';
import { listarProfesorados, ProfesoradoDTO } from '@/api/cargaNotas';
import PlanillaRegularidadDialog from './PlanillaRegularidadDialog';
import EquivalenciaDisposicionDialog from "@/components/equivalencias/EquivalenciaDisposicionDialog";
import { PageHero } from "@/components/ui/GradientTitles";
import {
  ICON_GRADIENT,
  INSTITUTIONAL_TERRACOTTA,
  INSTITUTIONAL_TERRACOTTA_DARK,
  INSTITUTIONAL_GREEN,
} from "@/styles/institutionalColors";




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

  const isSaving = mutation.isPending || checkingDni;

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
          {checkingDni ? 'Verificando...' : mutation.isPending ? 'Guardando...' : 'Guardar estudiante'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

const PrimeraCargaPage: React.FC = () => {
  const navigate = useNavigate();
  const [openStudentDialog, setOpenStudentDialog] = useState(false);
  const [openPlanillaDialog, setOpenPlanillaDialog] = useState(false);
  const [openDisposicionDialog, setOpenDisposicionDialog] = useState(false);

  const handleRegistrarDisposicionPrimeraCarga = async (payload: EquivalenciaDisposicionPayload) => {
    await registrarDisposicionEquivalenciaPrimeraCarga(payload);
  };

  const iconBoxStyles = {
    width: 64,
    height: 64,
    borderRadius: 14,
    background: ICON_GRADIENT,
    color: "common.white",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 18px 35px rgba(0,0,0,0.15)",
  };

  const cardStyles = {
    height: "100%",
    borderRadius: 14,
    border: "1px solid rgba(125,127,110,0.25)",
    boxShadow: "0 20px 40px rgba(15,23,42,0.08)",
    backgroundColor: "#fff",
  };

  return (
    <Box sx={{ p: 3 }}>
      <PageHero
        title="Primera carga de datos"
        subtitle="Utilizá esta sección para realizar cargas iniciales de información histórica en el sistema."
        sx={{
          background: `linear-gradient(120deg, ${INSTITUTIONAL_GREEN} 0%, ${INSTITUTIONAL_TERRACOTTA} 100%)`,
        }}
      />

      <Grid container spacing={3}>
        <Grid item xs={12} md={4}>
          <Card sx={cardStyles}>
            <CardContent sx={{ height: "100%" }}>
              <Stack spacing={3} sx={{ height: "100%" }}>
                <Box
                  sx={iconBoxStyles}
                >
                  <PersonAdd fontSize="large" />
                </Box>
                <Box>
                  <Typography variant="h6" fontWeight={600}>
                    Carga de Estudiantes
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Registre estudiantes sin preinscripción previa completando los datos disponibles.
                  </Typography>
                </Box>
                <Button
                  variant="contained"
                  fullWidth
                  sx={{
                    mt: "auto",
                    borderRadius: 999,
                    backgroundColor: INSTITUTIONAL_TERRACOTTA,
                    "&:hover": { backgroundColor: INSTITUTIONAL_TERRACOTTA_DARK },
                  }}
                  onClick={() => setOpenStudentDialog(true)}
                >
                  Registrar estudiante
                </Button>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card sx={cardStyles}>
            <CardContent sx={{ height: "100%" }}>
              <Stack spacing={3} sx={{ height: "100%" }}>
                <Box
                  sx={iconBoxStyles}
                >
                  <FileCopy fontSize="large" />
                </Box>
                <Box>
                  <Typography variant="h6" fontWeight={600}>
                    Carga de Regularidades
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Genera plantillas para registrar regularidades o promociones históricas.
                  </Typography>
                </Box>
                <Stack spacing={1.5} sx={{ mt: "auto" }}>
                  <Button
                    variant="outlined"
                    fullWidth
                    sx={{
                      borderRadius: 999,
                      borderColor: INSTITUTIONAL_TERRACOTTA,
                      color: INSTITUTIONAL_TERRACOTTA,
                      "&:hover": { borderColor: INSTITUTIONAL_TERRACOTTA_DARK },
                    }}
                    onClick={() => setOpenPlanillaDialog(true)}
                  >
                    Planilla de Regularidad
                  </Button>
                  <Button
                    variant="contained"
                    fullWidth
                    sx={{
                      borderRadius: 999,
                      backgroundColor: INSTITUTIONAL_TERRACOTTA,
                      "&:hover": { backgroundColor: INSTITUTIONAL_TERRACOTTA_DARK },
                    }}
                    onClick={() => navigate("/admin/primera-carga/actas-examen")}
                  >
                    Acta de Examen Final
                  </Button>
                </Stack>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card sx={cardStyles}>
            <CardContent sx={{ height: "100%" }}>
              <Stack spacing={3} sx={{ height: "100%" }}>
                <Box
                  sx={iconBoxStyles}
                >
                  <CompareArrows fontSize="large" />
                </Box>
                <Box>
                  <Typography variant="h6" fontWeight={600}>
                    Equivalencias por disposición
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Registrá disposiciones históricas sin validar correlatividades (solo primera carga).
                  </Typography>
                </Box>
                <Button
                  variant="contained"
                  fullWidth
                  sx={{
                    mt: "auto",
                    borderRadius: 999,
                    backgroundColor: INSTITUTIONAL_TERRACOTTA,
                    "&:hover": { backgroundColor: INSTITUTIONAL_TERRACOTTA_DARK },
                  }}
                  onClick={() => setOpenDisposicionDialog(true)}
                >
                  Registrar equivalencias
                </Button>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card sx={cardStyles}>
            <CardContent sx={{ height: "100%" }}>
              <Stack spacing={3} sx={{ height: "100%" }}>
                <Box
                  sx={iconBoxStyles}
                >
                  <HistoryIcon fontSize="large" />
                </Box>
                <Box>
                  <Typography variant="h6" fontWeight={600}>
                    Historial de Actas Cargadas
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Consultá el listado de las actas de examen cargadas masivamente.
                  </Typography>
                </Box>
                <Button
                  variant="outlined"
                  fullWidth
                  sx={{
                    mt: "auto",
                    borderRadius: 999,
                    borderColor: INSTITUTIONAL_TERRACOTTA,
                    color: INSTITUTIONAL_TERRACOTTA,
                    "&:hover": { borderColor: INSTITUTIONAL_TERRACOTTA_DARK },
                  }}
                  onClick={() => navigate("/admin/primera-carga/historial-actas")}
                >
                  Ver Historial
                </Button>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card sx={cardStyles}>
            <CardContent sx={{ height: "100%" }}>
              <Stack spacing={3} sx={{ height: "100%" }}>
                <Box
                  sx={iconBoxStyles}
                >
                  <FindInPage fontSize="large" />
                </Box>
                <Box>
                  <Typography variant="h6" fontWeight={600}>
                    Historial de Regularidades
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Consultá el listado de las planillas de regularidad cargadas.
                  </Typography>
                </Box>
                <Button
                  variant="outlined"
                  fullWidth
                  sx={{
                    mt: "auto",
                    borderRadius: 999,
                    borderColor: INSTITUTIONAL_TERRACOTTA,
                    color: INSTITUTIONAL_TERRACOTTA,
                    "&:hover": { borderColor: INSTITUTIONAL_TERRACOTTA_DARK },
                  }}
                  onClick={() => navigate("/admin/primera-carga/historial-regularidades")}
                >
                  Ver Historial
                </Button>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <StudentManualDialog open={openStudentDialog} onClose={() => setOpenStudentDialog(false)} />

      <EquivalenciaDisposicionDialog
        open={openDisposicionDialog}
        onClose={() => setOpenDisposicionDialog(false)}
        title="Registrar equivalencias (Primera carga)"
        submitLabel="Registrar equivalencias"
        onSubmit={handleRegistrarDisposicionPrimeraCarga}
        requiresCorrelatividades={false}
      />

      <PlanillaRegularidadDialog
        open={openPlanillaDialog}
        onClose={() => setOpenPlanillaDialog(false)}
      />
    </Box>
  );
};

export default PrimeraCargaPage;
