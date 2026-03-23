import { useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import FormControlLabel from "@mui/material/FormControlLabel";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import Typography from "@mui/material/Typography";
import AddIcon from "@mui/icons-material/Add";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import dayjs from "dayjs";
import { useForm } from "react-hook-form";
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

import { CalendarioEventoFormValues } from "./calendario-eventos-panel/types";
import { defaultValues } from "./calendario-eventos-panel/constants";
import EventoCard from "./calendario-eventos-panel/EventoCard";
import EventoFormDialog from "./calendario-eventos-panel/EventoFormDialog";

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

  const form = useForm<CalendarioEventoFormValues>({ defaultValues });

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

  const invalidateEventos = () => {
    queryClient.invalidateQueries({ queryKey: ["asistencia", "calendario"] });
  };

  const handleDialogClose = () => {
    setDialogOpen(false);
    setEditingEvento(null);
    form.reset(defaultValues);
  };

  const openForCreate = () => {
    setEditingEvento(null);
    form.reset(defaultValues);
    setDialogOpen(true);
  };

  const openForEdit = (evento: CalendarioEvento) => {
    setEditingEvento(evento);
    form.reset({
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
              <EventoCard
                key={evento.id}
                evento={evento}
                canManage={canManage}
                onEdit={openForEdit}
                onDeactivate={handleDeactivate}
              />
            ))}
          </Stack>
        )}
      </Stack>

      <EventoFormDialog
        open={dialogOpen}
        editingEvento={editingEvento}
        form={form}
        onClose={handleDialogClose}
        onSubmit={onSubmit}
        isSubmitting={form.formState.isSubmitting}
        isPending={createMutation.isPending || updateMutation.isPending}
      />
    </Paper>
  );
};

export default CalendarioEventosPanel;
