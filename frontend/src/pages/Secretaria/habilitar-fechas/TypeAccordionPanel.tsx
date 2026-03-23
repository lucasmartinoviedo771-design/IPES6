import React from "react";
import dayjs from "dayjs";
import Accordion from "@mui/material/Accordion";
import AccordionDetails from "@mui/material/AccordionDetails";
import AccordionSummary from "@mui/material/AccordionSummary";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import FormControl from "@mui/material/FormControl";
import FormControlLabel from "@mui/material/FormControlLabel";
import Grid from "@mui/material/Grid";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Select from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import EditIcon from "@mui/icons-material/Edit";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";

import CalendarPanel from "./CalendarPanel";
import {
  Ventana,
  TYPE_CONFIG,
  CALENDAR_TYPE,
  defaultDraft,
  formatRange,
  getPeriodoLabel,
  today,
  classifyVentana,
} from "./constants";

type TypeAccordionPanelProps = {
  typeKey: string;
  ventanas: Record<string, Ventana[]>;
  drafts: Record<string, Ventana>;
  setDrafts: React.Dispatch<React.SetStateAction<Record<string, Ventana>>>;
  saving: Record<string, boolean>;
  expandedPanel: string | null;
  setExpandedPanel: (panel: string | null) => void;
  panelRefs: React.MutableRefObject<Record<string, HTMLDivElement | null>>;
  onUpsert: (ventana: Ventana) => void;
  onEdit: (ventana: Ventana) => void;
  notify: (message: string, options?: any) => void;
};

const TypeAccordionPanel: React.FC<TypeAccordionPanelProps> = ({
  typeKey,
  ventanas,
  drafts,
  setDrafts,
  saving,
  expandedPanel,
  setExpandedPanel,
  panelRefs,
  onUpsert,
  onEdit,
  notify,
}) => {
  const config = TYPE_CONFIG.find((item) => item.key === typeKey);
  if (!config) return null;

  const list = ventanas[typeKey] ?? [];
  const reference = list.find((ventana) => ventana.activo) ?? list[0];
  const state = classifyVentana(reference);

  const accordionSx = {
    border: "1px solid",
    borderColor: expandedPanel === typeKey ? "primary.main" : "divider",
    borderRadius: 2,
    "&:not(:last-of-type)": {
      mb: 2,
    },
  };

  const accordionSummaryContent = (
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
  );

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
        sx={accordionSx}
      >
        {accordionSummaryContent}
        <AccordionDetails>
          <CalendarPanel
            list={list}
            drafts={drafts}
            setDrafts={setDrafts}
            saving={saving}
            onSave={onUpsert}
            onEdit={onEdit}
            notify={notify}
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
      sx={accordionSx}
    >
      {accordionSummaryContent}
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
              onClick={() => onUpsert(currentDraft)}
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
                              onClick={() => onEdit(item)}
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

export default TypeAccordionPanel;
