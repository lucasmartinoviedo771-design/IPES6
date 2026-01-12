import React, { useEffect, useMemo, useState } from "react";
import {
  Autocomplete,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import { enqueueSnackbar } from "notistack";
import {
  listarPlanes,
  listarProfesorados,
  PlanDTO,
  ProfesoradoDTO,
} from "@/api/cargaNotas";
import {
  ComisionDTO,
  listarComisiones,
  listarMaterias,
  MateriaDTO,
  generarComisiones,
} from "@/api/comisiones";
import { useCarreras } from "@/hooks/useCarreras";
import { useTurnos } from "@/hooks/useTurnos";
import { PageHero, SectionTitlePill } from "@/components/ui/GradientTitles";
import BackButton from "@/components/ui/BackButton";
import { INSTITUTIONAL_TERRACOTTA } from "@/styles/institutionalColors";

type FiltersState = {
  profesoradoId: number | null;
  planId: number | null;
  materiaId: number | null;
  turnoId: number | null;
  anioLectivo: string;
  estado: string;
};

const ESTADOS_COMISION = [
  { value: "ABI", label: "Abierta" },
  { value: "CER", label: "Cerrada" },
  { value: "SUS", label: "Suspendida" },
];

const currentYear = String(new Date().getFullYear());

const ComisionesPage: React.FC = () => {
  const [filters, setFilters] = useState<FiltersState>({
    profesoradoId: null,
    planId: null,
    materiaId: null,
    turnoId: null,
    anioLectivo: currentYear,
    estado: "",
  });

  const { data: profesorados = [] } = useCarreras();
  const { data: turnos = [] } = useTurnos();
  const [comisiones, setComisiones] = useState<ComisionDTO[]>([]);

  const [loadingPlanes, setLoadingPlanes] = useState(false);
  const [loadingMaterias, setLoadingMaterias] = useState(false);
  const [loadingComisiones, setLoadingComisiones] = useState(false);
  const [bulkCreating, setBulkCreating] = useState(false);

  const [bulkCantidad, setBulkCantidad] = useState("1");
  const [bulkEstado, setBulkEstado] = useState("ABI");

  const [planes, setPlanes] = useState<PlanDTO[]>([]);
  const [materias, setMaterias] = useState<MateriaDTO[]>([]);

  useEffect(() => {
    if (!filters.profesoradoId) {
      setPlanes([]);
      setFilters((prev) => ({
        ...prev,
        planId: null,
        materiaId: null,
      }));
      return;
    }

    const loadPlanes = async () => {
      setLoadingPlanes(true);
      try {
        const data = await listarPlanes(filters.profesoradoId!);
        setPlanes(data);
      } catch (error) {
        enqueueSnackbar("No se pudieron obtener los planes.", {
          variant: "error",
        });
      } finally {
        setLoadingPlanes(false);
      }
    };
    loadPlanes();
  }, [filters.profesoradoId]);

  useEffect(() => {
    if (!filters.planId) {
      setMaterias([]);
      setFilters((prev) => ({ ...prev, materiaId: null }));
      return;
    }

    const loadMaterias = async () => {
      setLoadingMaterias(true);
      try {
        const data = await listarMaterias(filters.planId!);
        setMaterias(data);
      } catch (error) {
        enqueueSnackbar("No se pudieron obtener las materias.", {
          variant: "error",
        });
      } finally {
        setLoadingMaterias(false);
      }
    };
    loadMaterias();
  }, [filters.planId]);

  useEffect(() => {
    const shouldFetch =
      filters.profesoradoId || filters.planId || filters.materiaId;
    if (!shouldFetch) {
      setComisiones([]);
      return;
    }

    const loadComisiones = async () => {
      setLoadingComisiones(true);
      try {
        const anio = filters.anioLectivo ? Number(filters.anioLectivo) : null;
        const data = await listarComisiones({
          profesorado_id: filters.profesoradoId,
          plan_id: filters.planId,
          materia_id: filters.materiaId,
          anio_lectivo: anio && !Number.isNaN(anio) ? anio : null,
          turno_id: filters.turnoId,
          estado: filters.estado || null,
        });
        setComisiones(data);
      } catch (error) {
        enqueueSnackbar("No se pudieron obtener las comisiones.", {
          variant: "error",
        });
      } finally {
        setLoadingComisiones(false);
      }
    };
    loadComisiones();
  }, [
    filters.profesoradoId,
    filters.planId,
    filters.materiaId,
    filters.anioLectivo,
    filters.turnoId,
    filters.estado,
  ]);

  const selectedMateria = useMemo(
    () => materias.find((m) => m.id === filters.materiaId) ?? null,
    [materias, filters.materiaId],
  );

  const handleGenerarMasivo = async () => {
    if (!filters.planId) {
      enqueueSnackbar("Selecciona un plan de estudio.", { variant: "warning" });
      return;
    }

    if (!filters.anioLectivo.trim()) {
      enqueueSnackbar("Ingresá el año lectivo.", { variant: "warning" });
      return;
    }

    const cantidad = Number(bulkCantidad);
    if (Number.isNaN(cantidad) || cantidad < 1) {
      enqueueSnackbar("La cantidad debe ser un numero mayor o igual a 1.", {
        variant: "warning",
      });
      return;
    }

    const anio = Number(filters.anioLectivo);
    if (Number.isNaN(anio)) {
      enqueueSnackbar("El año lectivo debe ser numérico.", {
        variant: "warning",
      });
      return;
    }

    setBulkCreating(true);
    try {
      const nuevos = await generarComisiones({
        plan_id: filters.planId,
        anio_lectivo: anio,
        cantidad,
        estado: bulkEstado,
      });
      enqueueSnackbar(
        `${nuevos.length} comisiones generadas correctamente.`,
        { variant: "success" },
      );
      setBulkCantidad("1");
      setBulkEstado("ABI");

      const data = await listarComisiones({
        profesorado_id: filters.profesoradoId,
        plan_id: filters.planId,
        materia_id: filters.materiaId,
        anio_lectivo: anio,
        turno_id: filters.turnoId,
        estado: filters.estado || null,
      });
      setComisiones(data);
    } catch (error: any) {
      const message =
        error?.response?.data?.message ||
        error?.response?.data?.detail ||
        "No se pudieron generar las comisiones.";
      enqueueSnackbar(message, { variant: "error" });
    } finally {
      setBulkCreating(false);
    }
  };

  return (
    <Stack gap={3}>
      <BackButton fallbackPath="/secretaria" />
      <PageHero
        title="Gestión de comisiones"
        subtitle="Generación automática y consulta de comisiones por plan y ciclo lectivo."
      />

      <Paper sx={{ p: 3 }}>
        <Stack gap={3}>
          <Typography variant="h6" mb={2}>
            Filtros
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} md={6} lg={4}>
              <Autocomplete
                options={profesorados}
                getOptionLabel={(option) => option.nombre}
                value={
                  profesorados.find((p) => p.id === filters.profesoradoId) ??
                  null
                }
                onChange={(_, value) =>
                  setFilters((prev) => ({
                    ...prev,
                    profesoradoId: value?.id ?? null,
                    planId: null,
                    materiaId: null,
                  }))
                }
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Profesorado"
                    placeholder="Selecciona profesorado"
                  />
                )}
              />
            </Grid>

            <Grid item xs={12} md={6} lg={4}>
              <Autocomplete
                options={planes}
                getOptionLabel={(option) => option.resolucion}
                loading={loadingPlanes}
                value={planes.find((p) => p.id === filters.planId) ?? null}
                onChange={(_, value) =>
                  setFilters((prev) => ({
                    ...prev,
                    planId: value?.id ?? null,
                    materiaId: null,
                  }))
                }
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Plan de estudio"
                    placeholder="Resolucion"
                    InputProps={{
                      ...params.InputProps,
                      endAdornment: (
                        <>
                          {loadingPlanes ? (
                            <CircularProgress size={16} />
                          ) : null}
                          {params.InputProps.endAdornment}
                        </>
                      ),
                    }}
                  />
                )}
              />
            </Grid>

            <Grid item xs={12} md={6} lg={4}>
              <Autocomplete
                options={materias}
                getOptionLabel={(option) =>
                  `${option.anio_cursada}° - ${option.nombre}`
                }
                loading={loadingMaterias}
                value={selectedMateria}
                onChange={(_, value) =>
                  setFilters((prev) => ({
                    ...prev,
                    materiaId: value?.id ?? null,
                  }))
                }
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Materia"
                    placeholder="Selecciona materia"
                    InputProps={{
                      ...params.InputProps,
                      endAdornment: (
                        <>
                          {loadingMaterias ? (
                            <CircularProgress size={16} />
                          ) : null}
                          {params.InputProps.endAdornment}
                        </>
                      ),
                    }}
                  />
                )}
              />
            </Grid>

            <Grid item xs={12} md={6} lg={4}>
              <FormControl fullWidth>
                <InputLabel id="turno-select">Turno</InputLabel>
                <Select
                  labelId="turno-select"
                  label="Turno"
                  value={filters.turnoId ?? ""}
                  onChange={(event) =>
                    setFilters((prev) => ({
                      ...prev,
                      turnoId: event.target.value
                        ? Number(event.target.value)
                        : null,
                    }))
                  }
                >
                  <MenuItem value="">
                    <em>Todos</em>
                  </MenuItem>
                  {turnos.map((turno) => (
                    <MenuItem key={turno.id} value={turno.id}>
                      {turno.nombre}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} md={6} lg={4}>
              <TextField
                label="Año lectivo"
                value={filters.anioLectivo}
                onChange={(event) =>
                  setFilters((prev) => ({
                    ...prev,
                    anioLectivo: event.target.value,
                  }))
                }
                inputProps={{ inputMode: "numeric", pattern: "[0-9]*" }}
              />
            </Grid>

            <Grid item xs={12} md={6} lg={4}>
              <FormControl fullWidth>
                <InputLabel id="estado-select">Estado</InputLabel>
                <Select
                  labelId="estado-select"
                  label="Estado"
                  value={filters.estado}
                  onChange={(event) =>
                    setFilters((prev) => ({
                      ...prev,
                      estado: event.target.value,
                    }))
                  }
                >
                  <MenuItem value="">
                    <em>Todos</em>
                  </MenuItem>
                  {ESTADOS_COMISION.map((item) => (
                    <MenuItem key={item.value} value={item.value}>
                      {item.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </Stack>
      </Paper>

      <Paper sx={{ p: 3 }}>
        <Stack gap={2}>
          <Typography variant="h6" mb={2}>
            Generar comisiones por ciclo lectivo
          </Typography>
          <Typography color="text.secondary">
            Crea comisiones base para todas las materias del plan seleccionado
            en el ciclo lectivo indicado.
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} md={4}>
              <TextField
                label="Cantidad por materia"
                value={bulkCantidad}
                onChange={(event) => setBulkCantidad(event.target.value)}
                inputProps={{ inputMode: "numeric", pattern: "[0-9]*", min: 1 }}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <FormControl fullWidth>
                <InputLabel id="bulk-estado-select">Estado inicial</InputLabel>
                <Select
                  labelId="bulk-estado-select"
                  label="Estado inicial"
                  value={bulkEstado}
                  onChange={(event) => setBulkEstado(event.target.value)}
                >
                  {ESTADOS_COMISION.map((item) => (
                    <MenuItem key={item.value} value={item.value}>
                      {item.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
          </Grid>
          <Box>
            <Button
              variant="outlined"
              onClick={handleGenerarMasivo}
              disabled={bulkCreating}
            >
              {bulkCreating ? "Generando..." : "Generar automaticamente"}
            </Button>
          </Box>
        </Stack>
      </Paper>

      <Paper sx={{ p: 3 }}>
        <Stack gap={2}>
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Typography variant="h6" mb={2}>
              Comisiones existentes
            </Typography>
            {loadingComisiones ? <CircularProgress size={20} /> : null}
          </Box>
          {comisiones.length ? (
            <TableContainer component={Card} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Anio</TableCell>
                    <TableCell>Materia</TableCell>
                    <TableCell>Codigo</TableCell>
                    <TableCell>Turno</TableCell>
                    <TableCell>Estado</TableCell>
                    <TableCell>Docente</TableCell>
                    <TableCell>Cupo</TableCell>
                    <TableCell>Observaciones</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {comisiones.map((com) => (
                    <TableRow key={com.id} hover>
                      <TableCell>{com.anio_lectivo}</TableCell>
                      <TableCell>{com.materia_nombre}</TableCell>
                      <TableCell>{com.codigo}</TableCell>
                      <TableCell>{com.turno_nombre}</TableCell>
                      <TableCell>
                        {
                          ESTADOS_COMISION.find(
                            (item) => item.value === com.estado,
                          )?.label ?? com.estado
                        }
                      </TableCell>
                      <TableCell>{com.docente_nombre ?? "-"}</TableCell>
                      <TableCell>{com.cupo_maximo ?? "-"}</TableCell>
                      <TableCell>{com.observaciones ?? "-"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          ) : (
            <Card variant="outlined">
              <CardContent>
                <Typography color="text.secondary">
                  No se encontraron comisiones con los filtros actuales.
                </Typography>
              </CardContent>
            </Card>
          )}
        </Stack>
      </Paper>
    </Stack>
  );
};

export default ComisionesPage;
