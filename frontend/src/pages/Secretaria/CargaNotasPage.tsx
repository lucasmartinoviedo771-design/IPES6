import React, { useEffect, useMemo, useState } from "react";
import {
  Autocomplete,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  CircularProgress,
  FormControl,
  Grid,
  InputAdornment,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Tab,
  Tabs,
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
  ComisionOptionDTO,
  GuardarRegularidadPayload,
  PlanDTO,
  ProfesoradoDTO,
  RegularidadAlumnoDTO,
  RegularidadPlanillaDTO,
  SituacionOptionDTO,
  listarComisiones,
  listarPlanes,
  listarProfesorados,
  obtenerPlanillaRegularidad,
  guardarPlanillaRegularidad,
} from "@/api/cargaNotas";

type FiltersState = {
  profesoradoId: number | null;
  planId: number | null;
  anio: number | null;
  cuatrimestre: string | null;
  comisionId: number | null;
};

type RowState = {
  inscripcionId: number;
  orden: number;
  alumnoId: number;
  apellidoNombre: string;
  dni: string;
  notaTp: string;
  notaFinal: string;
  asistencia: string;
  excepcion: boolean;
  situacion: string | null;
  observaciones: string;
};

const cuatrimestreLabel: Record<string, string> = {
  PCU: "1º cuatrimestre",
  SCU: "2º cuatrimestre",
  ANU: "Anual",
};

const CargaNotasPage: React.FC = () => {
  const [filters, setFilters] = useState<FiltersState>({
    profesoradoId: null,
    planId: null,
    anio: null,
    cuatrimestre: null,
    comisionId: null,
  });

  const [profesorados, setProfesorados] = useState<ProfesoradoDTO[]>([]);
  const [planes, setPlanes] = useState<PlanDTO[]>([]);
  const [comisiones, setComisiones] = useState<ComisionOptionDTO[]>([]);
  const [planilla, setPlanilla] = useState<RegularidadPlanillaDTO | null>(null);
  const [situaciones, setSituaciones] = useState<SituacionOptionDTO[]>([]);
  const [activeTab, setActiveTab] = useState<"regularidad" | "finales">("regularidad");
  const [rows, setRows] = useState<RowState[]>([]);
  const [observacionesGenerales, setObservacionesGenerales] = useState<string>("");
  const [fechaCierre, setFechaCierre] = useState<string>(() => new Date().toISOString().slice(0, 10));

  const [loadingProfesorados, setLoadingProfesorados] = useState(false);
  const [loadingPlanes, setLoadingPlanes] = useState(false);
  const [loadingComisiones, setLoadingComisiones] = useState(false);
  const [loadingPlanilla, setLoadingPlanilla] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const loadProfesorados = async () => {
      setLoadingProfesorados(true);
      try {
        const data = await listarProfesorados();
        setProfesorados(data);
      } catch (error) {
        enqueueSnackbar("No se pudieron obtener los profesorados.", { variant: "error" });
      } finally {
        setLoadingProfesorados(false);
      }
    };
    loadProfesorados();
  }, []);

  useEffect(() => {
    if (!filters.profesoradoId) {
      setPlanes([]);
      setFilters((prev) => ({ ...prev, planId: null }));
      return;
    }
    const loadPlanes = async () => {
      setLoadingPlanes(true);
      try {
        const data = await listarPlanes(filters.profesoradoId);
        setPlanes(data);
      } catch (error) {
        enqueueSnackbar("No se pudieron obtener los planes de estudio.", { variant: "error" });
      } finally {
        setLoadingPlanes(false);
      }
    };
    loadPlanes();
  }, [filters.profesoradoId]);

  useEffect(() => {
    if (!filters.planId) {
      setComisiones([]);
      setFilters((prev) => ({ ...prev, comisionId: null, anio: null, cuatrimestre: null }));
      return;
    }
    const loadComisiones = async () => {
      setLoadingComisiones(true);
      try {
        const data = await listarComisiones({
          plan_id: filters.planId,
        });
        setComisiones(data);
      } catch (error) {
        enqueueSnackbar("No se pudieron obtener las comisiones.", { variant: "error" });
      } finally {
        setLoadingComisiones(false);
      }
    };
    loadComisiones();
  }, [filters.planId]);

  const uniqueAnios = useMemo(() => {
    const set = new Set<number>();
    comisiones.forEach((c) => set.add(c.anio));
    return Array.from(set).sort((a, b) => b - a);
  }, [comisiones]);

  const uniqueCuatrimestres = useMemo(() => {
    const set = new Set<string>();
    comisiones.forEach((c) => {
      const clave = c.cuatrimestre ? c.cuatrimestre : "ANU";
      set.add(clave);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [comisiones]);

  const filteredComisiones = useMemo(() => {
    return comisiones.filter((c) => {
      if (filters.anio && c.anio !== filters.anio) return false;
      if (filters.cuatrimestre) {
        const clave = c.cuatrimestre ? c.cuatrimestre : "ANU";
        if (clave !== filters.cuatrimestre) return false;
      }
      return true;
    });
  }, [comisiones, filters.anio, filters.cuatrimestre]);

  const selectedComision = useMemo(
    () => filteredComisiones.find((c) => c.id === filters.comisionId) || null,
    [filteredComisiones, filters.comisionId]
  );

  const handleTabChange = (_event: React.SyntheticEvent, value: string) => {
    setActiveTab(value as "regularidad" | "finales");
  };

  useEffect(() => {
    if (!filters.comisionId) {
      setPlanilla(null);
      setRows([]);
      setSituaciones([]);
      return;
    }
    const loadPlanilla = async () => {
      setLoadingPlanilla(true);
      try {
        const data = await obtenerPlanillaRegularidad(filters.comisionId!);
        setPlanilla(data);
        setSituaciones(data.situaciones);
        setRows(
          data.alumnos.map((alumno) => ({
            inscripcionId: alumno.inscripcion_id,
            orden: alumno.orden,
            alumnoId: alumno.alumno_id,
            apellidoNombre: alumno.apellido_nombre,
            dni: alumno.dni,
            notaTp: alumno.nota_tp !== null ? String(alumno.nota_tp) : "",
            notaFinal: alumno.nota_final !== null ? String(alumno.nota_final) : "",
            asistencia: alumno.asistencia !== null ? String(alumno.asistencia) : "",
            excepcion: alumno.excepcion,
            situacion: alumno.situacion,
            observaciones: alumno.observaciones ?? "",
          }))
        );
      } catch (error) {
        enqueueSnackbar("No se pudo cargar la planilla de regularidad.", { variant: "error" });
      } finally {
        setLoadingPlanilla(false);
      }
    };
    loadPlanilla();
  }, [filters.comisionId]);

  const handleRowChange = (inscripcionId: number, patch: Partial<RowState>) => {
    setRows((prev) =>
      prev.map((row) => (row.inscripcionId === inscripcionId ? { ...row, ...patch } : row))
    );
  };

  const handleGuardar = async () => {
    if (!selectedComision) {
      enqueueSnackbar("Selecciona una Comision antes de guardar.", { variant: "warning" });
      return;
    }
    if (rows.length === 0) {
      enqueueSnackbar("No hay alumnos para guardar.", { variant: "warning" });
      return;
    }
    const payload: GuardarRegularidadPayload = {
      comision_id: selectedComision.id,
      fecha_cierre: fechaCierre,
      alumnos: [],
      observaciones_generales: observacionesGenerales || undefined,
    };

    for (const row of rows) {
      if (!row.situacion) {
        enqueueSnackbar(
          `Falta seleccionar la situacion academica para ${row.apellidoNombre}.`,
          { variant: "warning" }
        );
        return;
      }

      const notaTp =
        row.notaTp.trim() === "" ? null : Number.parseFloat(row.notaTp.replace(",", "."));
      const notaFinal =
        row.notaFinal.trim() === "" ? null : Number.parseInt(row.notaFinal, 10);
      const asistencia =
        row.asistencia.trim() === "" ? null : Number.parseInt(row.asistencia, 10);

      if (Number.isNaN(notaTp as number)) {
        enqueueSnackbar(
          `La nota de TP de ${row.apellidoNombre} no es valida.`,
          { variant: "warning" }
        );
        return;
      }
      if (Number.isNaN(notaFinal as number)) {
        enqueueSnackbar(
          `La nota final de ${row.apellidoNombre} no es valida.`,
          { variant: "warning" }
        );
        return;
      }
      if (Number.isNaN(asistencia as number)) {
        enqueueSnackbar(
          `El porcentaje de asistencia de ${row.apellidoNombre} no es valido.`,
          { variant: "warning" }
        );
        return;
      }

      payload.alumnos.push({
        inscripcion_id: row.inscripcionId,
        nota_tp: notaTp ?? undefined,
        nota_final: notaFinal ?? undefined,
        asistencia: asistencia ?? undefined,
        excepcion: row.excepcion,
        situacion: row.situacion,
        observaciones: row.observaciones || undefined,
      });
    }

    setSaving(true);
    try {
      await guardarPlanillaRegularidad(payload);
      enqueueSnackbar("Notas de regularidad guardadas correctamente.", { variant: "success" });
    } catch (error: any) {
      const message = error?.response?.data?.message || "No se pudieron guardar las notas.";
      enqueueSnackbar(message, { variant: "error" });
    } finally {
      setSaving(false);
    }
  };

  const renderSituacionLegend = () => {
    if (!situaciones.length) return null;
    return (
      <Card variant="outlined">
        <CardContent>
          <Typography variant="subtitle1" fontWeight={700} gutterBottom>
            Referencias de situacion academica
          </Typography>
          <Stack gap={1}>
            {situaciones.map((sit) => (
              <Box key={sit.alias}>
                <Typography variant="subtitle2">{sit.alias}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {sit.descripcion}
                </Typography>
              </Box>
            ))}
          </Stack>
        </CardContent>
      </Card>
    );
  };

  return (
    <Stack gap={3}>
      <Box>
        <Typography variant="h5" fontWeight={800}>
          Carga de Notas - Regularidad y Promocion
        </Typography>
        <Typography color="text.secondary">
          Completa la planilla de regularidad al cierre del cuatrimestre o ciclo lectivo.
        </Typography>
      </Box>

      <Box>
        <Tabs
          value={activeTab}
          onChange={handleTabChange}
          sx={{ borderBottom: 1, borderColor: "divider" }}
        >
          <Tab value="regularidad" label="Regularidad y Promocion" />
          <Tab value="finales" label="Examenes finales" />
        </Tabs>
      </Box>
      {activeTab === "regularidad" && (
        <>
          <Paper sx={{ p: 3 }}>
            <Stack gap={3}>
              <Typography variant="subtitle1" fontWeight={700}>
                Filtros
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} md={6} lg={4}>
                  <Autocomplete
                    options={profesorados}
                    loading={loadingProfesorados}
                    getOptionLabel={(option) => option.nombre}
                    value={profesorados.find((p) => p.id === filters.profesoradoId) ?? null}
                    onChange={(_, value) =>
                      setFilters((prev) => ({
                        ...prev,
                        profesoradoId: value?.id ?? null,
                        planId: null,
                        comisionId: null,
                        anio: null,
                        cuatrimestre: null,
                      }))
                    }
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label="Profesorado"
                        placeholder="Selecciona profesorado"
                        InputProps={{
                          ...params.InputProps,
                          endAdornment: (
                            <>
                              {loadingProfesorados ? <CircularProgress size={16} /> : null}
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
                    options={planes}
                    loading={loadingPlanes}
                    getOptionLabel={(option) => option.resolucion}
                    value={planes.find((p) => p.id === filters.planId) ?? null}
                    onChange={(_, value) =>
                      setFilters((prev) => ({
                        ...prev,
                        planId: value?.id ?? null,
                        comisionId: null,
                        anio: null,
                        cuatrimestre: null,
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
                              {loadingPlanes ? <CircularProgress size={16} /> : null}
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
                    <InputLabel id="anio-select">Ano lectivo</InputLabel>
                    <Select
                      labelId="anio-select"
                      label="Ano lectivo"
                      value={filters.anio ?? ""}
                      onChange={(event) =>
                        setFilters((prev) => ({
                          ...prev,
                          anio: event.target.value ? Number(event.target.value) : null,
                          comisionId: null,
                        }))
                      }
                    >
                      <MenuItem value="">
                        <em>TODOS</em>
                      </MenuItem>
                      {uniqueAnios.map((anio) => (
                        <MenuItem key={anio} value={anio}>
                          {anio}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} md={6} lg={4}>
                  <FormControl fullWidth>
                    <InputLabel id="cuatrimestre-select">Cuatrimestre</InputLabel>
                    <Select
                      labelId="cuatrimestre-select"
                      label="Cuatrimestre"
                      value={filters.cuatrimestre ?? ""}
                      onChange={(event) =>
                        setFilters((prev) => ({
                          ...prev,
                          cuatrimestre: event.target.value || null,
                          comisionId: null,
                        }))
                      }
                    >
                      <MenuItem value="">
                        <em>TODOS</em>
                      </MenuItem>
                      {uniqueCuatrimestres.map((clave) => (
                        <MenuItem key={clave} value={clave}>
                          {cuatrimestreLabel[clave] ?? clave}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} md={6} lg={8}>
                  <Autocomplete
                    options={filteredComisiones}
                    loading={loadingComisiones}
                    getOptionLabel={(option) =>
                      `${option.anio} - ${option.materia_nombre} (${option.codigo})`
                    }
                    value={selectedComision}
                    onChange={(_, value) =>
                      setFilters((prev) => ({
                        ...prev,
                        comisionId: value?.id ?? null,
                      }))
                    }
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label="Comision"
                        placeholder="Selecciona comision"
                        InputProps={{
                          ...params.InputProps,
                          endAdornment: (
                            <>
                              {loadingComisiones ? <CircularProgress size={16} /> : null}
                              {params.InputProps.endAdornment}
                            </>
                          ),
                        }}
                      />
                    )}
                  />
                </Grid>
              </Grid>
            </Stack>
          </Paper>

          {filters.planId && !filteredComisiones.length ? (
            <Paper sx={{ p: 3 }}>
              <Typography color="text.secondary">
                No encontramos comisiones para los filtros aplicados.
              </Typography>
            </Paper>
          ) : null}

          {filteredComisiones.length > 0 && (
            <Paper sx={{ p: 3 }}>
              <Stack gap={2}>
                <Typography variant="subtitle1" fontWeight={700}>
                  Comisiones disponibles
                </Typography>
                <TableContainer component={Paper} variant="outlined">
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Año</TableCell>
                        <TableCell>Materia</TableCell>
                        <TableCell>Turno</TableCell>
                        <TableCell>Comisión</TableCell>
                        <TableCell>Cuatrimestre</TableCell>
                        <TableCell align="center">Acciones</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {filteredComisiones.map((com) => {
                        const cuatri = com.cuatrimestre ?? "ANU";
                        return (
                          <TableRow
                            key={com.id}
                            hover
                            selected={selectedComision?.id === com.id}
                          >
                            <TableCell>{com.anio}</TableCell>
                            <TableCell>{com.materia_nombre}</TableCell>
                            <TableCell>{com.turno}</TableCell>
                            <TableCell>{com.codigo}</TableCell>
                            <TableCell>
                              {cuatrimestreLabel[cuatri] ?? cuatri}
                            </TableCell>
                            <TableCell align="center">
                              <Button
                                size="small"
                                variant={
                                  selectedComision?.id === com.id ? "contained" : "outlined"
                                }
                                onClick={() =>
                                  setFilters((prev) => ({ ...prev, comisionId: com.id }))
                                }
                              >
                                {selectedComision?.id === com.id ? "Seleccionado" : "Seleccionar"}
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Stack>
            </Paper>
          )}

          <Paper sx={{ p: 3 }}>
            <Stack gap={2}>
              <Box display="flex" justifyContent="space-between" alignItems="center">
                <Box>
                  <Typography variant="h6" fontWeight={700}>
                    Planilla Regularidad / Promocion
                  </Typography>
                  {planilla && (
                    <Typography color="text.secondary">
                      {planilla.materia_nombre} - {planilla.turno} - Comision {planilla.comision_codigo}
                    </Typography>
                  )}
                </Box>
                <Stack direction="row" spacing={1} alignItems="center">
                  <TextField
                    label="Fecha de cierre"
                    type="date"
                    size="small"
                    value={fechaCierre}
                    onChange={(event) => setFechaCierre(event.target.value)}
                    InputLabelProps={{ shrink: true }}
                  />
                  <Button
                    variant="contained"
                    onClick={handleGuardar}
                    disabled={saving || !selectedComision || !rows.length}
                  >
                    {saving ? "Guardando..." : "Guardar planilla"}
                  </Button>
                </Stack>
              </Box>

              {loadingPlanilla ? (
                <Box py={6} display="flex" alignItems="center" justifyContent="center">
                  <CircularProgress />
                </Box>
              ) : rows.length ? (
                <TableContainer component={Paper} variant="outlined">
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>N°</TableCell>
                        <TableCell>Alumno</TableCell>
                        <TableCell>DNI</TableCell>
                        <TableCell align="right">Nota TP</TableCell>
                        <TableCell align="right">Nota final</TableCell>
                        <TableCell align="right">Asistencia %</TableCell>
                        <TableCell align="center">Excepcion</TableCell>
                        <TableCell>Situacion academica</TableCell>
                        <TableCell>Observaciones</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {rows.map((row) => (
                        <TableRow key={row.inscripcionId} hover>
                          <TableCell>{row.orden}</TableCell>
                          <TableCell sx={{ minWidth: 240 }}>{row.apellidoNombre}</TableCell>
                          <TableCell sx={{ minWidth: 120 }}>{row.dni}</TableCell>
                          <TableCell align="right" sx={{ minWidth: 120 }}>
                            <TextField
                              size="small"
                              type="number"
                              value={row.notaTp}
                              onChange={(event) =>
                                handleRowChange(row.inscripcionId, {
                                  notaTp: event.target.value,
                                })
                              }
                              inputProps={{ min: 0, max: 10, step: 0.5 }}
                            />
                          </TableCell>
                          <TableCell align="right" sx={{ minWidth: 120 }}>
                            <TextField
                              size="small"
                              type="number"
                              value={row.notaFinal}
                              onChange={(event) =>
                                handleRowChange(row.inscripcionId, {
                                  notaFinal: event.target.value,
                                })
                              }
                              inputProps={{ min: 0, max: 10, step: 1 }}
                            />
                          </TableCell>
                          <TableCell align="right" sx={{ minWidth: 120 }}>
                            <TextField
                              size="small"
                              type="number"
                              value={row.asistencia}
                              onChange={(event) =>
                                handleRowChange(row.inscripcionId, {
                                  asistencia: event.target.value,
                                })
                              }
                              inputProps={{ min: 0, max: 100, step: 1 }}
                              InputProps={{
                                endAdornment: <InputAdornment position="end">%</InputAdornment>,
                              }}
                            />
                          </TableCell>
                          <TableCell align="center">
                            <Checkbox
                              checked={row.excepcion}
                              onChange={(event) =>
                                handleRowChange(row.inscripcionId, {
                                  excepcion: event.target.checked,
                                })
                              }
                            />
                          </TableCell>
                          <TableCell sx={{ minWidth: 200 }}>
                            <FormControl fullWidth size="small">
                              <Select
                                value={row.situacion ?? ""}
                                displayEmpty
                                onChange={(event) =>
                                  handleRowChange(row.inscripcionId, {
                                    situacion: event.target.value || null,
                                  })
                                }
                              >
                                <MenuItem value="">
                                  <em>Seleccionar</em>
                                </MenuItem>
                                {situaciones.map((option) => (
                                  <MenuItem key={option.alias} value={option.alias}>
                                    {option.alias}
                                  </MenuItem>
                                ))}
                              </Select>
                            </FormControl>
                          </TableCell>
                          <TableCell sx={{ minWidth: 220 }}>
                            <TextField
                              size="small"
                              fullWidth
                              value={row.observaciones}
                              onChange={(event) =>
                                handleRowChange(row.inscripcionId, {
                                  observaciones: event.target.value,
                                })
                              }
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              ) : (
                <Box py={6} textAlign="center">
                  <Typography color="text.secondary">
                    Selecciona una Comision para mostrar la planilla de alumnos.
                  </Typography>
                </Box>
              )}

              <Stack gap={1}>
                <TextField
                  label="Observaciones generales"
                  value={observacionesGenerales}
                  onChange={(event) => setObservacionesGenerales(event.target.value)}
                  multiline
                  minRows={3}
                />
                {renderSituacionLegend()}
              </Stack>
            </Stack>
          </Paper>
        </>
      )}

      {activeTab === "finales" && (
        <Paper sx={{ p: 3 }}>
          <Stack gap={2}>
            <Typography variant="subtitle1" fontWeight={700}>
              Examenes finales
            </Typography>
            <Typography color="text.secondary">
              Proximamente se podran cargar las actas y notas de finales desde este modulo.
            </Typography>
          </Stack>
        </Paper>
      )}
    </Stack>
  );
};

export default CargaNotasPage;












