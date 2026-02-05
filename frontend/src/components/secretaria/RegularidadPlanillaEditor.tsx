import React, { useEffect, useMemo } from "react";
import {
  Box,
  Button,
  Checkbox,
  Chip,
  Divider,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
  MenuItem,
  Tooltip,
} from "@mui/material";
import SaveIcon from "@mui/icons-material/Save";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import { enqueueSnackbar } from "notistack";

import {
  GuardarRegularidadPayload,
  RegularidadEstudianteDTO,
  RegularidadPlanillaDTO,
  SituacionOptionDTO,
} from "@/api/cargaNotas";

type RegularidadFilaForm = {
  inscripcionId: number;
  orden: number;
  dni: string;
  apellidoNombre: string;
  notaTp: string;
  notaFinal: string;
  asistencia: string;
  excepcion: boolean;
  situacion: string;
  observaciones: string;
  correlativasCaidas: string[];
};

type RegularidadFormValues = {
  fechaCierre: string;
  observaciones: string;
  filas: RegularidadFilaForm[];
};

interface RegularidadPlanillaEditorProps {
  comisionId: number;
  planilla: RegularidadPlanillaDTO;
  situaciones: SituacionOptionDTO[];
  defaultFechaCierre: string;
  defaultObservaciones?: string;
  saving: boolean;
  onSave: (payload: GuardarRegularidadPayload) => Promise<void>;
  readOnly?: boolean;
}

const mapEstudianteToFormRow = (estudiante: RegularidadEstudianteDTO): RegularidadFilaForm => ({
  inscripcionId: estudiante.inscripcion_id,
  orden: estudiante.orden ?? 0,
  dni: estudiante.dni,
  apellidoNombre: estudiante.apellido_nombre,
  notaTp: estudiante.nota_tp !== null ? String(estudiante.nota_tp).replace(".", ",") : "",
  notaFinal: estudiante.nota_final !== null ? String(estudiante.nota_final) : "",
  asistencia: estudiante.asistencia !== null ? String(estudiante.asistencia) : "",
  excepcion: estudiante.excepcion,
  situacion: estudiante.situacion ?? "",
  observaciones: estudiante.observaciones ?? "",
  correlativasCaidas: estudiante.correlativas_caidas ?? [],
});

const toIsoDate = (value?: string): string => {
  if (value && value.trim()) {
    return value.slice(0, 10);
  }
  return new Date().toISOString().slice(0, 10);
};

const ensureString = (value: string | number | null | undefined): string => {
  if (value === null || value === undefined) {
    return "";
  }
  return String(value);
};

const RegularidadPlanillaEditor: React.FC<RegularidadPlanillaEditorProps> = ({
  comisionId,
  planilla,
  situaciones,
  defaultFechaCierre,
  defaultObservaciones,
  saving,
  onSave,
  readOnly = false,
}) => {
  const {
    control,
    handleSubmit,
    reset,
    watch,
    formState: { isDirty },
  } = useForm<RegularidadFormValues>({
    defaultValues: {
      fechaCierre: toIsoDate(defaultFechaCierre),
      observaciones: defaultObservaciones ?? "",
      filas: planilla.estudiantes.map(mapEstudianteToFormRow),
    },
  });

  const { fields } = useFieldArray({
    control,
    name: "filas",
  });

  useEffect(() => {
    reset({
      fechaCierre: toIsoDate(defaultFechaCierre),
      observaciones: defaultObservaciones ?? "",
      filas: planilla.estudiantes.map(mapEstudianteToFormRow),
    });
  }, [planilla, defaultFechaCierre, defaultObservaciones, reset]);

  const filas = watch("filas") ?? [];

  const summary = useMemo(() => {
    const total = filas.length;
    const situacionCount: Record<string, number> = {};
    let conNotaFinal = 0;
    let conAsistencia = 0;
    filas.forEach((fila) => {
      if (!fila) {
        return;
      }
      if (fila.situacion) {
        situacionCount[fila.situacion] = (situacionCount[fila.situacion] || 0) + 1;
      }
      if (ensureString(fila.notaFinal).trim()) {
        conNotaFinal += 1;
      }
      if (ensureString(fila.asistencia).trim()) {
        conAsistencia += 1;
      }
    });
    return {
      total,
      situacionCount,
      conNotaFinal,
      conAsistencia,
    };
  }, [filas]);

  const situacionLabel = (alias: string) =>
    situaciones.find((item) => item.alias === alias)?.descripcion || alias;

  const parseDecimal = (value: string): number | null | "invalid" => {
    const normalizedValue = ensureString(value);
    if (!normalizedValue.trim()) return null;
    const normalized = normalizedValue.replace(",", ".");
    const parsed = Number(normalized);
    if (Number.isNaN(parsed)) {
      return "invalid";
    }
    return parsed;
  };

  const parseInteger = (value: string): number | null | "invalid" => {
    const normalizedValue = ensureString(value);
    if (!normalizedValue.trim()) return null;
    const parsed = Number.parseInt(normalizedValue, 10);
    if (Number.isNaN(parsed)) {
      return "invalid";
    }
    return parsed;
  };

  const onSubmit = handleSubmit(async (values) => {
    if (readOnly) {
      return;
    }
    const estudiantes: GuardarRegularidadPayload["estudiantes"] = [];

    for (const fila of values.filas) {
      if (!fila.situacion) {
        enqueueSnackbar(
          `Seleccioná la situación académica para ${fila.apellidoNombre} (${fila.dni}).`,
          { variant: "warning" }
        );
        return;
      }

      const notaTp = parseDecimal(fila.notaTp);
      if (notaTp === "invalid") {
        enqueueSnackbar(
          `La nota de trabajos prácticos de ${fila.apellidoNombre} no es válida.`,
          { variant: "warning" }
        );
        return;
      }

      const notaFinal = parseInteger(fila.notaFinal);
      if (notaFinal === "invalid") {
        enqueueSnackbar(`La nota final de ${fila.apellidoNombre} no es válida.`, {
          variant: "warning",
        });
        return;
      }

      const asistencia = parseInteger(fila.asistencia);
      if (asistencia === "invalid") {
        enqueueSnackbar(
          `El porcentaje de asistencia de ${fila.apellidoNombre} no es válido.`,
          { variant: "warning" }
        );
        return;
      }

      estudiantes.push({
        inscripcion_id: fila.inscripcionId,
        nota_tp: notaTp ?? undefined,
        nota_final: notaFinal ?? undefined,
        asistencia: asistencia ?? undefined,
        excepcion: fila.excepcion,
        situacion: fila.situacion,
        observaciones: ensureString(fila.observaciones).trim() || undefined,
      });
    }

    const payload: GuardarRegularidadPayload = {
      comision_id: comisionId,
      fecha_cierre: values.fechaCierre,
      observaciones_generales: ensureString(values.observaciones).trim() || undefined,
      estudiantes,
    };

    await onSave(payload);
  });

  return (
    <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 } }}>
      <Stack spacing={3}>
        <Box>
          <Typography variant="h6" fontWeight={600}>
            Planilla de regularidad y promoción
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Revisá y completá las calificaciones correspondientes a la comisión seleccionada.
          </Typography>
        </Box>

        <Stack
          direction={{ xs: "column", md: "row" }}
          spacing={2}
          sx={{ alignItems: { xs: "stretch", md: "center" } }}
        >
          <Controller
            name="fechaCierre"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                type="date"
                label="Fecha de cierre"
                InputLabelProps={{ shrink: true }}
                sx={{ width: { xs: "100%", md: 220 } }}
                disabled={readOnly}
              />
            )}
          />
          <Controller
            name="observaciones"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                label="Observaciones generales"
                multiline
                minRows={1}
                maxRows={3}
                fullWidth
                placeholder="Opcional"
                disabled={readOnly}
              />
            )}
          />
        </Stack>

        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>N°</TableCell>
                <TableCell>DNI</TableCell>
                <TableCell>Apellido y nombre</TableCell>
                <TableCell width={110}>Nota TP</TableCell>
                <TableCell width={110}>Nota final</TableCell>
                <TableCell width={120}>Asistencia (%)</TableCell>
                <TableCell width={140}>Situación</TableCell>
                <TableCell width={120}>Excepción</TableCell>
                <TableCell>Observaciones</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {fields.map((field, index) => (
                <TableRow key={field.id}>
                  <TableCell>{filas[index]?.orden ?? index + 1}</TableCell>
                  <TableCell>
                    <Controller
                      name={`filas.${index}.dni`}
                      control={control}
                      render={({ field: dniField }) => (
                        <TextField {...dniField} size="small" inputProps={{ readOnly: true }} />
                      )}
                    />
                  </TableCell>
                  <TableCell>
                    <Controller
                      name={`filas.${index}.apellidoNombre`}
                      control={control}
                      render={({ field: nameField }) => (
                        <Box display="flex" alignItems="center" gap={1}>
                          <TextField
                            {...nameField}
                            size="small"
                            fullWidth
                            inputProps={{ readOnly: true }}
                          />
                          {filas[index]?.correlativasCaidas?.length > 0 && (
                            <Tooltip
                              title={
                                <Box>
                                  <Typography variant="subtitle2" color="inherit">
                                    Correlativas Caídas:
                                  </Typography>
                                  <ul style={{ margin: 0, paddingLeft: 16 }}>
                                    {filas[index].correlativasCaidas.map((msg, i) => (
                                      <li key={i}>{msg}</li>
                                    ))}
                                  </ul>
                                </Box>
                              }
                            >
                              <WarningAmberIcon color="error" />
                            </Tooltip>
                          )}
                        </Box>
                      )}
                    />
                  </TableCell>
                  <TableCell>
                    <Controller
                      name={`filas.${index}.notaTp`}
                      control={control}
                      render={({ field: notaTpField }) => (
                        <TextField
                          {...notaTpField}
                          size="small"
                          inputMode="decimal"
                          placeholder="-"
                          disabled={readOnly}
                        />
                      )}
                    />
                  </TableCell>
                  <TableCell>
                    <Controller
                      name={`filas.${index}.notaFinal`}
                      control={control}
                      render={({ field: notaFinalField }) => (
                        <TextField
                          {...notaFinalField}
                          size="small"
                          inputMode="numeric"
                          placeholder="-"
                          disabled={readOnly}
                        />
                      )}
                    />
                  </TableCell>
                  <TableCell>
                    <Controller
                      name={`filas.${index}.asistencia`}
                      control={control}
                      render={({ field: asistenciaField }) => (
                        <TextField
                          {...asistenciaField}
                          size="small"
                          inputMode="numeric"
                          placeholder="-"
                          disabled={readOnly}
                        />
                      )}
                    />
                  </TableCell>
                  <TableCell>
                    <Controller
                      name={`filas.${index}.situacion`}
                      control={control}
                      render={({ field: situacionField }) => (
                        <TextField
                          {...situacionField}
                          size="small"
                          select
                          required
                          disabled={readOnly}
                        >
                          <MenuItem value="">
                            <em>Seleccionar</em>
                          </MenuItem>
                          {situaciones.map((option) => (
                            <MenuItem key={option.alias} value={option.alias}>
                              {option.alias}
                            </MenuItem>
                          ))}
                        </TextField>
                      )}
                    />
                  </TableCell>
                  <TableCell align="center">
                    <Controller
                      name={`filas.${index}.excepcion`}
                      control={control}
                      render={({ field: excepcionField }) => (
                        <Checkbox
                          {...excepcionField}
                          checked={!!excepcionField.value}
                          onChange={(event) => excepcionField.onChange(event.target.checked)}
                          disabled={readOnly}
                        />
                      )}
                    />
                  </TableCell>
                  <TableCell>
                    <Controller
                      name={`filas.${index}.observaciones`}
                      control={control}
                      render={({ field: obsField }) => (
                        <TextField
                          {...obsField}
                          size="small"
                          placeholder="Opcional"
                          fullWidth
                          disabled={readOnly}
                        />
                      )}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        <Stack spacing={1}>
          <Typography variant="subtitle2" color="text.secondary">
            Resumen
          </Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap">
            <Chip label={`Total de estudiantes: ${summary.total}`} />
            <Chip label={`Con nota final: ${summary.conNotaFinal}`} />
            <Chip label={`Con asistencia: ${summary.conAsistencia}`} />
            {Object.entries(summary.situacionCount).map(([alias, count]) => (
              <Chip
                key={alias}
                label={`${alias}: ${count} (${situacionLabel(alias)})`}
              />
            ))}
          </Stack>
        </Stack>

        <Divider />

        <Box display="flex" justifyContent="flex-end">
          <Button
            variant="contained"
            size="large"
            startIcon={<SaveIcon />}
            onClick={onSubmit}
            disabled={readOnly || saving || !filas.length || (!isDirty && !saving)}
          >
            {saving ? "Guardando..." : "Guardar planilla"}
          </Button>
        </Box>
      </Stack>
    </Paper>
  );
};

export default RegularidadPlanillaEditor;
