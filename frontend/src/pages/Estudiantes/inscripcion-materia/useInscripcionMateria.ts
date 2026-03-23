import { useEffect, useMemo, useState } from "react";
import type { SelectChangeEvent } from "@mui/material";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  solicitarInscripcionMateria,
  cancelarInscripcionMateria,
  obtenerMateriasPlanEstudiante,
  obtenerMateriasInscriptas,
  obtenerHistorialEstudiante,
  obtenerVentanaMaterias,
  obtenerCarrerasActivas,
  HistorialEstudianteDTO,
  MateriaInscriptaItemDTO,
  ApiResponseDTO,
  TrayectoriaCarreraDetalleDTO,
  VentanaInscripcion,
} from "@/api/estudiantes";
import { useAuth } from "@/context/AuthContext";
import { hasAnyRole } from "@/utils/roles";
import {
  Materia,
  MateriaEvaluada,
  TipoBloqueo,
  mapMateria,
  hayChoque,
  cuatrimestreCompatible,
  EMPTY_HISTORIAL,
} from "./types";

export const useInscripcionMateria = () => {
  const qc = useQueryClient();
  const { user } = (useAuth?.() ?? { user: null }) as any;
  const puedeGestionar = hasAnyRole(user, ["admin", "secretaria", "bedel"]);

  const [dniInput, setDniInput] = useState<string>("");
  const [dniFiltro, setDniFiltro] = useState<string>("");
  const [anioFiltro, setAnioFiltro] = useState<number | "all">("all");
  const [selectedCarreraId, setSelectedCarreraId] = useState<string>("");
  const [selectedPlanId, setSelectedPlanId] = useState<string>("");
  const [seleccionadas, setSeleccionadas] = useState<number[]>([]);
  const [info, setInfo] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [confirmInscripcionOpen, setConfirmInscripcionOpen] = useState(false);
  const [materiaConfirmId, setMateriaConfirmId] = useState<number | null>(null);

  const normalizedDni = dniFiltro.trim();
  const shouldFetchInscriptas = !puedeGestionar || normalizedDni.length > 0;
  const requiereSeleccionEstudiante = puedeGestionar && !shouldFetchInscriptas;

  const handleAnioChange = (event: SelectChangeEvent<string>) => {
    const value = event.target.value;
    setAnioFiltro(value === "all" ? "all" : Number(value));
  };

  const handleCarreraChange = (event: SelectChangeEvent<string>) => {
    const value = event.target.value;
    setSelectedCarreraId(value);
    setErr(null);
    setInfo(null);
    if (!value) {
      setSelectedPlanId("");
      return;
    }
    const carrera = carrerasDisponibles.find((c) => String(c.profesorado_id) === value);
    if (!carrera) {
      setSelectedPlanId("");
      return;
    }
    const preferido = carrera.planes.find((p) => p.vigente) ?? carrera.planes[0];
    setSelectedPlanId(preferido ? String(preferido.id) : "");
  };

  const handlePlanChange = (event: SelectChangeEvent<string>) => {
    setErr(null);
    setInfo(null);
    setSelectedPlanId(event.target.value);
  };

  useEffect(() => {
    setInfo(null);
    setErr(null);
    setSeleccionadas([]);
    setSelectedCarreraId("");
    setSelectedPlanId("");
  }, [dniFiltro]);

  const carrerasQ = useQuery<TrayectoriaCarreraDetalleDTO[]>({
    queryKey: ["carreras-activas", dniFiltro],
    queryFn: () => obtenerCarrerasActivas(shouldFetchInscriptas ? (dniFiltro ? { dni: dniFiltro } : undefined) : undefined),
    enabled: shouldFetchInscriptas,
    retry: false,
  });

  const carrerasDisponibles = carrerasQ.data ?? [];
  const selectedCarreraIdNum = selectedCarreraId ? Number(selectedCarreraId) : undefined;
  const selectedPlanIdNum = selectedPlanId ? Number(selectedPlanId) : undefined;
  const puedeSolicitarMaterias = !shouldFetchInscriptas || (carrerasQ.isSuccess && (carrerasDisponibles.length <= 1 || !!selectedCarreraIdNum || !!selectedPlanIdNum));

  const planesDisponibles = useMemo(() => {
    if (!selectedCarreraId) return [];
    const carrera = carrerasDisponibles.find((c) => String(c.profesorado_id) === selectedCarreraId);
    return carrera ? carrera.planes : [];
  }, [selectedCarreraId, carrerasDisponibles]);

  useEffect(() => {
    const disponibles = carrerasDisponibles;
    if (!disponibles.length) {
      setSelectedCarreraId("");
      setSelectedPlanId("");
      return;
    }
    if (selectedCarreraId) {
      const actual = disponibles.find((c) => String(c.profesorado_id) === selectedCarreraId);
      if (!actual) {
        setSelectedCarreraId("");
        setSelectedPlanId("");
        return;
      }
      if (!selectedPlanId || !actual.planes.some((p) => String(p.id) === selectedPlanId)) {
        const preferido = actual.planes.find((p) => p.vigente) ?? actual.planes[0];
        setSelectedPlanId(preferido ? String(preferido.id) : "");
      }
      return;
    }
    if (disponibles.length === 1) {
      const unica = disponibles[0];
      setSelectedCarreraId(String(unica.profesorado_id));
      const preferido = unica.planes.find((p) => p.vigente) ?? unica.planes[0];
      setSelectedPlanId(preferido ? String(preferido.id) : "");
    }
  }, [carrerasDisponibles, selectedCarreraId, selectedPlanId]);

  const materiasQ = useQuery<Materia[]>({
    queryKey: ["materias-plan", dniFiltro, selectedCarreraId, selectedPlanId],
    enabled: shouldFetchInscriptas && puedeSolicitarMaterias,
    queryFn: async () => {
      const params: { dni?: string; plan_id?: number; profesorado_id?: number } = {};
      if (dniFiltro) params.dni = dniFiltro;
      if (selectedPlanIdNum) {
        params.plan_id = selectedPlanIdNum;
      } else if (selectedCarreraIdNum) {
        params.profesorado_id = selectedCarreraIdNum;
      }
      const data = await obtenerMateriasPlanEstudiante(Object.keys(params).length ? params : undefined);
      return data.map(mapMateria);
    },
    retry: false,
  });

  useEffect(() => {
    if (materiasQ.isError) {
      const error = materiasQ.error as any;
      setErr(error?.response?.data?.message || "No se pudieron obtener las materias del plan.");
    } else if (materiasQ.isSuccess) {
      setErr(null);
    }
  }, [materiasQ.isError, materiasQ.isSuccess, materiasQ.error]);

  const historialQ = useQuery<HistorialEstudianteDTO>({
    queryKey: ["historial-estudiante", dniFiltro],
    queryFn: async () => {
      const d: HistorialEstudianteDTO = await obtenerHistorialEstudiante(dniFiltro ? { dni: dniFiltro } : undefined);
      return {
        ...d,
        aprobadas: d.aprobadas || [],
        regularizadas: d.regularizadas || [],
        inscriptas_actuales: d.inscriptas_actuales || [],
      };
    },
    enabled: shouldFetchInscriptas,
  });

  const ventanaQ = useQuery<VentanaInscripcion | null>({
    queryKey: ["ventana-materias"],
    queryFn: obtenerVentanaMaterias,
  });

  const inscripcionesQ = useQuery<MateriaInscriptaItemDTO[]>({
    queryKey: ["materias-inscriptas", normalizedDni],
    queryFn: () => obtenerMateriasInscriptas(normalizedDni ? { dni: normalizedDni } : undefined),
    enabled: shouldFetchInscriptas,
  });

  const queryError =
    materiasQ.isError ||
    historialQ.isError ||
    ventanaQ.isError ||
    (shouldFetchInscriptas && (inscripcionesQ.isError || carrerasQ.isError));

  const mInscribir = useMutation({
    mutationFn: (materiaId: number) =>
      solicitarInscripcionMateria({
        materia_id: materiaId,
        dni: normalizedDni ? normalizedDni : undefined,
      }),
    onMutate: (materiaId) => {
      setSeleccionadas((prev) => (prev.includes(materiaId) ? prev : [...prev, materiaId]));
    },
    onSuccess: (res) => {
      setInfo(res.message || "Inscripción registrada");
      setErr(null);
      qc.invalidateQueries();
    },
    onError: (error: any, materiaId) => {
      setSeleccionadas((prev) => prev.filter((id) => id !== materiaId));
      setErr(error?.response?.data?.message || "No se pudo inscribir");
      setInfo(null);
    },
  });
  const pendingMateriaId = mInscribir.variables as number | undefined;

  const mCancelar = useMutation<ApiResponseDTO, any, { inscripcionId: number; materiaId: number }>({
    mutationFn: ({ inscripcionId, materiaId }) =>
      cancelarInscripcionMateria({
        inscripcion_id: inscripcionId,
        dni: normalizedDni ? normalizedDni : undefined,
      }),
    onSuccess: (res, variables) => {
      const message = res?.message || "inscripción cancelada";
      setInfo(message);
      setErr(null);
      setSeleccionadas((prev) => prev.filter((id) => id !== variables.materiaId));
      qc.invalidateQueries();
    },
    onError: (error: any) => {
      setErr(error?.response?.data?.message || "No se pudo cancelar la inscripción");
      setInfo(null);
    },
  });
  const cancelarVars = mCancelar.variables;

  const materias = materiasQ.data ?? [];
  const historialRaw = historialQ.data ?? EMPTY_HISTORIAL;
  const historial = {
    aprobadas: historialRaw.aprobadas ?? [],
    regularizadas: historialRaw.regularizadas ?? [],
    inscriptasActuales: historialRaw.inscriptas_actuales ?? [],
  };
  const ventana = ventanaQ.data ?? null;
  const ventanaActiva = useMemo(() => {
    if (!ventana) return false;
    try {
      const desde = new Date(ventana.desde);
      const hasta = new Date(ventana.hasta);
      const hoy = new Date();
      return Boolean(ventana.activo) && hoy >= desde && hoy <= hasta;
    } catch {
      return Boolean(ventana?.activo);
    }
  }, [ventana]);
  const puedeInscribirse = ventanaActiva;
  const periodo = (ventana?.periodo ?? null) as "1C_ANUALES" | "2C" | null;

  const inscripcionesData = inscripcionesQ.data ?? [];

  const yaInscriptas = new Set<number>([...(historial.inscriptasActuales || []), ...seleccionadas]);
  const esPeriodoHabilitado = (m: Materia) => {
    if (!ventanaActiva || !periodo) return true;
    if (periodo === "1C_ANUALES") {
      return m.cuatrimestre === "ANUAL" || m.cuatrimestre === "1C";
    }
    if (periodo === "2C") {
      return m.cuatrimestre === "2C";
    }
    return true;
  };

  const materiaById = useMemo(() => {
    const map = new Map<number, Materia>();
    for (const materia of materias) map.set(materia.id, materia);
    return map;
  }, [materias]);

  const inscripcionPorMateria = useMemo(() => {
    const map = new Map<number, MateriaInscriptaItemDTO>();
    inscripcionesData.forEach((ins) => {
      if (!map.has(ins.materia_id) && (ins.estado === "CONF" || ins.estado === "PEND")) {
        map.set(ins.materia_id, ins);
      }
    });
    return map;
  }, [inscripcionesData]);

  const inscripcionesConHorario = useMemo(() => {
    return inscripcionesData
      .filter((ins) => (ins.estado === "CONF" || ins.estado === "PEND") && ins.comision_actual)
      .map((ins) => {
        const materiaRef = materiaById.get(ins.materia_id);
        const horarios = ins.comision_actual?.horarios ?? [];
        return {
          ins,
          horarios,
          materiaNombre: materiaRef?.nombre ?? ins.materia_nombre,
          cuatrimestre: materiaRef?.cuatrimestre ?? "ANUAL",
        };
      })
      .filter((item) => item.horarios.length > 0);
  }, [inscripcionesData, materiaById]);

  const aniosDisponibles = useMemo(() => {
    const unique = Array.from(new Set(materias.map((m) => m.anio))).sort((a, b) => a - b);
    return unique;
  }, [materias]);

  const selectedCarreraIdNum2 = selectedCarreraId ? Number(selectedCarreraId) : undefined;
  const selectedPlanIdNum2 = selectedPlanId ? Number(selectedPlanId) : undefined;

  const matchesFilters = (materia: MateriaEvaluada | Materia) => {
    const byAnio = anioFiltro === "all" || materia.anio === anioFiltro;
    const byCarrera = !selectedCarreraIdNum2 || materia.profesoradoId === selectedCarreraIdNum2;
    const byPlan = !selectedPlanIdNum2 || materia.planId === selectedPlanIdNum2;
    return byAnio && byCarrera && byPlan;
  };

  const materiasEvaluadas: MateriaEvaluada[] = useMemo(() => materias.map((materia) => {
    if (historial.aprobadas.includes(materia.id)) {
      return { ...materia, status: "aprobada", motivos: ["Materia aprobada"], faltantesRegular: [], faltantesAprob: [] };
    }

    if (historial.regularizadas.includes(materia.id)) {
      return {
        ...materia,
        status: "bloqueada",
        motivos: ["Ya tienes la regularidad de esta materia"],
        tipoBloqueo: "otro",
        faltantesRegular: [],
        faltantesAprob: [],
      };
    }

    if (!esPeriodoHabilitado(materia)) {
      return {
        ...materia,
        status: "bloqueada",
        motivos: ["No habilitada en este período de inscripción"],
        tipoBloqueo: "periodo",
        faltantesRegular: [],
        faltantesAprob: [],
      };
    }

    const faltasReg = materia.correlativasRegular.filter((id) => !historial.regularizadas.includes(id) && !historial.aprobadas.includes(id));
    const faltasApr = materia.correlativasAprob.filter((id) => !historial.aprobadas.includes(id));
    const faltasRegNombres = Array.from(new Set(faltasReg.map((id) => materiaById.get(id)?.nombre || `Materia ${id}`)));
    const faltasAprNombres = Array.from(new Set(faltasApr.map((id) => materiaById.get(id)?.nombre || `Materia ${id}`)));

    if (faltasReg.length || faltasApr.length) {
      const motivos: string[] = [];
      if (faltasRegNombres.length) motivos.push(`Regularizar: ${faltasRegNombres.join(", ")}`);
      if (faltasAprNombres.length) motivos.push(`Aprobar: ${faltasAprNombres.join(", ")}`);
      return {
        ...materia,
        status: "bloqueada",
        motivos,
        tipoBloqueo: "correlativas",
        faltantesRegular: faltasRegNombres,
        faltantesAprob: faltasAprNombres,
      };
    }

    if (yaInscriptas.has(materia.id)) {
      return {
        ...materia,
        status: "bloqueada",
        motivos: ["Ya estás inscripto/a en esta materia"],
        tipoBloqueo: "inscripta",
        faltantesRegular: [],
        faltantesAprob: [],
      };
    }

    const conflictoConInscripciones = inscripcionesConHorario.find((insData) => {
      if (insData.ins.materia_id === materia.id) return false;
      if (materia.horarios.length === 0 || insData.horarios.length === 0) return false;
      if (!cuatrimestreCompatible(materia.cuatrimestre, insData.cuatrimestre as Materia["cuatrimestre"])) return false;
      return hayChoque(materia.horarios, insData.horarios);
    });
    if (conflictoConInscripciones) {
      return {
        ...materia,
        status: "bloqueada",
        motivos: [`Superposición horaria con ${conflictoConInscripciones.materiaNombre}`],
        tipoBloqueo: "choque",
        faltantesRegular: [],
        faltantesAprob: [],
      };
    }

    const seleccionadasMaterias = materias.filter((x) => seleccionadas.includes(x.id));
    for (const seleccionada of seleccionadasMaterias) {
      if (seleccionada.horarios.length === 0 || materia.horarios.length === 0) continue;
      if (!cuatrimestreCompatible(materia.cuatrimestre, seleccionada.cuatrimestre)) continue;
      if (hayChoque(materia.horarios, seleccionada.horarios)) {
        return {
          ...materia,
          status: "bloqueada",
          motivos: [`Superposición horaria con ${seleccionada.nombre}`],
          tipoBloqueo: "choque",
          faltantesRegular: [],
          faltantesAprob: [],
        };
      }
    }

    const cumplidas: string[] = [];
    materia.correlativasRegular.forEach((id) => {
      const name = materiaById.get(id)?.nombre || `Materia ${id}`;
      if (historial.aprobadas.includes(id)) cumplidas.push(`${name} (Aprobada)`);
      else if (historial.regularizadas.includes(id)) cumplidas.push(`${name} (Regular)`);
    });
    materia.correlativasAprob.forEach((id) => {
      const name = materiaById.get(id)?.nombre || `Materia ${id}`;
      if (historial.aprobadas.includes(id)) cumplidas.push(`${name} (Aprobada)`);
    });

    return {
      ...materia,
      status: "habilitada",
      motivos: cumplidas,
      faltantesRegular: [],
      faltantesAprob: [],
    };
  }), [materias, historial.aprobadas, historial.regularizadas, historial.inscriptasActuales, seleccionadas, periodo, inscripcionesConHorario, materiaById]);

  const materiasHabilitadas = materiasEvaluadas.filter((m) => m.status === "habilitada");
  const materiasBloqueadas = materiasEvaluadas.filter((m) => m.status === "bloqueada");
  const materiasAprobadas = materiasEvaluadas.filter((m) => m.status === "aprobada");

  const habilitadasFiltradas = materiasHabilitadas.filter(matchesFilters);
  const bloqueadasFiltradas = materiasBloqueadas.filter(matchesFilters);
  const aprobadasFiltradas = materiasAprobadas.filter(matchesFilters);

  const habilitadasPorAnio = useMemo(() => {
    const groups = new Map<number, MateriaEvaluada[]>();
    habilitadasFiltradas.forEach((materia) => {
      if (!groups.has(materia.anio)) groups.set(materia.anio, []);
      groups.get(materia.anio)!.push(materia);
    });
    return Array.from(groups.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([anio, items]) => ({ anio, items }));
  }, [habilitadasFiltradas]);

  const bloqueadasPorTipo = bloqueadasFiltradas.reduce<Record<TipoBloqueo, MateriaEvaluada[]>>((acc, materia) => {
    const tipo = materia.tipoBloqueo ?? "otro";
    if (!acc[tipo]) acc[tipo] = [];
    acc[tipo].push(materia);
    return acc;
  }, { correlativas: [], periodo: [], choque: [], inscripta: [], otro: [] });

  const inscriptasDetalle = (historial.inscriptasActuales || [])
    .map((id) => {
      const materia = materiaById.get(id);
      if (!materia) return null;
      return {
        materia,
        inscripcion: inscripcionPorMateria.get(id) || null,
      };
    })
    .filter((item): item is { materia: Materia; inscripcion: MateriaInscriptaItemDTO | null } => Boolean(item))
    .filter(({ materia }) => matchesFilters(materia));

  const profesoradoNombre = useMemo(() => {
    if (selectedCarreraId) {
      const carrera = carrerasDisponibles.find((c) => String(c.profesorado_id) === selectedCarreraId);
      if (carrera) return carrera.nombre;
    }
    if (materias.length) {
      const withNombre = materias.find((m) => m.profesorado);
      if (withNombre?.profesorado) return withNombre.profesorado;
    }
    if (carrerasDisponibles.length === 1) {
      return carrerasDisponibles[0].nombre;
    }
    return "Profesorado";
  }, [selectedCarreraId, materias, carrerasDisponibles]);

  const periodoLabel = ventanaActiva
    ? ventana?.periodo === "2C"
      ? "2º Cuatrimestre"
      : "1º Cuatrimestre + Anuales"
    : "Sin ventana activa (se muestran todas las materias habilitadas por correlatividad)";

  const handleInscribir = (materiaId: number) => {
    if (!puedeInscribirse) {
      setErr("No hay una ventana de inscripción habilitada.");
      return;
    }
    if (mInscribir.isPending) return;
    setMateriaConfirmId(materiaId);
    setConfirmInscripcionOpen(true);
  };

  const confirmInscripcion = () => {
    if (materiaConfirmId === null || mInscribir.isPending) return;
    mInscribir.mutate(materiaConfirmId, {
      onSettled: () => {
        setConfirmInscripcionOpen(false);
        setMateriaConfirmId(null);
      },
    });
  };

  const cancelInscripcionConfirm = () => {
    if (mInscribir.isPending) return;
    setConfirmInscripcionOpen(false);
    setMateriaConfirmId(null);
  };

  const handleCancelar = (materiaId: number, inscripcionId?: number | null) => {
    if (!ventanaActiva || !inscripcionId) return;
    if (mCancelar.isPending && cancelarVars?.inscripcionId === inscripcionId) return;
    mCancelar.mutate({ inscripcionId, materiaId });
  };

  const loadingEstudiante =
    shouldFetchInscriptas && (carrerasQ.isLoading || historialQ.isLoading || materiasQ.isLoading || inscripcionesQ.isLoading);

  return {
    // state
    dniInput,
    setDniInput,
    dniFiltro,
    setDniFiltro,
    anioFiltro,
    selectedCarreraId,
    selectedPlanId,
    info,
    err,
    confirmInscripcionOpen,
    // computed
    puedeGestionar,
    shouldFetchInscriptas,
    requiereSeleccionEstudiante,
    carrerasDisponibles,
    planesDisponibles,
    aniosDisponibles,
    ventana,
    ventanaActiva,
    puedeInscribirse,
    periodoLabel,
    profesoradoNombre,
    queryError,
    loadingEstudiante,
    isVentanaLoading: ventanaQ.isLoading,
    // evaluated data
    habilitadasPorAnio,
    bloqueadasPorTipo,
    aprobadasFiltradas,
    inscriptasDetalle,
    // mutation state
    mInscribir,
    pendingMateriaId,
    mCancelar,
    cancelarVars,
    // handlers
    handleAnioChange,
    handleCarreraChange,
    handlePlanChange,
    handleInscribir,
    confirmInscripcion,
    cancelInscripcionConfirm,
    handleCancelar,
  };
};
