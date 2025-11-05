import React, { useEffect, useMemo, useState } from "react";
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

dayjs.extend(isSameOrAfter);
dayjs.extend(isSameOrBefore);

type Ventana = VentanaDto;

const LABEL_PERIODO: Record<"1C_ANUALES" | "2C", string> = {
  "1C_ANUALES": "1º Cuatrimestre + Anuales",
  "2C": "2º Cuatrimestre",
};

const TYPE_CONFIG: Array<{
  key: Ventana["tipo"];
  label: string;
  category: "mesas" | "tramites";
  description: string;
}> = [
  {
    key: "MESAS_FINALES",
    label: "Mesas de examen - Finales",
    category: "mesas",
    description: "Ventanas para las mesas regulares de examen final.",
  },
  {
    key: "MESAS_EXTRA",
    label: "Mesas de examen - Extraordinarias",
    category: "mesas",
    description: "Mesas especiales o extraordinarias habilitadas por dirección.",
  },
  {
    key: "MESAS_LIBRES",
    label: "Mesas de examen - Libres",
    category: "mesas",
    description: "Mesas destinadas a estudiantes libres.",
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
    label: "Pedidos de Analíticos",
    category: "tramites",
    description: "Ventanas para solicitar constancias o analíticos.",
  },
  {
    key: "PREINSCRIPCION",
    label: "Preinscripción",
    category: "tramites",
    description: "Periodo de preinscripción inicial a la institución.",
  },
];

const CATEGORY_CONFIG = [
  {
    id: "tramites",
    label: "Inscripciones y trámites",
    helper: "Habilita los periodos que impactan directamente en los estudiantes.",
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

const CATEGORY_FROM_TYPE = TYPE_CONFIG.reduce<Record<string, string>>((acc, type) => {
  acc[type.key] = type.category;
  return acc;
}, {});

const formatRange = (ventana?: Ventana | null) => {
  if (!ventana) return "Sin ventana activa";
  return `${dayjs(ventana.desde).format("DD/MM/YYYY")} → ${dayjs(ventana.hasta).format("DD/MM/YYYY")}`;
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
  const [editOpen, setEditOpen] = useState(false);
  const [editVentana, setEditVentana] = useState<Ventana | null>(null);

  const defaultDraft = (tipo: string): Ventana => ({
    tipo,
    activo: false,
    desde: dayjs().format("YYYY-MM-DD"),
    hasta: dayjs().add(7, "day").format("YYYY-MM-DD"),
    periodo: "1C_ANUALES",
  });

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
      setExpandedPanel((prev) => (prev === typeKey ? prev : typeKey));
    }
  };

  const renderTypePanel = (typeKey: string) => {
    const config = TYPE_CONFIG.find((item) => item.key === typeKey);
    if (!config) return null;

    const list = ventanas[typeKey] ?? [];
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
        if (patch.periodo && typeKey === "MATERIAS") {
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

    const reference = list.find((ventana) => ventana.activo) ?? list[0];
    const state = classifyVentana(reference);

    return (
      <Accordion
        key={typeKey}
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
              {reference ? formatRange(reference) : "Sin periodos configurados"}
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
                    <InputLabel id={`periodo-${typeKey}`}>Período</InputLabel>
                    <Select
                      labelId={`periodo-${typeKey}`}
                      label="Período"
                      value={currentDraft.periodo ?? "1C_ANUALES"}
                      onChange={(event) =>
                        setLocalDraft({ periodo: event.target.value as "1C_ANUALES" | "2C" })
                      }
                    >
                      <MenuItem value="1C_ANUALES">1º Cuatrimestre + Anuales</MenuItem>
                      <MenuItem value="2C">2º Cuatrimestre</MenuItem>
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
                            {typeKey === "MATERIAS" && (
                              <Chip
                                size="small"
                                variant="outlined"
                                color="primary"
                                label={LABEL_PERIODO[(item.periodo ?? "1C_ANUALES") as "1C_ANUALES" | "2C"]}
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
      <Typography variant="h4" fontWeight={800} gutterBottom>
        Habilitar Fechas
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
        Definí y administrá los periodos de inscripción, trámites y mesas de examen. Activá una ventana
        cuando quieras que quede disponible para los usuarios.
      </Typography>

      <Box sx={{ mb: 4 }}>
        <Typography variant="subtitle1" fontWeight={700} gutterBottom>
          Resumen rápido
        </Typography>
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
                    {item.reference ? formatRange(item.reference) : "Sin periodos cargados"}
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
          "Seleccioná un periodo para editarlo."
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
