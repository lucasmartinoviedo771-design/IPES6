import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  IconButton,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import SearchIcon from "@mui/icons-material/Search";
import { useSnackbar } from "notistack";
import { useQuery } from "@tanstack/react-query";

import {
  EquivalenciaDisposicionPayload,
  EquivalenciaMateriaPendienteDTO,
  obtenerCarrerasActivas,
  TrayectoriaCarreraDetalleDTO,
} from "@/api/alumnos";
import { listarPlanes, PlanDetalle } from "@/api/carreras";
import { fetchMateriasPendientesEquivalencia, fetchEstudianteAdminDetail } from "@/api/alumnos";
import { fetchRegularidadMetadata } from "@/api/primeraCarga";
import { getErrorMessage } from "@/utils/errors";

type Row = {
  key: string;
  materiaId: string;
  nota: string;
};

const preferPlan = (planes: PlanDetalle[]): PlanDetalle | null => {
  if (!planes.length) return null;
  const vigente = planes.find((plan) => plan.vigente);
  if (vigente) return vigente;
  return [...planes].sort((a, b) => (b.anio_inicio || 0) - (a.anio_inicio || 0))[0] ?? null;
};

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  submitLabel?: string;
  onSubmit: (payload: EquivalenciaDisposicionPayload) => Promise<void>;
  requiresCorrelatividades?: boolean;
}

const randomKey = () => Math.random().toString(36).substring(2, 11);

const EquivalenciaDisposicionDialog: React.FC<Props> = ({
  open,
  onClose,
  title,
  submitLabel = "Registrar",
  onSubmit,
  requiresCorrelatividades = true,
}) => {
  const { enqueueSnackbar } = useSnackbar();
  const [dni, setDni] = useState("");
  const [estudianteNombre, setEstudianteNombre] = useState("");
  const [numeroDisposicion, setNumeroDisposicion] = useState("");
  const [fechaDisposicion, setFechaDisposicion] = useState(() => new Date().toISOString().slice(0, 10));
  const [observaciones, setObservaciones] = useState("");
  const [carreras, setCarreras] = useState<TrayectoriaCarreraDetalleDTO[]>([]);
  const [carrerasLoading, setCarrerasLoading] = useState(false);
  const [selectedProfesoradoId, setSelectedProfesoradoId] = useState("");
  const [planes, setPlanes] = useState<PlanDetalle[]>([]);
  const [planesLoading, setPlanesLoading] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [materias, setMaterias] = useState<EquivalenciaMateriaPendienteDTO[]>([]);
  const [materiasLoading, setMateriasLoading] = useState(false);
  const [rows, setRows] = useState<Row[]>([{ key: randomKey(), materiaId: "", nota: "" }]);
  const [submitting, setSubmitting] = useState(false);

  const resetState = () => {
    setDni("");
    setEstudianteNombre("");
    setNumeroDisposicion("");
    setFechaDisposicion(new Date().toISOString().slice(0, 10));
    setObservaciones("");
    setCarreras([]);
    setSelectedProfesoradoId("");
    setPlanes([]);
    setSelectedPlanId("");
    setMaterias([]);
    setRows([{ key: randomKey(), materiaId: "", nota: "" }]);
  };

  useEffect(() => {
    if (!open) {
      resetState();
    }
  }, [open]);

  const metadataQuery = useQuery({
    queryKey: ['primera-carga', 'metadata-global'],
    queryFn: () => fetchRegularidadMetadata(true),
    enabled: open,
    staleTime: 1000 * 60 * 10,
  });
  const estudiantesOptions = metadataQuery.data?.estudiantes ?? [];

  const handleBuscarCarreras = async (dniToSearch?: string) => {
    const dniTrimmed = (dniToSearch || dni).trim();
    if (dniTrimmed.length < 7) {
      enqueueSnackbar("Ingresá un DNI válido.", { variant: "warning" });
      return;
    }
    setCarrerasLoading(true);
    try {
      const data = await obtenerCarrerasActivas({ dni: dniTrimmed });
      if (!data.length) {
        enqueueSnackbar("El estudiante no tiene profesorados asociados.", { variant: "warning" });
      }
      setCarreras(data);
      if (data.length === 1) {
        setSelectedProfesoradoId(String(data[0].profesorado_id));
      } else {
        setSelectedProfesoradoId("");
      }

      // Intentar obtener el nombre si no lo tenemos
      if (!estudianteNombre) {
        try {
          const det = await fetchEstudianteAdminDetail(dniTrimmed);
          setEstudianteNombre(`${det.apellido}, ${det.nombre}`);
        } catch { /* ignore */ }
      }
    } catch (error) {
      enqueueSnackbar(getErrorMessage(error, "No se pudieron obtener las carreras del estudiante."), {
        variant: "error",
      });
    } finally {
      setCarrerasLoading(false);
    }
  };

  useEffect(() => {
    if (!selectedProfesoradoId) {
      setPlanes([]);
      setSelectedPlanId("");
      return;
    }
    const load = async () => {
      setPlanesLoading(true);
      try {
        const data = await listarPlanes(Number(selectedProfesoradoId));
        setPlanes(data);
        if (data.length) {
          const prefer = preferPlan(data);
          if (prefer) {
            setSelectedPlanId(String(prefer.id));
          }
        }
      } catch (error) {
        enqueueSnackbar(getErrorMessage(error, "No se pudieron obtener los planes del profesorado."), {
          variant: "error",
        });
        setPlanes([]);
        setSelectedPlanId("");
      } finally {
        setPlanesLoading(false);
      }
    };
    load();
  }, [selectedProfesoradoId, enqueueSnackbar]);

  useEffect(() => {
    if (!selectedPlanId || !dni.trim()) {
      setMaterias([]);
      setRows([{ key: randomKey(), materiaId: "", nota: "" }]);
      return;
    }
    const load = async () => {
      setMateriasLoading(true);
      try {
        const data = await fetchMateriasPendientesEquivalencia({
          dni: dni.trim(),
          profesorado_id: Number(selectedProfesoradoId),
          plan_id: Number(selectedPlanId),
        });
        setMaterias(data);
        setRows([{ key: crypto.randomUUID(), materiaId: "", nota: "" }]);
      } catch (error) {
        enqueueSnackbar(getErrorMessage(error, "No se pudieron obtener las materias pendientes."), {
          variant: "error",
        });
        setMaterias([]);
      } finally {
        setMateriasLoading(false);
      }
    };
    load();
  }, [selectedPlanId, selectedProfesoradoId, dni, enqueueSnackbar]);

  const availableMaterias = useMemo(() => {
    return materias;
  }, [materias]);

  const handleRowChange = (rowKey: string, field: "materiaId" | "nota", value: string) => {
    setRows((prev) =>
      prev.map((row) => (row.key === rowKey ? { ...row, [field]: value } : row)),
    );
  };

  const handleAddRow = () => {
    setRows((prev) => [...prev, { key: randomKey(), materiaId: "", nota: "" }]);
  };

  const handleRemoveRow = (rowKey: string) => {
    setRows((prev) => (prev.length === 1 ? [{ key: randomKey(), materiaId: "", nota: "" }] : prev.filter((row) => row.key !== rowKey)));
  };

  const handleSubmit = async () => {
    const dniTrimmed = dni.trim();
    if (!dniTrimmed) {
      enqueueSnackbar("Ingresá el DNI del estudiante.", { variant: "warning" });
      return;
    }
    if (!selectedProfesoradoId) {
      enqueueSnackbar("Seleccioná el profesorado.", { variant: "warning" });
      return;
    }
    if (!selectedPlanId) {
      enqueueSnackbar("Seleccioná el plan de estudios.", { variant: "warning" });
      return;
    }
    if (!numeroDisposicion.trim()) {
      enqueueSnackbar("Ingresá el número de disposición.", { variant: "warning" });
      return;
    }
    if (!fechaDisposicion) {
      enqueueSnackbar("Ingresá la fecha de la disposición.", { variant: "warning" });
      return;
    }
    const detalles = rows
      .filter((row) => row.materiaId && row.nota)
      .map((row) => ({
        materia_id: Number(row.materiaId),
        nota: row.nota.trim(),
      }));
    if (!detalles.length) {
      enqueueSnackbar("Agregá al menos una materia con nota.", { variant: "warning" });
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit({
        dni: dniTrimmed,
        profesorado_id: Number(selectedProfesoradoId),
        plan_id: Number(selectedPlanId),
        numero_disposicion: numeroDisposicion.trim(),
        fecha_disposicion: fechaDisposicion,
        observaciones: observaciones.trim() || undefined,
        detalles,
      });
      enqueueSnackbar("Disposición registrada correctamente.", { variant: "success" });
      onClose();
    } catch (error) {
      enqueueSnackbar(getErrorMessage(error, "No se pudo registrar la disposición."), {
        variant: "error",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const selectedCarrera = carreras.find((c) => String(c.profesorado_id) === selectedProfesoradoId);

  const rowsRendered = rows.map((row, index) => {
    const selectedIds = rows.filter((r) => r.key !== row.key).map((r) => r.materiaId);
    const materiaOptions = availableMaterias.filter((m) => !selectedIds.includes(String(m.id)) || String(m.id) === row.materiaId);
    return (
      <Grid container spacing={1} alignItems="center" key={row.key}>
        <Grid item xs={12} md={6}>
          <TextField
            select
            label={`Materia ${index + 1}`}
            size="small"
            fullWidth
            value={row.materiaId}
            onChange={(event) => handleRowChange(row.key, "materiaId", event.target.value)}
          >
            <MenuItem value="">Seleccioná...</MenuItem>
            {materiaOptions.map((materia) => (
              <MenuItem key={materia.id} value={String(materia.id)}>
                {materia.anio}º - {materia.nombre}
              </MenuItem>
            ))}
          </TextField>
        </Grid>
        <Grid item xs={8} md={4}>
          <TextField
            label="Nota"
            size="small"
            fullWidth
            type="number"
            inputProps={{ min: 1, max: 10 }}
            value={row.nota}
            onChange={(event) => handleRowChange(row.key, "nota", event.target.value)}
          />
        </Grid>
        <Grid item xs={4} md={2} textAlign="right">
          <IconButton onClick={() => handleRemoveRow(row.key)} disabled={rows.length === 1}>
            <DeleteOutlineIcon fontSize="small" />
          </IconButton>
        </Grid>
      </Grid>
    );
  });

  return (
    <Dialog
      open={open}
      onClose={(event, reason) => {
        if (submitting) return;
        if (reason && reason === 'backdropClick') return;
        onClose();
      }}
      disableEscapeKeyDown
      maxWidth="md"
      fullWidth
    >
      <DialogTitle>{title}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={8}>
              <Autocomplete
                freeSolo
                options={estudiantesOptions}
                getOptionLabel={(option) => {
                  if (typeof option === 'string') return option;
                  return `${option.apellido_nombre} (${option.dni})`;
                }}
                value={
                  estudiantesOptions.find(e => e.dni === dni) ||
                  (estudianteNombre ? { dni, apellido_nombre: estudianteNombre, profesorados: [] } : null) ||
                  dni
                }
                onChange={(_, value) => {
                  if (typeof value === 'string') {
                    const match = value.match(/(.*) \((\d+)\)$/);
                    if (match) {
                      const name = match[1].trim();
                      const d = match[2];
                      setDni(d);
                      setEstudianteNombre(name);
                      handleBuscarCarreras(d);
                    } else {
                      setDni(value.replace(/\D/g, ""));
                    }
                  } else if (value) {
                    setDni(value.dni);
                    setEstudianteNombre(value.apellido_nombre);
                    handleBuscarCarreras(value.dni);
                  } else {
                    setDni("");
                    setEstudianteNombre("");
                    setCarreras([]);
                  }
                }}
                onInputChange={(_, value, reason) => {
                  if (reason === 'input') {
                    const cleanDni = value.replace(/\D/g, "");
                    if (cleanDni.length !== value.length) {
                      // if it contains nondigits, user might be typing name
                    } else {
                      setDni(cleanDni);
                    }
                  }
                }}
                renderOption={(props, option) => {
                  const { key, ...restProps } = props as any;
                  return (
                    <li key={key} {...restProps}>
                      <Box>
                        <Typography variant="body2">{option.apellido_nombre}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          DNI: {option.dni}
                        </Typography>
                      </Box>
                    </li>
                  );
                }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Buscar estudiante (Nombre o DNI)"
                    size="small"
                    inputProps={{
                      ...params.inputProps,
                      maxLength: 50,
                    }}
                  />
                )}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <Button
                variant="outlined"
                fullWidth
                startIcon={carrerasLoading ? <CircularProgress size={16} /> : <SearchIcon />}
                onClick={() => handleBuscarCarreras()}
                disabled={carrerasLoading || dni.trim().length < 7}
              >
                Buscar Carreras
              </Button>
            </Grid>
          </Grid>

          {estudianteNombre && (
            <Box sx={{ p: 1.5, bgcolor: '#f0f7f0', borderRadius: 1, border: '1px solid #cce7cc' }}>
              <Typography variant="body2" sx={{ color: '#2e7d32', fontWeight: 600 }}>
                Estudiante: {estudianteNombre}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                DNI: {dni}
              </Typography>
            </Box>
          )}

          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <TextField
                select
                label="Profesorado"
                size="small"
                fullWidth
                value={selectedProfesoradoId}
                onChange={(event) => setSelectedProfesoradoId(event.target.value)}
                disabled={!carreras.length}
              >
                <MenuItem value="">Seleccioná...</MenuItem>
                {carreras.map((carrera) => (
                  <MenuItem key={carrera.profesorado_id} value={String(carrera.profesorado_id)}>
                    {carrera.nombre}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                select
                label="Plan / Resolución"
                size="small"
                fullWidth
                value={selectedPlanId}
                onChange={(event) => setSelectedPlanId(event.target.value)}
                disabled={!selectedProfesoradoId || planesLoading}
              >
                <MenuItem value="">Seleccioná...</MenuItem>
                {planes.map((plan) => (
                  <MenuItem key={plan.id} value={String(plan.id)}>
                    {plan.resolucion} {plan.vigente ? "(vigente)" : ""}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
          </Grid>

          {selectedCarrera && (
            <Alert severity="info">
              Estudiante asignado a <strong>{selectedCarrera.nombre}</strong>.
            </Alert>
          )}

          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <TextField
                label="Número de disposición"
                size="small"
                fullWidth
                value={numeroDisposicion}
                onChange={(event) => setNumeroDisposicion(event.target.value)}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                label="Fecha de disposición"
                size="small"
                fullWidth
                type="date"
                value={fechaDisposicion}
                onChange={(event) => setFechaDisposicion(event.target.value)}
              />
            </Grid>
          </Grid>

          <TextField
            label="Observaciones"
            size="small"
            fullWidth
            value={observaciones}
            onChange={(event) => setObservaciones(event.target.value)}
            multiline
            minRows={2}
          />

          {requiresCorrelatividades ? (
            <Alert severity="info">
              Se verificarán automáticamente las correlatividades antes de registrar la equivalencia.
            </Alert>
          ) : (
            <Alert severity="warning">
              Esta carga no verifica correlatividades. Usar solo en el contexto de primera carga.
            </Alert>
          )}

          <Box>
            <Typography variant="subtitle1" fontWeight={600} gutterBottom>
              Materias a acreditar
            </Typography>
            {materiasLoading ? (
              <Stack direction="row" spacing={1} alignItems="center">
                <CircularProgress size={16} />
                <Typography variant="body2" color="text.secondary">
                  Cargando materias pendientes...
                </Typography>
              </Stack>
            ) : !materias.length ? (
              <Alert severity="info">No hay materias pendientes para el plan seleccionado.</Alert>
            ) : (
              <Stack spacing={1.5}>
                {rowsRendered}
                <Button
                  startIcon={<AddIcon />}
                  variant="text"
                  onClick={handleAddRow}
                  disabled={rows.length >= materias.length}
                >
                  Agregar fila
                </Button>
              </Stack>
            )}
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={submitting}>
          Cancelar
        </Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={submitting || materiasLoading}
        >
          {submitting ? <CircularProgress size={18} /> : submitLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default EquivalenciaDisposicionDialog;
