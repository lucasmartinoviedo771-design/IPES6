import React, { useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Grid,
  IconButton,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import dayjs from "dayjs";

import {
  generarActaExamenOralPDF,
  ORAL_SCORE_OPTIONS,
  OralTopicScore,
} from "@/utils/actaOralPdf";

export type OralActFormTopic = {
  id: string;
  tema: string;
  score: OralTopicScore | "";
};

export type OralActFormValues = {
  actaNumero: string;
  folioNumero: string;
  fecha: string;
  curso: string;
  notaFinal: string;
  observaciones: string;
  temasAlumno: OralActFormTopic[];
  temasDocente: OralActFormTopic[];
};

const scoreOptions = ORAL_SCORE_OPTIONS;

const createTopicRow = (): OralActFormTopic => ({
  id: `${Date.now()}-${Math.random()}`,
  tema: "",
  score: "",
});

type TribunalInfo = {
  presidente?: string | null;
  vocal1?: string | null;
  vocal2?: string | null;
  vocalExtra?: string | null;
};

type OralExamActaDialogProps = {
  open: boolean;
  onClose: () => void;
  alumnoNombre: string;
  alumnoDni: string;
  carrera?: string | null;
  unidadCurricular?: string | null;
  curso?: string | null;
  fechaMesa?: string | null;
  tribunal?: TribunalInfo;
  existingValues?: OralActFormValues;
  defaultNota?: string | null;
  loading?: boolean;
  saving?: boolean;
  onSave: (values: OralActFormValues) => Promise<void>;
};

const ensureMinRows = (rows: OralActFormTopic[], min = 3) => {
  const clone = [...rows];
  while (clone.length < min) {
    clone.push(createTopicRow());
  }
  return clone;
};

const OralExamActaDialog: React.FC<OralExamActaDialogProps> = ({
  open,
  onClose,
  alumnoNombre,
  alumnoDni,
  carrera,
  unidadCurricular,
  curso,
  fechaMesa,
  tribunal,
  existingValues,
  defaultNota,
  loading = false,
  saving = false,
  onSave,
}) => {
  const [form, setForm] = useState<OralActFormValues>(() => ({
    actaNumero: "",
    folioNumero: "",
    fecha: fechaMesa ? dayjs(fechaMesa).format("YYYY-MM-DD") : dayjs().format("YYYY-MM-DD"),
    curso: curso ?? "",
    notaFinal: defaultNota ?? "",
    observaciones: "",
    temasAlumno: ensureMinRows([], 3),
    temasDocente: ensureMinRows([], 4),
  }));

  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (existingValues) {
      setForm({
        ...existingValues,
        temasAlumno: ensureMinRows(existingValues.temasAlumno),
        temasDocente: ensureMinRows(existingValues.temasDocente),
      });
      return;
    }
    setForm({
      actaNumero: "",
      folioNumero: "",
      fecha: fechaMesa ? dayjs(fechaMesa).format("YYYY-MM-DD") : dayjs().format("YYYY-MM-DD"),
      curso: curso ?? "",
      notaFinal: defaultNota ?? "",
      observaciones: "",
      temasAlumno: ensureMinRows([], 3),
      temasDocente: ensureMinRows([], 4),
    });
  }, [open, existingValues, fechaMesa, curso, defaultNota]);

  const handleChange = (key: keyof OralActFormValues, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const updateTopic = (
    section: "temasAlumno" | "temasDocente",
    id: string,
    patch: Partial<OralActFormTopic>,
  ) => {
    setForm((prev) => ({
      ...prev,
      [section]: prev[section].map((row) => (row.id === id ? { ...row, ...patch } : row)),
    }));
  };

  const addTopic = (section: "temasAlumno" | "temasDocente") => {
    setForm((prev) => ({
      ...prev,
      [section]: [...prev[section], createTopicRow()],
    }));
  };

  const removeTopic = (section: "temasAlumno" | "temasDocente", id: string) => {
    setForm((prev) => {
      const filtered = prev[section].filter((row) => row.id !== id);
      return {
        ...prev,
        [section]: ensureMinRows(filtered, section === "temasAlumno" ? 3 : 4),
      };
    });
  };

  const temasAlumno = useMemo(() => ensureMinRows(form.temasAlumno, 3), [form.temasAlumno]);
  const temasDocente = useMemo(() => ensureMinRows(form.temasDocente, 4), [form.temasDocente]);
  const actionDisabled = loading || saving || submitting;

  const handleGenerate = async () => {
    if (submitting) {
      return;
    }
    setSubmitting(true);
    const nextValues: OralActFormValues = {
      ...form,
      temasAlumno,
      temasDocente,
    };
    try {
      await onSave(nextValues);
      generarActaExamenOralPDF({
        actaNumero: nextValues.actaNumero,
        folioNumero: nextValues.folioNumero,
        fecha: nextValues.fecha,
        carrera: carrera ?? "",
        unidadCurricular: unidadCurricular ?? "",
        curso: nextValues.curso,
        alumno: `${alumnoNombre} - DNI ${alumnoDni}`,
        tribunal: tribunal ?? {},
        temasElegidosAlumno: nextValues.temasAlumno
          .filter((item) => item.tema.trim())
          .map((item) => ({ tema: item.tema.trim(), score: item.score || undefined })),
        temasSugeridosDocente: nextValues.temasDocente
          .filter((item) => item.tema.trim())
          .map((item) => ({ tema: item.tema.trim(), score: item.score || undefined })),
        notaFinal: nextValues.notaFinal,
        observaciones: nextValues.observaciones,
      });
      onClose();
    } catch {
      // el error ya se notific� fuera
    } finally {
      setSubmitting(false);
    }
  };

  const renderTopicsTable = (
    title: string,
    section: "temasAlumno" | "temasDocente",
    rows: OralActFormTopic[],
  ) => (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
        <Typography variant="subtitle2">{title}</Typography>
        <Button size="small" startIcon={<AddIcon />} onClick={() => addTopic(section)}>
          Agregar fila
        </Button>
      </Stack>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell width="55%">Tema / Consigna</TableCell>
            <TableCell width="35%">Puntuación</TableCell>
            <TableCell width="10%" align="center">
              Acciones
            </TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id}>
              <TableCell>
                <TextField
                  fullWidth
                  size="small"
                  value={row.tema}
                  onChange={(event) => updateTopic(section, row.id, { tema: event.target.value })}
                />
              </TableCell>
              <TableCell>
                <TextField
                  select
                  fullWidth
                  size="small"
                  value={row.score}
                  onChange={(event) =>
                    updateTopic(section, row.id, { score: event.target.value as OralTopicScore | "" })
                  }
                >
                  <MenuItem value="">-</MenuItem>
                  {scoreOptions.map((option) => (
                    <MenuItem key={option.value} value={option.value}>
                      {option.label}
                    </MenuItem>
                  ))}
                </TextField>
              </TableCell>
              <TableCell align="center">
                <IconButton size="small" onClick={() => removeTopic(section, row.id)}>
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Box>
  );

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle>Acta de examen oral · {alumnoNombre}</DialogTitle>
      <DialogContent dividers>
        {loading ? (
          <Stack alignItems="center" justifyContent="center" py={6}>
            <CircularProgress />
          </Stack>
        ) : (
        <Stack spacing={2}>
          <Grid container spacing={2}>
            <Grid item xs={12} md={4}>
              <TextField
                label="Acta N°"
                fullWidth
                size="small"
                value={form.actaNumero}
                onChange={(event) => handleChange("actaNumero", event.target.value)}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                label="Folio N°"
                fullWidth
                size="small"
                value={form.folioNumero}
                onChange={(event) => handleChange("folioNumero", event.target.value)}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                label="Fecha"
                type="date"
                fullWidth
                size="small"
                InputLabelProps={{ shrink: true }}
                value={form.fecha}
                onChange={(event) => handleChange("fecha", event.target.value)}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                label="Curso / Comisión"
                fullWidth
                size="small"
                value={form.curso}
                onChange={(event) => handleChange("curso", event.target.value)}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                label="Nota final"
                fullWidth
                size="small"
                value={form.notaFinal}
                onChange={(event) => handleChange("notaFinal", event.target.value)}
              />
            </Grid>
          </Grid>

          <Divider />

          {renderTopicsTable("Temas elegidos por el alumno", "temasAlumno", temasAlumno)}
          {renderTopicsTable("Temas sugeridos por el docente", "temasDocente", temasDocente)}

          <TextField
            label="Observaciones"
            multiline
            minRows={3}
            fullWidth
            value={form.observaciones}
            onChange={(event) => handleChange("observaciones", event.target.value)}
          />
        </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cerrar</Button>
        <Button
          variant="contained"
          onClick={handleGenerate}
          disabled={actionDisabled}
          startIcon={actionDisabled ? <CircularProgress size={16} color="inherit" /> : undefined}
        >
          {actionDisabled ? "Generando..." : "Generar acta oral"}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default OralExamActaDialog;
