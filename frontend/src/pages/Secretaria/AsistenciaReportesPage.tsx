import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  Grid,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import SchoolIcon from "@mui/icons-material/School";
import GroupsIcon from "@mui/icons-material/Groups";
import ManageAccountsIcon from "@mui/icons-material/ManageAccounts";
import VisibilityIcon from "@mui/icons-material/Visibility";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import dayjs from "dayjs";
import "dayjs/locale/es";
import { useQuery } from "@tanstack/react-query";
import { useSnackbar } from "notistack";

import { useAuth } from "@/context/AuthContext";
import { hasAnyRole } from "@/utils/roles";
import {
  AlumnoClaseListado,
  CalendarioEvento,
  DocenteClasesResponse,
  DocenteClase,
  fetchAlumnoClases,
  fetchDocenteClases,
  listCalendarioEventos,
} from "@/api/asistencia";
import { listarComisiones, ComisionDTO } from "@/api/comisiones";

type Option = { id: number; label: string };
type DateOption = { id: string; label: string };

const ordenarPorLabel = (a: Option, b: Option) => a.label.localeCompare(b.label);

dayjs.locale("es");

const AsistenciaReportesPage = () => {
  const { user } = useAuth();
  const { enqueueSnackbar } = useSnackbar();

  const puedeGestionarDocentes = hasAnyRole(user, ["admin", "secretaria", "bedel"]);
  const puedeVerDocentes =
    puedeGestionarDocentes || hasAnyRole(user, ["coordinador", "bedel", "jefes", "jefa_aaee", "docente"]);

  const puedeGestionarEstudiantes = hasAnyRole(user, ["admin", "secretaria", "bedel", "profesor"]);
  const puedeVerEstudiantes =
    puedeGestionarEstudiantes || hasAnyRole(user, ["docente", "coordinador", "jefes", "tutor", "jefa_aaee"]);

  const esDocenteSolo =
    hasAnyRole(user, ["docente"]) && !hasAnyRole(user, ["admin", "secretaria", "bedel", "coordinador", "tutor", "jefes", "jefa_aaee"]);

  useEffect(() => {
    document.title = "Reportes de asistencia";
  }, []);

  const today = useMemo(() => dayjs().format("YYYY-MM-DD"), []);

  /* ---------------- Estudiantes ---------------- */
  const [alumnoProfesorado, setAlumnoProfesorado] = useState<Option | null>(null);
  const [alumnoPlan, setAlumnoPlan] = useState<Option | null>(null);
  const [alumnoMateria, setAlumnoMateria] = useState<Option | null>(null);
  const [alumnoComision, setAlumnoComision] = useState<Option | null>(null);
  const [alumnoDesde, setAlumnoDesde] = useState(today);
  const [alumnoHasta, setAlumnoHasta] = useState(today);
  const [alumnoResultados, setAlumnoResultados] = useState<AlumnoClaseListado[]>([]);
  const [cargandoAlumnos, setCargandoAlumnos] = useState(false);

  const { data: comisiones, isLoading: comisionesLoading } = useQuery<ComisionDTO[]>({
    queryKey: ["asistencia", "comisiones"],
    queryFn: () => listarComisiones({}),
    enabled: puedeVerEstudiantes,
    staleTime: 5 * 60 * 1000,
  });

  const profesoradoOptions = useMemo<Option[]>(() => {
    if (!comisiones) return [];
    const map = new Map<number, string>();
    for (const item of comisiones) {
      map.set(item.profesorado_id, item.profesorado_nombre);
    }
    return Array.from(map.entries())
      .map(([id, label]) => ({ id, label }))
      .sort(ordenarPorLabel);
  }, [comisiones]);

  const planOptions = useMemo<Option[]>(() => {
    if (!comisiones) return [];
    const filtered = alumnoProfesorado ? comisiones.filter((c) => c.profesorado_id === alumnoProfesorado.id) : comisiones;
    const map = new Map<number, string>();
    for (const item of filtered) {
      map.set(item.plan_id, item.plan_resolucion);
    }
    return Array.from(map.entries())
      .map(([id, label]) => ({ id, label }))
      .sort(ordenarPorLabel);
  }, [comisiones, alumnoProfesorado]);

  const alumnoMateriaOptions = useMemo<Option[]>(() => {
    if (!comisiones) return [];
    let filtered = comisiones;
    if (alumnoProfesorado) filtered = filtered.filter((c) => c.profesorado_id === alumnoProfesorado.id);
    if (alumnoPlan) filtered = filtered.filter((c) => c.plan_id === alumnoPlan.id);
    const map = new Map<number, string>();
    for (const item of filtered) {
      map.set(item.materia_id, item.materia_nombre);
    }
    return Array.from(map.entries())
      .map(([id, label]) => ({ id, label }))
      .sort(ordenarPorLabel);
  }, [comisiones, alumnoProfesorado, alumnoPlan]);

  const alumnoComisionOptions = useMemo<Option[]>(() => {
    if (!comisiones) return [];
    let filtered = comisiones;
    if (alumnoProfesorado) filtered = filtered.filter((c) => c.profesorado_id === alumnoProfesorado.id);
    if (alumnoPlan) filtered = filtered.filter((c) => c.plan_id === alumnoPlan.id);
    if (alumnoMateria) filtered = filtered.filter((c) => c.materia_id === alumnoMateria.id);
    return filtered
      .map((c) => ({ id: c.id, label: `${c.materia_nombre} - ${c.codigo}` }))
      .sort(ordenarPorLabel);
  }, [comisiones, alumnoProfesorado, alumnoPlan, alumnoMateria]);

  useEffect(() => {
    setAlumnoPlan(null);
    setAlumnoMateria(null);
    setAlumnoComision(null);
  }, [alumnoProfesorado]);

  useEffect(() => {
    setAlumnoMateria(null);
    setAlumnoComision(null);
  }, [alumnoPlan]);

  useEffect(() => {
    setAlumnoComision(null);
  }, [alumnoMateria]);

  const handleBuscarAlumnos = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!puedeVerEstudiantes) {
      enqueueSnackbar("No tenés permisos para consultar asistencia de estudiantes.", { variant: "warning" });
      return;
    }
    if (!alumnoMateria && !alumnoComision) {
      enqueueSnackbar("Seleccioná al menos una materia o comisión.", { variant: "info" });
      return;
    }
    setCargandoAlumnos(true);
    try {
      const params: { comision_id?: number; materia_id?: number; desde: string; hasta: string } = {
        desde: alumnoDesde,
        hasta: alumnoHasta,
      };
      if (alumnoComision) {
        params.comision_id = alumnoComision.id;
      } else if (alumnoMateria) {
        params.materia_id = alumnoMateria.id;
      }
      const data = await fetchAlumnoClases(params);
      setAlumnoResultados(data.clases);
      if (data.clases.length === 0) {
        enqueueSnackbar("No encontramos clases para ese rango.", { variant: "info" });
      }
    } catch (error) {
      enqueueSnackbar("No se pudo obtener la asistencia de estudiantes.", { variant: "error" });
    } finally {
      setCargandoAlumnos(false);
    }
  };

  /* ---------------- Docentes ---------------- */
  const [docenteDni, setDocenteDni] = useState("");
  const [docenteDesde, setDocenteDesde] = useState(today);
  const [docenteHasta, setDocenteHasta] = useState(today);
  const [docenteDiaSemana, setDocenteDiaSemana] = useState("");
  const [docenteClases, setDocenteClases] = useState<DocenteClase[]>([]);
  const [docenteInfo, setDocenteInfo] = useState<DocenteClasesResponse["docente"] | null>(null);
  const [cargandoDocente, setCargandoDocente] = useState(false);
  const [docenteProfesorado, setDocenteProfesorado] = useState<Option | null>(null);
  const [docentePlan, setDocentePlan] = useState<Option | null>(null);
  const [docenteMateria, setDocenteMateria] = useState<Option | null>(null);
  const [docenteComision, setDocenteComision] = useState<Option | null>(null);
  const [docenteFecha, setDocenteFecha] = useState<DateOption | null>(null);
  const [docAutoFetched, setDocAutoFetched] = useState(false);

  const docenteProfesOptions = useMemo<Option[]>(() => {
    const map = new Map<number, string>();
    for (const clase of docenteClases) {
      if (clase.profesorado_id && clase.profesorado_nombre) {
        map.set(clase.profesorado_id, clase.profesorado_nombre);
      }
    }
    return Array.from(map.entries())
      .map(([id, label]) => ({ id, label }))
      .sort(ordenarPorLabel);
  }, [docenteClases]);

  const docentePlanOptions = useMemo<Option[]>(() => {
    let filtered = docenteClases;
    if (docenteProfesorado) filtered = filtered.filter((c) => c.profesorado_id === docenteProfesorado.id);
    const map = new Map<number, string>();
    for (const clase of filtered) {
      if (clase.plan_id && clase.plan_resolucion) {
        map.set(clase.plan_id, clase.plan_resolucion);
      }
    }
    return Array.from(map.entries())
      .map(([id, label]) => ({ id, label }))
      .sort(ordenarPorLabel);
  }, [docenteClases, docenteProfesorado]);

  const docenteMateriaOptions = useMemo<Option[]>(() => {
    let filtered = docenteClases;
    if (docenteProfesorado) filtered = filtered.filter((c) => c.profesorado_id === docenteProfesorado.id);
    if (docentePlan) filtered = filtered.filter((c) => c.plan_id === docentePlan.id);
    const map = new Map<number, string>();
    for (const clase of filtered) {
      map.set(clase.materia_id, clase.materia);
    }
    return Array.from(map.entries())
      .map(([id, label]) => ({ id, label }))
      .sort(ordenarPorLabel);
  }, [docenteClases, docenteProfesorado, docentePlan]);

  const docenteComisionOptions = useMemo<Option[]>(() => {
    let filtered = docenteClases;
    if (docenteProfesorado) filtered = filtered.filter((c) => c.profesorado_id === docenteProfesorado.id);
    if (docentePlan) filtered = filtered.filter((c) => c.plan_id === docentePlan.id);
    if (docenteMateria) filtered = filtered.filter((c) => c.materia_id === docenteMateria.id);
    return filtered
      .map((clase) => ({ id: clase.comision_id, label: `${clase.comision} - ${dayjs(clase.fecha).format("DD/MM")}` }))
      .sort(ordenarPorLabel);
  }, [docenteClases, docenteProfesorado, docentePlan, docenteMateria]);

  const docenteFechaOptions = useMemo<DateOption[]>(() => {
    let filtered = docenteClases;
    if (docenteProfesorado) filtered = filtered.filter((c) => c.profesorado_id === docenteProfesorado.id);
    if (docentePlan) filtered = filtered.filter((c) => c.plan_id === docentePlan.id);
    if (docenteMateria) filtered = filtered.filter((c) => c.materia_id === docenteMateria.id);
    if (docenteComision) filtered = filtered.filter((c) => c.comision_id === docenteComision.id);
    const seen = new Set<string>();
    const options: DateOption[] = [];
    for (const clase of filtered) {
      if (!seen.has(clase.fecha)) {
        seen.add(clase.fecha);
        options.push({ id: clase.fecha, label: dayjs(clase.fecha).format("dddd DD/MM/YYYY") });
      }
    }
    return options.sort((a, b) => a.id.localeCompare(b.id));
  }, [docenteClases, docenteProfesorado, docentePlan, docenteMateria, docenteComision]);

  useEffect(() => {
    setDocentePlan(null);
    setDocenteMateria(null);
    setDocenteComision(null);
    setDocenteFecha(null);
  }, [docenteProfesorado]);

  useEffect(() => {
    setDocenteMateria(null);
    setDocenteComision(null);
    setDocenteFecha(null);
  }, [docentePlan]);

  useEffect(() => {
    setDocenteComision(null);
    setDocenteFecha(null);
  }, [docenteMateria]);

  useEffect(() => {
    setDocenteFecha(null);
  }, [docenteComision]);

  useEffect(() => {
    if (docenteProfesorado && !docenteProfesOptions.some((opt) => opt.id === docenteProfesorado.id)) {
      setDocenteProfesorado(null);
    } else if (!docenteProfesorado && docenteProfesOptions.length === 1) {
      setDocenteProfesorado(docenteProfesOptions[0]);
    }
  }, [docenteProfesorado, docenteProfesOptions]);

  useEffect(() => {
    if (docentePlan && !docentePlanOptions.some((opt) => opt.id === docentePlan.id)) {
      setDocentePlan(null);
    } else if (!docentePlan && docentePlanOptions.length === 1) {
      setDocentePlan(docentePlanOptions[0]);
    }
  }, [docentePlan, docentePlanOptions]);

  useEffect(() => {
    if (docenteMateria && !docenteMateriaOptions.some((opt) => opt.id === docenteMateria.id)) {
      setDocenteMateria(null);
    } else if (!docenteMateria && docenteMateriaOptions.length === 1) {
      setDocenteMateria(docenteMateriaOptions[0]);
    }
  }, [docenteMateria, docenteMateriaOptions]);

  useEffect(() => {
    if (docenteComision && !docenteComisionOptions.some((opt) => opt.id === docenteComision.id)) {
      setDocenteComision(null);
    } else if (!docenteComision && docenteComisionOptions.length === 1) {
      setDocenteComision(docenteComisionOptions[0]);
    }
  }, [docenteComision, docenteComisionOptions]);

  useEffect(() => {
    if (docenteFecha && !docenteFechaOptions.some((opt) => opt.id === docenteFecha.id)) {
      setDocenteFecha(null);
    } else if (!docenteFecha && docenteFechaOptions.length === 1) {
      setDocenteFecha(docenteFechaOptions[0]);
    }
  }, [docenteFecha, docenteFechaOptions]);

  const ejecutarBusquedaDocente = useCallback(
    async (dni: string) => {
      if (!puedeVerDocentes) {
        enqueueSnackbar("No tenés permisos para consultar asistencia de docentes.", { variant: "warning" });
        return;
      }
      if (!dni) {
        enqueueSnackbar("Ingresá un DNI de docente.", { variant: "info" });
        return;
      }
      setCargandoDocente(true);
      try {
        const params: { fecha?: string; desde: string; hasta: string; dia_semana?: number } = {
          desde: docenteDesde,
          hasta: docenteHasta,
        };
        if (docenteDiaSemana !== "") {
          const dia = Number(docenteDiaSemana);
          if (Number.isNaN(dia) || dia < 0 || dia > 6) {
            enqueueSnackbar("El día debe estar entre 0 y 6.", { variant: "warning" });
            setCargandoDocente(false);
            return;
          }
          params.dia_semana = dia;
        }
        const data = await fetchDocenteClases(dni, params);
        setDocenteClases(data.clases);
        setDocenteInfo(data.docente);
        if (data.clases.length === 0) {
          enqueueSnackbar("No hay clases programadas en el rango seleccionado.", { variant: "info" });
        }
      } catch (error) {
        enqueueSnackbar("No se pudo obtener la asistencia de docentes.", { variant: "error" });
      } finally {
        setCargandoDocente(false);
      }
    },
    [docenteDesde, docenteHasta, docenteDiaSemana, enqueueSnackbar, puedeVerDocentes],
  );

  const handleBuscarDocente = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await ejecutarBusquedaDocente(docenteDni.trim());
  };

  useEffect(() => {
    if (esDocenteSolo && user?.dni) {
      setDocenteDni(user.dni);
    }
  }, [esDocenteSolo, user?.dni]);

  useEffect(() => {
    if (esDocenteSolo && user?.dni && !docAutoFetched) {
      setDocAutoFetched(true);
      ejecutarBusquedaDocente(user.dni);
    }
  }, [esDocenteSolo, user?.dni, docAutoFetched, ejecutarBusquedaDocente]);

  const docenteClasesFiltradas = useMemo(() => {
    let filtered = docenteClases;
    if (docenteProfesorado) filtered = filtered.filter((c) => c.profesorado_id === docenteProfesorado.id);
    if (docentePlan) filtered = filtered.filter((c) => c.plan_id === docentePlan.id);
    if (docenteMateria) filtered = filtered.filter((c) => c.materia_id === docenteMateria.id);
    if (docenteComision) filtered = filtered.filter((c) => c.comision_id === docenteComision.id);
    if (docenteFecha) filtered = filtered.filter((c) => c.fecha === docenteFecha.id);
    return filtered;
  }, [docenteClases, docenteProfesorado, docentePlan, docenteMateria, docenteComision, docenteFecha]);

  /* ---------------- Calendario ---------------- */
  const { data: eventos, isLoading: eventosLoading } = useQuery<CalendarioEvento[]>({
    queryKey: ["asistencia", "calendario", "activos"],
    queryFn: () => listCalendarioEventos({ solo_activos: true }),
  });

  return (
    <Box sx={{ px: { xs: 1, md: 2 }, py: 1 }}>
      <Stack spacing={3}>
        <Stack spacing={0.5}>
          <Typography variant="h4" fontWeight={700}>
            Reportes de asistencia
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Filtros rapidos para acompanar el seguimiento diario de estudiantes y docentes.
          </Typography>
        </Stack>

        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Paper elevation={3} sx={{ p: 3, height: "100%" }}>
              <Stack spacing={2} height="100%">
                <Stack direction="row" spacing={1.5} alignItems="center">
                  <Chip icon={<SchoolIcon />} color="primary" label="Estudiantes" sx={{ fontWeight: 600 }} />
                  <Chip
                    icon={<ManageAccountsIcon />}
                    label={puedeGestionarEstudiantes ? "Gestión habilitada" : "Gestión restringida"}
                    color={puedeGestionarEstudiantes ? "success" : "default"}
                    variant={puedeGestionarEstudiantes ? "filled" : "outlined"}
                  />
                  <Chip
                    icon={<VisibilityIcon />}
                    label={puedeVerEstudiantes ? "Vista habilitada" : "Vista restringida"}
                    color={puedeVerEstudiantes ? "info" : "default"}
                    variant={puedeVerEstudiantes ? "filled" : "outlined"}
                  />
                </Stack>

                <Box component="form" onSubmit={handleBuscarAlumnos}>
                  <Stack spacing={1.5}>
                    <Typography variant="subtitle1" fontWeight={600}>
                      Filtrar asistencia de estudiantes
                    </Typography>
                    <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
                      <Autocomplete
                        options={profesoradoOptions}
                        value={alumnoProfesorado}
                        onChange={(_, value) => setAlumnoProfesorado(value)}
                        loading={comisionesLoading}
                        disabled={cargandoAlumnos || !puedeVerEstudiantes}
                        renderInput={(params) => (
                          <TextField
                            {...params}
                            label="Profesorado"
                            placeholder="Seleccioná un profesorado"
                            InputProps={{
                              ...params.InputProps,
                              endAdornment: (
                                <>
                                  {comisionesLoading ? <CircularProgress color="inherit" size={16} /> : null}
                                  {params.InputProps.endAdornment}
                                </>
                              ),
                            }}
                          />
                        )}
                      />
                      <Autocomplete
                        options={planOptions}
                        value={alumnoPlan}
                        onChange={(_, value) => setAlumnoPlan(value)}
                        disabled={cargandoAlumnos || !puedeVerEstudiantes || planOptions.length === 0}
                        renderInput={(params) => <TextField {...params} label="Plan" placeholder="Seleccioná un plan" />}
                      />
                    </Stack>
                    <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
                      <Autocomplete
                        options={alumnoMateriaOptions}
                        value={alumnoMateria}
                        onChange={(_, value) => setAlumnoMateria(value)}
                        disabled={cargandoAlumnos || !puedeVerEstudiantes || alumnoMateriaOptions.length === 0}
                        renderInput={(params) => <TextField {...params} label="Materia" placeholder="Seleccioná una materia" />}
                      />
                      <Autocomplete
                        options={alumnoComisionOptions}
                        value={alumnoComision}
                        onChange={(_, value) => setAlumnoComision(value)}
                        disabled={cargandoAlumnos || !puedeVerEstudiantes || alumnoComisionOptions.length === 0}
                        renderInput={(params) => <TextField {...params} label="Cátedra (comisión)" placeholder="Seleccioná una comisión" />}
                      />
                    </Stack>
                    <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
                      <TextField
                        label="Desde"
                        type="date"
                        value={alumnoDesde}
                        onChange={(event) => setAlumnoDesde(event.target.value)}
                        disabled={cargandoAlumnos || !puedeVerEstudiantes}
                        fullWidth
                        InputLabelProps={{ shrink: true }}
                      />
                      <TextField
                        label="Hasta"
                        type="date"
                        value={alumnoHasta}
                        onChange={(event) => setAlumnoHasta(event.target.value)}
                        disabled={cargandoAlumnos || !puedeVerEstudiantes}
                        fullWidth
                        InputLabelProps={{ shrink: true }}
                      />
                    </Stack>
                    <Button type="submit" variant="contained" disabled={cargandoAlumnos || !puedeVerEstudiantes}>
                      {cargandoAlumnos ? <CircularProgress size={20} /> : "Consultar"}
                    </Button>
                  </Stack>
                </Box>

                <Divider />

                {alumnoResultados.length === 0 ? (
                  <Alert severity="info">Configurá los filtros y presioná “Consultar” para ver clases.</Alert>
                ) : (
                  <Stack spacing={1.5} sx={{ maxHeight: 260, overflowY: "auto" }}>
                    {alumnoResultados.map((item) => (
                      <Paper key={item.clase_id} variant="outlined" sx={{ p: 1.5 }}>
                        <Typography variant="subtitle2" fontWeight={600}>
                          {item.materia} - {item.comision}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {dayjs(item.fecha).format("DD/MM/YYYY")} - Turno {item.turno ?? "-"} - {item.horario ?? "Sin horario"}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Estado de la clase: {item.estado_clase}
                        </Typography>
                        <Typography variant="body2" sx={{ mt: 0.5 }}>
                          Presentes: {item.presentes} - Ausentes: {item.ausentes} - Justificados: {item.ausentes_justificados} - Total: {item.total_alumnos}
                        </Typography>
                      </Paper>
                    ))}
                  </Stack>
                )}

                {!puedeVerEstudiantes && (
                  <Stack direction="row" spacing={1} alignItems="center" color="warning.main" mt={1}>
                    <WarningAmberIcon fontSize="small" />
                    <Typography variant="caption">
                      Tu rol no tiene acceso a este módulo. Contactá a Secretaría para habilitarlo.
                    </Typography>
                  </Stack>
                )}
              </Stack>
            </Paper>
          </Grid>

          <Grid item xs={12} md={6}>
            <Paper elevation={3} sx={{ p: 3, height: "100%" }}>
              <Stack spacing={2} height="100%">
                <Stack direction="row" spacing={1.5} alignItems="center">
                  <Chip icon={<GroupsIcon />} color="secondary" label="Docentes" sx={{ fontWeight: 600 }} />
                  <Chip
                    icon={<ManageAccountsIcon />}
                    label={puedeGestionarDocentes ? "Gestión habilitada" : "Gestión restringida"}
                    color={puedeGestionarDocentes ? "success" : "default"}
                    variant={puedeGestionarDocentes ? "filled" : "outlined"}
                  />
                  <Chip
                    icon={<VisibilityIcon />}
                    label={puedeVerDocentes ? "Vista habilitada" : "Vista restringida"}
                    color={puedeVerDocentes ? "info" : "default"}
                    variant={puedeVerDocentes ? "filled" : "outlined"}
                  />
                </Stack>

                <Box component="form" onSubmit={handleBuscarDocente}>
                  <Stack spacing={1.5}>
                    <Typography variant="subtitle1" fontWeight={600}>
                      Seleccioná al docente
                    </Typography>
                    <TextField
                      label="DNI del docente"
                      value={docenteDni}
                      onChange={(event) => setDocenteDni(event.target.value)}
                      placeholder="Ej: 28126358"
                      disabled={cargandoDocente || !puedeVerDocentes || esDocenteSolo}
                      fullWidth
                    />
                    <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
                      <TextField
                        label="Desde"
                        type="date"
                        value={docenteDesde}
                        onChange={(event) => setDocenteDesde(event.target.value)}
                        disabled={cargandoDocente || !puedeVerDocentes}
                        fullWidth
                        InputLabelProps={{ shrink: true }}
                      />
                      <TextField
                        label="Hasta"
                        type="date"
                        value={docenteHasta}
                        onChange={(event) => setDocenteHasta(event.target.value)}
                        disabled={cargandoDocente || !puedeVerDocentes}
                        fullWidth
                        InputLabelProps={{ shrink: true }}
                      />
                    </Stack>
                    <TextField
                      label="Filtrar por día de semana (0=lunes ... 6=domingo)"
                      value={docenteDiaSemana}
                      onChange={(event) => setDocenteDiaSemana(event.target.value)}
                      placeholder="Opcional"
                      disabled={cargandoDocente || !puedeVerDocentes}
                    />
                    <Button type="submit" variant="contained" color="secondary" disabled={cargandoDocente || !puedeVerDocentes}>
                      {cargandoDocente ? <CircularProgress size={20} /> : "Buscar clases"}
                    </Button>
                  </Stack>
                </Box>

                <Divider />

                {!!docenteInfo && (
                  <Typography variant="subtitle2" color="text.secondary">
                    Docente seleccionado: {docenteInfo.nombre} - DNI {docenteInfo.dni}
                  </Typography>
                )}

                {docenteClases.length > 0 && (
                  <Stack spacing={1.5}>
                    <Typography variant="subtitle1" fontWeight={600}>
                      Refinar resultados
                    </Typography>
                    <Autocomplete
                      options={docenteProfesOptions}
                      value={docenteProfesorado}
                      onChange={(_, value) => setDocenteProfesorado(value)}
                      disabled={docenteProfesOptions.length === 0}
                      renderInput={(params) => <TextField {...params} label="Profesorado" placeholder="Seleccioná un profesorado" />}
                    />
                    <Autocomplete
                      options={docentePlanOptions}
                      value={docentePlan}
                      onChange={(_, value) => setDocentePlan(value)}
                      disabled={docentePlanOptions.length === 0}
                      renderInput={(params) => <TextField {...params} label="Plan" placeholder="Seleccioná un plan" />}
                    />
                    <Autocomplete
                      options={docenteMateriaOptions}
                      value={docenteMateria}
                      onChange={(_, value) => setDocenteMateria(value)}
                      disabled={docenteMateriaOptions.length === 0}
                      renderInput={(params) => <TextField {...params} label="Materia" placeholder="Seleccioná una materia" />}
                    />
                    <Autocomplete
                      options={docenteComisionOptions}
                      value={docenteComision}
                      onChange={(_, value) => setDocenteComision(value)}
                      disabled={docenteComisionOptions.length === 0}
                      renderInput={(params) => <TextField {...params} label="Cátedra (comisión)" placeholder="Seleccioná una cátedra" />}
                    />
                    <Autocomplete
                      options={docenteFechaOptions}
                      value={docenteFecha}
                      onChange={(_, value) => setDocenteFecha(value)}
                      disabled={docenteFechaOptions.length === 0}
                      renderInput={(params) => <TextField {...params} label="Fecha" placeholder="Seleccioná una fecha" />}
                    />
                  </Stack>
                )}

                {docenteClasesFiltradas.length === 0 ? (
                  <Alert severity="info">Ingresá un DNI y rango de fechas para ver las clases asignadas.</Alert>
                ) : (
                  <Stack spacing={1.5} sx={{ maxHeight: 260, overflowY: "auto" }}>
                    {docenteClasesFiltradas.map((clase) => (
                      <Paper key={clase.id} variant="outlined" sx={{ p: 1.5 }}>
                        <Stack spacing={0.5}>
                          <Typography variant="subtitle2" fontWeight={600}>
                            {clase.materia} - {clase.comision}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {dayjs(clase.fecha).format("dddd DD/MM/YYYY")} - Turno {clase.turno || "-"} - {clase.horario ?? "Sin horario"}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            Profes.: {clase.profesorado_nombre ?? "-"} - Plan {clase.plan_resolucion ?? "-"}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            Puede marcar: {clase.puede_marcar ? "sí" : "no"} - Staff puede editar: {clase.editable_staff ? "sí" : "no"}
                          </Typography>
                        </Stack>
                      </Paper>
                    ))}
                  </Stack>
                )}

                {!puedeVerDocentes && (
                  <Stack direction="row" spacing={1} alignItems="center" color="warning.main" mt={1}>
                    <WarningAmberIcon fontSize="small" />
                    <Typography variant="caption">
                      Tu rol no tiene acceso a la asistencia docente. Coordiná con Secretaría para habilitarlo.
                    </Typography>
                  </Stack>
                )}
              </Stack>
            </Paper>
          </Grid>
        </Grid>

        <Paper elevation={1} sx={{ p: 3 }}>
          <Stack spacing={2}>
            <Stack direction="row" spacing={1.5} alignItems="center">
              <Chip icon={<CalendarMonthIcon />} label="Calendario institucional" color="default" />
              <Typography variant="body2" color="text.secondary">
                Suspensiones, feriados y licencias vigentes para asistencia.
              </Typography>
            </Stack>

            {eventosLoading ? (
              <CircularProgress size={28} />
            ) : !eventos || eventos.length === 0 ? (
              <Alert severity="info">No hay eventos cargados para los proximos dias.</Alert>
            ) : (
              <Stack spacing={1.2} sx={{ maxHeight: 220, overflowY: "auto" }}>
                {eventos.map((evento) => (
                  <Paper key={evento.id} variant="outlined" sx={{ p: 1.5 }}>
                    <Typography variant="subtitle2" fontWeight={600}>
                      {evento.nombre} - {evento.tipo}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {dayjs(evento.fecha_desde).format("DD/MM/YYYY")} - {dayjs(evento.fecha_hasta).format("DD/MM/YYYY")}
                      {evento.turno_nombre ? ` - Turno ${evento.turno_nombre}` : ""}
                    </Typography>
                    {evento.motivo && (
                      <Typography variant="caption" color="text.secondary">
                        {evento.motivo}
                      </Typography>
                    )}
                  </Paper>
                ))}
              </Stack>
            )}
          </Stack>
        </Paper>
      </Stack>
    </Box>
  );
};

export default AsistenciaReportesPage;
