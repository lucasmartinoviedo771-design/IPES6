import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import BackButton from "@/components/ui/BackButton";
import { isAxiosError } from "axios";
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Card,
  CardActionArea,
  CardContent,
  Checkbox,
  CircularProgress,
  FormControl,
  Grid,
  IconButton,
  InputAdornment,
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
import CloseIcon from "@mui/icons-material/Close";
import SearchIcon from "@mui/icons-material/Search";
import { enqueueSnackbar } from "notistack";
import { useSearchParams, useNavigate } from "react-router-dom";
import {
  ActaOralDTO,
  ComisionOptionDTO,
  GuardarActaOralPayload,
  GuardarRegularidadPayload,
  MateriaOptionDTO,
  MesaResumenDTO,
  PlanDTO,
  ProfesoradoDTO,
  RegularidadPlanillaDTO,
  guardarActaOral,
  guardarPlanillaRegularidad,
  gestionarCierreRegularidad,
  listarMesasFinales,
  listarPlanes,
  listarProfesorados,
  listarActasOrales,
  obtenerActaOral,
  obtenerDatosCargaNotas,
  obtenerPlanillaRegularidad,
} from "@/api/cargaNotas";
import { fetchVentanas, VentanaDto } from "@/api/ventanas";
import {
  actualizarMesaPlanilla,
  gestionarMesaPlanillaCierre,
  MesaPlanillaAlumnoDTO,
  MesaPlanillaCondicionDTO,
  MesaPlanillaDTO,
  obtenerMesaPlanilla,
} from "@/api/alumnos";
import RegularidadPlanillaEditor from "@/components/secretaria/RegularidadPlanillaEditor";
import ActaExamenForm from "@/components/secretaria/ActaExamenForm";
import OralExamActaDialog, { OralActFormValues, OralActFormTopic } from "@/components/secretaria/OralExamActaDialog";
import { PageHero } from "@/components/ui/GradientTitles";
import FinalConfirmationDialog from "@/components/ui/FinalConfirmationDialog";
import { OralTopicScore, generarActaExamenOralPDF } from "@/utils/actaOralPdf";

type FiltersState = {
  profesoradoId: number | null;
  planId: number | null;
  anio: number | null;
  cuatrimestre: string | null;
  materiaId: number | null;
  comisionId: number | null;
};

type FinalFiltersState = {
  ventanaId: string;
  tipo: "FIN" | "EXT" | "ESP" | "";
  modalidad: "REG" | "LIB" | "";
  profesoradoId: number | null;
  planId: number | null;
  materiaId: number | null;
  anio: number | null;
  cuatrimestre: string | null;
};

type FinalRowState = {
  inscripcionId: number;
  alumnoId: number;
  apellidoNombre: string;
  dni: string;
  condicion: string | null;
  nota: string;
  fechaResultado: string;
  cuentaParaIntentos: boolean;
  folio: string;
  libro: string;
  observaciones: string;
};

type FinalPlanillaPayload = {
  alumnos: {
    inscripcion_id: number;
    fecha_resultado: string | null;
    condicion: string | null;
    nota: number | null;
    folio: string | null;
    libro: string | null;
    observaciones: string | null;
    cuenta_para_intentos: boolean;
  }[];
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
    materiaId: null,
  comisionId: null,
});

  const [profesorados, setProfesorados] = useState<ProfesoradoDTO[]>([]);
  const [planes, setPlanes] = useState<PlanDTO[]>([]);
  const [materias, setMaterias] = useState<MateriaOptionDTO[]>([]);
  const [allComisiones, setAllComisiones] = useState<ComisionOptionDTO[]>([]);
  const [planilla, setPlanilla] = useState<RegularidadPlanillaDTO | null>(null);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const scope = searchParams.get("scope");
  const isFinalsMode = scope === "finales";

  const [loadingProfesorados, setLoadingProfesorados] = useState(false);
  const [loadingPlanes, setLoadingPlanes] = useState(false);
  const [loadingComisiones, setLoadingComisiones] = useState(false);
  const [loadingPlanilla, setLoadingPlanilla] = useState(false);
  const [saving, setSaving] = useState(false);
  const [regularidadConfirmOpen, setRegularidadConfirmOpen] = useState(false);
  const [regularidadPendingPayload, setRegularidadPendingPayload] = useState<GuardarRegularidadPayload | null>(null);
  const [regularidadCierreLoading, setRegularidadCierreLoading] = useState(false);
  const [defaultFechaCierre, setDefaultFechaCierre] = useState<string>(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [defaultObservaciones, setDefaultObservaciones] = useState<string>(""); 

const [finalFilters, setFinalFilters] = useState<FinalFiltersState>({
  ventanaId: "",
  tipo: "FIN",
  modalidad: "REG",
  profesoradoId: null,
  planId: null,
  materiaId: null,
  anio: null,
  cuatrimestre: null,
});
const [ventanasFinales, setVentanasFinales] = useState<VentanaDto[]>([]);
const [finalPlanes, setFinalPlanes] = useState<PlanDTO[]>([]);
const [finalMaterias, setFinalMaterias] = useState<MateriaOptionDTO[]>([]);
const [finalMesas, setFinalMesas] = useState<MesaResumenDTO[]>([]);
const [finalSelectedMesaId, setFinalSelectedMesaId] = useState<number | null>(null);
const [finalPlanilla, setFinalPlanilla] = useState<MesaPlanillaDTO | null>(null);
const [finalCondiciones, setFinalCondiciones] = useState<MesaPlanillaCondicionDTO[]>([]);
const [finalRows, setFinalRows] = useState<FinalRowState[]>([]);
const [finalSearch, setFinalSearch] = useState<string>("");
const [finalLoadingMesas, setFinalLoadingMesas] = useState(false);
const [finalLoadingPlanilla, setFinalLoadingPlanilla] = useState(false);
const [finalSaving, setFinalSaving] = useState(false);
const [finalError, setFinalError] = useState<string | null>(null);
const [finalSuccess, setFinalSuccess] = useState<string | null>(null);
const [finalPermissionDenied, setFinalPermissionDenied] = useState(false);
const [loadingFinalPlanes, setLoadingFinalPlanes] = useState(false);
const [loadingFinalMaterias, setLoadingFinalMaterias] = useState(false);
const [finalConfirmOpen, setFinalConfirmOpen] = useState(false);
const [finalPendingPayload, setFinalPendingPayload] = useState<{ mesaId: number; payload: FinalPlanillaPayload } | null>(null);
const [finalCierreLoading, setFinalCierreLoading] = useState(false);
const [oralActDrafts, setOralActDrafts] = useState<Record<number, OralActFormValues>>({});
const [oralDialogRow, setOralDialogRow] = useState<FinalRowState | null>(null);
const [oralActaLoading, setOralActaLoading] = useState(false);
const [oralActaSaving, setOralActaSaving] = useState(false);
const [downloadingOralBatch, setDownloadingOralBatch] = useState(false);

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
    const loadVentanasFinales = async () => {
      try {
        const data = await fetchVentanas();
        const filtered = (data || []).filter((ventana) =>
          ["MESAS_FINALES", "MESAS_EXTRA"].includes(ventana.tipo)
        );
        setVentanasFinales(filtered);
        setFinalFilters((prev) => {
          if (prev.ventanaId || !filtered.length) {
            return prev;
          }
          return { ...prev, ventanaId: String(filtered[0].id) };
        });
      } catch (error) {
        enqueueSnackbar("No se pudieron obtener las ventanas de mesas.", { variant: "error" });
      }
    };
    loadVentanasFinales();
  }, []);

  useEffect(() => {
    const profesoradoId = filters.profesoradoId;
    if (!profesoradoId) {
      setPlanes([]);
      setFilters((prev) => ({ ...prev, planId: null, materiaId: null, comisionId: null, anio: null, cuatrimestre: null }));
      return;
    }
    const loadPlanes = async () => {
      setLoadingPlanes(true);
      try {
        const data = await listarPlanes(profesoradoId);
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
    if (!isFinalsMode) {
      return;
    }
    const planId = finalFilters.planId;
    if (!planId) {
      setFinalMaterias([]);
      setFinalFilters((prev) => ({
        ...prev,
        materiaId: null,
        anio: null,
        cuatrimestre: null,
      }));
      return;
    }
    const loadFinalMaterias = async () => {
      setLoadingFinalMaterias(true);
      try {
        const data = await obtenerDatosCargaNotas({
          plan_id: planId,
        });
        setFinalMaterias(data.materias);
      } catch (error) {
        enqueueSnackbar("No se pudieron obtener las materias del plan seleccionado.", { variant: "error" });
        setFinalMaterias([]);
      } finally {
        setLoadingFinalMaterias(false);
      }
    };
    loadFinalMaterias();
  }, [isFinalsMode, finalFilters.planId]);

  useEffect(() => {
    if (!isFinalsMode) {
      return;
    }

    const params: Record<string, unknown> = {};
    if (finalFilters.ventanaId) params.ventana_id = Number(finalFilters.ventanaId);
    if (finalFilters.tipo) params.tipo = finalFilters.tipo;
    if (finalFilters.modalidad) params.modalidad = finalFilters.modalidad;
    if (finalFilters.profesoradoId) params.profesorado_id = finalFilters.profesoradoId;
    if (finalFilters.planId) params.plan_id = finalFilters.planId;
    if (finalFilters.anio) params.anio = finalFilters.anio;
    if (finalFilters.cuatrimestre) params.cuatrimestre = finalFilters.cuatrimestre;
    if (finalFilters.materiaId) params.materia_id = finalFilters.materiaId;

    const loadMesas = async () => {
      setFinalLoadingMesas(true);
      try {
        const data = await listarMesasFinales(params);
        setFinalMesas(data);
        setFinalSelectedMesaId((prev) => {
          if (!prev) {
            return prev;
          }
          return data.some((mesa) => mesa.id === prev) ? prev : null;
        });
        setFinalPlanilla(null);
        setFinalCondiciones([]);
        setFinalRows([]);
      } catch (error) {
        setFinalMesas([]);
        enqueueSnackbar("No se pudieron obtener las mesas de examen.", { variant: "error" });
      } finally {
        setFinalLoadingMesas(false);
      }
    };

    loadMesas();
  }, [
    isFinalsMode,
    finalFilters.anio,
    finalFilters.cuatrimestre,
    finalFilters.modalidad,
    finalFilters.materiaId,
    finalFilters.planId,
    finalFilters.profesoradoId,
    finalFilters.tipo,
    finalFilters.ventanaId,
  ]);

  const mapAlumnoToFinalRow = (alumno: MesaPlanillaAlumnoDTO): FinalRowState => ({
    inscripcionId: alumno.inscripcion_id,
    alumnoId: alumno.alumno_id,
    apellidoNombre: alumno.apellido_nombre,
    dni: alumno.dni,
    condicion: alumno.condicion ?? null,
    nota: alumno.nota !== null && alumno.nota !== undefined ? String(alumno.nota) : "",
    fechaResultado: alumno.fecha_resultado ? alumno.fecha_resultado.slice(0, 10) : "",
    cuentaParaIntentos: Boolean(alumno.cuenta_para_intentos),
    folio: alumno.folio ?? "",
    libro: alumno.libro ?? "",
    observaciones: alumno.observaciones ?? "",
  });

  const fetchFinalPlanilla = useCallback(
    async (mesaId: number) => {
      setFinalLoadingPlanilla(true);
      setFinalError(null);
      setFinalSuccess(null);
      setFinalPermissionDenied(false);
      try {
        const data = await obtenerMesaPlanilla(mesaId);
        setFinalPlanilla(data);
        setFinalCondiciones(data.condiciones);
        setFinalRows(data.alumnos.map((alumno) => mapAlumnoToFinalRow(alumno)));
        setFinalSearch("");
        setFinalPermissionDenied(false);
      } catch (error) {
        setFinalPlanilla(null);
        setFinalCondiciones([]);
        setFinalRows([]);
        if (isAxiosError(error) && error.response?.status === 403) {
          const message =
            "Solo los docentes que integran el tribunal o el personal autorizado pueden cargar las notas de esta mesa.";
          setFinalError(message);
          setFinalPermissionDenied(true);
          enqueueSnackbar(message, { variant: "warning" });
        } else {
          setFinalPermissionDenied(false);
          setFinalError("No se pudo cargar la planilla de la mesa seleccionada.");
        }
      } finally {
        setFinalLoadingPlanilla(false);
      }
    },
    [enqueueSnackbar]
  );

  useEffect(() => {
    if (!isFinalsMode || !finalSelectedMesaId) {
      return;
    }
    fetchFinalPlanilla(finalSelectedMesaId);
  }, [isFinalsMode, finalSelectedMesaId, fetchFinalPlanilla]);

  useEffect(() => {
    if (!isFinalsMode) {
      return;
    }
    const profesoradoId = finalFilters.profesoradoId;
    if (!profesoradoId) {
      setFinalPlanes([]);
      setFinalFilters((prev) => ({
        ...prev,
        planId: null,
        materiaId: null,
        anio: null,
        cuatrimestre: null,
      }));
      return;
    }
    const loadFinalPlanes = async () => {
      setLoadingFinalPlanes(true);
      try {
        const data = await listarPlanes(profesoradoId);
        setFinalPlanes(data);
      } catch (error) {
        enqueueSnackbar("No se pudieron obtener los planes para el profesorado seleccionado.", { variant: "error" });
        setFinalPlanes([]);
      } finally {
        setLoadingFinalPlanes(false);
      }
    };
    loadFinalPlanes();
  }, [isFinalsMode, finalFilters.profesoradoId]);

const selectedMesaResumen = useMemo(() => {
  if (!finalSelectedMesaId) return null;
  return finalMesas.find((mesa) => mesa.id === finalSelectedMesaId) ?? null;
}, [finalSelectedMesaId, finalMesas]);

const finalReadOnly = finalPermissionDenied || (finalPlanilla ? !finalPlanilla.puede_editar : false);

  const selectedMesaCursoLabel = useMemo(() => {
    if (!selectedMesaResumen) return "";
    const parts: string[] = [];
    if (selectedMesaResumen.anio_cursada) {
      parts.push(`A\u00f1o ${selectedMesaResumen.anio_cursada}`);
    }
    if (selectedMesaResumen.regimen) {
      parts.push(selectedMesaResumen.regimen);
    }
    if (selectedMesaResumen.modalidad) {
      parts.push(selectedMesaResumen.modalidad === "LIB" ? "Libre" : "Regular");
    }
    return parts.join(" \u00b7 ");
  }, [selectedMesaResumen]);

  useEffect(() => {
    setOralActDrafts({});
    setOralDialogRow(null);
  }, [finalSelectedMesaId]);

  const tribunalInfo = useMemo(() => {
    const docentes = selectedMesaResumen?.docentes ?? [];
    const findDoc = (rol: "PRES" | "VOC1" | "VOC2") =>
      docentes.find((item) => item.rol === rol)?.nombre || null;
    return {
      presidente: findDoc("PRES"),
      vocal1: findDoc("VOC1"),
      vocal2: findDoc("VOC2"),
    };
  }, [selectedMesaResumen]);

  useEffect(() => {
    const planId = filters.planId;
    if (!planId) {
      setMaterias([]);
      setAllComisiones([]);
      setFilters((prev) => ({ ...prev, materiaId: null, comisionId: null, anio: null, cuatrimestre: null }));
      return;
    }
    const loadDatos = async () => {
      setLoadingComisiones(true);
      try {
        const data = await obtenerDatosCargaNotas({
          plan_id: planId,
          anio: filters.anio ?? undefined,
        });
        setMaterias(data.materias);
        setAllComisiones(data.comisiones);
      } catch (error) {
        enqueueSnackbar("No se pudieron obtener los datos de comisiones.", { variant: "error" });
      } finally {
        setLoadingComisiones(false);
      }
    };
    loadDatos();
  }, [filters.planId, filters.anio]);

  const uniqueAnios = useMemo(() => {
    const set = new Set<number>();
    allComisiones.forEach((c) => {
      if (c.anio) {
        set.add(c.anio);
      }
    });
    return Array.from(set).sort((a, b) => b - a);
  }, [allComisiones]);

  const uniqueCuatrimestres = useMemo(() => {
    const set = new Set<string>();
    allComisiones.forEach((c) => {
      const clave = c.cuatrimestre ? c.cuatrimestre : "ANU";
      set.add(clave);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [allComisiones]);

  useEffect(() => {
    if (!filters.planId) return;
    if (!filters.anio && uniqueAnios.length === 1) {
      setFilters((prev) => ({
        ...prev,
        anio: uniqueAnios[0],
      }));
    }
  }, [filters.planId, filters.anio, uniqueAnios]);

  useEffect(() => {
    if (!filters.planId) return;
    if (!filters.cuatrimestre && uniqueCuatrimestres.length === 1) {
      setFilters((prev) => ({
        ...prev,
        cuatrimestre: uniqueCuatrimestres[0],
      }));
    }
  }, [filters.planId, filters.cuatrimestre, uniqueCuatrimestres]);

  const materiaOptions = useMemo(() => {
    let base = materias;
    if (filters.cuatrimestre) {
      base = base.filter((m) => {
        const clave = m.cuatrimestre ? m.cuatrimestre : "ANU";
        return clave === filters.cuatrimestre;
      });
    }
    return base;
  }, [materias, filters.anio, filters.cuatrimestre]);

  const filteredComisiones = useMemo(() => {
    let base = allComisiones;
    if (filters.materiaId) {
      base = base.filter((c) => c.materia_id === filters.materiaId);
    }
    if (filters.anio) {
      base = base.filter((c) => c.anio === filters.anio);
    }
    if (filters.cuatrimestre) {
      base = base.filter((c) => {
        const clave = c.cuatrimestre ? c.cuatrimestre : "ANU";
        return clave === filters.cuatrimestre;
      });
    }
    return base;
  }, [allComisiones, filters.materiaId, filters.anio, filters.cuatrimestre]);

  const finalAvailableAnios = useMemo(() => {
    const set = new Set<number>();
    finalMaterias.forEach((materia) => {
      if (typeof materia.anio === "number" && materia.anio !== null) {
        set.add(materia.anio);
      }
    });
    return Array.from(set).sort((a, b) => a - b);
  }, [finalMaterias]);

  const finalCuatrimestreOptions = useMemo(() => {
    const set = new Set<string>();
    finalMaterias.forEach((materia) => {
      if (materia.cuatrimestre) {
        set.add(materia.cuatrimestre);
      }
    });
    return Array.from(set)
      .sort((a, b) => a.localeCompare(b))
      .map((value) => ({
        value,
        label: cuatrimestreLabel[value] || value,
      }));
  }, [finalMaterias]);

  const finalMateriasFiltradas = useMemo(() => {
    let base = finalMaterias;
    if (finalFilters.anio) {
      base = base.filter((materia) => materia.anio === finalFilters.anio);
    }
    if (finalFilters.cuatrimestre) {
      base = base.filter((materia) => materia.cuatrimestre === finalFilters.cuatrimestre);
    }
    return base;
  }, [finalMaterias, finalFilters.anio, finalFilters.cuatrimestre]);

  useEffect(() => {
    if (!isFinalsMode) return;
    if (!finalFilters.planId) return;
    if (!finalFilters.anio && finalAvailableAnios.length === 1) {
      setFinalFilters((prev) => ({
        ...prev,
        anio: finalAvailableAnios[0],
      }));
    }
  }, [isFinalsMode, finalAvailableAnios, finalFilters.anio, finalFilters.planId]);

  useEffect(() => {
    if (!isFinalsMode) return;
    if (!finalFilters.planId) return;
    if (!finalFilters.cuatrimestre && finalCuatrimestreOptions.length === 1) {
      setFinalFilters((prev) => ({
        ...prev,
        cuatrimestre: finalCuatrimestreOptions[0]?.value ?? null,
      }));
    }
  }, [isFinalsMode, finalCuatrimestreOptions, finalFilters.cuatrimestre, finalFilters.planId]);

  const condicionFinalPorValor = useMemo(() => {
    const map = new Map<string, MesaPlanillaCondicionDTO>();
    finalCondiciones.forEach((condicion) => {
      map.set(condicion.value, condicion);
    });
    return map;
  }, [finalCondiciones]);

  const filteredFinalRows = useMemo(() => {
    const term = finalSearch.trim();
    if (!term) {
      return finalRows;
    }
    const normalizedTerm = term.toLowerCase();
    const numericTerm = term.replace(/\D/g, "");
    return finalRows.filter((row) => {
      const matchesNombre = row.apellidoNombre.toLowerCase().includes(normalizedTerm);
      const dniDigits = row.dni.replace(/\D/g, "");
      const matchesDni = numericTerm ? dniDigits.includes(numericTerm) : false;
      return matchesNombre || matchesDni;
    });
  }, [finalRows, finalSearch]);

  const hasFinalSearch = finalSearch.trim().length > 0;
  const totalFinalRows = finalRows.length;
  const visibleFinalRows = filteredFinalRows.length;

  useEffect(() => {
    if (!filters.materiaId) {
      if (filters.comisionId) {
        setFilters((prev) => ({ ...prev, comisionId: null }));
      }
      return;
    }

    const exists = materiaOptions.some((m) => m.id === filters.materiaId);
    if (!exists) {
      setFilters((prev) => ({ ...prev, materiaId: null, comisionId: null }));
    }
  }, [materiaOptions, filters.materiaId, filters.comisionId]);

  useEffect(() => {
    if (!filters.materiaId) {
      if (filters.comisionId) {
        setFilters((prev) => ({ ...prev, comisionId: null }));
      }
      return;
    }
    if (!filteredComisiones.length) {
      if (filters.comisionId) {
        setFilters((prev) => ({ ...prev, comisionId: null }));
      }
      return;
    }
    if (!filters.comisionId || !filteredComisiones.some((c) => c.id === filters.comisionId)) {
      setFilters((prev) => ({ ...prev, comisionId: filteredComisiones[0].id }));
    }
  }, [filteredComisiones, filters.materiaId, filters.comisionId]);

  const selectedComision = useMemo(
    () => filteredComisiones.find((c) => c.id === filters.comisionId) || null,
    [filteredComisiones, filters.comisionId]
  );
  const regularidadReadOnly = planilla ? !planilla.puede_editar : false;

  const fetchPlanilla = useCallback(
    async (comisionId: number) => {
      setLoadingPlanilla(true);
      try {
        const data = await obtenerPlanillaRegularidad(comisionId);
        setPlanilla(data);
        setDefaultFechaCierre(new Date().toISOString().slice(0, 10));
        setDefaultObservaciones("");
      } catch (error) {
        setPlanilla(null);
        enqueueSnackbar("No se pudo cargar la planilla de regularidad.", { variant: "error" });
      } finally {
        setLoadingPlanilla(false);
      }
    },
    [enqueueSnackbar]
  );

  useEffect(() => {
    if (!filters.comisionId) {
      setPlanilla(null);
      return;
    }
    fetchPlanilla(filters.comisionId);
  }, [filters.comisionId, fetchPlanilla]);

  const persistRegularidad = async (payload: GuardarRegularidadPayload) => {
    setSaving(true);
    try {
      await guardarPlanillaRegularidad(payload);
      enqueueSnackbar("Notas de regularidad guardadas correctamente.", { variant: "success" });
      setDefaultFechaCierre(payload.fecha_cierre ?? "");
      setDefaultObservaciones(payload.observaciones_generales ?? "");
      await fetchPlanilla(payload.comision_id);
    } catch (error: any) {
      const message =
        error?.response?.data?.message || "No se pudieron guardar las notas de regularidad.";
      enqueueSnackbar(message, { variant: "error" });
    } finally {
      setSaving(false);
    }
  };

  const handleGuardarRegularidad = async (payload: GuardarRegularidadPayload) => {
    setRegularidadPendingPayload(payload);
    setRegularidadConfirmOpen(true);
  };

  const confirmRegularidadSave = async () => {
    if (!regularidadPendingPayload) return;
    await persistRegularidad(regularidadPendingPayload);
    setRegularidadPendingPayload(null);
    setRegularidadConfirmOpen(false);
  };

  const handleRegularidadCierre = async (accion: "cerrar" | "reabrir") => {
    if (!selectedComision) return;
    setRegularidadCierreLoading(true);
    try {
      await gestionarCierreRegularidad(selectedComision.id, accion);
      enqueueSnackbar(
        accion === "cerrar" ? "Planilla cerrada correctamente." : "Planilla reabierta correctamente.",
        { variant: "success" }
      );
      await fetchPlanilla(selectedComision.id);
    } catch (error: any) {
      const message = error?.response?.data?.message || "No se pudo actualizar el estado de cierre.";
      enqueueSnackbar(message, { variant: "error" });
    } finally {
      setRegularidadCierreLoading(false);
    }
  };

  const cancelRegularidadConfirm = () => {
    if (saving) return;
    setRegularidadConfirmOpen(false);
    setRegularidadPendingPayload(null);
  };

  const handleFinalRowChange = (inscripcionId: number, patch: Partial<FinalRowState>) => {
    if (finalReadOnly) {
      return;
    }
    setFinalRows((prev) =>
      prev.map((row) => {
        if (row.inscripcionId !== inscripcionId) {
          return row;
        }
        const next: FinalRowState = { ...row, ...patch };
        if (patch.condicion !== undefined) {
          const condicion = patch.condicion;
          if (!condicion) {
            next.cuentaParaIntentos = false;
          } else {
            const info = condicionFinalPorValor.get(condicion);
            if (info) {
              next.cuentaParaIntentos = info.cuenta_para_intentos;
            }
          }
        }
        return next;
      })
    );
  };

  const handleOpenFinalPlanilla = (mesaId: number) => {
    if (finalSelectedMesaId === mesaId) {
      // Forzar refresco manual si ya está seleccionada.
      setFinalSelectedMesaId(null);
      setTimeout(() => setFinalSelectedMesaId(mesaId), 0);
    } else {
      setFinalSelectedMesaId(mesaId);
    }
  };

  const handleOpenOralActa = async (row: FinalRowState) => {
    if (finalReadOnly) {
      enqueueSnackbar(
        "Solo los docentes del tribunal pueden gestionar las actas orales de esta mesa.",
        { variant: "warning" },
      );
      return;
    }
    if (!finalSelectedMesaId) {
      enqueueSnackbar("Selecciona una mesa para generar el acta oral.", { variant: "warning" });
      return;
    }
    setOralDialogRow(row);
    if (oralActDrafts[row.inscripcionId]) {
      return;
    }
    setOralActaLoading(true);
    try {
      const data = await obtenerActaOral(finalSelectedMesaId, row.inscripcionId);
      setOralActDrafts((prev) => ({
        ...prev,
        [row.inscripcionId]: mapActaOralDtoToFormValues(data),
      }));
    } catch (error) {
      if (!isAxiosError(error) || error.response?.status !== 404) {
        enqueueSnackbar("No se pudo cargar el acta oral.", { variant: "error" });
      }
    } finally {
      setOralActaLoading(false);
    }
  };

  const handleCloseOralActa = () => {
    setOralDialogRow(null);
  };

  const handleSaveOralActa = async (values: OralActFormValues) => {
    if (!oralDialogRow || !finalSelectedMesaId) {
      enqueueSnackbar("Selecciona una mesa para registrar el acta oral.", { variant: "warning" });
      throw new Error("Mesa no seleccionada");
    }
    if (finalReadOnly) {
      enqueueSnackbar(
        "Solo los docentes del tribunal pueden registrar actas orales para esta mesa.",
        { variant: "warning" },
      );
      throw new Error("Sin permisos");
    }
    setOralActaSaving(true);
    try {
      await guardarActaOral(
        finalSelectedMesaId,
        oralDialogRow.inscripcionId,
        mapFormValuesToOralPayload(values),
      );
      setOralActDrafts((prev) => ({
        ...prev,
        [oralDialogRow.inscripcionId]: values,
      }));
      enqueueSnackbar("Acta oral guardada correctamente.", { variant: "success" });
    } catch (error) {
      enqueueSnackbar("No se pudo guardar el acta oral.", { variant: "error" });
      throw error;
    } finally {
      setOralActaSaving(false);
    }
  };

  const handleDownloadAllOralActas = async () => {
    if (finalReadOnly) {
      enqueueSnackbar(
        "Solo los docentes del tribunal pueden descargar las actas orales de esta mesa.",
        { variant: "warning" },
      );
      return;
    }
    if (!finalSelectedMesaId) {
      enqueueSnackbar("Selecciona una mesa para descargar las actas orales.", { variant: "warning" });
      return;
    }
    setDownloadingOralBatch(true);
    try {
      const actas = await listarActasOrales(finalSelectedMesaId);
      if (!actas.length) {
        enqueueSnackbar("No hay actas orales registradas para esta mesa.", { variant: "info" });
        return;
      }
      const carrera = selectedMesaResumen?.profesorado_nombre ?? "";
      const unidadCurricular = finalPlanilla?.materia_nombre ?? selectedMesaResumen?.materia_nombre ?? "";
      const cursoLabel = selectedMesaCursoLabel;
      actas.forEach((acta) => {
        const temasAlumno = (acta.temas_alumno ?? []).map((item) => ({
          tema: item.tema,
          score: (item.score as OralTopicScore | undefined) || undefined,
        }));
        const temasDocente = (acta.temas_docente ?? []).map((item) => ({
          tema: item.tema,
          score: (item.score as OralTopicScore | undefined) || undefined,
        }));
        generarActaExamenOralPDF({
          actaNumero: acta.acta_numero ?? undefined,
          folioNumero: acta.folio_numero ?? undefined,
          fecha: acta.fecha ?? undefined,
          carrera,
          unidadCurricular,
          curso: acta.curso || cursoLabel,
          alumno: `${acta.alumno} - DNI ${acta.dni}`,
          tribunal: tribunalInfo,
          temasElegidosAlumno: temasAlumno,
          temasSugeridosDocente: temasDocente,
          notaFinal: acta.nota_final ?? undefined,
          observaciones: acta.observaciones ?? undefined,
        });
      });
      enqueueSnackbar("Actas orales descargadas.", { variant: "success" });
    } catch (error) {
      enqueueSnackbar("No se pudieron descargar las actas orales.", { variant: "error" });
    } finally {
      setDownloadingOralBatch(false);
    }
  };

  const buildFinalPlanillaPayload = (): { mesaId: number; payload: FinalPlanillaPayload } | null => {
    if (!finalSelectedMesaId) {
      enqueueSnackbar("Selecciona una mesa para guardar las notas de finales.", { variant: "warning" });
      return null;
    }
    if (!finalRows.length) {
      enqueueSnackbar("No hay inscripciones para guardar.", { variant: "warning" });
      return null;
    }

    for (const row of finalRows) {
      if (!row.condicion) {
        enqueueSnackbar(`Falta seleccionar la condición de ${row.apellidoNombre}.`, { variant: "warning" });
        return null;
      }
      if (row.nota.trim() !== "") {
        const notaParse = Number.parseFloat(row.nota.replace(",", "."));
        if (Number.isNaN(notaParse)) {
          enqueueSnackbar(`La nota de ${row.apellidoNombre} no es válida.`, { variant: "warning" });
          return null;
        }
      }
    }

    const payload: FinalPlanillaPayload = {
      alumnos: finalRows.map((row) => {
        const notaValor =
          row.nota.trim() === "" ? null : Number.parseFloat(row.nota.replace(",", "."));
        return {
          inscripcion_id: row.inscripcionId,
          fecha_resultado: row.fechaResultado || null,
          condicion: row.condicion || null,
          nota: notaValor,
          folio: row.folio.trim() === "" ? null : row.folio.trim(),
          libro: row.libro.trim() === "" ? null : row.libro.trim(),
          observaciones: row.observaciones.trim() === "" ? null : row.observaciones.trim(),
          cuenta_para_intentos: row.cuentaParaIntentos,
        };
      }),
    };

    return { mesaId: finalSelectedMesaId, payload };
  };

  const handleFinalSaveClick = () => {
    if (finalPermissionDenied) {
      enqueueSnackbar(
        "Solo los docentes del tribunal o el personal autorizado pueden guardar la planilla de esta mesa.",
        { variant: "warning" },
      );
      return;
    }
    const pending = buildFinalPlanillaPayload();
    if (!pending) {
      return;
    }
    setFinalPendingPayload(pending);
    setFinalConfirmOpen(true);
  };

  const executeGuardarFinalPlanilla = async () => {
    if (!finalPendingPayload) return;
    const { mesaId, payload } = finalPendingPayload;

    setFinalSaving(true);
    setFinalError(null);
    setFinalSuccess(null);
    try {
      await actualizarMesaPlanilla(mesaId, payload);
      enqueueSnackbar("Planilla de finales guardada correctamente.", { variant: "success" });
      setFinalSuccess("Planilla guardada correctamente.");
      const refreshed = await obtenerMesaPlanilla(mesaId);
      if (mesaId === finalSelectedMesaId) {
        setFinalPlanilla(refreshed);
        setFinalCondiciones(refreshed.condiciones);
        setFinalRows(refreshed.alumnos.map((alumno) => mapAlumnoToFinalRow(alumno)));
        setFinalPermissionDenied(false);
      }
    } catch (error) {
      if (isAxiosError(error) && error.response?.status === 403) {
        const message =
          "Solo los docentes que integran el tribunal o el personal autorizado pueden guardar la planilla de esta mesa.";
        setFinalError(message);
        setFinalPermissionDenied(true);
        enqueueSnackbar(message, { variant: "warning" });
      } else {
        setFinalPermissionDenied(false);
        setFinalError("No se pudieron guardar las notas de la mesa seleccionada.");
        enqueueSnackbar("No se pudieron guardar las notas de la mesa.", { variant: "error" });
      }
    } finally {
      setFinalSaving(false);
      setFinalConfirmOpen(false);
      setFinalPendingPayload(null);
    }
  };

  const cancelFinalConfirm = () => {
    if (finalSaving) return;
    setFinalConfirmOpen(false);
    setFinalPendingPayload(null);
  };

  const handleFinalPlanillaCierre = async (accion: "cerrar" | "reabrir") => {
    if (!finalSelectedMesaId) return;
    setFinalCierreLoading(true);
    try {
      await gestionarMesaPlanillaCierre(finalSelectedMesaId, accion);
      enqueueSnackbar(
        accion === "cerrar" ? "Planilla cerrada correctamente." : "Planilla reabierta correctamente.",
        { variant: "success" }
      );
      await fetchFinalPlanilla(finalSelectedMesaId);
    } catch (error: any) {
      const message =
        error?.response?.data?.message || "No se pudo actualizar el estado de cierre de la planilla.";
      enqueueSnackbar(message, { variant: "error" });
    } finally {
      setFinalCierreLoading(false);
    }
  };


  return (
    <Box sx={{ p: { xs: 2, md: 3 }, bgcolor: "#f5f5f5", minHeight: "100vh" }}>
      <BackButton fallbackPath="/secretaria" sx={{ mb: 2 }} />
      <Stack gap={3}>
      <PageHero
        title={isFinalsMode ? "Actas de Examen Final" : "Planilla de Regularidad"}
        subtitle={
          isFinalsMode
            ? "Gestioná las mesas de examen, inscribí alumnos y cargá las notas finales."
            : "Gestioná la planilla de regularidad y promoción de las comisiones."
        }
      />

      {!isFinalsMode && (
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
                        materiaId: null,
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
                        materiaId: null,
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
                    <InputLabel id="anio-select">Año lectivo</InputLabel>
                    <Select
                      labelId="anio-select"
                      label="Año lectivo"
                      value={filters.anio ?? ""}
                      onChange={(event) =>
                        setFilters((prev) => ({
                          ...prev,
                          anio: event.target.value ? Number(event.target.value) : null,
                          materiaId: null,
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
                          materiaId: null,
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
                    options={materiaOptions}
                    loading={loadingComisiones}
                    getOptionLabel={(option) => {
                      const etiquetaCuatrimestre = option.cuatrimestre ? cuatrimestreLabel[option.cuatrimestre] ?? option.cuatrimestre : "Anual";
                      return `${option.anio ?? "-"} - ${option.nombre} (${etiquetaCuatrimestre})`;
                    }}
                    value={materiaOptions.find((m) => m.id === filters.materiaId) ?? null}
                    onChange={(_, value) =>
                      setFilters((prev) => ({
                        ...prev,
                        materiaId: value?.id ?? null,
                        comisionId: null,
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

          {filters.planId && filters.materiaId && (
            <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 } }}>
              <Stack spacing={2}>
                <Typography variant="subtitle1" fontWeight={700}>
                  Comisiones disponibles
                </Typography>
                {!filteredComisiones.length ? (
                  <Alert severity="info">
                    No encontramos comisiones para la selección realizada.
                  </Alert>
                ) : (
                  <Grid container spacing={2}>
                    {filteredComisiones.map((com) => {
                      const cuatri = com.cuatrimestre ?? "ANU";
                      const isSelected = selectedComision?.id === com.id;
                      return (
                        <Grid item xs={12} md={6} lg={4} key={com.id}>
                          <Card
                            variant="outlined"
                            sx={{
                              height: "100%",
                              borderColor: isSelected ? "primary.main" : "divider",
                              boxShadow: isSelected ? "0 0 0 2px rgba(25,118,210,0.15)" : "none",
                              transition: "border-color .15s ease, box-shadow .15s ease",
                            }}
                          >
                            <CardActionArea
                              onClick={() =>
                                setFilters((prev) => ({
                                  ...prev,
                                  comisionId: com.id,
                                }))
                              }
                              sx={{ height: "100%" }}
                            >
                              <CardContent>
                                <Stack spacing={0.5}>
                                  <Typography variant="subtitle2" fontWeight={700}>
                                    Comisión {com.codigo}
                                  </Typography>
                                  <Typography variant="body2" color="text.secondary">
                                    {com.materia_nombre}
                                  </Typography>
                                  <Typography variant="body2" color="text.secondary">
                                    Año {com.anio ?? "-"} · {cuatrimestreLabel[cuatri] ?? cuatri}
                                  </Typography>
                                  <Typography variant="body2" color="text.secondary">
                                    Turno {com.turno || "Sin turno"}
                                  </Typography>
                                </Stack>
                              </CardContent>
                            </CardActionArea>
                          </Card>
                        </Grid>
                      );
                    })}
                  </Grid>
                )}
              </Stack>
            </Paper>
          )}

          {selectedComision ? (
            loadingPlanilla ? (
              <Paper
                variant="outlined"
                sx={{
                  p: 6,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <CircularProgress />
              </Paper>
            ) : planilla ? (
              <Stack spacing={2}>
                {planilla.esta_cerrada ? (
                  <Alert severity={planilla.puede_editar ? "info" : "warning"}>
                    Planilla cerrada el{" "}
                    {planilla.cerrada_en ? new Date(planilla.cerrada_en).toLocaleString("es-AR") : "fecha desconocida"}
                    {planilla.cerrada_por ? ` por ${planilla.cerrada_por}` : ""}.
                    {!planilla.puede_editar && " Solo secretaría o admin pueden editarla o reabrirla."}
                  </Alert>
                ) : (
                  <Alert severity="info">
                    Cuando finalices la carga, cerrá la planilla para bloquear nuevas ediciones.
                  </Alert>
                )}
                <RegularidadPlanillaEditor
                  comisionId={selectedComision.id}
                  planilla={planilla}
                  situaciones={planilla.situaciones}
                  defaultFechaCierre={defaultFechaCierre}
                  defaultObservaciones={defaultObservaciones}
                  saving={saving}
                  onSave={handleGuardarRegularidad}
                  readOnly={regularidadReadOnly}
                />
                <Box display="flex" justifyContent="flex-end" gap={1} flexWrap="wrap">
                  {planilla.puede_cerrar && (
                    <Button
                      variant="outlined"
                      color="warning"
                      onClick={() => handleRegularidadCierre("cerrar")}
                      disabled={regularidadCierreLoading}
                    >
                      {regularidadCierreLoading ? "Cerrando..." : "Cerrar planilla"}
                    </Button>
                  )}
                  {planilla.puede_reabrir && (
                    <Button
                      variant="contained"
                      onClick={() => handleRegularidadCierre("reabrir")}
                      disabled={regularidadCierreLoading}
                    >
                      {regularidadCierreLoading ? "Actualizando..." : "Reabrir planilla"}
                    </Button>
                  )}
                </Box>
              </Stack>
            ) : (
              <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 } }}>
                <Typography color="text.secondary">
                  No pudimos obtener la planilla de regularidad para la comisión seleccionada.
                </Typography>
              </Paper>
            )
          ) : filters.materiaId ? (
            <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 } }}>
              <Typography color="text.secondary">
                Seleccioná una comisión para continuar con la carga de notas.
              </Typography>
            </Paper>
          ) : null}
        </>
      )}

      {isFinalsMode && (
        <Stack gap={3}>
          <Paper sx={{ p: 3 }}>
            <Stack gap={3}>
              <Box>
                <Typography variant="subtitle1" fontWeight={700}>
                  Exámenes finales (planilla de mesa)
                </Typography>
                <Typography color="text.secondary">
                  Gestioná las planillas de actas y notas de las mesas finales habilitadas.
                </Typography>
              </Box>

              <Stack direction={{ xs: "column", md: "row" }} gap={2} sx={{ flexWrap: "wrap" }}>
                <TextField
                  select
                  label="Periodo"
                  size="small"
                  sx={{ minWidth: 220 }}
                  value={finalFilters.ventanaId}
                  onChange={(event) =>
                    setFinalFilters((prev) => ({ ...prev, ventanaId: event.target.value }))
                  }
                >
                  <MenuItem value="">Todos</MenuItem>
                  {ventanasFinales.map((ventana) => (
                    <MenuItem key={ventana.id} value={String(ventana.id)}>
                      {new Date(ventana.desde).toLocaleDateString()} - {new Date(ventana.hasta).toLocaleDateString()} ({ventana.tipo.replace("MESAS_", "")})
                    </MenuItem>
                  ))}
                </TextField>
                <TextField
                  select
                  label="Tipo"
                  size="small"
                  sx={{ minWidth: 160 }}
                  value={finalFilters.tipo ?? ""}
                  onChange={(event) =>
                    setFinalFilters((prev) => ({ ...prev, tipo: event.target.value as FinalFiltersState["tipo"] }))
                  }
                >
                  <MenuItem value="">Todos</MenuItem>
                  <MenuItem value="FIN">Ordinaria</MenuItem>
                  <MenuItem value="EXT">Extraordinaria</MenuItem>
                  <MenuItem value="ESP">Especial</MenuItem>
                </TextField>
                <TextField
                  select
                  label="Modalidad"
                  size="small"
                  sx={{ minWidth: 180 }}
                  value={finalFilters.modalidad ?? ""}
                  onChange={(event) =>
                    setFinalFilters((prev) => ({
                      ...prev,
                      modalidad: event.target.value as FinalFiltersState["modalidad"],
                    }))
                  }
                >
                  <MenuItem value="">Todas</MenuItem>
                  <MenuItem value="REG">Regulares</MenuItem>
                  <MenuItem value="LIB">Libres</MenuItem>
                </TextField>
                <TextField
                  select
                  label="Profesorado"
                  size="small"
                  sx={{ minWidth: 220 }}
                  value={finalFilters.profesoradoId ?? ""}
                  onChange={(event) => {
                    const value = event.target.value === "" ? null : Number(event.target.value);
                    setFinalFilters((prev) => ({
                      ...prev,
                      profesoradoId: value,
                      planId: null,
                      materiaId: null,
                      anio: null,
                      cuatrimestre: null,
                    }));
                  }}
                >
                  <MenuItem value="">Todos</MenuItem>
                  {profesorados.map((profesorado) => (
                    <MenuItem key={profesorado.id} value={String(profesorado.id)}>
                      {profesorado.nombre}
                    </MenuItem>
                  ))}
                </TextField>
                <TextField
                  select
                  label="Plan de estudio"
                  size="small"
                  sx={{ minWidth: 220 }}
                  value={finalFilters.planId ?? ""}
                  onChange={(event) => {
                    const value = event.target.value === "" ? null : Number(event.target.value);
                    setFinalFilters((prev) => ({
                      ...prev,
                      planId: value,
                      materiaId: null,
                      anio: null,
                      cuatrimestre: null,
                    }));
                  }}
                  disabled={!finalFilters.profesoradoId}
                  InputProps={{
                    endAdornment: loadingFinalPlanes ? <CircularProgress size={18} /> : undefined,
                  }}
                >
                  <MenuItem value="">Todos</MenuItem>
                  {finalPlanes.map((plan) => (
                    <MenuItem key={plan.id} value={String(plan.id)}>
                      {plan.resolucion}
                    </MenuItem>
                  ))}
                </TextField>
              </Stack>

              <Stack direction={{ xs: "column", md: "row" }} gap={2} sx={{ flexWrap: "wrap" }}>
                <TextField
                  select
                  label="Año cursada"
                  size="small"
                  sx={{ minWidth: 160 }}
                  value={finalFilters.anio ?? ""}
                  onChange={(event) => {
                    const value = event.target.value === "" ? null : Number(event.target.value);
                    setFinalFilters((prev) => ({
                      ...prev,
                      anio: value,
                      materiaId: null,
                    }));
                  }}
                  disabled={!finalFilters.planId}
                >
                  <MenuItem value="">Todos</MenuItem>
                  {finalAvailableAnios.map((anio) => (
                    <MenuItem key={anio} value={anio}>
                      {anio}
                    </MenuItem>
                  ))}
                </TextField>
                <TextField
                  select
                  label="Cuatrimestre"
                  size="small"
                  sx={{ minWidth: 180 }}
                  value={finalFilters.cuatrimestre ?? ""}
                  onChange={(event) =>
                    setFinalFilters((prev) => ({
                      ...prev,
                      cuatrimestre: event.target.value === "" ? null : (event.target.value as string),
                      materiaId: null,
                    }))
                  }
                  disabled={!finalFilters.planId}
                >
                  <MenuItem value="">Todos</MenuItem>
                  {finalCuatrimestreOptions.map((option) => (
                    <MenuItem key={option.value} value={option.value}>
                      {option.label}
                    </MenuItem>
                  ))}
                </TextField>
                <TextField
                  select
                  label="Materia"
                  size="small"
                  sx={{ minWidth: 240 }}
                  value={finalFilters.materiaId ?? ""}
                  onChange={(event) =>
                    setFinalFilters((prev) => ({
                      ...prev,
                      materiaId: event.target.value === "" ? null : Number(event.target.value),
                    }))
                  }
                  disabled={!finalFilters.planId}
                  InputProps={{
                    endAdornment: loadingFinalMaterias ? <CircularProgress size={18} /> : undefined,
                  }}
                >
                  <MenuItem value="">Todas</MenuItem>
                  {finalMateriasFiltradas.map((materia) => (
                    <MenuItem key={materia.id} value={materia.id}>
                      {materia.nombre}
                    </MenuItem>
                  ))}
                </TextField>
              </Stack>

              {finalError && (
                <Alert severity="error" onClose={() => setFinalError(null)}>
                  {finalError}
                </Alert>
              )}
              {finalSuccess && (
                <Alert severity="success" onClose={() => setFinalSuccess(null)}>
                  {finalSuccess}
                </Alert>
              )}

              <Grid container spacing={1.5}>
                {finalLoadingMesas ? (
                  <Grid item xs={12}>
                    <Stack alignItems="center" py={4}>
                      <CircularProgress size={32} />
                    </Stack>
                  </Grid>
                ) : finalMesas.length ? (
                  finalMesas.map((mesa) => {
                    const fecha = mesa.fecha ? new Date(mesa.fecha).toLocaleDateString() : "-";
                    const horaDesde = mesa.hora_desde ? mesa.hora_desde.slice(0, 5) : "";
                    const horaHasta = mesa.hora_hasta ? mesa.hora_hasta.slice(0, 5) : "";
                    const isSelected = mesa.id === finalSelectedMesaId;
                    return (
                      <Grid item xs={12} md={6} lg={4} key={mesa.id}>
                        <Paper
                          variant="outlined"
                          sx={{
                            p: 1.5,
                            borderColor: isSelected ? "primary.main" : "divider",
                            borderWidth: isSelected ? 2 : 1,
                          }}
                        >
                          <Stack gap={0.5}>
                            <Typography variant="subtitle2">
                              {mesa.materia_nombre} (#{mesa.materia_id})
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              {mesa.profesorado_nombre ?? "Sin profesorado"} | Plan {mesa.plan_resolucion ?? "-"}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              {fecha} {horaDesde}
                              {horaHasta ? ` - ${horaHasta}` : ""} | {mesa.modalidad === "LIB" ? "Libre" : "Regular"} | {mesa.tipo === "FIN" ? "Ordinaria" : mesa.tipo === "EXT" ? "Extraordinaria" : "Especial"}
                            </Typography>
                            <Stack direction="row" gap={1}>
                              <Button
                                size="small"
                                variant="contained"
                                onClick={() => handleOpenFinalPlanilla(mesa.id)}
                                disabled={finalLoadingPlanilla && isSelected}
                              >
                                Ver planilla
                              </Button>
                            </Stack>
                          </Stack>
                        </Paper>
                      </Grid>
                    );
                  })
                ) : (
                  <Grid item xs={12}>
                    <Alert severity="info">
                      No se encontraron mesas que coincidan con los filtros seleccionados.
                    </Alert>
                  </Grid>
                )}
              </Grid>

              {finalSelectedMesaId && (
                <Box>
                  {finalLoadingPlanilla ? (
                    <Stack alignItems="center" py={4}>
                      <CircularProgress size={32} />
                    </Stack>
                  ) : finalPlanilla ? (
                    <Stack gap={2}>
                      <Box
                        display="flex"
                        flexDirection={{ xs: "column", md: "row" }}
                        justifyContent="space-between"
                        alignItems={{ xs: "flex-start", md: "center" }}
                        gap={2}
                      >
                        <Box>
                          <Typography variant="subtitle2" fontWeight={700}>
                            {finalPlanilla.materia_nombre} - Mesa #{finalPlanilla.mesa_id}
                          </Typography>
                          <Typography color="text.secondary">
                            {finalPlanilla.fecha ? new Date(finalPlanilla.fecha).toLocaleDateString() : "-"} - {finalPlanilla.tipo === "FIN" ? "Ordinaria" : finalPlanilla.tipo === "EXT" ? "Extraordinaria" : "Especial"} - {finalPlanilla.modalidad === "LIB" ? "Libre" : "Regular"}
                          </Typography>
                        </Box>
                        <Stack
                          direction={{ xs: "column", sm: "row" }}
                          spacing={1.5}
                          alignItems={{ xs: "stretch", sm: "center" }}
                          sx={{ width: { xs: "100%", sm: "auto" } }}
                        >
                          {totalFinalRows > 0 && (
                            <Typography variant="body2" color="text.secondary" sx={{ minWidth: "fit-content" }}>
                              {visibleFinalRows} de {totalFinalRows} inscripciones{hasFinalSearch ? " (filtrado)" : ""}
                            </Typography>
                          )}
                          <Button
                            variant="outlined"
                            size="small"
                            onClick={handleDownloadAllOralActas}
                            disabled={downloadingOralBatch || finalReadOnly}
                            startIcon={
                              downloadingOralBatch ? <CircularProgress size={14} color="inherit" /> : undefined
                            }
                          >
                            {downloadingOralBatch ? "Descargando..." : "Actas orales"}
                          </Button>
                          <TextField
                            size="small"
                            placeholder="Buscar por apellido o DNI"
                            value={finalSearch}
                            onChange={(event) => setFinalSearch(event.target.value)}
                            sx={{ minWidth: { xs: "100%", sm: 260 } }}
                            InputProps={{
                              startAdornment: (
                                <InputAdornment position="start">
                                  <SearchIcon fontSize="small" />
                                </InputAdornment>
                              ),
                              endAdornment: finalSearch ? (
                                <InputAdornment position="end">
                                  <IconButton
                                    size="small"
                                    edge="end"
                                    onClick={() => setFinalSearch("")}
                                    aria-label="Limpiar busqueda"
                                  >
                                    <CloseIcon fontSize="small" />
                                  </IconButton>
                                </InputAdornment>
                              ) : undefined,
                            }}
                          />
                        </Stack>
                      </Box>
                      {finalPlanilla.esta_cerrada ? (
                        <Alert severity={finalPlanilla.puede_editar ? "info" : "warning"}>
                          Planilla cerrada el{" "}
                          {finalPlanilla.cerrada_en
                            ? new Date(finalPlanilla.cerrada_en).toLocaleString("es-AR")
                            : "fecha desconocida"}
                          {finalPlanilla.cerrada_por ? ` por ${finalPlanilla.cerrada_por}` : ""}.
                          {!finalPlanilla.puede_editar && " Solo secretaría o admin pueden editarla o reabrirla."}
                        </Alert>
                      ) : (
                        <Alert severity="info">
                          Cuando confirmes las notas, cerrá la planilla para bloquear nuevas ediciones.
                        </Alert>
                      )}
                      <Box display="flex" justifyContent="flex-end" gap={1} flexWrap="wrap">
                        {finalPlanilla.puede_cerrar && (
                          <Button
                            variant="outlined"
                            color="warning"
                            onClick={() => handleFinalPlanillaCierre("cerrar")}
                            disabled={finalCierreLoading}
                          >
                            {finalCierreLoading ? "Cerrando..." : "Cerrar planilla"}
                          </Button>
                        )}
                        {finalPlanilla.puede_reabrir && (
                          <Button
                            variant="contained"
                            onClick={() => handleFinalPlanillaCierre("reabrir")}
                            disabled={finalCierreLoading}
                          >
                            {finalCierreLoading ? "Actualizando..." : "Reabrir planilla"}
                          </Button>
                        )}
                      </Box>
                      {finalPermissionDenied && (
                        <Alert severity="warning">
                          Solo los docentes que integran el tribunal o el personal autorizado pueden modificar esta planilla.
                        </Alert>
                      )}
                      {totalFinalRows === 0 ? (
                        <Alert severity="info">No hay inscripciones registradas para esta mesa.</Alert>
                      ) : visibleFinalRows === 0 ? (
                        <Alert severity="info">No se encontraron inscripciones que coincidan con la búsqueda.</Alert>
                      ) : (
                        <TableContainer component={Paper} variant="outlined">
                          <Table size="small">
                            <TableHead>
                              <TableRow>
                                <TableCell>DNI</TableCell>
                                <TableCell>Apellido y nombre</TableCell>
                                <TableCell>Condicion</TableCell>
                                <TableCell>Nota</TableCell>
                                <TableCell>Fecha</TableCell>
                                <TableCell>Cuenta intentos</TableCell>
                                <TableCell>Folio</TableCell>
                                <TableCell>Libro</TableCell>
                                <TableCell>Observaciones</TableCell>
                                <TableCell align="center">Acta oral</TableCell>
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {filteredFinalRows.map((row) => (
                                <TableRow
                                  key={row.inscripcionId}
                                  hover
                                  sx={{
                                    backgroundColor: row.condicion ? "inherit" : "rgba(255, 213, 79, 0.12)",
                                  }}
                                >
                                  <TableCell>{row.dni}</TableCell>
                                  <TableCell>{row.apellidoNombre}</TableCell>
                                  <TableCell sx={{ minWidth: 180 }}>
                                    <FormControl fullWidth size="small">
                                      <Select
                                        value={row.condicion ?? ""}
                                        displayEmpty
                                        disabled={finalReadOnly}
                                        onChange={(event) =>
                                          handleFinalRowChange(row.inscripcionId, {
                                            condicion: event.target.value ? String(event.target.value) : null,
                                          })
                                        }
                                      >
                                        <MenuItem value="">
                                          <em>Seleccionar</em>
                                        </MenuItem>
                                        {finalCondiciones.map((condicion) => (
                                          <MenuItem key={condicion.value} value={condicion.value}>
                                            {condicion.label}
                                          </MenuItem>
                                        ))}
                                      </Select>
                                    </FormControl>
                                  </TableCell>
                                  <TableCell sx={{ minWidth: 120 }}>
                                    <TextField
                                      size="small"
                                      type="number"
                                      value={row.nota}
                                      disabled={finalReadOnly}
                                      onChange={(event) =>
                                        handleFinalRowChange(row.inscripcionId, { nota: event.target.value })
                                      }
                                      inputProps={{ step: 0.5, min: 0, max: 10 }}
                                    />
                                  </TableCell>
                                  <TableCell sx={{ minWidth: 150 }}>
                                    <TextField
                                      size="small"
                                      type="date"
                                      value={row.fechaResultado}
                                      disabled={finalReadOnly}
                                      onChange={(event) =>
                                        handleFinalRowChange(row.inscripcionId, { fechaResultado: event.target.value })
                                      }
                                      InputLabelProps={{ shrink: true }}
                                    />
                                  </TableCell>
                                  <TableCell align="center">
                                    <Checkbox
                                      checked={row.cuentaParaIntentos}
                                      disabled={finalReadOnly}
                                      onChange={(event) =>
                                        handleFinalRowChange(row.inscripcionId, {
                                          cuentaParaIntentos: event.target.checked,
                                        })
                                      }
                                    />
                                  </TableCell>
                                  <TableCell sx={{ minWidth: 120 }}>
                                    <TextField
                                      size="small"
                                      value={row.folio}
                                      disabled={finalReadOnly}
                                      onChange={(event) =>
                                        handleFinalRowChange(row.inscripcionId, { folio: event.target.value })
                                      }
                                    />
                                  </TableCell>
                                  <TableCell sx={{ minWidth: 120 }}>
                                    <TextField
                                      size="small"
                                      value={row.libro}
                                      disabled={finalReadOnly}
                                      onChange={(event) =>
                                        handleFinalRowChange(row.inscripcionId, { libro: event.target.value })
                                      }
                                    />
                                  </TableCell>
                                  <TableCell sx={{ minWidth: 220 }}>
                                    <TextField
                                      size="small"
                                      value={row.observaciones}
                                      disabled={finalReadOnly}
                                      onChange={(event) =>
                                        handleFinalRowChange(row.inscripcionId, { observaciones: event.target.value })
                                      }
                                      multiline
                                      maxRows={3}
                                    />
                                  </TableCell>
                                  <TableCell align="center">
                                    <Button
                                      size="small"
                                      variant="outlined"
                                      disabled={finalReadOnly}
                                      onClick={() => handleOpenOralActa(row)}
                                    >
                                      Acta oral
                                    </Button>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </TableContainer>
                      )}

                      <Stack direction={{ xs: "column", sm: "row" }} justifyContent="flex-end" gap={1}>
                        <Button
                          variant="contained"
                          onClick={handleFinalSaveClick}
                          disabled={finalReadOnly || finalSaving || finalRows.length === 0}
                        >
                          {finalSaving ? "Guardando..." : "Guardar planilla"}
                        </Button>
                      </Stack>
                    </Stack>
                  ) : (
                    <Alert severity="info">Seleccioná una mesa para cargar las notas.</Alert>
                  )}
                </Box>
              )}
            </Stack>
          </Paper>

          <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 } }}>
            <Stack spacing={1.5}>
              <Box>
                <Typography variant="subtitle1" fontWeight={700}>
                  Acta de examen manual
                </Typography>
                <Typography color="text.secondary">
                  Generá o actualizá actas finales cargando los datos manualmente. El sistema valida correlatividades, regularidades y ventanas vigentes.
                </Typography>
              </Box>
              <ActaExamenForm
                strict
                title="Acta de examen"
                subtitle="Ingresá los datos del acta para los estudiantes rendidos."
                successMessage="Acta generada correctamente."
              />
            </Stack>
          </Paper>
        </Stack>
      )}
    </Stack>
    <FinalConfirmationDialog
      open={regularidadConfirmOpen}
      onConfirm={confirmRegularidadSave}
      onCancel={cancelRegularidadConfirm}
      contextText="Nuevos Registros"
      loading={saving}
    />
    <FinalConfirmationDialog
      open={finalConfirmOpen}
      onConfirm={executeGuardarFinalPlanilla}
      onCancel={cancelFinalConfirm}
      contextText="Nuevos Registros"
      loading={finalSaving}
    />
    {oralDialogRow && (
      <OralExamActaDialog
        open
        onClose={handleCloseOralActa}
        alumnoNombre={oralDialogRow.apellidoNombre}
        alumnoDni={oralDialogRow.dni}
        carrera={selectedMesaResumen?.profesorado_nombre ?? ""}
        unidadCurricular={finalPlanilla?.materia_nombre ?? selectedMesaResumen?.materia_nombre ?? ""}
        curso={selectedMesaCursoLabel}
        fechaMesa={finalPlanilla?.fecha ?? selectedMesaResumen?.fecha ?? null}
        tribunal={tribunalInfo}
        existingValues={oralActDrafts[oralDialogRow.inscripcionId]}
        defaultNota={oralDialogRow.nota}
        loading={oralActaLoading && !oralActDrafts[oralDialogRow.inscripcionId]}
        saving={oralActaSaving}
        onSave={handleSaveOralActa}
      />
    )}
    </Box>
  );
};

export default CargaNotasPage;

const createTopicRow = (tema = "", score?: string | null): OralActFormTopic => ({
  id: `${Date.now()}-${Math.random()}`,
  tema,
  score: (score as OralTopicScore | "") || "",
});

const ensureTopicRowsFromApi = (
  topics: ActaOralDTO["temas_alumno"] | undefined,
  min: number,
): OralActFormTopic[] => {
  const rows = (topics ?? []).map((item) => createTopicRow(item.tema ?? "", item.score ?? null));
  while (rows.length < min) {
    rows.push(createTopicRow());
  }
  return rows;
};

function mapActaOralDtoToFormValues(dto: ActaOralDTO): OralActFormValues {
  return {
    actaNumero: dto.acta_numero ?? "",
    folioNumero: dto.folio_numero ?? "",
    fecha: dto.fecha ?? "",
    curso: dto.curso ?? "",
    notaFinal: dto.nota_final ?? "",
    observaciones: dto.observaciones ?? "",
    temasAlumno: ensureTopicRowsFromApi(dto.temas_alumno, 3),
    temasDocente: ensureTopicRowsFromApi(dto.temas_docente, 4),
  };
}

function mapFormValuesToOralPayload(values: OralActFormValues): GuardarActaOralPayload {
  const normalize = (rows: OralActFormTopic[]) =>
    rows
      .filter((row) => row.tema.trim())
      .map((row) => ({
        tema: row.tema.trim(),
        score: row.score || null,
      }));

  return {
    acta_numero: values.actaNumero || null,
    folio_numero: values.folioNumero || null,
    fecha: values.fecha || null,
    curso: values.curso || null,
    nota_final: values.notaFinal || null,
    observaciones: values.observaciones || null,
    temas_alumno: normalize(values.temasAlumno),
    temas_docente: normalize(values.temasDocente),
  };
}












