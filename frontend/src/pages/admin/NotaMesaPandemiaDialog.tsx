import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Grid,
  IconButton,
  MenuItem,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Autocomplete,
  Tooltip,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { useMutation, useQuery } from '@tanstack/react-query';
import { enqueueSnackbar } from 'notistack';
import {
  fetchRegularidadMetadata,
  MesaPandemiaFila,
  MesaPandemiaPayload,
  MesaPandemiaResult,
  registrarMesaPandemia,
} from '@/api/primeraCarga';
import {
  INSTITUTIONAL_TERRACOTTA,
  INSTITUTIONAL_TERRACOTTA_DARK,
} from '@/styles/institutionalColors';

// ---------------------------------------------------------------------------
// Tipos locales
// ---------------------------------------------------------------------------

type FilaLocal = {
  id: number;
  apellido_nombre: string;
  dni: string;
  nota_raw: string; // "7", "AUSENTE", "LIBRE", etc.
  comision_obs: string;
  observaciones: string;
};

const TIPO_MESA_OPTIONS = [
  { value: 'EXT', label: 'Extraordinaria (Pandemia)' },
  { value: 'FIN', label: 'Ordinaria (Final)' },
  { value: 'ESP', label: 'Especial' },
];

const NOTA_CHIP_PROPS = (
  nota: string
): { color: 'success' | 'error' | 'warning' | 'default'; label: string } => {
  const upper = nota.trim().toUpperCase();
  if (!upper) return { color: 'default', label: '—' };
  if (['AUSENTE', 'AUS', 'AUS.'].includes(upper)) return { color: 'warning', label: 'AUS' };
  if (upper === 'LIBRE') return { color: 'warning', label: 'LIBRE' };
  const n = parseFloat(upper.replace(',', '.'));
  if (!isNaN(n)) {
    return n >= 6
      ? { color: 'success', label: `${n} – APR` }
      : { color: 'error', label: `${n} – DES` };
  }
  return { color: 'default', label: upper };
};

let _nextId = 1;
const newFila = (): FilaLocal => ({
  id: _nextId++,
  apellido_nombre: '',
  dni: '',
  nota_raw: '',
  comision_obs: '',
  observaciones: '',
});

const OBS_DEFAULT = 'Notas de mesa tomada durante período de pandemia (2020).';

// ---------------------------------------------------------------------------
// Resumen de resultados
// ---------------------------------------------------------------------------
const ResultadoSummary: React.FC<{ data: MesaPandemiaResult }> = ({ data }) => (
  <Stack spacing={1.5}>
    <Alert
      severity={data.errores_count === 0 ? 'success' : 'warning'}
      icon={<CheckCircleIcon />}
    >
      <Typography variant="body2" fontWeight={600}>
        {data.procesadas} procesadas · {data.omitidas} omitidas · {data.errores_count} errores
      </Typography>
    </Alert>

    {data.warnings.length > 0 && (
      <Paper variant="outlined" sx={{ p: 1.5, bgcolor: 'warning.50' }}>
        <Typography variant="caption" color="warning.dark" fontWeight={600} gutterBottom>
          Advertencias:
        </Typography>
        {data.warnings.map((w, i) => (
          <Typography key={i} variant="caption" display="block" color="text.secondary">
            • {w}
          </Typography>
        ))}
      </Paper>
    )}

    <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 300 }}>
      <Table size="small" stickyHeader>
        <TableHead>
          <TableRow sx={{ bgcolor: 'grey.100' }}>
            <TableCell>#</TableCell>
            <TableCell>Nombre</TableCell>
            <TableCell>DNI</TableCell>
            <TableCell>Nota</TableCell>
            <TableCell>Estado</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {data.results.map((r) => (
            <TableRow key={r.fila} hover>
              <TableCell>{r.fila}</TableCell>
              <TableCell>{r.apellido_nombre || '—'}</TableCell>
              <TableCell>{r.dni || '—'}</TableCell>
              <TableCell>{r.nota_raw || '—'}</TableCell>
              <TableCell>
                <Chip
                  size="small"
                  label={r.mensaje || r.estado}
                  color={
                    r.estado === 'aprobado'
                      ? 'success'
                      : r.estado === 'desaprobado'
                      ? 'error'
                      : r.estado === 'ausente'
                      ? 'warning'
                      : 'default'
                  }
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  </Stack>
);

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
interface Props {
  open: boolean;
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------
const NotaMesaPandemiaDialog: React.FC<Props> = ({ open, onClose }) => {
  // — Encabezado —
  const [profesoradoId, setProfesId] = useState<string>('');
  const [materiaId, setMateriaId] = useState<string>('');
  const [fecha, setFecha] = useState<string>('');
  const [tipo, setTipo] = useState<string>('EXT');
  const [docenteNombre, setDocenteNombre] = useState<string>('');
  const [folio, setFolio] = useState<string>('PANDEMIA');
  const [libro, setLibro] = useState<string>('PANDEMIA');
  const [obsGeneral, setObsGeneral] = useState<string>(OBS_DEFAULT);

  // — Filas —
  const [filas, setFilas] = useState<FilaLocal[]>([newFila()]);

  // — Resultado —
  const [resultado, setResultado] = useState<MesaPandemiaResult | null>(null);

  // — Metadata —
  const metadataQuery = useQuery({
    queryKey: ['primera-carga-metadata-all'],
    queryFn: () => fetchRegularidadMetadata(false), // false = Respeta el filtro de bedel de la API
    enabled: open,
    staleTime: 5 * 60 * 1000,
  });

  // Reset al cerrar
  useEffect(() => {
    if (!open) {
      setProfesId('');
      setMateriaId('');
      setFecha('');
      setTipo('EXT');
      setDocenteNombre('');
      setFolio('PANDEMIA');
      setLibro('PANDEMIA');
      setObsGeneral(OBS_DEFAULT);
      setFilas([newFila()]);
      setResultado(null);
    }
  }, [open]);

  // Profesorados
  const profesorados = useMemo(
    () => metadataQuery.data?.profesorados ?? [],
    [metadataQuery.data]
  );

  // Materias filtradas
  const materias = useMemo(() => {
    if (!profesoradoId) return [];
    const prof = profesorados.find((p) => String(p.id) === profesoradoId);
    if (!prof) return [];
    const seen = new Set<number>();
    const lista: { id: number; nombre: string; anio: number | null }[] = [];
    for (const plan of prof.planes) {
      for (const mat of plan.materias) {
        if (!seen.has(mat.id)) {
          seen.add(mat.id);
          lista.push({ id: mat.id, nombre: mat.nombre, anio: mat.anio_cursada });
        }
      }
    }
    return lista.sort(
      (a, b) => (a.anio ?? 0) - (b.anio ?? 0) || a.nombre.localeCompare(b.nombre)
    );
  }, [profesoradoId, profesorados]);

  // Listas de docentes y estudiantes desde la metadata
  const docentes = useMemo(() => metadataQuery.data?.docentes ?? [], [metadataQuery.data]);
  const estudiantes = useMemo(() => {
    const todos = metadataQuery.data?.estudiantes ?? [];
    if (!profesoradoId) return todos;
    // Si se eligió profesorado, filtramos los que pertenezcan a ese profesorado para facilitar la búsqueda
    const profIdNum = Number(profesoradoId);
    return todos.filter(e => e.profesorados.includes(profIdNum));
  }, [metadataQuery.data, profesoradoId]);

  // Mutation
  const mutation = useMutation({
    mutationFn: (payload: MesaPandemiaPayload) => registrarMesaPandemia(payload),
    onSuccess: (res) => {
      setResultado(res.data);
      if (res.data.errores_count === 0) {
        enqueueSnackbar(res.message, { variant: 'success' });
      } else {
        enqueueSnackbar(
          `Carga completada con ${res.data.errores_count} errores. Revisá el detalle.`,
          { variant: 'warning' }
        );
      }
    },
    onError: (err: any) => {
      enqueueSnackbar(
        err?.response?.data?.message || 'Error al registrar las notas.',
        { variant: 'error' }
      );
    },
  });

  // — Handlers filas —
  const agregarFila = useCallback(() => setFilas((prev) => [...prev, newFila()]), []);

  const eliminarFila = useCallback(
    (id: number) => setFilas((prev) => prev.filter((f) => f.id !== id)),
    []
  );

  const actualizarFila = useCallback(
    (id: number, campo: keyof FilaLocal, valor: string) =>
      setFilas((prev) => prev.map((f) => (f.id === id ? { ...f, [campo]: valor } : f))),
    []
  );

  // — Submit —
  const handleSubmit = () => {
    if (!profesoradoId || !materiaId || !fecha) {
      enqueueSnackbar('Completá profesorado, materia y fecha.', { variant: 'warning' });
      return;
    }
    if (filas.length === 0) {
      enqueueSnackbar('Agregá al menos una fila.', { variant: 'warning' });
      return;
    }

    const payload: MesaPandemiaPayload = {
      profesorado_id: Number(profesoradoId),
      materia_id: Number(materiaId),
      fecha,
      tipo,
      docente_nombre: docenteNombre.trim() || undefined,
      folio: folio.trim() || undefined,
      libro: libro.trim() || undefined,
      observaciones: obsGeneral.trim() || undefined,
      filas: filas.map(
        (f): MesaPandemiaFila => ({
          apellido_nombre: f.apellido_nombre.trim(),
          dni: f.dni.trim() || undefined,
          nota_raw: f.nota_raw.trim() || undefined,
          comision_obs: f.comision_obs.trim() || undefined,
          observaciones: f.observaciones.trim() || undefined,
        })
      ),
    };

    mutation.mutate(payload);
  };

  const isBusy = mutation.isPending || metadataQuery.isLoading;

  // ---------------------------------------------------------------------------
  return (
    <Dialog
      open={open}
      onClose={(_, reason) => {
        if (reason === 'backdropClick') return;
        onClose();
      }}
      disableEscapeKeyDown
      maxWidth="lg"
      fullWidth
    >
      <DialogTitle sx={{ pb: 0.5 }}>
        <Typography variant="h6" fontWeight={700}>
          Carga de notas de Mesa — Histórico Pandemia
        </Typography>
        <Typography variant="caption" color="text.secondary">
          Ingresá los datos del acta de mesa tomada durante el período especial. Nota aprobatoria:{' '}
          <strong>≥ 6</strong>. Folio/Libro se pre-completan con <em>PANDEMIA</em> para identificar
          estos registros.
        </Typography>
      </DialogTitle>

      <DialogContent dividers sx={{ p: { xs: 2, md: 3 } }}>
        {metadataQuery.isError && (
          <Alert severity="error" sx={{ mb: 2 }}>
            No se pudo cargar el listado de profesorados y materias.
          </Alert>
        )}

        {/* ━━━━━━ ENCABEZADO ━━━━━━ */}
        <Typography variant="subtitle1" fontWeight={600} gutterBottom>
          Datos del encabezado
        </Typography>

        <Grid container spacing={2} sx={{ mb: 2 }}>
          {/* Profesorado */}
          <Grid item xs={12} md={5}>
            <TextField
              select
              label="Profesorado *"
              fullWidth
              value={profesoradoId}
              onChange={(e) => {
                setProfesId(e.target.value);
                setMateriaId('');
              }}
              disabled={isBusy || metadataQuery.isLoading}
              size="small"
            >
              {profesorados.map((p) => (
                <MenuItem key={p.id} value={String(p.id)}>
                  {p.nombre}
                </MenuItem>
              ))}
            </TextField>
          </Grid>

          {/* Materia */}
          <Grid item xs={12} md={4}>
            <TextField
              select
              label="Materia *"
              fullWidth
              value={materiaId}
              onChange={(e) => setMateriaId(e.target.value)}
              disabled={isBusy || !profesoradoId}
              size="small"
            >
              {materias.map((m) => (
                <MenuItem key={m.id} value={String(m.id)}>
                  {m.anio != null ? `${m.anio}° – ` : ''}
                  {m.nombre}
                </MenuItem>
              ))}
            </TextField>
          </Grid>

          {/* Fecha */}
          <Grid item xs={12} md={3}>
            <TextField
              label="Fecha de examen *"
              type="date"
              fullWidth
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              InputLabelProps={{ shrink: true }}
              disabled={isBusy}
              size="small"
            />
          </Grid>

          {/* Tipo de mesa */}
          <Grid item xs={12} md={3}>
            <TextField
              select
              label="Tipo de mesa"
              fullWidth
              value={tipo}
              onChange={(e) => setTipo(e.target.value)}
              disabled={isBusy}
              size="small"
            >
              {TIPO_MESA_OPTIONS.map((o) => (
                <MenuItem key={o.value} value={o.value}>
                  {o.label}
                </MenuItem>
              ))}
            </TextField>
          </Grid>

          {/* Docente */}
          <Grid item xs={12} md={4}>
            <Autocomplete
              options={docentes}
              getOptionLabel={(op) => (typeof op === 'string' ? op : op.nombre || '')}
              value={docentes.find((d) => d.nombre === docenteNombre) || null}
              onChange={(_, newVal) => {
                if (typeof newVal === 'string') {
                  setDocenteNombre(newVal);
                } else {
                  setDocenteNombre(newVal ? newVal.nombre : '');
                }
              }}
              onInputChange={(_, newInputValue) => setDocenteNombre(newInputValue)}
              freeSolo
              disabled={isBusy}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Docente (Buscador)"
                  size="small"
                  fullWidth
                  placeholder="Seleccioná de la lista o tipeá"
                />
              )}
            />
          </Grid>

          {/* Folio */}
          <Grid item xs={6} md={2}>
            <TextField
              label="Folio"
              fullWidth
              value={folio}
              onChange={(e) => setFolio(e.target.value)}
              disabled={isBusy}
              size="small"
              helperText="Identificador del registro"
            />
          </Grid>

          {/* Libro */}
          <Grid item xs={6} md={3}>
            <TextField
              label="Libro"
              fullWidth
              value={libro}
              onChange={(e) => setLibro(e.target.value)}
              disabled={isBusy}
              size="small"
              helperText="'PANDEMIA' para identificar estas actas"
            />
          </Grid>

          {/* Observaciones generales */}
          <Grid item xs={12}>
            <TextField
              label="Observaciones generales"
              fullWidth
              multiline
              minRows={1}
              value={obsGeneral}
              onChange={(e) => setObsGeneral(e.target.value)}
              disabled={isBusy}
              size="small"
            />
          </Grid>
        </Grid>

        <Divider sx={{ my: 2 }} />

        {/* ━━━━━━ TABLA DE FILAS ━━━━━━ */}
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
          <Typography variant="subtitle1" fontWeight={600}>
            Estudiantes ({filas.length})
          </Typography>
          <Button
            size="small"
            startIcon={<AddIcon />}
            variant="outlined"
            onClick={agregarFila}
            disabled={isBusy}
            sx={{
              borderRadius: 999,
              borderColor: INSTITUTIONAL_TERRACOTTA,
              color: INSTITUTIONAL_TERRACOTTA,
            }}
          >
            Agregar fila
          </Button>
        </Stack>

        <Alert severity="info" sx={{ mb: 1.5 }} icon={<WarningAmberIcon />}>
          <Typography variant="caption">
            <strong>Nota:</strong> ingresá el valor tal como figura en el acta: número (ej.{' '}
            <code>7</code>), <code>AUSENTE</code> o <code>LIBRE</code>. El campo "Comisión" es
            informativo para casos donde el estudiante pertenece a otro profesorado.
          </Typography>
        </Alert>

        <TableContainer component={Paper} variant="outlined" sx={{ mb: 2 }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow sx={{ bgcolor: 'grey.50' }}>
                <TableCell width={40}>#</TableCell>
                <TableCell width={300}>Búsqueda de Estudiante (Obligatorio)</TableCell>
                <TableCell width={140}>Nota / Condición</TableCell>
                <TableCell width={150}>Comisión (otro prof.)</TableCell>
                <TableCell width={160}>Obs. de la fila</TableCell>
                <TableCell width={50} align="center">⌫</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filas.map((fila, idx) => {
                const chip = NOTA_CHIP_PROPS(fila.nota_raw);
                return (
                  <TableRow key={fila.id} hover>
                    <TableCell>
                      <Typography variant="caption" color="text.disabled">
                        {idx + 1}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Autocomplete
                        options={estudiantes}
                        getOptionLabel={(e) => `${e.apellido_nombre} (DNI ${e.dni})`}
                        value={estudiantes.find((e) => e.dni === fila.dni) || null as any}
                        onChange={(_, newVal) => {
                          actualizarFila(fila.id, 'dni', newVal ? newVal.dni : '');
                          actualizarFila(
                            fila.id,
                            'apellido_nombre',
                            newVal ? newVal.apellido_nombre : ''
                          );
                        }}
                        disabled={isBusy}
                        disableClearable
                        renderInput={(params) => (
                          <TextField
                            {...params}
                            variant="standard"
                            placeholder="Tipeá DNI o Nombre"
                            inputProps={{
                              ...params.inputProps,
                              style: { fontSize: 13, paddingTop: 6 },
                            }}
                          />
                        )}
                        renderOption={(props, option) => (
                          <li {...props}>
                            <Box>
                              <Typography variant="body2">{option.apellido_nombre}</Typography>
                              <Typography variant="caption" color="text.secondary">
                                DNI: {option.dni}
                              </Typography>
                            </Box>
                          </li>
                        )}
                      />
                    </TableCell>
                    <TableCell>
                      <Stack spacing={0.5}>
                        <TextField
                          variant="standard"
                          value={fila.nota_raw}
                          onChange={(e) => actualizarFila(fila.id, 'nota_raw', e.target.value)}
                          disabled={isBusy}
                          placeholder="7 / AUSENTE"
                          inputProps={{ style: { fontSize: 13 } }}
                          fullWidth
                        />
                        {fila.nota_raw && (
                          <Chip
                            size="small"
                            label={chip.label}
                            color={chip.color}
                            sx={{ fontSize: 10, height: 18 }}
                          />
                        )}
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <TextField
                        variant="standard"
                        value={fila.comision_obs}
                        onChange={(e) =>
                          actualizarFila(fila.id, 'comision_obs', e.target.value)
                        }
                        disabled={isBusy}
                        placeholder="Comisión B / PEP"
                        inputProps={{ style: { fontSize: 12 } }}
                        fullWidth
                      />
                    </TableCell>
                    <TableCell>
                      <TextField
                        variant="standard"
                        value={fila.observaciones}
                        onChange={(e) =>
                          actualizarFila(fila.id, 'observaciones', e.target.value)
                        }
                        disabled={isBusy}
                        placeholder="Opcional..."
                        inputProps={{ style: { fontSize: 12 } }}
                        fullWidth
                      />
                    </TableCell>
                    <TableCell align="center">
                      <Tooltip title="Eliminar fila">
                        <span>
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => eliminarFila(fila.id)}
                            disabled={isBusy || filas.length === 1}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </span>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>

        {/* ━━━━━━ RESULTADO ━━━━━━ */}
        {resultado && (
          <>
            <Divider sx={{ my: 2 }} />
            <Typography variant="subtitle1" fontWeight={600} gutterBottom>
              Resultado de la carga
            </Typography>
            <ResultadoSummary data={resultado} />
          </>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
        <Button onClick={onClose} disabled={mutation.isPending} color="inherit">
          Cerrar
        </Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={isBusy}
          startIcon={
            mutation.isPending ? <CircularProgress size={16} color="inherit" /> : undefined
          }
          sx={{
            borderRadius: 999,
            backgroundColor: INSTITUTIONAL_TERRACOTTA,
            '&:hover': { backgroundColor: INSTITUTIONAL_TERRACOTTA_DARK },
          }}
        >
          {mutation.isPending ? 'Guardando...' : 'Registrar notas'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default NotaMesaPandemiaDialog;
