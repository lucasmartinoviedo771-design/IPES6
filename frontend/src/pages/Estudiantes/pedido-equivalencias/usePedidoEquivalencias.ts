import { useCallback, useEffect, useMemo, useState } from "react";
import { useSnackbar } from "notistack";
import { useAuth } from "@/context/AuthContext";
import { useCarreras as useCatalogoCarreras } from "@/hooks/useCarreras";
import { listarPlanes } from "@/api/carreras";
import {
  obtenerCarrerasActivas,
  TrayectoriaCarreraDetalleDTO,
  listarPedidosEquivalencia,
  crearPedidoEquivalencia,
  actualizarPedidoEquivalencia,
  eliminarPedidoEquivalencia,
  descargarNotaPedidoEquivalencia,
  PedidoEquivalenciaDTO,
  obtenerTrayectoriaEstudiante,
  TrayectoriaDTO,
} from "@/api/estudiantes";
import { fetchVentanas, VentanaDto } from "@/api/ventanas";
import { getErrorMessage } from "@/utils/errors";
import { MateriaRow, FormState } from "./types";
import { buildEmptyMateria, buildInitialForm, buildPayload, preferPlan, STAFF_ROLES, DNI_COMPLETO_LENGTH } from "./utils";

export function usePedidoEquivalencias() {
  const { enqueueSnackbar } = useSnackbar();
  const { user } = useAuth();

  const roles = (user?.roles ?? []).map((rol: string) => (rol || "").toLowerCase());
  const canGestionar = roles.some((rol) => STAFF_ROLES.includes(rol));

  const [ventanaActiva, setVentanaActiva] = useState<VentanaDto | null>(null);
  const [pedidos, setPedidos] = useState<PedidoEquivalenciaDTO[]>([]);
  const [loadingPedidos, setLoadingPedidos] = useState(false);
  const [form, setForm] = useState<FormState>(buildInitialForm);
  const [materias, setMaterias] = useState<MateriaRow[]>([buildEmptyMateria()]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [descargando, setDescargando] = useState(false);
  const [eliminandoId, setEliminandoId] = useState<number | null>(null);
  const [planesDestino, setPlanesDestino] = useState<any[]>([]);
  const [carrerasEstudiante, setCarrerasEstudiante] = useState<TrayectoriaCarreraDetalleDTO[]>([]);
  const [carrerasLoading, setCarrerasLoading] = useState(false);
  const [trayectoria, setTrayectoria] = useState<TrayectoriaDTO | null>(null);
  const [trayectoriaLoading, setTrayectoriaLoading] = useState(false);
  const [autoFillKey, setAutoFillKey] = useState("");

  const { data: profesoradosCatalogo = [] } = useCatalogoCarreras();

  const [dniManual, setDniManual] = useState("");
  const dniObjetivo = canGestionar ? dniManual.trim() : user?.dni ?? "";
  const requiereDni = canGestionar && dniObjetivo.length !== DNI_COMPLETO_LENGTH;
  const dniParcial = canGestionar && dniObjetivo.length > 0 && dniObjetivo.length < DNI_COMPLETO_LENGTH;

  const selectedPedido = useMemo(() => pedidos.find((item) => item.id === selectedId) ?? null, [pedidos, selectedId]);
  const puedeEditar = selectedPedido ? selectedPedido.puede_editar : true;

  const tipoSeleccionado = form.tipo !== "";
  const esAnexoA = form.tipo === "ANEXO_A";
  const esAnexoB = form.tipo === "ANEXO_B";
  const datosDeshabilitados = !tipoSeleccionado || requiereDni;

  const puedeGuardar = Boolean(ventanaActiva) && !requiereDni && tipoSeleccionado && puedeEditar;
  const puedeDescargar = Boolean(ventanaActiva) && !requiereDni && Boolean(selectedId);

  const carrerasDestino = profesoradosCatalogo.map((item) => ({ id: item.id, nombre: item.nombre }));
  const carreraOrigenSeleccionada = useMemo(
    () => carrerasEstudiante.find((c) => String(c.profesorado_id) === form.profesoradoOrigenId),
    [carrerasEstudiante, form.profesoradoOrigenId],
  );
  const planesOrigenDisponibles = carreraOrigenSeleccionada?.planes ?? [];

  useEffect(() => {
    fetchVentanas({ tipo: "EQUIVALENCIAS" })
      .then((data) => {
        const activa = (data || []).find((item) => item.activo);
        setVentanaActiva(activa || null);
      })
      .catch((error) => {
        setVentanaActiva(null);
        enqueueSnackbar(getErrorMessage(error, "No se pudo verificar la ventana de equivalencias."), {
          variant: "warning",
        });
      });
  }, [enqueueSnackbar]);

  useEffect(() => {
    let cancelado = false;
    const load = async () => {
      if (requiereDni) {
        setCarrerasEstudiante([]);
        return;
      }
      setCarrerasLoading(true);
      try {
        const data = await obtenerCarrerasActivas(canGestionar ? { dni: dniObjetivo || undefined } : undefined);
        if (!cancelado) {
          setCarrerasEstudiante(data || []);
        }
      } catch (error) {
        if (!cancelado) {
          setCarrerasEstudiante([]);
          enqueueSnackbar(
            getErrorMessage(error, "No se pudieron obtener las carreras activas del estudiante."),
            { variant: "warning" },
          );
        }
      } finally {
        if (!cancelado) {
          setCarrerasLoading(false);
        }
      }
    };
    load();
    return () => { cancelado = true; };
  }, [canGestionar, dniObjetivo, requiereDni, enqueueSnackbar]);

  const fetchPedidos = useCallback(async () => {
    if (requiereDni) {
      setPedidos([]);
      return [];
    }
    setLoadingPedidos(true);
    try {
      const data = await listarPedidosEquivalencia(canGestionar ? { dni: dniObjetivo || undefined } : {});
      setPedidos(data);
      return data;
    } catch (error) {
      setPedidos([]);
      enqueueSnackbar(getErrorMessage(error, "No se pudieron cargar los pedidos de equivalencia."), {
        variant: "error",
      });
      return [];
    } finally {
      setLoadingPedidos(false);
    }
  }, [canGestionar, dniObjetivo, requiereDni, enqueueSnackbar]);

  useEffect(() => {
    setSelectedId(null);
    setForm(buildInitialForm());
    setMaterias([buildEmptyMateria()]);
    setAutoFillKey("");
    fetchPedidos();
  }, [fetchPedidos]);

  useEffect(() => {
    if (requiereDni) {
      setTrayectoria(null);
      return;
    }
    let cancelado = false;
    setTrayectoriaLoading(true);
    obtenerTrayectoriaEstudiante(canGestionar ? { dni: dniObjetivo || undefined } : undefined)
      .then((data) => {
        if (!cancelado) { setTrayectoria(data); }
      })
      .catch((error) => {
        if (!cancelado) {
          setTrayectoria(null);
          enqueueSnackbar(
            getErrorMessage(error, "No se pudo consultar la trayectoria académica del estudiante."),
            { variant: "warning" },
          );
        }
      })
      .finally(() => {
        if (!cancelado) { setTrayectoriaLoading(false); }
      });
    return () => { cancelado = true; };
  }, [canGestionar, dniObjetivo, requiereDni, enqueueSnackbar]);

  useEffect(() => {
    let cancelado = false;
    if (!form.profesoradoDestinoId) {
      setPlanesDestino([]);
      setForm((prev) => ({ ...prev, planDestinoId: "", planDestinoResolucion: "" }));
      return () => { cancelado = true; };
    }
    listarPlanes(Number(form.profesoradoDestinoId))
      .then((planes) => {
        if (cancelado) return;
        setPlanesDestino(planes);
        if (!planes.length) {
          setForm((prev) => ({ ...prev, planDestinoId: "", planDestinoResolucion: "" }));
          return;
        }
        const preferido = preferPlan(planes);
        if (!preferido) return;
        setForm((prev) => {
          const nextId = String(preferido.id);
          const nextResol = preferido.resolucion || `Plan ${preferido.id}`;
          if (prev.planDestinoId === nextId && prev.planDestinoResolucion === nextResol) return prev;
          return { ...prev, planDestinoId: nextId, planDestinoResolucion: nextResol };
        });
      })
      .catch((error) => {
        if (!cancelado) {
          setPlanesDestino([]);
          enqueueSnackbar(
            getErrorMessage(error, "No se pudieron obtener los planes del profesorado destino."),
            { variant: "warning" },
          );
        }
      });
    return () => { cancelado = true; };
  }, [form.profesoradoDestinoId]);

  useEffect(() => {
    if (!esAnexoA) {
      setForm((prev) => ({
        ...prev,
        profesoradoOrigenId: "",
        profesoradoOrigenNombre: "",
        planOrigenId: "",
        planOrigenResolucion: "",
      }));
      setAutoFillKey("");
      return;
    }
    if (!carreraOrigenSeleccionada) {
      setForm((prev) => ({
        ...prev,
        profesoradoOrigenNombre: "",
        planOrigenId: "",
        planOrigenResolucion: "",
      }));
      return;
    }
    setForm((prev) => ({ ...prev, profesoradoOrigenNombre: carreraOrigenSeleccionada.nombre }));
    if (!planesOrigenDisponibles.length) {
      setForm((prev) => ({ ...prev, planOrigenId: "", planOrigenResolucion: "" }));
      return;
    }
    setForm((prev) => {
      const actual = planesOrigenDisponibles.find((plan) => String(plan.id) === prev.planOrigenId);
      if (actual) {
        const nextResol = actual.resolucion || `Plan ${actual.id}`;
        if (prev.planOrigenResolucion === nextResol) return prev;
        return { ...prev, planOrigenResolucion: nextResol };
      }
      const preferido = preferPlan(planesOrigenDisponibles);
      if (!preferido) return prev;
      return {
        ...prev,
        planOrigenId: String(preferido.id),
        planOrigenResolucion: preferido.resolucion || `Plan ${preferido.id}`,
      };
    });
  }, [esAnexoA, carreraOrigenSeleccionada, planesOrigenDisponibles]);

  useEffect(() => {
    if (!esAnexoA) {
      setAutoFillKey("");
      return;
    }
    if (!trayectoria || !form.profesoradoOrigenId || !form.planOrigenId || selectedId) return;
    const key = `${form.profesoradoOrigenId}|${form.planOrigenId}`;
    if (!key.trim() || autoFillKey === key) return;
    const plan = trayectoria.carton.find(
      (item) => String(item.profesorado_id) === form.profesoradoOrigenId && String(item.plan_id) === form.planOrigenId,
    );
    if (!plan) return;
    const autoMaterias = plan.materias
      .filter((materia) => Boolean(materia.final) || Boolean(materia.regularidad))
      .map((materia) => ({
        nombre: materia.materia_nombre,
        formato: materia.formato_display || materia.formato || "",
        anio_cursada: materia.anio ? String(materia.anio) : "",
        nota: materia.final?.nota || materia.regularidad?.nota || "",
      }));
    if (autoMaterias.length) {
      setMaterias(autoMaterias);
      setAutoFillKey(key);
    }
  }, [esAnexoA, trayectoria, form.profesoradoOrigenId, form.planOrigenId, selectedId, autoFillKey]);

  const resetFormState = useCallback(() => {
    setForm(buildInitialForm());
    setMaterias([buildEmptyMateria()]);
    setAutoFillKey("");
  }, []);

  const hydrateForm = useCallback((pedido: PedidoEquivalenciaDTO) => {
    setForm({
      tipo: pedido.tipo,
      cicloLectivo: pedido.ciclo_lectivo || String(new Date().getFullYear()),
      profesoradoDestinoId: pedido.profesorado_destino_id ? String(pedido.profesorado_destino_id) : "",
      profesoradoDestinoNombre: pedido.profesorado_destino_nombre || "",
      planDestinoId: pedido.plan_destino_id ? String(pedido.plan_destino_id) : "",
      planDestinoResolucion: pedido.plan_destino_resolucion || "",
      establecimientoOrigen: pedido.establecimiento_origen || "",
      establecimientoLocalidad: pedido.establecimiento_localidad || "",
      establecimientoProvincia: pedido.establecimiento_provincia || "",
      profesoradoOrigenId: "",
      profesoradoOrigenNombre: pedido.profesorado_origen_nombre || "",
      planOrigenId: "",
      planOrigenResolucion: pedido.plan_origen_resolucion || "",
    });
    setMaterias(
      pedido.materias.length
        ? pedido.materias.map((item) => ({
          nombre: item.nombre,
          formato: item.formato || "",
          anio_cursada: item.anio_cursada || "",
          nota: item.nota || "",
        }))
        : [buildEmptyMateria()],
    );
    setAutoFillKey("");
  }, []);

  const handleSelectPedido = (pedido: PedidoEquivalenciaDTO) => {
    setSelectedId(pedido.id);
    hydrateForm(pedido);
  };

  const handleNuevoPedido = () => {
    setSelectedId(null);
    resetFormState();
  };

  const handleMateriaChange = (index: number, field: keyof MateriaRow, value: string) => {
    if (!puedeEditar) return;
    setMaterias((prev) => prev.map((item, idx) => (idx === index ? { ...item, [field]: value } : item)));
  };

  const handleAddMateria = () => {
    if (!puedeEditar) return;
    setMaterias((prev) => [...prev, buildEmptyMateria()]);
  };

  const handleRemoveMateria = (index: number) => {
    if (!puedeEditar) return;
    setMaterias((prev) => {
      if (prev.length === 1) return [buildEmptyMateria()];
      return prev.filter((_, idx) => idx !== index);
    });
  };

  const handleGuardar = async () => {
    if (!puedeGuardar) return;
    if (!form.tipo) {
      enqueueSnackbar("Seleccioná el tipo de formulario.", { variant: "warning" });
      return;
    }
    if (materias.filter((item) => item.nombre.trim()).length === 0) {
      enqueueSnackbar("Agregá al menos un espacio curricular.", { variant: "warning" });
      return;
    }
    const payload = buildPayload(form, materias);
    setSaving(true);
    try {
      let saved: PedidoEquivalenciaDTO;
      if (selectedId) {
        saved = await actualizarPedidoEquivalencia(selectedId, payload);
      } else {
        saved = await crearPedidoEquivalencia(payload, canGestionar ? { dni: dniObjetivo || undefined } : {});
      }
      enqueueSnackbar("Pedido guardado correctamente.", { variant: "success" });
      setPedidos((prev) => {
        const resto = prev.filter((item) => item.id !== saved.id);
        return [saved, ...resto];
      });
      setSelectedId(saved.id);
      hydrateForm(saved);
    } catch (error) {
      enqueueSnackbar(getErrorMessage(error, "No se pudo guardar el pedido de equivalencia."), {
        variant: "error",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDescargar = async () => {
    if (!selectedId || !puedeDescargar) return;
    setDescargando(true);
    try {
      const blob = await descargarNotaPedidoEquivalencia(selectedId);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `pedido_equivalencias_${dniObjetivo || user?.dni || "estudiante"}.pdf`;
      link.click();
      window.URL.revokeObjectURL(url);
      enqueueSnackbar("Nota generada correctamente.", { variant: "success" });
      const data = await fetchPedidos();
      const actualizado = data.find((item) => item.id === selectedId);
      if (actualizado) {
        hydrateForm(actualizado);
      }
    } catch (error) {
      enqueueSnackbar(getErrorMessage(error, "No se pudo generar la nota."), { variant: "error" });
    } finally {
      setDescargando(false);
    }
  };

  const handleEliminar = async (pedidoId: number) => {
    setEliminandoId(pedidoId);
    try {
      await eliminarPedidoEquivalencia(pedidoId);
      setPedidos((prev) => prev.filter((item) => item.id !== pedidoId));
      if (pedidoId === selectedId) {
        handleNuevoPedido();
      }
      enqueueSnackbar("Pedido eliminado.", { variant: "success" });
    } catch (error) {
      enqueueSnackbar(getErrorMessage(error, "No se pudo eliminar el pedido."), { variant: "error" });
    } finally {
      setEliminandoId(null);
    }
  };

  return {
    // auth / config
    user, canGestionar,
    dniManual, setDniManual, dniObjetivo, requiereDni, dniParcial,
    // ventana
    ventanaActiva,
    // pedidos
    pedidos, loadingPedidos, selectedId, selectedPedido, puedeEditar,
    handleSelectPedido, handleNuevoPedido, handleEliminar,
    // form state
    form, setForm, materias,
    tipoSeleccionado, esAnexoA, esAnexoB, datosDeshabilitados,
    puedeGuardar, puedeDescargar,
    // carreras / planes
    carrerasDestino, carrerasEstudiante, carrerasLoading,
    planesDestino, planesOrigenDisponibles,
    // materias handlers
    handleMateriaChange, handleAddMateria, handleRemoveMateria,
    // actions
    handleGuardar, handleDescargar, saving, descargando, eliminandoId,
    // trayectoria
    trayectoriaLoading,
  };
}
