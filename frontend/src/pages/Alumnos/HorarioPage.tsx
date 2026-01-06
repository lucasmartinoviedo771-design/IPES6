import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Box,
  Button,
  CircularProgress,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  SelectChangeEvent,
  Stack,
  Typography,
} from "@mui/material";
import { Download as DownloadIcon, Refresh as RefreshIcon } from "@mui/icons-material";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSnackbar } from "notistack";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { isAxiosError } from "axios";

import {
  HorarioTablaDTO,
  TrayectoriaCarreraDetalleDTO,
  obtenerCarrerasActivas,
  obtenerHorarioAlumno,
} from "@/api/alumnos";
import { listarPlanes, listarProfesorados, PlanDTO, ProfesoradoDTO } from "@/api/cargaNotas";
import HorarioTablaCard from "@/features/alumnos/horario/HorarioTablaCard";
import { useAuth } from "@/context/AuthContext";
import { fetchVentanas, VentanaDto } from "@/api/ventanas";
import BackButton from "@/components/ui/BackButton";
import { useCarreras } from "@/hooks/useCarreras";
import { PageHero, SectionTitlePill } from "@/components/ui/GradientTitles";
import { INSTITUTIONAL_TERRACOTTA } from "@/styles/institutionalColors";

type SelectValue = string;
type PlanOption = {
  id: number;
  resolucion?: string | null;
  vigente?: boolean;
};

const parseNumberOrEmpty = (value: SelectValue): number | undefined => {
  if (value === "") return undefined;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? undefined : parsed;
};

const CUATRIMESTRE_LABEL: Record<string, string> = {
  ANUAL: "Anuales",
  "1C": "1.er Cuatrimestre",
  "2C": "2.do Cuatrimestre",
};

const HorarioPage: React.FC = () => {
  const { enqueueSnackbar } = useSnackbar();
  const exportRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  const { user } = useAuth();
  const roles = user?.roles ?? [];
  const isAlumno = roles.includes("alumno") && roles.every((rol) => rol === "alumno");

  const [profesoradoId, setProfesoradoId] = useState<SelectValue>("");
  const [planId, setPlanId] = useState<SelectValue>("");
  const [turnoFilter, setTurnoFilter] = useState<SelectValue>("");
  const [anioFilter, setAnioFilter] = useState<SelectValue>("");
  const [cuatrFilter, setCuatrFilter] = useState<SelectValue>("");

  const carrerasQuery = useQuery({
    queryKey: ["alumnos", "carreras-activas"],
    queryFn: () => obtenerCarrerasActivas(),
    staleTime: 5 * 60 * 1000,
    enabled: isAlumno,
  });

  const profesoradosQuery = useCarreras();

  const planesAdminQuery = useQuery({
    queryKey: ["alumnos", "profesorados", "planes", profesoradoId],
    queryFn: () => listarPlanes(Number(profesoradoId)),
    enabled: !isAlumno && Boolean(profesoradoId),
  });

  const ventanasCalendarioQuery = useQuery<VentanaDto[]>({
    queryKey: ["ventanas", "calendario-cuatrimestre"],
    queryFn: () => fetchVentanas({ tipo: "CALENDARIO_CUATRIMESTRE" }),
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (!profesoradoId) {
      if (isAlumno && carrerasQuery.data && carrerasQuery.data.length > 0) {
        setProfesoradoId(String(carrerasQuery.data[0].profesorado_id));
      }
      if (!isAlumno && profesoradosQuery.data && profesoradosQuery.data.length > 0) {
        setProfesoradoId(String(profesoradosQuery.data[0].id));
      }
    }
  }, [isAlumno, carrerasQuery.data, profesoradosQuery.data, profesoradoId]);

  const planesDisponibles = useMemo<PlanOption[]>(() => {
    if (isAlumno) {
      if (!carrerasQuery.data) return [];
      const selected = carrerasQuery.data.find(
        (item) => item.profesorado_id === Number(profesoradoId),
      );
      return selected?.planes ?? [];
    }
    return (planesAdminQuery.data ?? []).map((plan: PlanDTO): PlanOption => ({
      id: plan.id,
      resolucion: plan.resolucion,
    }));
  }, [isAlumno, carrerasQuery.data, planesAdminQuery.data, profesoradoId]);

  useEffect(() => {
    if (!planesDisponibles.length) {
      setPlanId("");
      return;
    }
    const existe = planesDisponibles.some((plan) => String(plan.id) === planId);
    if (!existe && planesDisponibles.length > 0) {
      const preferido = planesDisponibles.find((plan) => plan.vigente) ?? planesDisponibles[0];
      setPlanId(String(preferido.id));
    }
  }, [planesDisponibles, planId]);

  const horarioQuery = useQuery({
    queryKey: ["alumnos", "horarios", profesoradoId, planId],
    queryFn: () =>
      obtenerHorarioAlumno({
        profesorado_id: parseNumberOrEmpty(profesoradoId),
        plan_id: parseNumberOrEmpty(planId),
      }),
    enabled: Boolean(profesoradoId && planId),
    retry: false,
  });

  useEffect(() => {
    const error = horarioQuery.error;
    if (!error) return;
    if (isAxiosError(error)) {
      const message =
        error.response?.data?.message ||
        "No se pudo cargar el horario. Inténtalo nuevamente más tarde.";
      enqueueSnackbar(message, { variant: "error" });
    } else {
      enqueueSnackbar("No se pudo cargar el horario. Inténtalo nuevamente más tarde.", {
        variant: "error",
      });
    }
  }, [horarioQuery.error, enqueueSnackbar]);

  const tablas = horarioQuery.data ?? [];

  const turnosDisponibles = useMemo(() => {
    const map = new Map<number, string>();
    tablas.forEach((tabla) => {
      map.set(tabla.turno_id, tabla.turno_nombre || "Sin turno");
    });
    return Array.from(map.entries()).map(([id, nombre]) => ({
      id: String(id),
      nombre,
    }));
  }, [tablas]);

  const aniosDisponibles = useMemo(() => {
    const map = new Map<number, string>();
    tablas.forEach((tabla) => {
      map.set(tabla.anio_plan, tabla.anio_plan_label);
    });
    return Array.from(map.entries()).map(([id, label]) => ({
      id: String(id),
      label,
    }));
  }, [tablas]);

  const cuatrDisponibles = useMemo(() => {
    const set = new Set<string>();
    tablas.forEach((tabla) => {
      tabla.cuatrimestres.forEach((c) => set.add(c));
    });
    return Array.from(set.values());
  }, [tablas]);

  const prevTablasRef = useRef<HorarioTablaDTO[]>();

  useEffect(() => {
    if (prevTablasRef.current !== tablas) {
      if (turnoFilter && !turnosDisponibles.some((item) => item.id === turnoFilter)) {
        setTurnoFilter("");
      }
      if (anioFilter && !aniosDisponibles.some((item) => item.id === anioFilter)) {
        setAnioFilter("");
      }
      if (cuatrFilter && !cuatrDisponibles.includes(cuatrFilter)) {
        setCuatrFilter("");
      }
    }
    prevTablasRef.current = tablas;
  }, [tablas, turnoFilter, anioFilter, cuatrFilter, turnosDisponibles, aniosDisponibles, cuatrDisponibles]);

  useEffect(() => {
    if (cuatrFilter) return;
    if (!cuatrDisponibles.length) return;
    const ventanas = ventanasCalendarioQuery.data ?? [];
    if (!ventanas.length) return;

    const hoy = new Date();
    const parseDate = (value?: string | null) => {
      if (!value) return null;
      const parsed = new Date(value);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    };
    const mapPeriodo = (valor?: string | null) => {
      if (!valor) return "";
      const upper = valor.toUpperCase();
      if (upper === "1C_ANUALES" || upper === "ANUALES") return "1C";
      if (upper === "2C_ANUALES") return "2C";
      return upper;
    };
    const dentroDeRango = (ventana: VentanaDto) => {
      const desde = parseDate(ventana.desde);
      const hasta = parseDate(ventana.hasta);
      if (desde && hoy < desde) return false;
      if (hasta && hoy > hasta) return false;
      return true;
    };

    const ventanaActiva =
      ventanas.find((ventana) => {
        const periodo = mapPeriodo(ventana.periodo);
        if (!["1C", "2C"].includes(periodo)) return false;
        return dentroDeRango(ventana);
      }) ||
      ventanas.find(
        (ventana) => ventana.activo && ["1C", "2C"].includes(mapPeriodo(ventana.periodo)),
      );

    const sugerido = ventanaActiva ? mapPeriodo(ventanaActiva.periodo) : "";
    if (sugerido && cuatrDisponibles.includes(sugerido) && cuatrFilter !== sugerido) {
      setCuatrFilter(sugerido);
    }
  }, [cuatrDisponibles, cuatrFilter, ventanasCalendarioQuery.data]);

  const tablasFiltradas = useMemo(() => {
    return tablas.filter((tabla) => {
      const turnoMatch = turnoFilter ? String(tabla.turno_id) === turnoFilter : true;
      const anioMatch = anioFilter ? String(tabla.anio_plan) === anioFilter : true;
      const cuatrMatch = cuatrFilter
        ? tabla.cuatrimestres.includes(cuatrFilter)
        : true;
      return turnoMatch && anioMatch && cuatrMatch;
    });
  }, [tablas, turnoFilter, anioFilter, cuatrFilter]);

  const tablasAgrupadas = useMemo(() => {
    const grupos = new Map<number, HorarioTablaDTO[]>();
    tablasFiltradas.forEach((tabla) => {
      if (!grupos.has(tabla.anio_plan)) {
        grupos.set(tabla.anio_plan, []);
      }
      grupos.get(tabla.anio_plan)!.push(tabla);
    });
    return Array.from(grupos.entries()).sort((a, b) => a[0] - b[0]);
  }, [tablasFiltradas]);

  const handleDownloadPDF = async () => {
    if (!exportRef.current) {
      enqueueSnackbar("No hay contenido para exportar.", { variant: "warning" });
      return;
    }
    enqueueSnackbar("Generando PDF...", { variant: "info" });
    try {
      const canvas = await html2canvas(exportRef.current, {
        scale: 2,
        useCORS: true,
        logging: false,
      });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");
      const imgWidth = 190;
      const pageHeight = 277;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 10;

      pdf.addImage(imgData, "PNG", 10, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft > 0) {
        position = heightLeft - imgHeight + 10;
        pdf.addPage();
        pdf.addImage(imgData, "PNG", 10, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      const fileNameParts = ["Horario"];
      if (isAlumno) {
        const carrera = carrerasQuery.data?.find(
          (item) => item.profesorado_id === Number(profesoradoId),
        );
        if (carrera) {
          fileNameParts.push(carrera.nombre.replace(/\s+/g, "_"));
        }
      } else if (profesoradosQuery.data) {
        const prof = profesoradosQuery.data.find((item) => item.id === Number(profesoradoId));
        if (prof) {
          fileNameParts.push(prof.nombre.replace(/\s+/g, "_"));
        }
      }

      if (planId) {
        const planDetalle = planesDisponibles.find((plan) => String(plan.id) === planId);
        if (planDetalle && planDetalle.resolucion) {
          fileNameParts.push(planDetalle.resolucion.replace(/\s+/g, "_"));
        } else {
          fileNameParts.push(`Plan_${planId}`);
        }
      }

      pdf.save(`${fileNameParts.join("_")}.pdf`);
      enqueueSnackbar("PDF descargado correctamente.", { variant: "success" });
    } catch (error) {
      console.error("Error generando PDF", error);
      enqueueSnackbar("No se pudo generar el PDF.", { variant: "error" });
    }
  };

  const handleRefresh = () => {
    queryClient.invalidateQueries({
      queryKey: ["alumnos", "horarios", profesoradoId, planId],
    });
  };

  const handleCarreraChange = (event: SelectChangeEvent<string>) => {
    setProfesoradoId(event.target.value);
    setTurnoFilter("");
    setAnioFilter("");
    setCuatrFilter("");
  };

  const handlePlanChange = (event: SelectChangeEvent<string>) => {
    setPlanId(event.target.value);
    setTurnoFilter("");
    setAnioFilter("");
    setCuatrFilter("");
  };

  const loading =
    carrerasQuery.isLoading ||
    profesoradosQuery.isLoading ||
    planesAdminQuery.isLoading ||
    horarioQuery.isLoading;
  const sinCarreras =
    isAlumno && !loading && (!carrerasQuery.data || carrerasQuery.data.length === 0);

  return (
    <Box sx={{ p: 3 }}>
      <BackButton fallbackPath="/alumnos" />
      <PageHero
        title="Horario de cursada"
        subtitle="Selecciona el profesorado y plan que deseas consultar. Podés filtrar por turno, año y cuatrimestre y descargar el resultado en PDF."
        sx={{ background: `linear-gradient(120deg, ${INSTITUTIONAL_TERRACOTTA} 0%, #8e4a31 100%)` }}
      />

      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid item xs={12} md={4}>
          <SectionTitlePill
            title="Selección de Carrera"
            sx={{ background: `linear-gradient(120deg, ${INSTITUTIONAL_TERRACOTTA} 0%, #8e4a31 100%)`, mb: 1 }}
          />
          <FormControl fullWidth size="small">
            <InputLabel id="carrera-select-label">Profesorado</InputLabel>
            <Select
              labelId="carrera-select-label"
              label="Profesorado"
              value={profesoradoId}
              onChange={handleCarreraChange}
              disabled={carrerasQuery.isLoading}
            >
              {isAlumno
                ? carrerasQuery.data?.map((carrera: TrayectoriaCarreraDetalleDTO) => (
                  <MenuItem key={carrera.profesorado_id} value={String(carrera.profesorado_id)}>
                    {carrera.nombre}
                  </MenuItem>
                ))
                : profesoradosQuery.data?.map((profesorado: ProfesoradoDTO) => (
                  <MenuItem key={profesorado.id} value={String(profesorado.id)}>
                    {profesorado.nombre}
                  </MenuItem>
                ))}
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={12} md={4}>
          <FormControl
            fullWidth
            size="small"
            disabled={!planesDisponibles.length || (!isAlumno && planesAdminQuery.isLoading)}
          >
            <InputLabel id="plan-select-label">Plan</InputLabel>
            <Select
              labelId="plan-select-label"
              label="Plan"
              value={planId}
              onChange={handlePlanChange}
            >
              {planesDisponibles.map((plan) => (
                <MenuItem key={plan.id} value={String(plan.id)}>
                  {plan.resolucion || `Plan ${plan.id}`}
                  {plan.vigente ? " - Vigente" : ""}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={12} md={4}>
          <Stack direction="row" spacing={1} justifyContent="flex-end">
            <Button
              variant="outlined"
              startIcon={<RefreshIcon />}
              onClick={handleRefresh}
              disabled={!profesoradoId || !planId || horarioQuery.isFetching}
            >
              Actualizar
            </Button>
            <Button
              variant="contained"
              startIcon={<DownloadIcon />}
              onClick={handleDownloadPDF}
              disabled={!tablasFiltradas.length}
            >
              Descargar PDF
            </Button>
          </Stack>
        </Grid>
      </Grid>

      <SectionTitlePill
        title="Filtros de visualización"
        sx={{ background: `linear-gradient(120deg, ${INSTITUTIONAL_TERRACOTTA} 0%, #8e4a31 100%)`, mt: 3, mb: 1 }}
      />
      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid item xs={12} md={4}>
          <FormControl fullWidth size="small" disabled={!turnosDisponibles.length}>
            <InputLabel id="turno-select-label">Turno</InputLabel>
            <Select
              labelId="turno-select-label"
              label="Turno"
              value={turnoFilter}
              onChange={(event) => setTurnoFilter(event.target.value)}
            >
              <MenuItem value="">Todos</MenuItem>
              {turnosDisponibles.map((turno) => (
                <MenuItem key={turno.id} value={turno.id}>
                  {turno.nombre}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={12} md={4}>
          <FormControl fullWidth size="small" disabled={!aniosDisponibles.length}>
            <InputLabel id="anio-select-label">Año</InputLabel>
            <Select
              labelId="anio-select-label"
              label="Año"
              value={anioFilter}
              onChange={(event) => setAnioFilter(event.target.value)}
            >
              <MenuItem value="">Todos</MenuItem>
              {aniosDisponibles.map((anio) => (
                <MenuItem key={anio.id} value={anio.id}>
                  {anio.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={12} md={4}>
          <FormControl fullWidth size="small" disabled={!cuatrDisponibles.length}>
            <InputLabel id="cuatr-select-label">Cuatrimestre</InputLabel>
            <Select
              labelId="cuatr-select-label"
              label="Cuatrimestre"
              value={cuatrFilter}
              onChange={(event) => setCuatrFilter(event.target.value)}
            >
              <MenuItem value="">Todos</MenuItem>
              {["1C", "2C"].map((cuatr) => (
                <MenuItem key={cuatr} value={cuatr}>
                  {CUATRIMESTRE_LABEL[cuatr] ?? cuatr}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>
      </Grid>

      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", mt: 4 }}>
          <CircularProgress />
        </Box>
      ) : (
        <Box ref={exportRef}>
          {sinCarreras ? (
            <Typography variant="body1" color="text.secondary" sx={{ mt: 4 }}>
              No se encontraron profesorados asociados a tu usuario. Consulta con Secretaría para verificar tu inscripción.
            </Typography>
          ) : tablasFiltradas.length === 0 ? (
            <Typography variant="body1" color="text.secondary" sx={{ mt: 4 }}>
              No se encontraron horarios para los filtros seleccionados.
            </Typography>
          ) : (
            <Stack spacing={2}>
              {tablasAgrupadas.map(([anio, items]) => (
                <Box key={anio} sx={{ border: "1px solid", borderColor: "divider", borderRadius: 2, p: 2 }}>
                  <Typography variant="h6" sx={{ mb: 2 }}>
                    {items[0].anio_plan_label || `Año ${anio}`}
                  </Typography>
                  <Stack spacing={2}>
                    {items
                      .sort((a, b) => a.turno_nombre.localeCompare(b.turno_nombre))
                      .map((tabla) => (
                        <HorarioTablaCard key={tabla.key} tabla={tabla} cuatrimestre={cuatrFilter || undefined} />
                      ))}
                  </Stack>
                </Box>
              ))}
            </Stack>
          )}
        </Box>
      )}
    </Box>
  );
};

export default HorarioPage;
