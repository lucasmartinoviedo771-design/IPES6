import React, { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import FormControl from "@mui/material/FormControl";
import Grid from "@mui/material/Grid";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import type { SelectChangeEvent } from "@mui/material";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import DownloadIcon from "@mui/icons-material/Download";
import RefreshIcon from "@mui/icons-material/Refresh";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSnackbar } from "notistack";
import { toJpeg } from "html-to-image";
import jsPDF from "jspdf";
import { isAxiosError } from "axios";

import {
  HorarioTablaDTO,
  TrayectoriaCarreraDetalleDTO,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  CarrerasActivasDTO,
  obtenerCarrerasActivas,
  obtenerHorarioEstudiante,
} from "@/api/estudiantes";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { getDefaultHomeRoute, hasAnyRole, isOnlyEstudiante } from "@/utils/roles";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { listarPlanes, listarProfesorados, PlanDTO, ProfesoradoDTO } from "@/api/cargaNotas";
import InstitutionalScheduleFormat from "@/features/estudiantes/horario/InstitutionalScheduleFormat";
import { useAuth } from "@/context/AuthContext";
import { fetchVentanas, VentanaDto } from "@/api/ventanas";
import BackButton from "@/components/ui/BackButton";
import { useCarreras } from "@/hooks/useCarreras";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { PageHero, SectionTitlePill } from "@/components/ui/GradientTitles";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
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

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const AÑO_LABELS: Record<number, string> = {
    1: "1er Año",
    2: "2do Año",
    3: "3er Año",
    4: "4to Año",
    5: "5to Año",
};

const HorarioPage: React.FC = () => {
  const { enqueueSnackbar } = useSnackbar();
  const exportRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const dniParam = searchParams.get("dni");
  const canGestionar = hasAnyRole(user, ["admin", "secretaria", "bedel"]);
  const isEstudiante = hasAnyRole(user, ["estudiante"]);
  
  // Si soy admin/gestor y no hay DNI en la URL, NO actúo como estudiante aunque tenga el rol.
  const isActingAsEstudiante = isEstudiante && (!canGestionar || !!dniParam);
  const targetDni = dniParam || (isActingAsEstudiante ? user?.dni : undefined);

  const [profesoradoId, setProfesoradoId] = useState<SelectValue>("");
  const [planId, setPlanId] = useState<SelectValue>("");
  const [turnoFilter, setTurnoFilter] = useState<SelectValue>("");
  const [anioFilter, setAnioFilter] = useState<SelectValue>("");
  const getCuatrDefault = () => {
    const month = new Date().getMonth() + 1;
    return month <= 7 ? "1C" : "2C";
  };
  const [cuatrFilter, setCuatrFilter] = useState<string>(getCuatrDefault);

  const { data: carrerasData } = useQuery({
    queryKey: ["estudiantes", "carreras-activas", targetDni],
    queryFn: () => obtenerCarrerasActivas({ dni: targetDni ?? undefined }),
    staleTime: 5 * 60 * 1000,
    enabled: !!targetDni, // Solo si tenemos un DNI objetivo (el propio o de un alumno buscado)
  });

  const profesoradosQuery = useCarreras();

  const { data: planesAdminData } = useQuery({
    queryKey: ["estudiantes", "profesorados", "planes", profesoradoId],
    queryFn: () => listarPlanes(Number(profesoradoId)),
    enabled: !isActingAsEstudiante && Boolean(profesoradoId),
  });

  const { data: ventanasData } = useQuery<VentanaDto[]>({
    queryKey: ["ventanas", "calendario-cuatrimestre"],
    queryFn: () => fetchVentanas({ tipo: "CALENDARIO_CUATRIMESTRE" }),
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (!profesoradoId) {
      if (targetDni && carrerasData && carrerasData.carreras.length > 0) {
        setProfesoradoId(String(carrerasData.carreras[0].profesorado_id));
      }
      if (!targetDni && profesoradosQuery.data && profesoradosQuery.data.length > 0) {
        setProfesoradoId(String(profesoradosQuery.data[0].id));
      }
    }
  }, [targetDni, carrerasData, profesoradosQuery.data, profesoradoId]);

  const planesDisponibles = useMemo<PlanOption[]>(() => {
    if (targetDni) {
      if (!carrerasData) return [];
      const selected = carrerasData.carreras.find(
        (item) => item.profesorado_id === Number(profesoradoId),
      );
      return selected?.planes ?? [];
    }
    return (planesAdminData ?? []).map((plan: PlanDTO): PlanOption => ({
      id: plan.id,
      resolucion: plan.resolucion,
    }));
  }, [targetDni, carrerasData, planesAdminData, profesoradoId]);

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

  const { data: horarioData, error: horarioError, isLoading: horarioLoading, isFetching: horarioFetching } = useQuery({
    queryKey: ["estudiantes", "horarios", profesoradoId, planId, targetDni, cuatrFilter],
    queryFn: () =>
      obtenerHorarioEstudiante({
        profesorado_id: parseNumberOrEmpty(profesoradoId),
        plan_id: parseNumberOrEmpty(planId),
        cuatrimestre: cuatrFilter || undefined,
        dni: targetDni ?? undefined,
      }),
    enabled: Boolean(profesoradoId && planId),
    retry: false,
  });

  useEffect(() => {
    const error = horarioError;
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
  }, [horarioError, enqueueSnackbar]);

  const tablas = horarioData ?? [];  // eslint-disable-line react-hooks/exhaustive-deps

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
    }
    prevTablasRef.current = tablas;
  }, [tablas, turnoFilter, anioFilter, cuatrFilter, turnosDisponibles, aniosDisponibles, cuatrDisponibles]);

  useEffect(() => {
    if (cuatrFilter) return;
    if (!cuatrDisponibles.length) return;
    const ventanas = ventanasData.data ?? [];
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
  }, [cuatrDisponibles, cuatrFilter, ventanasData.data]);

  const tablasFiltradas = useMemo(() => {
    return tablas.filter((tabla) => {
      const turnoMatch = turnoFilter ? String(tabla.turno_id) === turnoFilter : true;
      const anioMatch = anioFilter ? String(tabla.anio_plan) === anioFilter : true;
      // Backend ya filtra por cuatrimestre, no necesitamos hacerlo aquí
      return turnoMatch && anioMatch;
    });
  }, [tablas, turnoFilter, anioFilter]);

  const handleDownloadPDF = async () => {
    if (!exportRef.current) {
      enqueueSnackbar("No hay contenido para exportar.", { variant: "warning" });
      return;
    }
    enqueueSnackbar("Generando PDF profesional...", { variant: "info" });
    try {
      const pdf = new jsPDF("l", "mm", "a4", true);
      const pageWidth = 297;
      const margin = 5;
      const contentWidth = pageWidth - margin * 2;

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const maxContentHeight = 210 - margin * 2;

      // Temporarily force a wide aspect ratio to match A4 landscape
      const originalWidth = exportRef.current.style.width;
      const originalPosition = exportRef.current.style.position;
      const originalLeft = exportRef.current.style.left;
      const originalTop = exportRef.current.style.top;
      const originalZIndex = exportRef.current.style.zIndex;

      exportRef.current.style.width = "1900px";
      exportRef.current.style.position = "absolute";
      exportRef.current.style.left = "0px";
      exportRef.current.style.top = "0px";
      exportRef.current.style.zIndex = "-1000";

      // Force layout recalculation and give the browser time to paint the layout change
      void exportRef.current.offsetHeight;
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Buscamos todos los contenedores de página (cada uno tiene 2 años)
      const pageElements = Array.from(exportRef.current.querySelectorAll('.pdf-page-chunk'));
      
      if (pageElements.length === 0) {
        // Fallback si no estamos en modo impresión o algo falló en la query
        const imgData = await toJpeg(exportRef.current, {
          pixelRatio: 1,
          quality: 0.78,
          backgroundColor: "#ffffff",
        });
        let imgHeight = (exportRef.current.offsetHeight * contentWidth) / exportRef.current.offsetWidth;
        let imgWidth = contentWidth;
        const maxContentHeight = 210 - margin * 2;
        if (imgHeight > maxContentHeight) {
            const scale = maxContentHeight / imgHeight;
            imgHeight = maxContentHeight;
            imgWidth = imgWidth * scale;
        }
        const xOffset = margin + (contentWidth - imgWidth) / 2;
        pdf.addImage(imgData, "JPEG", xOffset, margin, imgWidth, imgHeight);
      } else {
        for (let i = 0; i < pageElements.length; i++) {
          if (i > 0) pdf.addPage();
          const element = pageElements[i] as HTMLElement;
          const imgData = await toJpeg(element, {
            pixelRatio: 1,
            quality: 0.78,
            backgroundColor: "#ffffff",
          });
          let imgHeight = (element.offsetHeight * contentWidth) / element.offsetWidth;
          let imgWidth = contentWidth;
          const maxContentHeight = 210 - margin * 2;
          if (imgHeight > maxContentHeight) {
              const scale = maxContentHeight / imgHeight;
              imgHeight = maxContentHeight;
              imgWidth = imgWidth * scale;
          }
          const xOffset = margin + (contentWidth - imgWidth) / 2;
          pdf.addImage(imgData, "JPEG", xOffset, margin, imgWidth, imgHeight);
        }
      }

      // Restore original styles
      exportRef.current.style.width = originalWidth;
      exportRef.current.style.position = originalPosition;
      exportRef.current.style.left = originalLeft;
      exportRef.current.style.top = originalTop;
      exportRef.current.style.zIndex = originalZIndex;

      const fileNameParts = ["Horario"];
      if (isEstudiante) {
        const carrera = carrerasData?.carreras.find(
          (item) => item.profesorado_id === Number(profesoradoId),
        );
        if (carrera) {
          fileNameParts.push(carrera.nombre.replace(/\s+/g, "_"));
        }
      } else if (targetDni && targetDni !== user?.dni) {
        fileNameParts.push(`DNI_${targetDni}`);
        if (profesoradosQuery.data) {
          const prof = profesoradosQuery.data.find((item) => item.id === Number(profesoradoId));
          if (prof) {
            fileNameParts.push(prof.nombre.replace(/\s+/g, "_"));
          }
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
    } catch (_error) {
      void 0;
      enqueueSnackbar("No se pudo generar el PDF.", { variant: "error" });
    }
  };

  const handleRefresh = () => {
    queryClient.invalidateQueries({
      queryKey: ["estudiantes", "horarios", profesoradoId, planId],
    });
  };

  const handleCarreraChange = (event: SelectChangeEvent<string>) => {
    setProfesoradoId(event.target.value);
    setPlanId("");
    setTurnoFilter("");
    setAnioFilter("");
    setCuatrFilter(getCuatrDefault());
  };

  const handlePlanChange = (event: SelectChangeEvent<string>) => {
    setPlanId(event.target.value);
    setTurnoFilter("");
    setAnioFilter("");
    setCuatrFilter(getCuatrDefault());
  };

  const loading =
    (!!targetDni && carrerasQuery.isLoading) ||
    profesoradosQuery.isLoading ||
    planesAdminQuery.isLoading ||
    horarioLoading;
  const sinCarreras =
    !!targetDni && !loading && (!carrerasData || carrerasData.carreras.length === 0);

  return (
    <Box sx={{ p: 3 }}>
      <BackButton fallbackPath="/estudiantes" />
      <PageHero
        title="Horario de cursada"
        subtitle="Selecciona el profesorado y plan que deseas consultar. Podés filtrar por turno, año y cuatrimestre y descargar el resultado en PDF."
      />

      <Grid container spacing={2} sx={{ mb: 3, alignItems: "center" }}>
        <Grid item xs={12} md={4}>
          <FormControl fullWidth size="small">
            <InputLabel id="carrera-select-label">Profesorado (Carrera)</InputLabel>
            <Select
              labelId="carrera-select-label"
              label="Profesorado (Carrera)"
              value={profesoradoId}
              onChange={handleCarreraChange}
              disabled={carrerasQuery.isLoading}
            >
              {targetDni
                ? carrerasData?.carreras.map((carrera: TrayectoriaCarreraDetalleDTO) => (
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
        <Grid item xs={12} md={3}>
          <FormControl
            fullWidth
            size="small"
            disabled={!planesDisponibles.length || (!isEstudiante && planesAdminQuery.isLoading)}
          >
            <InputLabel id="plan-select-label">Plan / Resolución</InputLabel>
            <Select
              labelId="plan-select-label"
              label="Plan / Resolución"
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
        <Grid item xs={12} md={5}>
          <Stack direction="row" spacing={1} justifyContent="flex-end">
            <Button
              variant="outlined"
              size="small"
              startIcon={<RefreshIcon />}
              onClick={handleRefresh}
              disabled={!profesoradoId || !planId || horarioFetching}
              sx={{ minWidth: "110px" }}
            >
              Actualizar
            </Button>
            <Button
              variant="contained"
              size="small"
              startIcon={<DownloadIcon />}
              onClick={handleDownloadPDF}
              disabled={!tablasFiltradas.length}
              sx={{ minWidth: "130px", bgcolor: "#a0522d", "&:hover": { bgcolor: "#8b4513" } }}
            >
              Descargar PDF
            </Button>

          </Stack>
        </Grid>
      </Grid>

      {/* Eliminamos el cuadro de texto manual de salón */}

      <Box sx={{ mt: 1, mb: 1.5, borderBottom: "1px solid", borderColor: "divider" }}>
        <Typography variant="overline" sx={{ fontWeight: "bold", color: "text.secondary" }}>
          Filtros de visualización
        </Typography>
      </Box>
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
          <FormControl fullWidth size="small">
            <InputLabel id="cuatr-select-label">Cuatrimestre</InputLabel>
            <Select
              labelId="cuatr-select-label"
              label="Cuatrimestre"
              value={cuatrFilter}
              onChange={(event) => setCuatrFilter(event.target.value)}
            >
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
        <Box ref={exportRef} sx={{ p: 1, bgcolor: "white" }}>
            {!cuatrFilter ? (
                <Box sx={{ p: 4, textAlign: "center", border: "2px dashed #ccc", borderRadius: 4, mt: 4 }}>
                    <Typography variant="h5" color="text.secondary" gutterBottom>
                        Debes seleccionar un Cuatrimestre
                    </Typography>
                    <Typography variant="body1" color="text.secondary">
                        Para generar el reporte institucional sin errores de solapamiento, por favor selecciona 
                        <b> 1.er Cuatrimestre</b> o <b>2.do Cuatrimestre</b> en los filtros de arriba.
                    </Typography>
                </Box>
            ) : sinCarreras ? (
                <Typography variant="body1" color="text.secondary" sx={{ mt: 4 }}>
                  No se encontraron profesorados asociados a tu usuario. Consulta con Secretaría para verificar tu inscripción.
                </Typography>
            ) : tablasFiltradas.length === 0 ? (
                <Typography variant="body1" color="text.secondary" sx={{ mt: 4 }}>
                  No se encontraron horarios para los filtros seleccionados.
                </Typography>
            ) : (
                <Stack spacing={4}>
                    {tablasFiltradas.map((tabla, idx) => {
                        const shorthand = cuatrFilter === "1C" ? "1º C" : (cuatrFilter === "2C" ? "2º C" : "");
                        return (
                            <Box key={idx} className="pdf-page-chunk" sx={{ p: 1, bgcolor: "white", width: "100%" }}>
                                <InstitutionalScheduleFormat 
                                    tabla={tabla} 
                                    salon={shorthand} 
                                    cuatrimestre={cuatrFilter || undefined} 
                                />
                            </Box>
                        );
                    })}
                </Stack>
            )}
        </Box>
      )}
    </Box>
  );
};

export default HorarioPage;
