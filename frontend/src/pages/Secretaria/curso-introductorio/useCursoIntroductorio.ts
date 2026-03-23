import { useCallback, useEffect, useMemo, useState } from "react";
import { useSnackbar } from "notistack";

import { useAuth } from "@/context/AuthContext";
import { hasAnyRole } from "@/utils/roles";
import { getErrorMessage } from "@/utils/errors";
import { useCarreras } from "@/hooks/useCarreras";
import { useTurnos } from "@/hooks/useTurnos";
import { fetchVentanas, VentanaDto } from "@/api/ventanas";
import {
  CursoIntroCohorteDTO,
  CursoIntroCohortePayload,
  CursoIntroPendienteDTO,
  CursoIntroRegistroDTO,
  fetchCursoIntroCohortes,
  crearCursoIntroCohorte,
  actualizarCursoIntroCohorte,
  listarCursoIntroPendientes,
  listarCursoIntroRegistros,
  inscribirCursoIntro,
  registrarCursoIntroAsistencia,
  cerrarCursoIntroRegistro,
} from "@/api/cursoIntro";

import {
  CohorteFormState,
  InscribirFormState,
  CierreFormState,
  buildCohorteForm,
  buildInscribirForm,
  buildCierreForm,
} from "./types";

export function useCursoIntroductorio() {
  const { user } = useAuth();
  const { enqueueSnackbar } = useSnackbar();

  const { data: profesorados = [] } = useCarreras();
  const { data: turnos = [] } = useTurnos();
  const [cohortes, setCohortes] = useState<CursoIntroCohorteDTO[]>([]);
  const [cohortesLoading, setCohortesLoading] = useState(false);
  const [ventanas, setVentanas] = useState<VentanaDto[]>([]);
  const [ventanasLoading, setVentanasLoading] = useState(false);

  const [cohorteDialogOpen, setCohorteDialogOpen] = useState(false);
  const [cohorteForm, setCohorteForm] = useState<CohorteFormState>(() => buildCohorteForm());
  const [editingCohorteId, setEditingCohorteId] = useState<number | null>(null);
  const [savingCohorte, setSavingCohorte] = useState(false);
  const [creatingCohortesTurnos, setCreatingCohortesTurnos] = useState(false);

  const [pendientesProfesoradoId, setPendientesProfesoradoId] = useState("");
  const [pendientes, setPendientes] = useState<CursoIntroPendienteDTO[]>([]);
  const [pendientesLoading, setPendientesLoading] = useState(false);

  const [registros, setRegistros] = useState<CursoIntroRegistroDTO[]>([]);
  const [registrosLoading, setRegistrosLoading] = useState(false);
  const [registroFiltros, setRegistroFiltros] = useState({
    cohorteId: "",
    profesoradoId: "",
    turnoId: "",
    resultado: "",
    anio: "",
  });

  const [inscribirDialogOpen, setInscribirDialogOpen] = useState(false);
  const [pendienteSeleccionado, setPendienteSeleccionado] = useState<CursoIntroPendienteDTO | null>(null);
  const [inscribirForm, setInscribirForm] = useState<InscribirFormState>(() => buildInscribirForm());
  const [inscribiendo, setInscribiendo] = useState(false);

  const [asistenciaDialogOpen, setAsistenciaDialogOpen] = useState(false);
  const [registroSeleccionado, setRegistroSeleccionado] = useState<CursoIntroRegistroDTO | null>(null);
  const [asistenciaValor, setAsistenciaValor] = useState("");
  const [guardandoAsistencia, setGuardandoAsistencia] = useState(false);

  const [cierreDialogOpen, setCierreDialogOpen] = useState(false);
  const [cierreForm, setCierreForm] = useState<CierreFormState>(() => buildCierreForm());
  const [guardandoCierre, setGuardandoCierre] = useState(false);

  const puedeGestionarCohortes = hasAnyRole(user, ["admin", "secretaria"]);
  const puedeGestionarRegistros = hasAnyRole(user, ["admin", "secretaria", "bedel", "curso_intro"]);
  const cohorteAccionBloqueada = savingCohorte || creatingCohortesTurnos;

  // ── Loaders ────────────────────────────────────────────────────────────────

  const loadCohortes = useCallback(async () => {
    setCohortesLoading(true);
    try {
      const data = await fetchCursoIntroCohortes();
      setCohortes(data);
    } catch (error) {
      enqueueSnackbar(getErrorMessage(error, "No se pudieron obtener las cohortes."), { variant: "error" });
    } finally {
      setCohortesLoading(false);
    }
  }, [enqueueSnackbar]);

  const loadVentanas = useCallback(async () => {
    setVentanasLoading(true);
    try {
      const data = await fetchVentanas({ tipo: "CURSO_INTRODUCTORIO" });
      setVentanas(data ?? []);
    } catch (error) {
      enqueueSnackbar(getErrorMessage(error, "No se pudieron obtener las ventanas."), { variant: "error" });
      setVentanas([]);
    } finally {
      setVentanasLoading(false);
    }
  }, [enqueueSnackbar]);

  const loadPendientes = useCallback(async () => {
    setPendientesLoading(true);
    try {
      const data = await listarCursoIntroPendientes(
        pendientesProfesoradoId ? Number(pendientesProfesoradoId) : undefined,
      );
      setPendientes(data);
    } catch (error) {
      enqueueSnackbar(getErrorMessage(error, "No se pudo cargar el listado de pendientes."), { variant: "error" });
    } finally {
      setPendientesLoading(false);
    }
  }, [enqueueSnackbar, pendientesProfesoradoId]);

  const loadRegistros = useCallback(async () => {
    setRegistrosLoading(true);
    try {
      const data = await listarCursoIntroRegistros({
        cohorte_id: registroFiltros.cohorteId ? Number(registroFiltros.cohorteId) : undefined,
        profesorado_id: registroFiltros.profesoradoId ? Number(registroFiltros.profesoradoId) : undefined,
        turno_id: registroFiltros.turnoId ? Number(registroFiltros.turnoId) : undefined,
        resultado: registroFiltros.resultado || undefined,
        anio: registroFiltros.anio ? Number(registroFiltros.anio) : undefined,
      });
      setRegistros(data);
    } catch (error) {
      enqueueSnackbar(getErrorMessage(error, "No se pudieron cargar los registros."), { variant: "error" });
    } finally {
      setRegistrosLoading(false);
    }
  }, [enqueueSnackbar, registroFiltros]);

  useEffect(() => {
    loadCohortes();
    loadVentanas();
  }, [loadCohortes, loadVentanas]);

  useEffect(() => {
    loadPendientes();
  }, [loadPendientes]);

  useEffect(() => {
    loadRegistros();
  }, [loadRegistros]);

  // ── Derived ────────────────────────────────────────────────────────────────

  const cohorteOptions = useMemo(
    () =>
      cohortes.map((cohorte) => {
        const baseLabel = cohorte.nombre || `Cohorte ${cohorte.anio_academico}`;
        const turnoLabel = cohorte.turno_nombre || "Sin turno fijo";
        return {
          value: cohorte.id,
          label: `${baseLabel} · ${turnoLabel}`,
        };
      }),
    [cohortes],
  );

  const anioOptions = useMemo(() => {
    const set = new Set<number>();
    cohortes.forEach((c) => set.add(c.anio_academico));
    return Array.from(set).sort((a, b) => b - a);
  }, [cohortes]);

  // ── Cohorte dialog ─────────────────────────────────────────────────────────

  const abrirDialogoCohorte = (cohorte?: CursoIntroCohorteDTO) => {
    if (cohorte) {
      setEditingCohorteId(cohorte.id);
      setCohorteForm({
        nombre: cohorte.nombre || "",
        anio_academico: String(cohorte.anio_academico),
        profesorado_id: cohorte.profesorado_id ? String(cohorte.profesorado_id) : "",
        turno_id: cohorte.turno_id ? String(cohorte.turno_id) : "",
        ventana_id: cohorte.ventana_id ? String(cohorte.ventana_id) : "",
        fecha_inicio: cohorte.fecha_inicio || "",
        fecha_fin: cohorte.fecha_fin || "",
        cupo: cohorte.cupo !== undefined && cohorte.cupo !== null ? String(cohorte.cupo) : "",
        observaciones: cohorte.observaciones || "",
      });
    } else {
      setEditingCohorteId(null);
      setCohorteForm(buildCohorteForm());
    }
    setCohorteDialogOpen(true);
  };

  const cerrarDialogoCohorte = () => {
    setCohorteDialogOpen(false);
    setEditingCohorteId(null);
    setCohorteForm(buildCohorteForm());
  };

  const buildCohortePayload = (): CursoIntroCohortePayload => ({
    nombre: cohorteForm.nombre.trim() || undefined,
    anio_academico: Number(cohorteForm.anio_academico),
    profesorado_id: cohorteForm.profesorado_id ? Number(cohorteForm.profesorado_id) : undefined,
    turno_id: cohorteForm.turno_id ? Number(cohorteForm.turno_id) : undefined,
    ventana_id: cohorteForm.ventana_id ? Number(cohorteForm.ventana_id) : undefined,
    fecha_inicio: cohorteForm.fecha_inicio || undefined,
    fecha_fin: cohorteForm.fecha_fin || undefined,
    cupo: cohorteForm.cupo ? Number(cohorteForm.cupo) : undefined,
    observaciones: cohorteForm.observaciones.trim() || undefined,
  });

  const ensureCohorteBaseValida = () => {
    if (!cohorteForm.anio_academico.trim()) {
      enqueueSnackbar("Indicá el año académico de la cohorte.", { variant: "warning" });
      return false;
    }
    return true;
  };

  const handleGuardarCohorte = async () => {
    if (!ensureCohorteBaseValida()) {
      return;
    }
    const payload = buildCohortePayload();
    setSavingCohorte(true);
    try {
      if (editingCohorteId) {
        await actualizarCursoIntroCohorte(editingCohorteId, payload);
        enqueueSnackbar("Cohorte actualizada.", { variant: "success" });
      } else {
        await crearCursoIntroCohorte(payload);
        enqueueSnackbar("Cohorte creada.", { variant: "success" });
      }
      cerrarDialogoCohorte();
      loadCohortes();
    } catch (error) {
      enqueueSnackbar(getErrorMessage(error, "No se pudo guardar la cohorte."), { variant: "error" });
    } finally {
      setSavingCohorte(false);
    }
  };

  const handleCrearCohortesTodosTurnos = async () => {
    if (editingCohorteId) {
      return;
    }
    if (!ensureCohorteBaseValida()) {
      return;
    }
    const turnosDisponibles = turnos.filter((turno) => Boolean(turno.id));
    if (!turnosDisponibles.length) {
      enqueueSnackbar("No hay turnos configurados para generar cohortes.", { variant: "warning" });
      return;
    }
    const basePayload = buildCohortePayload();
    setCreatingCohortesTurnos(true);
    try {
      for (const turno of turnosDisponibles) {
        await crearCursoIntroCohorte({ ...basePayload, turno_id: turno.id });
      }
      enqueueSnackbar(
        `Se crearon cohortes para ${turnosDisponibles.length} turno${turnosDisponibles.length > 1 ? "s" : ""}.`,
        { variant: "success" },
      );
      cerrarDialogoCohorte();
      loadCohortes();
    } catch (error) {
      enqueueSnackbar(getErrorMessage(error, "No se pudieron crear las cohortes."), { variant: "error" });
    } finally {
      setCreatingCohortesTurnos(false);
    }
  };

  // ── Inscripción dialog ─────────────────────────────────────────────────────

  const abrirDialogoInscripcion = (pendiente: CursoIntroPendienteDTO) => {
    setPendienteSeleccionado(pendiente);
    setInscribirForm({
      cohorte_id: registroFiltros.cohorteId,
      profesorado_id: pendiente.profesorados[0]?.id ? String(pendiente.profesorados[0]?.id) : "",
      turno_id: "",
    });
    setInscribirDialogOpen(true);
  };

  const cerrarDialogoInscripcion = () => {
    setPendienteSeleccionado(null);
    setInscribirForm(buildInscribirForm());
    setInscribirDialogOpen(false);
  };

  const handleInscribir = async () => {
    if (!pendienteSeleccionado || !inscribirForm.cohorte_id) {
      enqueueSnackbar("Seleccioná la cohorte donde inscribir.", { variant: "warning" });
      return;
    }
    setInscribiendo(true);
    try {
      await inscribirCursoIntro({
        cohorte_id: Number(inscribirForm.cohorte_id),
        estudiante_id: pendienteSeleccionado.estudiante_id,
        profesorado_id: inscribirForm.profesorado_id ? Number(inscribirForm.profesorado_id) : undefined,
        turno_id: inscribirForm.turno_id ? Number(inscribirForm.turno_id) : undefined,
      });
      enqueueSnackbar("Estudiante inscripto al curso.", { variant: "success" });
      cerrarDialogoInscripcion();
      loadPendientes();
      loadRegistros();
    } catch (error) {
      enqueueSnackbar(getErrorMessage(error, "No se pudo inscribir al estudiante."), { variant: "error" });
    } finally {
      setInscribiendo(false);
    }
  };

  // ── Asistencia dialog ──────────────────────────────────────────────────────

  const abrirDialogoAsistencia = (registro: CursoIntroRegistroDTO) => {
    setRegistroSeleccionado(registro);
    setAsistenciaValor(
      registro.asistencias_totales !== undefined && registro.asistencias_totales !== null
        ? String(registro.asistencias_totales)
        : "",
    );
    setAsistenciaDialogOpen(true);
  };

  const cerrarDialogoAsistencia = () => {
    setRegistroSeleccionado(null);
    setAsistenciaValor("");
    setAsistenciaDialogOpen(false);
  };

  const handleGuardarAsistencia = async () => {
    if (!registroSeleccionado) return;
    const total = Number(asistenciaValor);
    if (Number.isNaN(total) || !Number.isInteger(total)) {
      enqueueSnackbar("La asistencia debe ser un número entero.", { variant: "warning" });
      return;
    }
    if (total < 0 || total > 100) {
      enqueueSnackbar("La asistencia debe estar entre 0 y 100.", { variant: "warning" });
      return;
    }
    setGuardandoAsistencia(true);
    try {
      await registrarCursoIntroAsistencia(registroSeleccionado.id, total);
      enqueueSnackbar("Asistencia actualizada.", { variant: "success" });
      cerrarDialogoAsistencia();
      loadRegistros();
    } catch (error) {
      enqueueSnackbar(getErrorMessage(error, "No se pudo registrar la asistencia."), { variant: "error" });
    } finally {
      setGuardandoAsistencia(false);
    }
  };

  // ── Cierre dialog ──────────────────────────────────────────────────────────

  const abrirDialogoCierre = (registro: CursoIntroRegistroDTO) => {
    setRegistroSeleccionado(registro);
    setCierreForm({
      nota_final: registro.nota_final !== null && registro.nota_final !== undefined ? String(registro.nota_final) : "",
      asistencias_totales:
        registro.asistencias_totales !== null && registro.asistencias_totales !== undefined
          ? String(registro.asistencias_totales)
          : "",
      resultado: registro.resultado || "PEN",
      observaciones: registro.observaciones || "",
    });
    setCierreDialogOpen(true);
  };

  const cerrarDialogoCierre = () => {
    setRegistroSeleccionado(null);
    setCierreForm(buildCierreForm());
    setCierreDialogOpen(false);
  };

  const handleGuardarCierre = async () => {
    if (!registroSeleccionado) return;
    if (!cierreForm.resultado) {
      enqueueSnackbar("Seleccioná el resultado.", { variant: "warning" });
      return;
    }
    const nota = cierreForm.nota_final ? Number(cierreForm.nota_final) : undefined;
    const asistencias = cierreForm.asistencias_totales ? Number(cierreForm.asistencias_totales) : undefined;
    if (nota !== undefined && Number.isNaN(nota)) {
      enqueueSnackbar("La nota ingresada no es válida.", { variant: "warning" });
      return;
    }
    if (nota !== undefined && (nota < 1 || nota > 10)) {
      enqueueSnackbar("La nota debe estar entre 1 y 10.", { variant: "warning" });
      return;
    }
    if (asistencias !== undefined && Number.isNaN(asistencias)) {
      enqueueSnackbar("La asistencia ingresada no es válida.", { variant: "warning" });
      return;
    }
    if (asistencias !== undefined && (!Number.isInteger(asistencias) || asistencias < 0 || asistencias > 100)) {
      enqueueSnackbar("La asistencia debe ser un número entero entre 0 y 100.", { variant: "warning" });
      return;
    }
    setGuardandoCierre(true);
    try {
      await cerrarCursoIntroRegistro(registroSeleccionado.id, {
        resultado: cierreForm.resultado,
        nota_final: nota,
        asistencias_totales: asistencias,
        observaciones: cierreForm.observaciones.trim() || undefined,
      });
      enqueueSnackbar("Resultado guardado.", { variant: "success" });
      cerrarDialogoCierre();
      loadRegistros();
    } catch (error) {
      enqueueSnackbar(getErrorMessage(error, "No se pudo guardar el resultado."), { variant: "error" });
    } finally {
      setGuardandoCierre(false);
    }
  };

  return {
    // data
    profesorados,
    turnos,
    cohortes,
    cohortesLoading,
    ventanas,
    ventanasLoading,
    pendientes,
    pendientesLoading,
    pendientesProfesoradoId,
    setPendientesProfesoradoId,
    registros,
    registrosLoading,
    registroFiltros,
    setRegistroFiltros,
    cohorteOptions,
    anioOptions,
    // permissions
    puedeGestionarCohortes,
    puedeGestionarRegistros,
    // cohorte dialog
    cohorteDialogOpen,
    cohorteForm,
    setCohorteForm,
    editingCohorteId,
    savingCohorte,
    creatingCohortesTurnos,
    cohorteAccionBloqueada,
    abrirDialogoCohorte,
    cerrarDialogoCohorte,
    handleGuardarCohorte,
    handleCrearCohortesTodosTurnos,
    // inscripción dialog
    inscribirDialogOpen,
    pendienteSeleccionado,
    inscribirForm,
    setInscribirForm,
    inscribiendo,
    abrirDialogoInscripcion,
    cerrarDialogoInscripcion,
    handleInscribir,
    // asistencia dialog
    asistenciaDialogOpen,
    registroSeleccionado,
    asistenciaValor,
    setAsistenciaValor,
    guardandoAsistencia,
    abrirDialogoAsistencia,
    cerrarDialogoAsistencia,
    handleGuardarAsistencia,
    // cierre dialog
    cierreDialogOpen,
    cierreForm,
    setCierreForm,
    guardandoCierre,
    abrirDialogoCierre,
    cerrarDialogoCierre,
    handleGuardarCierre,
    // loaders
    loadRegistros,
  };
}
