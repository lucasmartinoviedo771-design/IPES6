import { useMemo } from "react";
import Autocomplete from "@mui/material/Autocomplete";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Divider from "@mui/material/Divider";
import FormControlLabel from "@mui/material/FormControlLabel";
import Grid from "@mui/material/Grid";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import CloseIcon from "@mui/icons-material/Close";
import { Controller, UseFormReturn } from "react-hook-form";
import { useQuery } from "@tanstack/react-query";
import { useSnackbar } from "notistack";
import dayjs from "dayjs";

import { CalendarioEvento } from "@/api/asistencia";
import { listarDocentes, DocenteDTO } from "@/api/docentes";
import { fetchCarreras, listarPlanes, Carrera, PlanDetalle } from "@/api/carreras";
import { listarComisiones, listarTurnos, ComisionDTO } from "@/api/comisiones";

import { CalendarioEventoFormValues, Option } from "./types";
import {
  tipoOptions,
  tipoValueMap,
  subtipoOptions,
  subtipoValueMap,
  quickRanges,
} from "./constants";

type Props = {
  open: boolean;
  editingEvento: CalendarioEvento | null;
  form: UseFormReturn<CalendarioEventoFormValues>;
  onClose: () => void;
  onSubmit: (values: CalendarioEventoFormValues) => Promise<void>;
  isSubmitting: boolean;
  isPending: boolean;
};

const EventoFormDialog = ({
  open,
  editingEvento,
  form,
  onClose,
  onSubmit,
  isSubmitting,
  isPending,
}: Props) => {
  const { control, handleSubmit, watch, setValue } = form;
  const { enqueueSnackbar } = useSnackbar();

  const currentTipo = watch("tipo") || "feriado";
  const selectedProfesoradoId = watch("profesorado_id");
  const selectedPlanId = watch("plan_id");
  const turnosSeleccionados = watch("turnos");

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

  const subtipoItems = subtipoOptions[currentTipo] ?? subtipoOptions.feriado;
  const turnosHelper =
    !editingEvento || !turnosSeleccionados?.length
      ? undefined
      : "Editar un evento solo permite seleccionar un turno a la vez.";

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

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      aria-labelledby="calendario-evento-dialog-title"
    >
      <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        {editingEvento ? "Editar evento de asistencia" : "Nuevo evento de asistencia"}
        <IconButton onClick={onClose}>
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
        <Button onClick={onClose}>Cancelar</Button>
        <Button
          onClick={handleSubmit(onSubmit)}
          variant="contained"
          disabled={isSubmitting || isPending}
        >
          {editingEvento ? "Guardar cambios" : "Crear evento"}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default EventoFormDialog;
