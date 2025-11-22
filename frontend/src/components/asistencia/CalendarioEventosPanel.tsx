import { useMemo, useState } from "react";
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  Grid,
  IconButton,
  Paper,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import CloseIcon from "@mui/icons-material/Close";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import EditIcon from "@mui/icons-material/Edit";
import PauseCircleIcon from "@mui/icons-material/PauseCircle";
import dayjs from "dayjs";
import { Controller, useForm } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSnackbar } from "notistack";

import {
  CalendarioEvento,
  CalendarioEventoPayload,
  actualizarCalendarioEvento,
  crearCalendarioEvento,
  desactivarCalendarioEvento,
  listCalendarioEventos,
} from "@/api/asistencia";
import { listarDocentes, DocenteDTO } from "@/api/docentes";
import { fetchCarreras, listarPlanes, Carrera, PlanDetalle } from "@/api/carreras";
import { listarComisiones, listarTurnos, ComisionDTO, TurnoDTO } from "@/api/comisiones";

type Option = { id: number; label: string };

type CalendarioEventoFormValues = {
  id?: number;
  nombre: string;
  tipo: string;
  subtipo?: string | null;
  fecha_desde: string;
  fecha_hasta: string;
  turnos: number[];
  aplica_docentes: boolean;
  aplica_estudiantes: boolean;
  motivo?: string;
  profesorado_id?: number | null;
  plan_id?: number | null;
  comision_id?: number | null;
  docente_id?: number | null;
};

const today = dayjs().format("YYYY-MM-DD");

const tipoOptions: Option[] = [
  { id: 1, label: "Feriado" },
  { id: 2, label: "Suspensión de actividades" },
  { id: 3, label: "Licencia institucional" },
  { id: 4, label: "Feria / período sin asistencia" },
];

const tipoValueMap: Record<number, string> = {
  1: "feriado",
  2: "suspension",
  3: "licencia",
  4: "receso",
};

const subtipoOptions: Record<string, Option[]> = {
  feriado: [
    { id: 1, label: "General" },
    { id: 2, label: "Feria académica / receso" },
    { id: 3, label: "Período sin asistencia" },
    { id: 4, label: "Otro" },
  ],
  suspension: [
    { id: 1, label: "General" },
    { id: 2, label: "Período sin asistencia" },
    { id: 3, label: "Otro" },
  ],
  licencia: [
    { id: 1, label: "Licencia especial de invierno" },
    { id: 2, label: "Licencia anual reglamentaria (LAR)" },
    { id: 3, label: "Licencia docente individual" },
    { id: 4, label: "Otro" },
  ],
  receso: [
    { id: 1, label: "Feria académica / receso" },
    { id: 2, label: "Período sin asistencia" },
    { id: 3, label: "General" },
  ],
};

const subtipoValueMap: Record<string, Record<number, string>> = {
  feriado: {
    1: "general",
    2: "feria_academica",
    3: "periodo_sin_asistencia",
    4: "otro",
  },
  suspension: {
    1: "general",
    2: "periodo_sin_asistencia",
    3: "otro",
  },
  licencia: {
    1: "licencia_invierno",
    2: "licencia_anual",
    3: "licencia_docente",
    4: "otro",
  },
  receso: {
    1: "feria_academica",
    2: "periodo_sin_asistencia",
    3: "general",
  },
};

const quickRanges = [
  { label: "LAR (50 días)", days: 50, subtipo: "licencia_anual" },
  { label: "Invierno (15 días)", days: 15, subtipo: "licencia_invierno" },
];

const defaultValues: CalendarioEventoFormValues = {
  nombre: "",
  tipo: "feriado",
  subtipo: "general",
  fecha_desde: today,
  fecha_hasta: today,
  turnos: [],
  aplica_docentes: true,
  aplica_estudiantes: true,
  motivo: "",
  profesorado_id: null,
  plan_id: null,
  comision_id: null,
  docente_id: null,
};

const formatFecha = (fecha: string) => dayjs(fecha).format("DD/MM/YYYY");

const scopeSummary = (evento: CalendarioEvento): string[] => {
  const badges: string[] = [];
  if (evento.turno_nombre) badges.push(`Turno ${evento.turno_nombre}`);
  if (evento.profesorado_nombre) badges.push(evento.profesorado_nombre);
  if (evento.plan_resolucion) badges.push(`Plan ${evento.plan_resolucion}`);
  if (evento.comision_nombre) badges.push(`Comisión ${evento.comision_nombre}`);
  if (evento.docente_nombre) badges.push(`Docente ${evento.docente_nombre}`);
  if (!badges.length) badges.push("General");
  return badges;
};

type Props = {
  canManage: boolean;
};

const CalendarioEventosPanel = ({ canManage }: Props) => {
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();
  const [soloActivos, setSoloActivos] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEvento, setEditingEvento] = useState<CalendarioEvento | null>(null);

  const eventosKey = ["asistencia", "calendario", soloActivos ? "activos" : "todos"];

  const { data: eventos, isLoading: eventosLoading } = useQuery({
    queryKey: eventosKey,
    queryFn: () => listCalendarioEventos({ solo_activos: soloActivos }),
    staleTime: 60 * 1000,
  });

  const { data: turnosData } = useQuery({
    queryKey: ["turnos"],
    queryFn: listarTurnos,
    staleTime: 10 * 60 * 1000,
  });

  const { data: profesoradosData } = useQuery({
    queryKey: ["profesorados"],
    queryFn: fetchCarreras,
    staleTime: 5 * 60 * 1000,
  });

  const { data: docentesData } = useQuery({
    queryKey: ["docentes"],
    queryFn: listarDocentes,
    staleTime: 5 * 60 * 1000,
  });

  const {
    control,
    handleSubmit,
    watch,
    reset,
    setValue,
    formState: { isSubmitting },
  } = useForm<CalendarioEventoFormValues>({
    defaultValues,
  });

  const selectedProfesoradoId = watch("profesorado_id");
  const selectedPlanId = watch("plan_id");

  const { data: planesData, isFetching: planesLoading } = useQuery({
    queryKey: ["planes", selectedProfesoradoId ?? 0],
    queryFn: () => listarPlanes(selectedProfesoradoId!),
    enabled: Boolean(selectedProfesoradoId),
    staleTime: 5 * 60 * 1000,
  });

  const { data: comisionesData, isFetching: comisionesLoading } = useQuery({
    queryKey: ["comisiones", selectedPlanId ?? 0],
    queryFn: () => listarComisiones({ plan_id: selectedPlanId ?? undefined }),
    enabled: Boolean(selectedPlanId),
    staleTime: 5 * 60 * 1000,
  });

  const turnosOptions = useMemo<Option[]>(() => {
    if (!turnosData) return [];
    return turnosData.map((turno) => ({ id: turno.id, label: turno.nombre }));
  }, [turnosData]);

  const profesoradoOptions = useMemo<Option[]>(() => {
    if (!profesoradosData) return [];
    return profesoradosData.map((prof: Carrera) => ({ id: prof.id, label: prof.nombre }));
  }, [profesoradosData]);

  const planOptions = useMemo<Option[]>(() => {
    if (!planesData) return [];
    return planesData.map((plan: PlanDetalle) => ({
      id: plan.id,
      label: plan.resolucion,
    }));
  }, [planesData]);

  const comisionOptions = useMemo<Option[]>(() => {
    if (!comisionesData) return [];
    return comisionesData.map((comision: ComisionDTO) => ({
      id: comision.id,
      label: `${comision.codigo} - ${comision.materia_nombre}`,
    }));
  }, [comisionesData]);

  const docenteOptions = useMemo<Option[]>(() => {
    if (!docentesData) return [];
    return docentesData.map((docente: DocenteDTO) => {
      const nombre = `${docente.apellido ?? ""} ${docente.nombre ?? ""}`.trim();
      return { id: docente.id, label: nombre || docente.dni };
    });
  }, [docentesData]);

  const invalidateEventos = () => {
    queryClient.invalidateQueries({ queryKey: ["asistencia", "calendario"] });
  };

  const createMutation = useMutation({
    mutationFn: (payload: CalendarioEventoPayload) => crearCalendarioEvento(payload),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: CalendarioEventoPayload }) =>
      actualizarCalendarioEvento(id, payload),
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: number) => desactivarCalendarioEvento(id),
  });

  const handleDialogClose = () => {
    setDialogOpen(false);
    setEditingEvento(null);
    reset(defaultValues);
  };

  const openForCreate = () => {
    setEditingEvento(null);
    reset(defaultValues);
    setDialogOpen(true);
  };

  const openForEdit = (evento: CalendarioEvento) => {
    setEditingEvento(evento);
    reset({
      id: evento.id,
      nombre: evento.nombre,
      tipo: evento.tipo,
      subtipo: evento.subtipo,
      fecha_desde: evento.fecha_desde,
      fecha_hasta: evento.fecha_hasta,
      turnos: evento.turno_id ? [evento.turno_id] : [],
      aplica_docentes: evento.aplica_docentes,
      aplica_estudiantes: evento.aplica_estudiantes,
      motivo: evento.motivo ?? "",
      profesorado_id: evento.profesorado_id ?? null,
      plan_id: evento.plan_id ?? null,
      comision_id: evento.comision_id ?? null,
      docente_id: evento.docente_id ?? null,
    });
    setDialogOpen(true);
  };

  const toPayload = (values: CalendarioEventoFormValues, turnoId: number | null): CalendarioEventoPayload => ({
    nombre: values.nombre,
    tipo: values.tipo,
    subtipo: values.subtipo ?? null,
    fecha_desde: values.fecha_desde,
    fecha_hasta: values.fecha_hasta,
    turno_id: turnoId,
    profesorado_id: values.profesorado_id ?? null,
    plan_id: values.plan_id ?? null,
    comision_id: values.comision_id ?? null,
    docente_id: values.docente_id ?? null,
    aplica_docentes: values.aplica_docentes,
    aplica_estudiantes: values.aplica_estudiantes,
    motivo: values.motivo ?? "",
    activo: true,
  });

  const onSubmit = async (values: CalendarioEventoFormValues) => {
    if (dayjs(values.fecha_desde).isAfter(dayjs(values.fecha_hasta))) {
      enqueueSnackbar("La fecha desde no puede ser posterior a la fecha hasta.", { variant: "warning" });
      return;
    }

    const turnosObjetivo = values.turnos?.length ? values.turnos : [null];

    try {
      if (editingEvento) {
        const payload = toPayload(values, turnosObjetivo[0] ?? null);
        await updateMutation.mutateAsync({ id: editingEvento.id, payload });
        enqueueSnackbar("Evento actualizado correctamente.", { variant: "success" });
      } else {
        await Promise.all(
          turnosObjetivo.map((turnoId) =>
            createMutation.mutateAsync(toPayload(values, turnoId ?? null)),
          ),
        );
        enqueueSnackbar("Evento(s) creados correctamente.", { variant: "success" });
      }
      invalidateEventos();
      handleDialogClose();
    } catch (error: any) {
      const message =
        error?.response?.data?.detail ||
        error?.response?.data?.message ||
        "No se pudo guardar el evento.";
      enqueueSnackbar(message, { variant: "error" });
    }
  };

  const handleDeactivate = async (evento: CalendarioEvento) => {
    if (!evento.activo) return;
    const confirmar = window.confirm(
      `¿Deseas desactivar "${evento.nombre}"? Las clases volverán a generarse normalmente.`,
    );
    if (!confirmar) return;
    try {
      await deactivateMutation.mutateAsync(evento.id);
      enqueueSnackbar("Evento desactivado.", { variant: "info" });
      invalidateEventos();
    } catch (error: any) {
      const message =
        error?.response?.data?.detail ||
        error?.response?.data?.message ||
        "No se pudo desactivar el evento.";
      enqueueSnackbar(message, { variant: "error" });
    }
  };

  const handleQuickRange = (days: number, subtipo?: string) => {
    const inicio = watch("fecha_desde");
    if (!inicio) {
      enqueueSnackbar("Selecciona una fecha de inicio para aplicar el rango.", { variant: "info" });
      return;
    }
    const fin = dayjs(inicio).add(days - 1, "day").format("YYYY-MM-DD");
    setValue("fecha_hasta", fin);
    if (subtipo) {
      setValue("subtipo", subtipo);
    }
  };

  const currentTipo = watch("tipo") || "feriado";
  const turnosSeleccionados = watch("turnos");

  const subtipoItems = subtipoOptions[currentTipo] ?? subtipoOptions.feriado;
  const turnosHelper =
    !editingEvento || !turnosSeleccionados?.length
      ? undefined
      : "Editar un evento solo permite seleccionar un turno a la vez.";

  return (
    <Paper elevation={1} sx={{ p: 3 }}>
      <Stack spacing={2}>
        <Stack direction="row" spacing={1.5} alignItems="center" justifyContent="space-between">
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Chip icon={<CalendarMonthIcon />} label="Calendario institucional" color="default" />
            <Typography variant="body2" color="text.secondary">
              Suspensiones, feriados y licencias vigentes para asistencia.
            </Typography>
          </Stack>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <FormControlLabel
              control={
                <Switch
                  checked={soloActivos}
                  onChange={(_, checked) => setSoloActivos(checked)}
                  color="primary"
                />
              }
              label={soloActivos ? "Solo activos" : "Ver todos"}
            />
            {canManage && (
              <Button
                startIcon={<AddIcon />}
                variant="contained"
                color="secondary"
                onClick={openForCreate}
              >
                Nuevo evento
              </Button>
            )}
          </Stack>
        </Stack>

        {eventosLoading ? (
          <Box display="flex" justifyContent="center" py={3}>
            <CircularProgress size={32} />
          </Box>
        ) : !eventos || eventos.length === 0 ? (
          <Alert severity="info">No hay eventos cargados para el criterio seleccionado.</Alert>
        ) : (
          <Stack spacing={1.2} sx={{ maxHeight: 260, overflowY: "auto" }}>
            {eventos.map((evento) => (
              <Paper key={evento.id} variant="outlined" sx={{ p: 1.5 }}>
                <Stack spacing={0.5}>
                  <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
                    <Box>
                      <Typography variant="subtitle2" fontWeight={600}>
                        {evento.nombre} - {evento.tipo}
                      </Typography>
                      {!evento.activo && (
                        <Chip label="Inactivo" size="small" color="default" sx={{ mt: 0.5 }} />
                      )}
                    </Box>
                    {canManage && (
                      <Stack direction="row" spacing={1}>
                        <Tooltip title="Editar evento">
                          <IconButton size="small" onClick={() => openForEdit(evento)}>
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        {evento.activo && (
                          <Tooltip title="Desactivar evento">
                            <IconButton
                              size="small"
                              color="warning"
                              onClick={() => handleDeactivate(evento)}
                            >
                              <PauseCircleIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                      </Stack>
                    )}
                  </Stack>
                  <Typography variant="body2" color="text.secondary">
                    {formatFecha(evento.fecha_desde)} - {formatFecha(evento.fecha_hasta)}
                  </Typography>
                  <Stack direction="row" spacing={0.5} flexWrap="wrap">
                    {scopeSummary(evento).map((scope) => (
                      <Chip key={`${evento.id}-${scope}`} label={scope} size="small" />
                    ))}
                    <Chip
                      label={evento.aplica_docentes ? "Docentes incluidos" : "Sin docentes"}
                      size="small"
                      color={evento.aplica_docentes ? "primary" : "default"}
                    />
                    <Chip
                      label={evento.aplica_estudiantes ? "Estudiantes incluidos" : "Sin estudiantes"}
                      size="small"
                      color={evento.aplica_estudiantes ? "primary" : "default"}
                    />
                  </Stack>
                  {evento.motivo && (
                    <Typography variant="caption" color="text.secondary">
                      {evento.motivo}
                    </Typography>
                  )}
                </Stack>
              </Paper>
            ))}
          </Stack>
        )}
      </Stack>

      <Dialog
        open={dialogOpen}
        onClose={handleDialogClose}
        maxWidth="md"
        fullWidth
        aria-labelledby="calendario-evento-dialog-title"
      >
        <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          {editingEvento ? "Editar evento de asistencia" : "Nuevo evento de asistencia"}
          <IconButton onClick={handleDialogClose}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          <Box component="form" onSubmit={handleSubmit(onSubmit)}>
            <Stack spacing={2}>
              <Controller
                name="nombre"
                control={control}
                rules={{ required: "El nombre es obligatorio" }}
                render={({ field, fieldState }) => (
                  <TextField
                    {...field}
                    label="Nombre del evento"
                    error={Boolean(fieldState.error)}
                    helperText={fieldState.error?.message || "Ej: Suspensión por paro provincial"}
                    fullWidth
                  />
                )}
              />

              <Grid container spacing={1.5}>
                <Grid item xs={12} md={4}>
                  <Controller
                    name="tipo"
                    control={control}
                    render={({ field }) => (
                      <Autocomplete
                        options={tipoOptions}
                        value={
                          tipoOptions.find((opt) => tipoValueMap[opt.id] === field.value) ?? null
                        }
                        onChange={(_, option) => {
                          const value = option ? tipoValueMap[option.id] : "feriado";
                          field.onChange(value);
                          // reset subtype to default of new type
                          const defaultSubtipo = (subtipoOptions[value] || subtipoOptions.feriado)[0];
                          setValue("subtipo", subtipoValueMap[value][defaultSubtipo.id]);
                        }}
                        renderInput={(params) => <TextField {...params} label="Tipo" required />}
                      />
                    )}
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <Controller
                    name="subtipo"
                    control={control}
                    render={({ field }) => (
                      <Autocomplete
                        options={subtipoItems}
                        value={
                          subtipoItems.find(
                            (opt) => subtipoValueMap[currentTipo]?.[opt.id] === field.value,
                          ) ?? null
                        }
                        onChange={(_, option) =>
                          field.onChange(option ? subtipoValueMap[currentTipo][option.id] : null)
                        }
                        renderInput={(params) => (
                          <TextField {...params} label="Subtipo / categoría" required />
                        )}
                      />
                    )}
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <Controller
                    name="motivo"
                    control={control}
                    render={({ field }) => (
                      <TextField {...field} label="Motivo / detalle" placeholder="Opcional" />
                    )}
                  />
                </Grid>
              </Grid>

              <Grid container spacing={1.5}>
                <Grid item xs={12} md={6}>
                  <Controller
                    name="fecha_desde"
                    control={control}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        type="date"
                        label="Desde"
                        InputLabelProps={{ shrink: true }}
                        fullWidth
                      />
                    )}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <Controller
                    name="fecha_hasta"
                    control={control}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        type="date"
                        label="Hasta"
                        InputLabelProps={{ shrink: true }}
                        fullWidth
                      />
                    )}
                  />
                </Grid>
              </Grid>

              <Stack direction="row" spacing={1} flexWrap="wrap">
                {quickRanges.map((item) => (
                  <Chip
                    key={item.label}
                    label={item.label}
                    size="small"
                    onClick={() => handleQuickRange(item.days, item.subtipo)}
                    sx={{ cursor: "pointer" }}
                  />
                ))}
              </Stack>

              <Controller
                name="turnos"
                control={control}
                render={({ field }) => (
                  <Autocomplete
                    multiple
                    options={turnosOptions}
                    value={turnosOptions.filter((opt) => field.value?.includes(opt.id))}
                    onChange={(_, values) => {
                      if (editingEvento && values.length > 1) {
                        const last = values[values.length - 1];
                        field.onChange(last ? [last.id] : []);
                      } else {
                        field.onChange(values.map((opt) => opt.id));
                      }
                    }}
                    disableCloseOnSelect
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label="Turnos afectados"
                        helperText={
                          turnosHelper ??
                          "Deja vacío para aplicar a todos los turnos o selecciona varios (solo en altas)."
                        }
                      />
                    )}
                  />
                )}
              />

              <Divider />

              <Typography variant="subtitle2" fontWeight={600}>
                Alcance del evento
              </Typography>

              <Grid container spacing={1.5}>
                <Grid item xs={12} md={4}>
                  <Controller
                    name="profesorado_id"
                    control={control}
                    render={({ field }) => (
                      <Autocomplete
                        options={profesoradoOptions}
                        value={profesoradoOptions.find((opt) => opt.id === field.value) ?? null}
                        onChange={(_, option) => {
                          field.onChange(option?.id ?? null);
                          setValue("plan_id", null);
                          setValue("comision_id", null);
                        }}
                        renderInput={(params) => (
                          <TextField {...params} label="Profesorado (opcional)" />
                        )}
                      />
                    )}
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <Controller
                    name="plan_id"
                    control={control}
                    render={({ field }) => (
                      <Autocomplete
                        options={planOptions}
                        loading={planesLoading}
                        value={planOptions.find((opt) => opt.id === field.value) ?? null}
                        onChange={(_, option) => {
                          field.onChange(option?.id ?? null);
                          setValue("comision_id", null);
                        }}
                        disabled={!selectedProfesoradoId}
                        renderInput={(params) => (
                          <TextField
                            {...params}
                            label="Plan de estudio"
                            helperText={selectedProfesoradoId ? undefined : "Selecciona un profesorado"}
                          />
                        )}
                      />
                    )}
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <Controller
                    name="comision_id"
                    control={control}
                    render={({ field }) => (
                      <Autocomplete
                        options={comisionOptions}
                        loading={comisionesLoading}
                        value={comisionOptions.find((opt) => opt.id === field.value) ?? null}
                        onChange={(_, option) => field.onChange(option?.id ?? null)}
                        disabled={!selectedPlanId}
                        renderInput={(params) => (
                          <TextField
                            {...params}
                            label="Comisión / cátedra"
                            helperText={selectedPlanId ? undefined : "Selecciona un plan"}
                          />
                        )}
                      />
                    )}
                  />
                </Grid>
              </Grid>

              <Controller
                name="docente_id"
                control={control}
                render={({ field }) => (
                  <Autocomplete
                    options={docenteOptions}
                    value={docenteOptions.find((opt) => opt.id === field.value) ?? null}
                    onChange={(_, option) => {
                      field.onChange(option?.id ?? null);
                      if (option) {
                        setValue("aplica_docentes", true);
                      }
                    }}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label="Docente (opcional)"
                        helperText="Úsalo para licencias particulares (LAR, invierno, etc.)."
                      />
                    )}
                  />
                )}
              />

              <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                <Controller
                  name="aplica_docentes"
                  control={control}
                  render={({ field }) => (
                    <FormControlLabel
                      control={<Switch {...field} checked={field.value} />}
                      label="Impacta en docentes"
                    />
                  )}
                />
                <Controller
                  name="aplica_estudiantes"
                  control={control}
                  render={({ field }) => (
                    <FormControlLabel
                      control={<Switch {...field} checked={field.value} />}
                      label="Impacta en estudiantes"
                    />
                  )}
                />
              </Stack>
            </Stack>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDialogClose}>Cancelar</Button>
          <Button
            onClick={handleSubmit(onSubmit)}
            variant="contained"
            disabled={isSubmitting || createMutation.isPending || updateMutation.isPending}
          >
            {editingEvento ? "Guardar cambios" : "Crear evento"}
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
};

export default CalendarioEventosPanel;
