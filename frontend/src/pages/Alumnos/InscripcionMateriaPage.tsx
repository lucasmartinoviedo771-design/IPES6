import React, { useEffect, useMemo, useState } from "react";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Chip,
  Divider,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  SelectChangeEvent,
  Skeleton,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  solicitarInscripcionMateria,
  cancelarInscripcionMateria,
  obtenerMateriasPlanAlumno,
  obtenerMateriasInscriptas,
  obtenerHistorialAlumno,
  obtenerVentanaMaterias,
  MateriaPlanDTO,
  HistorialAlumnoDTO,
  MateriaInscriptaItemDTO,
  ApiResponseDTO,
} from "@/api/alumnos";
import { useAuth } from "@/context/AuthContext";

type Horario = { dia: string; desde: string; hasta: string };

type Materia = {
  id: number;
  nombre: string;
  anio: number;
  cuatrimestre: "ANUAL" | "1C" | "2C";
  horarios: Horario[];
  correlativasRegular: number[];
  correlativasAprob: number[];
  profesorado?: string;
};

const cuatrimestreCompatible = (a: Materia["cuatrimestre"], b: Materia["cuatrimestre"]) => {
  if (a === "ANUAL" || b === "ANUAL") return true;
  return a === b;
};


type Status = "aprobada" | "habilitada" | "bloqueada";
type TipoBloqueo = "correlativas" | "periodo" | "choque" | "inscripta" | "otro";

type MateriaEvaluada = Materia & {
  status: Status;
  motivos: string[];
  tipoBloqueo?: TipoBloqueo;
  faltantesRegular?: string[];
  faltantesAprob?: string[];
};

function mapMateria(dto: MateriaPlanDTO): Materia {
  return {
    id: dto.id,
    nombre: dto.nombre,
    anio: dto.anio,
    cuatrimestre: dto.cuatrimestre,
    horarios: dto.horarios,
    correlativasRegular: dto.correlativas_regular || [],
    correlativasAprob: dto.correlativas_aprob || [],
    profesorado: dto.profesorado,
  };
}

function hayChoque(a: Horario[], b: Horario[]) {
  const toMin = (t: string) => parseInt(t.slice(0, 2)) * 60 + parseInt(t.slice(3));
  for (const ha of a) {
    for (const hb of b) {
      if (ha.dia !== hb.dia) continue;
      const a1 = toMin(ha.desde); const a2 = toMin(ha.hasta);
      const b1 = toMin(hb.desde); const b2 = toMin(hb.hasta);
      if (Math.max(a1, b1) < Math.min(a2, b2)) return true;
    }
  }
  return false;
}

const STATUS_LABEL: Record<Status, string> = {
  habilitada: "Habilitada",
  bloqueada: "No disponible",
  aprobada: "Materia aprobada",
};

const BLOQUEO_LABEL: Record<TipoBloqueo | "otros", string> = {
  correlativas: "Correlativas pendientes",
  periodo: "Fuera de la ventana de inscripciÃ³n",
  choque: "SuperposiciÃ³n horaria",
  inscripta: "Ya inscripta",
  otro: "Otros motivos",
  otros: "Otros motivos",
};

const EMPTY_HISTORIAL: HistorialAlumnoDTO = {
  aprobadas: [],
  regularizadas: [],
  inscriptas_actuales: [],
};

const InscripcionMateriaPage: React.FC = () => {
  const qc = useQueryClient();
  const { user } = (useAuth?.() ?? { user: null }) as any;
  const puedeGestionar = !!user && (user.is_staff || (user.roles || []).some((r: string) => ["admin", "secretaria", "bedel"].includes((r || "").toLowerCase())));

  const [dniInput, setDniInput] = useState<string>("");
  const [dniFiltro, setDniFiltro] = useState<string>("");
  const [anioFiltro, setAnioFiltro] = useState<number | "all">("all");
  const [profesoradoFiltro, setProfesoradoFiltro] = useState<string | "all">("all");
  const [seleccionadas, setSeleccionadas] = useState<number[]>([]);
  const [info, setInfo] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const normalizedDni = dniFiltro.trim();
  const shouldFetchInscriptas = !puedeGestionar || normalizedDni.length > 0;

  const handleAnioChange = (event: SelectChangeEvent<string>) => {
    const value = event.target.value;
    setAnioFiltro(value === "all" ? "all" : Number(value));
  };

  const handleProfesoradoChange = (event: SelectChangeEvent<string>) => {
    const value = event.target.value;
    setProfesoradoFiltro(value === "all" ? "all" : value);
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      setDniFiltro(dniInput.trim());
    }, 400);
    return () => clearTimeout(timer);
  }, [dniInput]);

  useEffect(() => {
    setInfo(null);
    setErr(null);
    setSeleccionadas([]);
  }, [dniFiltro]);

  const materiasQ = useQuery<Materia[]>({
    queryKey: ["materias-plan", dniFiltro],
    queryFn: async () => {
      const data = await obtenerMateriasPlanAlumno(dniFiltro ? { dni: dniFiltro } : undefined);
      return data.map(mapMateria);
    },
  });

  const historialQ = useQuery({
    queryKey: ["historial-alumno", dniFiltro],
    queryFn: async () => {
      const d: HistorialAlumnoDTO = await obtenerHistorialAlumno(dniFiltro ? { dni: dniFiltro } : undefined);
      return {
        ...d,
        aprobadas: d.aprobadas || [],
        regularizadas: d.regularizadas || [],
        inscriptas_actuales: d.inscriptas_actuales || [],
      };
    },
  });

  const ventanaQ = useQuery({
    queryKey: ["ventana-materias"],
    queryFn: obtenerVentanaMaterias,
  });

  const inscripcionesQ = useQuery({
    queryKey: ["materias-inscriptas", normalizedDni],
    queryFn: () => obtenerMateriasInscriptas(normalizedDni ? { dni: normalizedDni } : undefined),
    enabled: shouldFetchInscriptas,
  });

  const queryError =
    materiasQ.isError ||
    historialQ.isError ||
    ventanaQ.isError ||
    (shouldFetchInscriptas && inscripcionesQ.isError);

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
      setInfo(res.message || "InscripciÃ³n registrada");
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
      const message = res?.message || "Inscripción cancelada";
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
  const inscripcionesData = inscripcionesQ.data ?? [];

  const yaInscriptas = new Set<number>([...(historial.inscriptasActuales || []), ...seleccionadas]);
  const periodo = (ventana?.periodo ?? "1C_ANUALES") as "1C_ANUALES" | "2C";
  const esPeriodoHabilitado = (m: Materia) =>
    periodo === "1C_ANUALES"
      ? (m.cuatrimestre === "ANUAL" || m.cuatrimestre === "1C")
      : m.cuatrimestre === "2C";

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

  const profesoradosDisponibles = useMemo(() => {
    const set = new Set<string>();
    materias.forEach((m) => {
      if (m.profesorado) set.add(m.profesorado);
    });
    return Array.from(set).sort();
  }, [materias]);

  const matchesFilters = (materia: MateriaEvaluada | Materia) => {
    const byAnio = anioFiltro === "all" || materia.anio === anioFiltro;
    const byProf = profesoradoFiltro === "all" || (materia.profesorado ?? "") === profesoradoFiltro;
    return byAnio && byProf;
  };

  const materiasEvaluadas: MateriaEvaluada[] = useMemo(() => materias.map((materia) => {
    if (historial.aprobadas.includes(materia.id)) {
      return { ...materia, status: "aprobada", motivos: ["Materia aprobada"], faltantesRegular: [], faltantesAprob: [] };
    }

    if (!esPeriodoHabilitado(materia)) {
      return {
        ...materia,
        status: "bloqueada",
        motivos: ["No habilitada en este perÃ­odo de inscripciÃ³n"],
        tipoBloqueo: "periodo",
        faltantesRegular: [],
        faltantesAprob: [],
      };
    }

    const faltasReg = materia.correlativasRegular.filter((id) => !historial.regularizadas.includes(id));
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
        motivos: ["Ya estÃ¡s inscripto/a en esta materia"],
        tipoBloqueo: "inscripta",
        faltantesRegular: [],
        faltantesAprob: [],
      };
    }

    const conflictoConInscripciones = inscripcionesConHorario.find((insData) => {
      if (insData.ins.materia_id === materia.id) return false;
      if (materia.horarios.length === 0 || insData.horarios.length === 0) return false;
      if (!cuatrimestreCompatible(materia.cuatrimestre, insData.cuatrimestre)) return false;
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


    return {
      ...materia,
      status: "habilitada",
      motivos: [],
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

  const bloqueadasPorTipo = bloqueadasFiltradas.reduce<Record<TipoBloqueo | "otros", MateriaEvaluada[]>>((acc, materia) => {
    const tipo = materia.tipoBloqueo ?? "otro";
    const key = tipo in acc ? tipo : "otros";
    acc[key] = acc[key] || [];
    acc[key].push(materia);
    return acc;
  }, { correlativas: [], periodo: [], choque: [], inscripta: [], otros: [] });

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

  const profesoradoNombre = materias.find((m) => m.profesorado)?.profesorado || "Profesorado";
  const periodoLabel = ventana?.periodo === "2C" ? "2Âº Cuatrimestre" : "1Âº Cuatrimestre + Anuales";

  const handleInscribir = (materiaId: number) => {
    if (mInscribir.isPending) return;
    mInscribir.mutate(materiaId);
  };

  const handleCancelar = (materiaId: number, inscripcionId?: number | null) => {
    if (!ventanaActiva || !inscripcionId) return;
    if (mCancelar.isPending && cancelarVars?.inscripcionId === inscripcionId) return;
    mCancelar.mutate({ inscripcionId, materiaId });
  };

  if (materiasQ.isLoading || historialQ.isLoading || ventanaQ.isLoading || inscripcionesQ.isLoading) {
    return <Skeleton variant="rectangular" height={160} />;
  }

  return (
    <Box sx={{ p: 3, bgcolor: "#f9f5ea", minHeight: "100vh" }}>
      <Stack spacing={3} maxWidth={1180} mx="auto">
        <Stack
          direction={{ xs: "column", lg: "row" }}
          spacing={2}
          justifyContent="space-between"
          alignItems={{ xs: "flex-start", lg: "center" }}
        >
          <Box>
            <Typography variant="h4" fontWeight={800}>InscripciÃ³n a Materias</Typography>
            <Typography color="text.secondary">
              {profesoradoNombre} â€¢ {periodoLabel}
            </Typography>
            {ventana?.desde && ventana?.hasta && (
              <Typography variant="body2" color="text.secondary">
                Ventana: {new Date(ventana.desde).toLocaleDateString()} â€“ {new Date(ventana.hasta).toLocaleDateString()}
              </Typography>
            )}
          </Box>

          <Stack spacing={1.5} sx={{ width: { xs: "100%", lg: "auto" } }}>
            {puedeGestionar && (
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ xs: "stretch", sm: "center" }}>
                <TextField
                  label="DNI del estudiante"
                  size="small"
                  value={dniInput}
                  onChange={(e) => setDniInput(e.target.value.replace(/\D+/g, ""))}
                  onBlur={() => setDniFiltro(dniInput.trim())}
                  sx={{ maxWidth: 240, bgcolor: "#fff" }}
                  inputProps={{ inputMode: "numeric", pattern: "[0-9]*" }}
                />
                <Typography variant="caption" color="text.secondary">
                  Bedel/SecretarÃ­a/Admin: filtrÃ¡ por DNI para gestionar inscripciones de un alumno.
                </Typography>
              </Stack>
            )}

            <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ xs: "stretch", sm: "center" }}>
              <FormControl size="small" sx={{ minWidth: 150, bgcolor: "#fff" }}>
                <InputLabel id="filtro-anio-label">Anio</InputLabel>
                <Select
                  labelId="filtro-anio-label"
                  value={anioFiltro === "all" ? "all" : String(anioFiltro)}
                  label="Anio"
                  onChange={handleAnioChange}
                >
                  <MenuItem value="all">Todos los anios</MenuItem>
                  {aniosDisponibles.map((anio) => (
                    <MenuItem key={anio} value={String(anio)}>
                      {`${anio} anio`}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              {(profesoradosDisponibles.length > 0) && (
                <FormControl size="small" sx={{ minWidth: 200, bgcolor: "#fff" }}>
                  <InputLabel id="filtro-profesorado-label">Profesorado</InputLabel>
                  <Select
                    labelId="filtro-profesorado-label"
                    value={profesoradoFiltro === "all" ? "all" : profesoradoFiltro}
                    label="Profesorado"
                    onChange={handleProfesoradoChange}
                  >
                    <MenuItem value="all">Todos los profesorados</MenuItem>
                    {profesoradosDisponibles.map((nombre) => (
                      <MenuItem key={nombre} value={nombre}>
                        {nombre}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )}
            </Stack>
          </Stack>
        </Stack>

        {queryError && (
          <Alert severity="error">
            No se pudieron cargar los datos de inscripción. Verifica el DNI e intenta nuevamente.
          </Alert>
        )}

        {err && <Alert severity="error">{err}</Alert>}
        {info && <Alert severity="success">{info}</Alert>}

        <Paper elevation={0} sx={{ p: 3, borderRadius: 3, border: "1px solid #e3d7bc", bgcolor: "#fff" }}>
          <Typography variant="h6" fontWeight={700} gutterBottom color="primary.dark">
            Materias habilitadas para inscribirte
          </Typography>
          {habilitadasFiltradas.length === 0 ? (
            <Alert severity="info" sx={{ mt: 2 }}>
              No hay materias habilitadas que coincidan con los filtros seleccionados. Revisa correlatividades o estados administrativos.
            </Alert>
          ) : (
            <Stack spacing={3}>
              {habilitadasPorAnio.map(({ anio, items }) => (
                <Box key={anio}>
                  <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>
                    {anio}Âº aÃ±o
                  </Typography>
                  <Box
                    sx={{
                      display: "grid",
                      gap: 2,
                      gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
                    }}
                  >
                    {items.map((materia) => (
                      <Box
                        key={materia.id}
                        sx={{ p: 2.5, borderRadius: 2, border: "1px solid #d4c4a5", bgcolor: "#fefbf4", height: "100%" }}
                      >
                        <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={2} height="100%">
                          <Box>
                            <Typography variant="h6">{materia.nombre}</Typography>
                            <Typography variant="body2" color="text.secondary">
                              {materia.cuatrimestre}
                            </Typography>
                            <Stack direction="row" spacing={1} mt={1} flexWrap="wrap">
                              <Chip size="small" color="success" label="Correlativas cumplidas" />
                              {materia.status === "habilitada" && <Chip size="small" color="primary" label={STATUS_LABEL[materia.status]} />}
                            </Stack>
                          </Box>
                          <Stack spacing={1} minWidth={240}>
                            <Box sx={{ p: 1.5, borderRadius: 2, border: "1px solid #cbb891", bgcolor: "#fff" }}>
                              <Typography variant="body2" fontWeight={600}>Horarios</Typography>
                              {materia.horarios.length === 0 ? (
                                <Typography variant="body2" color="text.secondary">Sin horarios informados.</Typography>
                              ) : (
                                materia.horarios.map((h, idx) => (
                                  <Typography key={idx} variant="body2" color="text.secondary">
                                    {h.dia} {h.desde} - {h.hasta}
                                  </Typography>
                                ))
                              )}
                              <Button
                                variant="contained"
                                size="small"
                                sx={{ mt: 1 }}
                                onClick={() => handleInscribir(materia.id)}
                                disabled={mInscribir.isPending && pendingMateriaId === materia.id}
                              >
                                Inscribirme
                              </Button>
                            </Box>
                          </Stack>
                        </Stack>
                      </Box>
                    ))}
                  </Box>
                </Box>
              ))}
            </Stack>
          )}
        </Paper>

        <Accordion defaultExpanded sx={{ bgcolor: "#fffaf1", borderRadius: 3, border: "1px solid #e2d4b5" }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography fontWeight={700}>Materias pendientes / no disponibles</Typography>
          </AccordionSummary>
          <AccordionDetails>
            {(["correlativas", "periodo", "choque", "inscripta", "otros"] as const).map((tipo) => {
              const lista = bloqueadasPorTipo[tipo];
              if (!lista || lista.length === 0) return null;
              return (
                <Box key={tipo} sx={{ mb: 3 }}>
                  <Divider textAlign="left" sx={{ mb: 1.5 }}>{BLOQUEO_LABEL[tipo]}</Divider>
                  <Stack spacing={1.5}>
                    {lista.map((materia) => (
                      <Box key={materia.id} sx={{ p: 2, borderRadius: 2, border: "1px dashed #d3c19c", bgcolor: "#fff" }}>
                        <Typography fontWeight={600}>{materia.nombre}</Typography>
                        {materia.tipoBloqueo === "correlativas" ? (
                          <>
                            {materia.faltantesRegular && materia.faltantesRegular.length > 0 && (
                              <Typography
                              variant="body2"
                              color="text.secondary"
                            >
                                <Box component="span" sx={{ textDecoration: "underline", fontWeight: 600 }}>
                                  Regularizar:
                                </Box>{" "}
                                {materia.faltantesRegular.join(", ")}
                              </Typography>
                            )}
                            {materia.faltantesAprob && materia.faltantesAprob.length > 0 && (
                              <Typography
                              variant="body2"
                              color="text.secondary"
                              sx={{ mt: materia.faltantesRegular?.length ? 0.5 : 0 }}
                            >
                              <Box component="span" sx={{ textDecoration: "underline", fontWeight: 600 }}>
                                  Aprobar:
                                </Box>{" "}
                                {materia.faltantesAprob.join(", ")}
                              </Typography>
                            )}
                          </>
                        ) : (
                          materia.motivos.length > 0 && (
                            <Typography variant="body2" color="text.secondary">
                              {materia.motivos.join(" | ")}
                            </Typography>
                          )
                        )}
                      </Box>
                    ))}
                  </Stack>
                </Box>
              );
            })}

            {aprobadasFiltradas.length > 0 && (
              <Box sx={{ mt: 2 }}>
                <Divider textAlign="left" sx={{ mb: 1.5 }}>Materias ya aprobadas</Divider>
                <Stack direction="row" flexWrap="wrap" gap={1}>
                  {aprobadasFiltradas.map((materia) => (
                    <Chip key={materia.id} label={materia.nombre} color="success" size="small" />
                  ))}
                </Stack>
              </Box>
            )}
          </AccordionDetails>
        </Accordion>

        <Paper elevation={0} sx={{ p: 3, borderRadius: 3, border: "1px solid #d8ccb0", bgcolor: "#fff" }}>
          <Typography variant="h6" fontWeight={700} gutterBottom>
            Materias ya inscriptas en esta ventana
          </Typography>
          {inscriptasDetalle.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              Todavía no tenés inscripciones registradas.
            </Typography>
          ) : (
            <Stack spacing={2}>
              {inscriptasDetalle.map(({ materia, inscripcion }) => {
                const canceling = inscripcion ? (cancelarVars?.inscripcionId === inscripcion.inscripcion_id && mCancelar.isPending) : false;
                return (
                  <Box key={materia.id} sx={{ p: 2, borderRadius: 2, border: "1px solid #cbb891", bgcolor: "#f7f1df" }}>
                    <Typography fontWeight={600}>{materia.nombre}</Typography>
                    {materia.horarios.length > 0 ? (
                      materia.horarios.map((h, idx) => (
                        <Typography key={idx} variant="body2" color="text.secondary">
                          {h.dia} {h.desde} – {h.hasta}
                        </Typography>
                      ))
                    ) : (
                      <Typography variant="body2" color="text.secondary">Horario no informado.</Typography>
                    )}
                    <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1 }}>
                      <Chip label="Inscripta" color="success" size="small" />
                      {ventanaActiva && inscripcion && (
                        <Button
                          variant="outlined"
                          color="error"
                          size="small"
                          disabled={canceling}
                          onClick={() => handleCancelar(materia.id, inscripcion.inscripcion_id)}
                        >
                          Cancelar inscripción
                        </Button>
                      )}
                    </Stack>
                  </Box>
                );
              })}
            </Stack>
          )
}
        </Paper>
      </Stack>
    </Box>
  );
};

export default InscripcionMateriaPage;
