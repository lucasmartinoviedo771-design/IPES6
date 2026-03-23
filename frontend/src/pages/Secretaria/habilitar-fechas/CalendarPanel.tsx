import React from "react";
import dayjs from "dayjs";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import FormControlLabel from "@mui/material/FormControlLabel";
import Grid from "@mui/material/Grid";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import EditIcon from "@mui/icons-material/Edit";

import {
  Ventana,
  CalendarPeriod,
  CALENDAR_PERIODS,
  CALENDAR_TYPE,
  makeCalendarDraftKey,
  defaultFirstCalendarDraft,
  buildDefaultCalendarDraft,
  formatRange,
  classifyVentana,
} from "./constants";

type CalendarPanelProps = {
  list: Ventana[];
  drafts: Record<string, Ventana>;
  setDrafts: React.Dispatch<React.SetStateAction<Record<string, Ventana>>>;
  saving: Record<string, boolean>;
  onSave: (ventana: Ventana) => void;
  onEdit: (ventana: Ventana) => void;
  notify: (message: string, options?: any) => void;
  setExpandedPanel: (panel: string | null) => void;
};

const CalendarPanel: React.FC<CalendarPanelProps> = ({
  list,
  drafts,
  setDrafts,
  saving,
  onSave,
  onEdit,
  notify,
  setExpandedPanel,
}) => {
  const resolveDraft = (period: CalendarPeriod, state: Record<string, Ventana>): Ventana => {
    const key = makeCalendarDraftKey(period);
    if (state[key]) return state[key];
    const existing = list.find((ventana) => (ventana.periodo ?? (period === "1C" ? "1C" : "2C")) === period);
    if (existing) return { ...existing };
    if (period === "2C") {
      const first = state[makeCalendarDraftKey("1C")] ?? list.find((ventana) => (ventana.periodo ?? "1C") === "1C") ?? defaultFirstCalendarDraft();
      return buildDefaultCalendarDraft("2C", first);
    }
    return defaultFirstCalendarDraft();
  };

  const getDraft = (period: CalendarPeriod): Ventana => resolveDraft(period, drafts);

  const mergeDrafts = (updater: (current: Record<string, Ventana>) => Record<string, Ventana>) => {
    setDrafts((prev) => updater({ ...prev }));
  };

  const updateDraft = (period: CalendarPeriod, patch: Partial<Ventana>) => {
    mergeDrafts((state) => {
      const updatedState = { ...state };
      const current = resolveDraft(period, updatedState);
      const nextDraft: Ventana = { ...current, ...patch, tipo: CALENDAR_TYPE, periodo: period };
      updatedState[makeCalendarDraftKey(period)] = nextDraft;

      if (period === "1C") {
        const end = dayjs(nextDraft.hasta || nextDraft.desde);
        if (end.isValid()) {
          const counterpart = resolveDraft("2C", updatedState);
          const nextStart = end.add(1, "day");
          let updatedCounterpart: Ventana = { ...counterpart, tipo: CALENDAR_TYPE, periodo: "2C" };
          if (!dayjs(counterpart.desde).isSame(nextStart, "day")) {
            updatedCounterpart.desde = nextStart.format("YYYY-MM-DD");
          }
          if (!counterpart.hasta || dayjs(counterpart.hasta).isSameOrBefore(nextStart, "day")) {
            updatedCounterpart.hasta = nextStart.add(4, "month").endOf("month").format("YYYY-MM-DD");
          }
          updatedState[makeCalendarDraftKey("2C")] = updatedCounterpart;
        }
      }

      if (period === "2C") {
        const start = dayjs(nextDraft.desde);
        if (start.isValid()) {
          const counterpart = resolveDraft("1C", updatedState);
          const prevEnd = start.subtract(1, "day");
          let updatedCounterpart: Ventana = { ...counterpart, tipo: CALENDAR_TYPE, periodo: "1C" };
          if (!dayjs(counterpart.hasta).isSame(prevEnd, "day")) {
            updatedCounterpart.hasta = prevEnd.format("YYYY-MM-DD");
          }
          if (!counterpart.desde || dayjs(counterpart.desde).isAfter(prevEnd, "day")) {
            updatedCounterpart.desde = prevEnd.subtract(4, "month").startOf("month").format("YYYY-MM-DD");
          }
          updatedState[makeCalendarDraftKey("1C")] = updatedCounterpart;
        }
      }

      return updatedState;
    });
  };

  const handleSave = (period: CalendarPeriod) => {
    const draft = getDraft(period);
    const from = dayjs(draft.desde);
    const to = dayjs(draft.hasta);

    if (!from.isValid() || !to.isValid()) {
      notify("Revisa las fechas: deben ser válidas.", { variant: "warning" });
      return;
    }
    if (!to.isAfter(from, "day")) {
      notify("La fecha de fin debe ser posterior a la de inicio.", { variant: "warning" });
      return;
    }

    const otherPeriod: CalendarPeriod = period === "1C" ? "2C" : "1C";
    const otherDraft = getDraft(otherPeriod);

    if (period === "1C") {
      const expected = to.add(1, "day");
      if (otherDraft.desde && !dayjs(otherDraft.desde).isSame(expected, "day")) {
        notify("El segundo cuatrimestre debe comenzar el día siguiente a que finaliza el primer cuatrimestre.", { variant: "error" });
        return;
      }
    } else {
      if (!otherDraft.hasta) {
        notify("Definí primero la fecha de fin del primer cuatrimestre.", { variant: "warning" });
        return;
      }
      const expected = dayjs(otherDraft.hasta).add(1, "day");
      if (!dayjs(draft.desde).isSame(expected, "day")) {
        notify("El segundo cuatrimestre debe comenzar el día siguiente a que finaliza el primer cuatrimestre.", { variant: "error" });
        return;
      }
    }

    onSave({ ...draft, tipo: CALENDAR_TYPE, periodo: period });
  };

  const renderPeriodCard = (period: CalendarPeriod) => {
    const draft = getDraft(period);
    const history = list
      .filter((ventana) => (ventana.periodo ?? period) === period)
      .slice(0, 5);

    return (
      <Paper key={period} variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
        <Stack spacing={2}>
          <Box>
            <Typography variant="subtitle1" fontWeight={700}>
              {period === "1C" ? "1er Cuatrimestre" : "2do Cuatrimestre"}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {period === "1C"
                ? "Define el inicio y fin del primer cuatrimestre académico."
                : "Inicia automáticamente al finalizar el primero. Ajusta la fecha de fin según el calendario institucional."}
            </Typography>
          </Box>

          <Grid container spacing={2} alignItems="flex-start">
            <Grid item xs={12} md={6}>
              <TextField
                type="date"
                label="Desde"
                InputLabelProps={{ shrink: true }}
                fullWidth
                size="small"
                value={draft.desde}
                disabled={period === "2C"}
                onChange={(event) => updateDraft(period, { desde: event.target.value })}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                type="date"
                label="Hasta"
                InputLabelProps={{ shrink: true }}
                fullWidth
                size="small"
                value={draft.hasta}
                onChange={(event) => updateDraft(period, { hasta: event.target.value })}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControlLabel
                control={
                  <Switch
                    checked={!!draft.activo}
                    onChange={(event) => updateDraft(period, { activo: event.target.checked })}
                  />
                }
                label={draft.activo ? "Habilitado" : "Deshabilitado"}
              />
            </Grid>
          </Grid>

          <Stack direction="row" spacing={1} justifyContent="flex-end">
            <Button
              variant="contained"
              onClick={() => handleSave(period)}
              disabled={!!saving[CALENDAR_TYPE]}
            >
              {saving[CALENDAR_TYPE] ? "Guardando..." : "Guardar"} {period === "1C" ? "1er Cuatrimestre" : "2do Cuatrimestre"}
            </Button>
          </Stack>

          <Box>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              Historial
            </Typography>
            {history.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                Sin registros previos.
              </Typography>
            ) : (
              <Stack spacing={1.5}>
                {history.map((item) => {
                  const state = classifyVentana(item);
                  return (
                    <Paper
                      key={`${period}-${item.id ?? item.desde}`}
                      variant="outlined"
                      sx={{ p: 1.5, display: "flex", alignItems: "center", gap: 1 }}
                    >
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="body2" fontWeight={600}>
                          {formatRange(item)}
                        </Typography>
                        <Stack direction="row" spacing={1} sx={{ mt: 0.5 }}>
                          <Chip size="small" label={state.label} color={state.color} />
                          {item.activo ? (
                            <Chip size="small" color="success" variant="outlined" label="Habilitado" />
                          ) : (
                            <Chip size="small" variant="outlined" label="Cerrado" />
                          )}
                        </Stack>
                      </Box>
                      <Stack direction="row" spacing={0.5}>
                        <Tooltip title="Editar">
                          <span>
                            <Button
                              size="small"
                              variant="text"
                              startIcon={<EditIcon fontSize="small" />}
                              onClick={() => onEdit(item)}
                            >
                              Editar
                            </Button>
                          </span>
                        </Tooltip>
                        <Tooltip title="Usar estas fechas">
                          <span>
                            <Button
                              size="small"
                              variant="text"
                              onClick={() => {
                                mergeDrafts((state) => {
                                  const nextState = { ...state };
                                  nextState[makeCalendarDraftKey(period)] = { ...item };

                                  if (period === "1C") {
                                    const counterpart = resolveDraft("2C", nextState);
                                    const end = dayjs(item.hasta || item.desde);
                                    if (end.isValid()) {
                                      const nextStart = end.add(1, "day").format("YYYY-MM-DD");
                                      nextState[makeCalendarDraftKey("2C")] = {
                                        ...counterpart,
                                        tipo: CALENDAR_TYPE,
                                        periodo: "2C",
                                        desde: nextStart,
                                        hasta:
                                          dayjs(counterpart.hasta).isAfter(dayjs(nextStart), "day")
                                            ? counterpart.hasta
                                            : dayjs(nextStart).add(4, "month").endOf("month").format("YYYY-MM-DD"),
                                      };
                                    }
                                  } else {
                                    const counterpart = resolveDraft("1C", nextState);
                                    const start = dayjs(item.desde);
                                    if (start.isValid()) {
                                      const prevEnd = start.subtract(1, "day").format("YYYY-MM-DD");
                                      nextState[makeCalendarDraftKey("1C")] = {
                                        ...counterpart,
                                        tipo: CALENDAR_TYPE,
                                        periodo: "1C",
                                        hasta: prevEnd,
                                      };
                                    }
                                  }

                                  return nextState;
                                });
                                setExpandedPanel(CALENDAR_TYPE);
                              }}
                            >
                              Usar
                            </Button>
                          </span>
                        </Tooltip>
                      </Stack>
                    </Paper>
                  );
                })}
              </Stack>
            )}
          </Box>
        </Stack>
      </Paper>
    );
  };

  return (
    <Stack spacing={2}>
      <Typography variant="body2" color="text.secondary">
        Ajusta los períodos cuatrimestrales. El segundo cuatrimestre debe comenzar el día posterior a la finalización del primero.
      </Typography>
      <Grid container spacing={2}>
        {CALENDAR_PERIODS.map((period) => (
          <Grid item xs={12} md={6} key={period}>
            {renderPeriodCard(period)}
          </Grid>
        ))}
      </Grid>
    </Stack>
  );
};

export default CalendarPanel;
