import React, { useEffect, useMemo, useRef, useState } from "react";
import dayjs from "dayjs";
import isSameOrAfter from "dayjs/plugin/isSameOrAfter";
import isSameOrBefore from "dayjs/plugin/isSameOrBefore";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Button,
  ButtonBase,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  Grid,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Switch,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { client as axios } from "@/api/client";
import { fetchVentanas, VentanaDto } from "@/api/ventanas";
import { useSnackbar } from "notistack";
import { PageHero, SectionTitlePill } from "@/components/ui/GradientTitles";
import BackButton from "@/components/ui/BackButton";

dayjs.extend(isSameOrAfter);
dayjs.extend(isSameOrBefore);

type Ventana = VentanaDto;

const LABEL_PERIODO: Record<string, string> = {
  "1C_ANUALES": "1er Cuatrimestre + Anuales",
  "2C": "2do Cuatrimestre",
  "1C": "1er Cuatrimestre",
};

const TYPE_CONFIG: Array<{
  key: Ventana["tipo"];
  label: string;
  category: "mesas" | "tramites";
  description: string;
}> = [
  {
    key: "MESAS_FINALES",
    label: "Mesas de examen - Ordinarias",
    category: "mesas",
    description: "Ventanas para las mesas ordinarias (antes denominadas finales).",
  },
  {
    key: "MESAS_EXTRA",
    label: "Mesas de examen - Extraordinarias",
    category: "mesas",
    description: "Ventanas para mesas extraordinarias habilitadas por dirección.",
  },
  {
    key: "MATERIAS",
    label: "Inscripciones a Materias",
    category: "tramites",
    description: "Períodos para que los estudiantes se inscriban a cursadas.",
  },
  {
    key: "COMISION",
    label: "Cambios de Comisión",
    category: "tramites",
    description: "Gestiona solicitudes de cambio de comisión.",
  },
  {
    key: "ANALITICOS",
    label: "Pedidos de Analiticos",
    category: "tramites",
    description: "Ventanas para solicitar constancias o analiticos.",
  },
  {
    key: "EQUIVALENCIAS",
    label: "Pedidos de Equivalencias",
    category: "tramites",
    description: "Periodos para cargar solicitudes de equivalencias curriculares.",
  },
  {
    key: "PREINSCRIPCION",
    label: "Preinscripción",
    category: "tramites",
    description: "Período de preinscripción inicial a la institución.",
  },
  {
    key: "CURSO_INTRODUCTORIO",
    label: "Curso Introductorio",
    category: "tramites",
    description: "Habilita la inscripción al Curso Introductorio y sus cohortes.",
  },
  {
    key: "CALENDARIO_CUATRIMESTRE",
    label: "Calendario académico - Cuatrimestres",
    category: "tramites",
    description:
      "Define las fechas de inicio y fin de los cuatrimestres. El segundo debe iniciar inmediatamente después del primero.",
  },
];

const CATEGORY_CONFIG = [
  {
    id: "tramites",
    label: "Inscripciones y trámites",
    helper: "Habilita los períodos que impactan directamente en los estudiantes.",
  },
  {
    id: "mesas",
    label: "Mesas de examen",
    helper: "Configura las fechas de generación y cierre de las mesas finales.",
  },
];

const TYPE_BY_CATEGORY = CATEGORY_CONFIG.reduce<Record<string, string[]>>((acc, category) => {
  acc[category.id] = TYPE_CONFIG.filter((type) => type.category === category.id).map((type) => type.key);
  return acc;
}, {});

type CalendarPeriod = "1C" | "2C";
const CALENDAR_PERIODS: CalendarPeriod[] = ["1C", "2C"];
const CALENDAR_TYPE = "CALENDARIO_CUATRIMESTRE";
const makeCalendarDraftKey = (period: CalendarPeriod) => `${CALENDAR_TYPE}:${period}`;

function defaultDraft(tipo: string): Ventana {
  return {
    tipo,
    activo: false,
    desde: dayjs().format("YYYY-MM-DD"),
    hasta: dayjs().add(7, "day").format("YYYY-MM-DD"),
    periodo: tipo === CALENDAR_TYPE ? "1C" : "1C_ANUALES",
  };
}

const defaultFirstCalendarDraft = (): Ventana => {
  const base = defaultDraft(CALENDAR_TYPE);
  const baseYear = dayjs().year();
  const start = dayjs(`${baseYear}-03-01`);
  const end = start.add(4, "month").endOf("month");
  return {
    ...base,
    tipo: CALENDAR_TYPE,
    periodo: "1C",
    desde: start.format("YYYY-MM-DD"),
    hasta: end.format("YYYY-MM-DD"),
  };
};

const buildDefaultCalendarDraft = (period: CalendarPeriod, reference?: Ventana): Ventana => {
  if (period === "1C") {
    return defaultFirstCalendarDraft();
  }
  const base = defaultDraft(CALENDAR_TYPE);
  const ref = reference ?? defaultFirstCalendarDraft();
  const refEnd = dayjs(ref.hasta || ref.desde || dayjs().format("YYYY-MM-DD"));
  const start = (refEnd.isValid() ? refEnd : dayjs()).add(1, "day");
  const end = start.add(4, "month").endOf("month");
  return {
    ...base,
    tipo: CALENDAR_TYPE,
    periodo: "2C",
    desde: start.format("YYYY-MM-DD"),
    hasta: end.format("YYYY-MM-DD"),
  };
};

const CATEGORY_FROM_TYPE = TYPE_CONFIG.reduce<Record<string, string>>((acc, type) => {
  acc[type.key] = type.category;
  return acc;
}, {});

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
const formatRange = (ventana?: Ventana | null) => {
  if (!ventana) return "Sin ventana activa";
  return `${dayjs(ventana.desde).format("DD/MM/YYYY")} -> ${dayjs(ventana.hasta).format("DD/MM/YYYY")}`;
};

const getPeriodoLabel = (periodo?: string | null) => {
  if (!periodo) return "Sin periodo asignado";
  return LABEL_PERIODO[periodo] ?? periodo;
};

const today = () => dayjs();

const classifyVentana = (ventana: Ventana | undefined) => {
  if (!ventana) return { label: "Sin ventana", color: "default" as const };
  const now = today();
  if (dayjs(ventana.desde).isSameOrBefore(now, "day") && dayjs(ventana.hasta).isSameOrAfter(now, "day")) {
    return { label: "Activa", color: "success" as const };
  }
  if (dayjs(ventana.desde).isAfter(now, "day")) {
    return { label: "Pendiente", color: "warning" as const };
  }
  return { label: "Vencida", color: "default" as const };
};

export default function HabilitarFechasPage() {
  const { enqueueSnackbar } = useSnackbar();
  const [ventanas, setVentanas] = useState<Record<string, Ventana[]>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [drafts, setDrafts] = useState<Record<string, Ventana>>({});
  const [selectedCategory, setSelectedCategory] = useState<string>(CATEGORY_CONFIG[0].id);
  const [expandedPanel, setExpandedPanel] = useState<string | null>(null);
  const panelRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [pendingScrollKey, setPendingScrollKey] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editVentana, setEditVentana] = useState<Ventana | null>(null);

  const loadVentanas = async () => {
    try {
      const data = await fetchVentanas();
      const map: Record<string, Ventana[]> = {};
      data.forEach((ventana) => {
        (map[ventana.tipo] ||= []).push(ventana);
      });
      Object.keys(map).forEach((key) => {
        map[key].sort((a, b) => dayjs(b.desde).diff(dayjs(a.desde)));
      });
      setVentanas(map);
    } catch (error) {
      setVentanas({});
      enqueueSnackbar("No se pudieron cargar las ventanas.", { variant: "error" });
    }
  };

  useEffect(() => {
    loadVentanas();
  }, []);

  const upsertVentana = async (ventana: Ventana) => {
    setSaving((state) => ({ ...state, [ventana.tipo]: true }));
    try {
      const payload = { ...ventana };
      if (ventana.id) {
        await axios.put(`/ventanas/${ventana.id}`, payload);
      } else {
        await axios.post(`/ventanas`, payload);
      }
      enqueueSnackbar("Ventana guardada correctamente.", { variant: "success" });
    } catch (error) {
      enqueueSnackbar("No se pudo guardar la ventana.", { variant: "error" });
    } finally {
      setSaving((state) => ({ ...state, [ventana.tipo]: false }));
      loadVentanas();
    }
  };

  const openEditDialog = (ventana: Ventana) => {
    setEditVentana({ ...ventana });
    setEditOpen(true);
  };

  const closeEditDialog = () => {
    setEditOpen(false);
    setEditVentana(null);
  };

  const saveEditDialog = async () => {
    if (!editVentana?.id) return;
    try {
      await axios.put(`/ventanas/${editVentana.id}`, editVentana);
      enqueueSnackbar("Ventana actualizada.", { variant: "success" });
      closeEditDialog();
      loadVentanas();
    } catch (error) {
      enqueueSnackbar("No se pudo actualizar la ventana.", { variant: "error" });
    }
  };

  const deleteVentana = async (id?: number) => {
    if (!id) return;
    try {
      await axios.delete(`/ventanas/${id}`);
      enqueueSnackbar("Ventana eliminada.", { variant: "success" });
      closeEditDialog();
      loadVentanas();
    } catch (error) {
      enqueueSnackbar("No se pudo eliminar la ventana.", { variant: "error" });
    }
  };

  const summaryItems = useMemo(() => {
    return TYPE_CONFIG.map((config) => {
      const list = ventanas[config.key] ?? [];
      const active = list.find((item) => item.activo);
      const upcoming = list
        .filter((item) => dayjs(item.desde).isAfter(today(), "day"))
        .sort((a, b) => dayjs(a.desde).diff(dayjs(b.desde)))[0];
      const reference = active ?? upcoming ?? list[0];
      const state = classifyVentana(active ?? upcoming ?? list[0]);
      return {
        ...config,
        active,
        upcoming,
        reference,
        state,
      };
    });
  }, [ventanas]);

  const handleSummaryClick = (typeKey: string) => {
    const category = CATEGORY_FROM_TYPE[typeKey];
    if (category) {
      setSelectedCategory(category);
      setExpandedPanel(typeKey);
      setPendingScrollKey(typeKey);
    }
  };

  useEffect(() => {
    if (pendingScrollKey && expandedPanel === pendingScrollKey) {
      const node = panelRefs.current[pendingScrollKey];
      if (node) {
        node.scrollIntoView({ behavior: "smooth", block: "start" });
        (node as HTMLElement).focus?.();
      }
      setPendingScrollKey(null);
    }
  }, [expandedPanel, pendingScrollKey]);

  const renderTypePanel = (typeKey: string) => {
    const config = TYPE_CONFIG.find((item) => item.key === typeKey);
    if (!config) return null;

    const list = ventanas[typeKey] ?? [];
    const reference = list.find((ventana) => ventana.activo) ?? list[0];
    const state = classifyVentana(reference);

    if (typeKey === CALENDAR_TYPE) {
      return (
        <Accordion
          key={typeKey}
          ref={(node) => {
            panelRefs.current[typeKey] = node;
          }}
          tabIndex={-1}
          disableGutters
          elevation={0}
          square
          expanded={expandedPanel === typeKey}
          onChange={(_, expanded) => setExpandedPanel(expanded ? typeKey : null)}
          sx={{
            border: "1px solid",
            borderColor: expandedPanel === typeKey ? "primary.main" : "divider",
            borderRadius: 2,
            "&:not(:last-of-type)": {
              mb: 2,
            },
          }}
        >
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="subtitle1" fontWeight={700}>
                {config.label}
              </Typography>
              <Typography variant="body2" color="text.secondary" noWrap>
                {reference ? formatRange(reference) : "Sin períodos configurados"}
              </Typography>
            </Box>
            <Stack direction="row" spacing={1} alignItems="center">
              <Chip size="small" label={state.label} color={state.color} />
              {reference?.activo && (
                <Chip size="small" color="success" variant="outlined" label="Habilitado" />
              )}
            </Stack>
          </AccordionSummary>
          <AccordionDetails>
            <CalendarPanel
              list={list}
              drafts={drafts}
              setDrafts={setDrafts}
              saving={saving}
              onSave={upsertVentana}
              onEdit={openEditDialog}
              notify={enqueueSnackbar}
              setExpandedPanel={setExpandedPanel}
            />
          </AccordionDetails>
        </Accordion>
      );
    }

    const now = today();

    const baseDraft =
      drafts[typeKey] ??
      (() => {
        const active = list.find((ventana) => ventana.activo);
        return active ? { ...active } : defaultDraft(typeKey);
      })();

    const setLocalDraft = (patch: Partial<Ventana>) =>
      setDrafts((prev) => {
        let draftBase: Ventana = baseDraft;
        if (patch.periodo && (typeKey === "MATERIAS" || typeKey === "CALENDARIO_CUATRIMESTRE")) {
          const candidato = list.find((item) => item.periodo === patch.periodo);
          if (candidato) {
            draftBase = { ...candidato };
          } else {
            draftBase = {
              ...draftBase,
              id: undefined,
              activo: false,
              periodo: patch.periodo,
            };
          }
        }
        return {
          ...prev,
          [typeKey]: { ...draftBase, ...patch, tipo: typeKey },
        };
      });

    const resetDraft = () =>
      setDrafts((prev) => ({
        ...prev,
        [typeKey]: defaultDraft(typeKey),
      }));

    const currentDraft = baseDraft;

    const historyItems = list
      .filter((ventana) => ventana.activo || dayjs(ventana.hasta).isSameOrAfter(now, "day"))
      .slice(0, 5);

    return (
      <Accordion
        key={typeKey}
        ref={(node) => {
          panelRefs.current[typeKey] = node;
        }}
        tabIndex={-1}
        disableGutters
        elevation={0}
        square
        expanded={expandedPanel === typeKey}
        onChange={(_, expanded) => setExpandedPanel(expanded ? typeKey : null)}
        sx={{
          border: "1px solid",
          borderColor: expandedPanel === typeKey ? "primary.main" : "divider",
          borderRadius: 2,
          "&:not(:last-of-type)": {
            mb: 2,
          },
        }}
      >
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="subtitle1" fontWeight={700}>
              {config.label}
            </Typography>
            <Typography variant="body2" color="text.secondary" noWrap>
              {reference ? formatRange(reference) : "Sin períodos configurados"}
            </Typography>
          </Box>
          <Stack direction="row" spacing={1} alignItems="center">
            <Chip size="small" label={state.label} color={state.color} />
            {reference?.activo && (
              <Chip size="small" color="success" variant="outlined" label="Habilitado" />
            )}
          </Stack>
        </AccordionSummary>
        <AccordionDetails>
          <Stack spacing={3}>
            <Typography variant="body2" color="text.secondary">
              {config.description}
            </Typography>
            <Grid container spacing={2} alignItems="flex-start">
              <Grid item xs={12} md={3}>
                <TextField
                  type="date"
                  label="Desde"
                  InputLabelProps={{ shrink: true }}
                  fullWidth
                  size="small"
                  value={currentDraft.desde}
                  onChange={(event) => setLocalDraft({ desde: event.target.value })}
                />
              </Grid>
              <Grid item xs={12} md={3}>
                <TextField
                  type="date"
                  label="Hasta"
                  InputLabelProps={{ shrink: true }}
                  fullWidth
                  size="small"
                  value={currentDraft.hasta}
                  onChange={(event) => setLocalDraft({ hasta: event.target.value })}
                />
              </Grid>
              {typeKey === "MATERIAS" && (
                <Grid item xs={12} md={3}>
                  <FormControl fullWidth size="small">
                    <InputLabel id={`periodo-${typeKey}`}>Periodo</InputLabel>
                    <Select
                      labelId={`periodo-${typeKey}`}
                      label="Periodo"
                      value={currentDraft.periodo ?? "1C_ANUALES"}
                      onChange={(event) =>
                        setLocalDraft({ periodo: event.target.value as "1C_ANUALES" | "2C" })
                      }
                    >
                      <MenuItem value="1C_ANUALES">1er Cuatrimestre + Anuales</MenuItem>
                      <MenuItem value="2C">2do Cuatrimestre</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
              )}
              <Grid item xs={12} md={3} display="flex" justifyContent={{ xs: "flex-start", md: "flex-end" }}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={!!currentDraft.activo}
                      onChange={(event) => setLocalDraft({ activo: event.target.checked })}
                    />
                  }
                  label={currentDraft.activo ? "Habilitado" : "Deshabilitado"}
                />
              </Grid>
            </Grid>

            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} justifyContent="flex-end">
              <Button variant="outlined" onClick={resetDraft}>
                Limpiar borrador
              </Button>
              <Button
                variant="contained"
                onClick={() => upsertVentana(currentDraft)}
                disabled={!!saving[typeKey]}
              >
                {saving[typeKey] ? "Guardando..." : "Guardar cambios"}
              </Button>
            </Stack>

            <Box>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                Historial reciente
              </Typography>
              {historyItems.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  Todavía no hay registros para este tipo.
                </Typography>
              ) : (
                <Stack spacing={1.5}>
                  {historyItems.map((item) => {
                    const itemState = classifyVentana(item);
                    return (
                      <Paper
                        key={`${typeKey}-${item.id ?? item.desde}`}
                        variant="outlined"
                        sx={{ p: 1.5, display: "flex", alignItems: "center", gap: 1 }}
                      >
                        <Box sx={{ flex: 1 }}>
                          <Typography variant="body2" fontWeight={600}>
                            {formatRange(item)}
                          </Typography>
                          <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.5 }}>
                            <Chip size="small" label={itemState.label} color={itemState.color} />
                            {item.activo ? (
                              <Chip size="small" color="success" variant="outlined" label="Habilitado" />
                            ) : (
                              <Chip size="small" variant="outlined" label="Cerrado" />
                            )}
                            {(typeKey === "MATERIAS" || typeKey === "CALENDARIO_CUATRIMESTRE") && (
                              <Chip
                                size="small"
                                variant="outlined"
                                color="primary"
                                label={getPeriodoLabel(item.periodo)}
                              />
                            )}
                          </Stack>
                        </Box>
                        <Stack direction="row" spacing={0.5}>
                          <Tooltip title="Editar">
                            <span>
                              <Button
                                size="small"
                                variant="text"
                                onClick={() => openEditDialog(item)}
                                startIcon={<EditIcon fontSize="small" />}
                              >
                                Editar
                              </Button>
                            </span>
                          </Tooltip>
                          <Tooltip title="Cargar en el borrador">
                            <span>
                              <Button
                                size="small"
                                variant="text"
                                onClick={() => {
                                  setDrafts((prev) => ({
                                    ...prev,
                                    [typeKey]: { ...item },
                                  }));
                                  setExpandedPanel(typeKey);
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
        </AccordionDetails>
      </Accordion>
    );
  };

  return (
    <Box className="center-page" sx={{ pb: 6 }}>
      <BackButton fallbackPath="/secretaria" />
      <PageHero
        title="Habilitar fechas"
        subtitle="Definí y administrá los períodos de inscripción, trámites y mesas de examen"
      />

      <Box sx={{ mt: 2 }}>
        <SectionTitlePill title="Resumen rápido" sx={{ mt: 3 }} />
      </Box>

      <Box sx={{ mb: 4 }}>
        <Grid container spacing={2}>
          {summaryItems.map((item) => (
            <Grid item xs={12} sm={6} md={4} key={item.key}>
              <ButtonBase
                onClick={() => handleSummaryClick(item.key)}
                sx={{
                  width: "100%",
                  textAlign: "left",
                  borderRadius: 2,
                  border: "1px solid",
                  borderColor: "divider",
                  p: 2,
                  transition: "all .15s ease",
                  "&:hover": {
                    borderColor: "primary.main",
                    boxShadow: (theme) => `${theme.palette.primary.main}33 0px 0px 0px 2px`,
                  },
                }}
              >
                <Stack spacing={1}>
                  <Typography variant="subtitle1" fontWeight={700}>
                    {item.label}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {item.reference ? formatRange(item.reference) : "Sin períodos cargados"}
                  </Typography>
                  <Stack direction="row" spacing={1}>
                    <Chip size="small" label={item.state.label} color={item.state.color} />
                    {item.reference?.activo && <Chip size="small" label="Habilitado" color="success" />}
                  </Stack>
                </Stack>
              </ButtonBase>
            </Grid>
          ))}
        </Grid>
      </Box>

      <Box sx={{ borderBottom: 1, borderColor: "divider", mb: 3 }}>
        <Tabs
          value={selectedCategory}
          onChange={(_, value) => {
            setSelectedCategory(value);
            setExpandedPanel(null);
          }}
          variant="scrollable"
          allowScrollButtonsMobile
        >
          {CATEGORY_CONFIG.map((category) => (
            <Tab key={category.id} value={category.id} label={category.label} />
          ))}
        </Tabs>
      </Box>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {
          CATEGORY_CONFIG.find((category) => category.id === selectedCategory)?.helper ??
          "Selecciona un período para editarlo."
        }
      </Typography>

      <Stack spacing={2}>
        {TYPE_BY_CATEGORY[selectedCategory].map((typeKey) => renderTypePanel(typeKey))}
      </Stack>

      <Dialog open={editOpen} onClose={closeEditDialog} maxWidth="xs" fullWidth>
        <DialogTitle>Editar ventana</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Tipo"
              fullWidth
              size="small"
              value={editVentana?.tipo ?? ""}
              onChange={(event) =>
                setEditVentana((prev) => (prev ? { ...prev, tipo: event.target.value } : prev))
              }
            />
            <TextField
              type="date"
              label="Desde"
              InputLabelProps={{ shrink: true }}
              fullWidth
              size="small"
              value={editVentana?.desde ?? ""}
              onChange={(event) =>
                setEditVentana((prev) => (prev ? { ...prev, desde: event.target.value } : prev))
              }
            />
            <TextField
              type="date"
              label="Hasta"
              InputLabelProps={{ shrink: true }}
              fullWidth
              size="small"
              value={editVentana?.hasta ?? ""}
              onChange={(event) =>
                setEditVentana((prev) => (prev ? { ...prev, hasta: event.target.value } : prev))
              }
            />
            <FormControlLabel
              control={
                <Switch
                  checked={!!editVentana?.activo}
                  onChange={(event) =>
                    setEditVentana((prev) => (prev ? { ...prev, activo: event.target.checked } : prev))
                  }
                />
              }
              label={editVentana?.activo ? "Habilitado" : "Deshabilitado"}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeEditDialog}>Cancelar</Button>
          <Button color="error" onClick={() => deleteVentana(editVentana?.id)}>
            Eliminar
          </Button>
          <Button variant="contained" onClick={saveEditDialog}>
            Guardar
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
