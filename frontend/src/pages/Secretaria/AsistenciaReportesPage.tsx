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
import dayjs from "dayjs";
import "dayjs/locale/es";
import { useQuery } from "@tanstack/react-query";
import { useSnackbar } from "notistack";

import { useAuth } from "@/context/AuthContext";
import { hasAnyRole } from "@/utils/roles";
import {
  EstudianteClaseListado,
  DocenteClasesResponse,
  DocenteClase,
  fetchEstudianteClases,
  fetchDocenteClases,
} from "@/api/asistencia";
import { listarComisiones, listarMaterias, ComisionDTO, MateriaDTO } from "@/api/comisiones";
import { fetchCarreras, listarPlanes, Carrera, PlanDetalle } from "@/api/carreras";
import CalendarioEventosPanel from "@/components/asistencia/CalendarioEventosPanel";
import { PageHero } from "@/components/ui/GradientTitles";
import BackButton from "@/components/ui/BackButton";

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
  const [estudianteProfesorado, setEstudianteProfesorado] = useState<Option | null>(null);
  const [estudiantePlan, setEstudiantePlan] = useState<Option | null>(null);
  const [estudianteMateria, setEstudianteMateria] = useState<Option | null>(null);
  const [estudianteComision, setEstudianteComision] = useState<Option | null>(null);
  const [estudianteDesde, setEstudianteDesde] = useState(today);
  const [estudianteHasta, setEstudianteHasta] = useState(today);
  const [estudianteResultados, setEstudianteResultados] = useState<EstudianteClaseListado[]>([]);
  const [cargandoEstudiantes, setCargandoEstudiantes] = useState(false);

  const { data: profesoradosData, isLoading: profesoradosLoading } = useQuery<Carrera[]>({
    queryKey: ["asistencia", "profesorados"],
    queryFn: () => fetchCarreras(),
    enabled: puedeVerEstudiantes || puedeVerDocentes,
    staleTime: 5 * 60 * 1000,
  });

  const profesoradoOptions = useMemo<Option[]>(() => {
    if (!profesoradosData) return [];
    return profesoradosData
      .map((prof) => ({ id: prof.id, label: prof.nombre }))
      .sort(ordenarPorLabel);
  }, [profesoradosData]);

  const { data: estudiantePlanesData, isLoading: estudiantePlanesLoading } = useQuery<PlanDetalle[]>({
    queryKey: ["asistencia", "planes", estudianteProfesorado?.id ?? 0],
    queryFn: () => listarPlanes(estudianteProfesorado!.id),
    enabled: puedeVerEstudiantes && !!estudianteProfesorado,
    staleTime: 5 * 60 * 1000,
  });

  const estudiantePlanOptions = useMemo<Option[]>(() => {
    if (!estudiantePlanesData) return [];
    return estudiantePlanesData
      .map((plan) => ({ id: plan.id, label: plan.resolucion }))
      .sort(ordenarPorLabel);
  }, [estudiantePlanesData]);

  const { data: estudianteMateriasData, isLoading: estudianteMateriasLoading } = useQuery<MateriaDTO[]>({
    queryKey: ["asistencia", "materias", estudiantePlan?.id ?? 0],
    queryFn: () => listarMaterias(estudiantePlan!.id),
    enabled: puedeVerEstudiantes && !!estudiantePlan,
    staleTime: 5 * 60 * 1000,
  });

  const {
    data: estudianteComisionesData,
    isLoading: estudianteComisionesLoading,
  } = useQuery<ComisionDTO[]>({
    queryKey: ["asistencia", "comisiones", estudianteProfesorado?.id ?? 0, estudiantePlan?.id ?? 0, estudianteMateria?.id ?? 0],
    queryFn: () =>
      listarComisiones({
        profesorado_id: estudianteProfesorado?.id ?? undefined,
        plan_id: estudiantePlan?.id ?? undefined,
        materia_id: estudianteMateria?.id ?? undefined,
      }),
    enabled: puedeVerEstudiantes && !!estudianteProfesorado && !!estudiantePlan,
    staleTime: 2 * 60 * 1000,
  });

  const estudianteMateriaOptions = useMemo<Option[]>(() => {
    if (!estudianteMateriasData) return [];
    return estudianteMateriasData
      .map((materia) => ({ id: materia.id, label: materia.nombre }))
      .sort(ordenarPorLabel);
  }, [estudianteMateriasData]);

  const estudianteComisionOptions = useMemo<Option[]>(() => {
    if (!estudianteComisionesData) return [];
    let filtered = estudianteComisionesData;
    if (estudiantePlan) filtered = filtered.filter((c) => c.plan_id === estudiantePlan.id);
    if (estudianteMateria) filtered = filtered.filter((c) => c.materia_id === estudianteMateria.id);
    return filtered
      .map((c) => ({ id: c.id, label: `${c.materia_nombre} - ${c.codigo}` }))
      .sort(ordenarPorLabel);
  }, [estudianteComisionesData, estudiantePlan, estudianteMateria]);

  useEffect(() => {
    setEstudiantePlan(null);
    setEstudianteMateria(null);
    setEstudianteComision(null);
  }, [estudianteProfesorado]);

  useEffect(() => {
    setEstudianteMateria(null);
    setEstudianteComision(null);
  }, [estudiantePlan]);

  useEffect(() => {
    setEstudianteComision(null);
  }, [estudianteMateria]);

  const handleBuscarEstudiantes = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!puedeVerEstudiantes) {
      enqueueSnackbar("No tenes permisos para consultar asistencia de estudiantes.", { variant: "warning" });
      return;
    }
    if (!estudianteMateria && !estudianteComision) {
      enqueueSnackbar("Selecciona al menos una materia o comision.", { variant: "info" });
      return;
    }
    setCargandoEstudiantes(true);
    try {
      const params: { comision_id?: number; materia_id?: number; desde: string; hasta: string } = {
        desde: estudianteDesde,
        hasta: estudianteHasta,
      };
      if (estudianteComision) {
        params.comision_id = estudianteComision.id;
      } else if (estudianteMateria) {
        params.materia_id = estudianteMateria.id;
      }
      const data = await fetchEstudianteClases(params);
      setEstudianteResultados(data.clases);
      if (data.clases.length === 0) {
        enqueueSnackbar("No encontramos clases para ese rango.", { variant: "info" });
      }
    } catch (error) {
      enqueueSnackbar("No se pudo obtener la asistencia de estudiantes.", { variant: "error" });
    } finally {
      setCargandoEstudiantes(false);
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
        enqueueSnackbar("No tenes permisos para consultar asistencia de docentes.", { variant: "warning" });
        return;
      }
      if (!dni) {
        enqueueSnackbar("Ingresa un DNI de docente.", { variant: "info" });
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
            enqueueSnackbar("El dia debe estar entre 0 y 6.", { variant: "warning" });
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
  // Gestionado en CalendarioEventosPanel
  return (
    <Box sx={{ px: { xs: 1, md: 2 }, py: 1 }}>
      <Stack spacing={3}>
        <BackButton fallbackPath="/secretaria" />
        <PageHero
          title="Reportes de asistencia"
          subtitle="Filtros rápidos para acompañar el seguimiento diario de estudiantes y docentes"
        />

        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Paper elevation={3} sx={{ p: 3, height: "100%" }}>
              <Stack spacing={2} height="100%">
                <Stack direction="row" spacing={1.5} alignItems="center">
                  <Chip
                    icon={<SchoolIcon />}
                    label="Estudiantes"
                    sx={{
                      fontWeight: 600,
                      bgcolor: "primary.main",
                      color: "common.white",
                      "& .MuiChip-icon": { color: "common.white !important" },
                    }}
                  />
                  <Chip
                    icon={<ManageAccountsIcon />}
                    label={puedeGestionarEstudiantes ? "Gestion habilitada" : "Gestion restringida"}
                    color={puedeGestionarEstudiantes ? "success" : "default"}
                    variant={puedeGestionarEstudiantes ? "filled" : "outlined"}
                    sx={{
                      "& .MuiChip-icon": {
                        color: "common.white !important",
                      },
                    }}
                  />
                  <Chip
                    icon={<VisibilityIcon />}
                    label={puedeVerEstudiantes ? "Vista habilitada" : "Vista restringida"}
                    color={puedeVerEstudiantes ? "info" : "default"}
                    variant={puedeVerEstudiantes ? "filled" : "outlined"}
                    sx={{
                      "& .MuiChip-icon": {
                        color: "common.white !important",
                      },
                    }}
                  />
                </Stack>

                <Box component="form" onSubmit={handleBuscarEstudiantes}>
                  <Stack spacing={1.5}>
                    <Typography variant="subtitle1" fontWeight={600}>
                      Filtrar asistencia de estudiantes
                    </Typography>
                    <Grid container spacing={1.5}>
                      <Grid item xs={12} md={6}>
                        <Autocomplete
                          options={profesoradoOptions}
                          value={estudianteProfesorado}
                          onChange={(_, value) => setEstudianteProfesorado(value)}
                          loading={profesoradosLoading}
                          disabled={cargandoEstudiantes || !puedeVerEstudiantes}
                          fullWidth
                          renderInput={(params) => (
                            <TextField
                              {...params}
                              label="Profesorado"
                              placeholder="Selecciona un profesorado"
                              InputProps={{
                                ...params.InputProps,
                                endAdornment: (
                                  <>
                                    {profesoradosLoading ? <CircularProgress color="inherit" size={16} /> : null}
                                    {params.InputProps.endAdornment}
                                  </>
                                ),
                              }}
                            />
                          )}
                        />
                      </Grid>
                      <Grid item xs={12} md={6}>
                        <Autocomplete
                          options={estudiantePlanOptions}
                          value={estudiantePlan}
                          onChange={(_, value) => setEstudiantePlan(value)}
                          loading={estudiantePlanesLoading}
                          disabled={cargandoEstudiantes || !puedeVerEstudiantes || estudiantePlanOptions.length === 0}
                          fullWidth
                          renderInput={(params) => (
                            <TextField
                              {...params}
                              label="Plan"
                              placeholder="Selecciona un plan"
                              InputProps={{
                                ...params.InputProps,
                                endAdornment: (
                                  <>
                                    {estudiantePlanesLoading ? <CircularProgress color="inherit" size={16} /> : null}
                                    {params.InputProps.endAdornment}
                                  </>
                                ),
                              }}
                            />
                          )}
                        />
                      </Grid>
                    </Grid>
                    <Grid container spacing={1.5}>
                      <Grid item xs={12} md={6}>
                        <Autocomplete
                          options={estudianteMateriaOptions}
                          value={estudianteMateria}
                          onChange={(_, value) => setEstudianteMateria(value)}
                          loading={estudianteMateriasLoading}
                          disabled={
                            cargandoEstudiantes ||
                            !puedeVerEstudiantes ||
                            estudianteMateriaOptions.length === 0 ||
                            estudianteMateriasLoading
                          }
                          fullWidth
                          renderInput={(params) => (
                            <TextField
                              {...params}
                              label="Materia"
                              placeholder="Selecciona una materia"
                              InputProps={{
                                ...params.InputProps,
                                endAdornment: (
                                  <>
                                    {estudianteMateriasLoading ? <CircularProgress color="inherit" size={16} /> : null}
                                    {params.InputProps.endAdornment}
                                  </>
                                ),
                              }}
                            />
                          )}
                        />
                      </Grid>
                      <Grid item xs={12} md={6}>
                        <Autocomplete
                          options={estudianteComisionOptions}
                          value={estudianteComision}
                          onChange={(_, value) => setEstudianteComision(value)}
                          loading={estudianteComisionesLoading}
                          disabled={
                            cargandoEstudiantes ||
                            !puedeVerEstudiantes ||
                            estudianteComisionOptions.length === 0 ||
                            estudianteComisionesLoading
                          }
                          fullWidth
                          renderInput={(params) => (
                            <TextField
                              {...params}
                              label="Catedra (comision)"
                              placeholder="Selecciona una catedra"
                              InputProps={{
                                ...params.InputProps,
                                endAdornment: (
                                  <>
                                    {estudianteComisionesLoading ? <CircularProgress color="inherit" size={16} /> : null}
                                    {params.InputProps.endAdornment}
                                  </>
                                ),
                              }}
                            />
                          )}
                        />
                      </Grid>
                    </Grid>
                    <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
                      <TextField
                        label="Desde"
                        type="date"
                        value={estudianteDesde}
                        onChange={(event) => setEstudianteDesde(event.target.value)}
                        disabled={cargandoEstudiantes || !puedeVerEstudiantes}
                        fullWidth
                        InputLabelProps={{ shrink: true }}
                      />
                      <TextField
                        label="Hasta"
                        type="date"
                        value={estudianteHasta}
                        onChange={(event) => setEstudianteHasta(event.target.value)}
                        disabled={cargandoEstudiantes || !puedeVerEstudiantes}
                        fullWidth
                        InputLabelProps={{ shrink: true }}
                      />
                    </Stack>
                    <Button type="submit" variant="contained" disabled={cargandoEstudiantes || !puedeVerEstudiantes}>
                      {cargandoEstudiantes ? <CircularProgress size={20} /> : "Consultar"}
                    </Button>
                  </Stack>
                </Box>

                <Divider />

                {estudianteResultados.length === 0 ? (
                  <Alert severity="info">Configura los filtros y presiona "Consultar" para ver clases.</Alert>
                ) : (
                  <Stack spacing={1.5} sx={{ maxHeight: 260, overflowY: "auto" }}>
                    {estudianteResultados.map((item) => (
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
                          Presentes: {item.presentes} - Ausentes: {item.ausentes} - Justificados: {item.ausentes_justificados} - Total: {item.total_estudiantes}
                        </Typography>
                      </Paper>
                    ))}
                  </Stack>
                )}

                {!puedeVerEstudiantes && (
                  <Stack direction="row" spacing={1} alignItems="center" color="warning.main" mt={1}>
                    <WarningAmberIcon fontSize="small" />
                    <Typography variant="caption">
                      Tu rol no tiene acceso a este modulo. Contacta a Secretaria para habilitarlo.
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
                  <Chip
                    icon={<GroupsIcon />}
                    label="Docentes"
                    sx={{
                      fontWeight: 600,
                      bgcolor: "primary.main",
                      color: "common.white",
                      "& .MuiChip-icon": { color: "common.white !important" },
                    }}
                  />
                  <Chip
                    icon={<ManageAccountsIcon />}
                    label={puedeGestionarDocentes ? "Gestion habilitada" : "Gestion restringida"}
                    color={puedeGestionarDocentes ? "success" : "default"}
                    variant={puedeGestionarDocentes ? "filled" : "outlined"}
                    sx={{
                      "& .MuiChip-icon": {
                        color: "common.white !important",
                      },
                    }}
                  />
                  <Chip
                    icon={<VisibilityIcon />}
                    label={puedeVerDocentes ? "Vista habilitada" : "Vista restringida"}
                    color={puedeVerDocentes ? "info" : "default"}
                    variant={puedeVerDocentes ? "filled" : "outlined"}
                    sx={{
                      "& .MuiChip-icon": {
                        color: "common.white !important",
                      },
                    }}
                  />
                </Stack>

                <Box component="form" onSubmit={handleBuscarDocente}>
                  <Stack spacing={1.5}>
                    <Typography variant="subtitle1" fontWeight={600}>
                      Selecciona al docente
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
                      label="Filtrar por dia de semana (0=lunes ... 6=domingo)"
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
                    <Grid container spacing={1.5}>
                      <Grid item xs={12} md={6}>
                        <Autocomplete
                          options={docenteProfesOptions}
                          value={docenteProfesorado}
                          onChange={(_, value) => setDocenteProfesorado(value)}
                          disabled={docenteProfesOptions.length === 0}
                          fullWidth
                          renderInput={(params) => <TextField {...params} label="Profesorado" placeholder="Selecciona un profesorado" />}
                        />
                      </Grid>
                      <Grid item xs={12} md={6}>
                        <Autocomplete
                          options={docentePlanOptions}
                          value={docentePlan}
                          onChange={(_, value) => setDocentePlan(value)}
                          disabled={docentePlanOptions.length === 0}
                          fullWidth
                          renderInput={(params) => <TextField {...params} label="Plan" placeholder="Selecciona un plan" />}
                        />
                      </Grid>
                      <Grid item xs={12} md={6}>
                        <Autocomplete
                          options={docenteMateriaOptions}
                          value={docenteMateria}
                          onChange={(_, value) => setDocenteMateria(value)}
                          disabled={docenteMateriaOptions.length === 0}
                          fullWidth
                          renderInput={(params) => <TextField {...params} label="Materia" placeholder="Selecciona una materia" />}
                        />
                      </Grid>
                      <Grid item xs={12} md={6}>
                        <Autocomplete
                          options={docenteComisionOptions}
                          value={docenteComision}
                          onChange={(_, value) => setDocenteComision(value)}
                          disabled={docenteComisionOptions.length === 0}
                          fullWidth
                          renderInput={(params) => <TextField {...params} label="Catedra (comision)" placeholder="Selecciona una catedra" />}
                        />
                      </Grid>
                      <Grid item xs={12} md={6}>
                        <Autocomplete
                          options={docenteFechaOptions}
                          value={docenteFecha}
                          onChange={(_, value) => setDocenteFecha(value)}
                          disabled={docenteFechaOptions.length === 0}
                          fullWidth
                          renderInput={(params) => <TextField {...params} label="Fecha" placeholder="Selecciona una fecha" />}
                        />
                      </Grid>
                    </Grid>
                  </Stack>
                )}

                {docenteClasesFiltradas.length === 0 ? (
                  <Alert severity="info">Ingresa un DNI y rango de fechas para ver las clases asignadas.</Alert>
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
                            Puede marcar: {clase.puede_marcar ? "si" : "no"} - Staff puede editar: {clase.editable_staff ? "si" : "no"}
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
                      Tu rol no tiene acceso a la asistencia docente. Coordina con Secretaria para habilitarlo.
                    </Typography>
                  </Stack>
                )}
              </Stack>
            </Paper>
          </Grid>
        </Grid>

        <CalendarioEventosPanel canManage={puedeGestionarDocentes} />
      </Stack>
    </Box>
  );
};

export default AsistenciaReportesPage;

