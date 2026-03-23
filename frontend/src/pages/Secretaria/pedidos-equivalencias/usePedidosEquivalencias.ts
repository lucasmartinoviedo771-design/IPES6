import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useSnackbar } from "notistack";

import { useAuth } from "@/context/AuthContext";
import { fetchVentanas, VentanaDto } from "@/api/ventanas";
import {
  listarPedidosEquivalencia,
  descargarNotaPedidoEquivalencia,
  crearDisposicionEquivalencia,
  listarDisposicionesEquivalencia,
  PedidoEquivalenciaDTO,
  EquivalenciaDisposicionDTO,
  EquivalenciaDisposicionPayload,
  enviarPedidoEquivalencia,
  registrarDocumentacionEquivalencia,
  registrarEvaluacionEquivalencia,
  registrarTitulosEquivalencia,
  notificarPedidoEquivalencia,
} from "@/api/estudiantes";
import { getErrorMessage } from "@/utils/errors";
import { EstadoFiltro } from "./types";

export const usePedidosEquivalencias = () => {
  const { enqueueSnackbar } = useSnackbar();
  const { user } = useAuth();
  const roles = (user?.roles || []).map((rol) => (rol || "").toLowerCase());
  const isAdmin = roles.includes("admin") || roles.includes("secretaria");
  const isTutor = isAdmin || roles.includes("tutor");
  const isEquivalencias = isAdmin || roles.includes("equivalencias");
  const isTitulos = isAdmin || roles.includes("titulos");
  const [searchParams, setSearchParams] = useSearchParams();

  const [ventanas, setVentanas] = useState<VentanaDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [pedidos, setPedidos] = useState<PedidoEquivalenciaDTO[]>([]);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);
  const [disposiciones, setDisposiciones] = useState<EquivalenciaDisposicionDTO[]>([]);
  const [loadingDisposiciones, setLoadingDisposiciones] = useState(false);
  const [openDisposicionDialog, setOpenDisposicionDialog] = useState(false);
  const [filters, setFilters] = useState<{ profesoradoId: string; ventanaId: string; estado: EstadoFiltro; workflow: string; dni: string }>({
    profesoradoId: "",
    ventanaId: "",
    estado: "",
    workflow: "",
    dni: "",
  });
  const [documentacionDialog, setDocumentacionDialog] = useState<{ open: boolean; pedido?: PedidoEquivalenciaDTO }>({
    open: false,
  });
  const [documentacionForm, setDocumentacionForm] = useState({ presentada: true, cantidad: "", detalle: "" });
  const [evaluacionDialog, setEvaluacionDialog] = useState<{ open: boolean; pedido?: PedidoEquivalenciaDTO }>({
    open: false,
  });
  const [evaluacionForm, setEvaluacionForm] = useState<Array<{ id: number; resultado: "otorgada" | "rechazada"; observaciones: string }>>([]);
  const [evaluacionObservaciones, setEvaluacionObservaciones] = useState("");
  const [titulosDialog, setTitulosDialog] = useState<{ open: boolean; pedido?: PedidoEquivalenciaDTO }>({ open: false });
  const [titulosForm, setTitulosForm] = useState({
    nota_numero: "",
    nota_fecha: "",
    disposicion_numero: "",
    disposicion_fecha: "",
    observaciones: "",
  });
  const [notificarDialog, setNotificarDialog] = useState<{ open: boolean; pedido?: PedidoEquivalenciaDTO }>({
    open: false,
  });
  const [notificarMensaje, setNotificarMensaje] = useState("");
  const [documentacionSaving, setDocumentacionSaving] = useState(false);
  const [evaluacionSaving, setEvaluacionSaving] = useState(false);
  const [titulosSaving, setTitulosSaving] = useState(false);
  const [notificarSaving, setNotificarSaving] = useState(false);
  const [enviandoId, setEnviandoId] = useState<number | null>(null);
  const [refreshToggle, setRefreshToggle] = useState(0);
  const [filtersHydrated, setFiltersHydrated] = useState(false);
  const triggerRefresh = useCallback(() => setRefreshToggle((prev) => prev + 1), []);

  useEffect(() => {
    const workflowParam = searchParams.get("workflow") ?? "";
    const estadoParam = (searchParams.get("estado") as EstadoFiltro | null) ?? "";
    const dniParam = searchParams.get("dni") ?? "";
    const profesoradoParam = searchParams.get("profesoradoId") ?? "";
    const ventanaParam = searchParams.get("ventanaId") ?? "";
    if (workflowParam || estadoParam || dniParam || profesoradoParam || ventanaParam) {
      setFilters((prev) => ({
        ...prev,
        workflow: workflowParam || prev.workflow,
        estado: estadoParam || prev.estado,
        dni: dniParam || prev.dni,
        profesoradoId: profesoradoParam || prev.profesoradoId,
        ventanaId: ventanaParam || prev.ventanaId,
      }));
    }
    setFiltersHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!filtersHydrated) return;
    const params = new URLSearchParams();
    if (filters.workflow) params.set("workflow", filters.workflow);
    if (filters.estado) params.set("estado", filters.estado);
    if (filters.dni) params.set("dni", filters.dni);
    if (filters.profesoradoId) params.set("profesoradoId", filters.profesoradoId);
    if (filters.ventanaId) params.set("ventanaId", filters.ventanaId);
    setSearchParams(params, { replace: true });
  }, [filters, filtersHydrated, setSearchParams]);

  const fetchDisposiciones = useCallback(async () => {
    setLoadingDisposiciones(true);
    try {
      const data = await listarDisposicionesEquivalencia(filters.dni ? { dni: filters.dni } : {});
      setDisposiciones(data);
    } catch (error) {
      enqueueSnackbar(getErrorMessage(error, "No se pudieron cargar las disposiciones."), { variant: "warning" });
    } finally {
      setLoadingDisposiciones(false);
    }
  }, [filters.dni, enqueueSnackbar]);

  useEffect(() => {
    fetchVentanas({ tipo: "EQUIVALENCIAS" })
      .then((data) => setVentanas(data || []))
      .catch(() => setVentanas([]));
  }, []);

  useEffect(() => {
    let cancelado = false;
    const load = async () => {
      if (filters.dni && filters.dni.length < 7) {
        setPedidos([]);
        return;
      }
      setLoading(true);
      try {
        const data = await listarPedidosEquivalencia({
          profesorado_id: filters.profesoradoId ? Number(filters.profesoradoId) : undefined,
          ventana_id: filters.ventanaId ? Number(filters.ventanaId) : undefined,
          estado: filters.estado || undefined,
          workflow_estado: filters.workflow || undefined,
          dni: filters.dni || undefined,
        });
        if (!cancelado) {
          setPedidos(data);
        }
      } catch (error) {
        if (!cancelado) {
          setPedidos([]);
          enqueueSnackbar(getErrorMessage(error, "No se pudieron cargar los pedidos."), { variant: "error" });
        }
      } finally {
        if (!cancelado) {
          setLoading(false);
        }
      }
    };
    load();
    return () => {
      cancelado = true;
    };
  }, [filters, enqueueSnackbar, refreshToggle]);

  useEffect(() => {
    fetchDisposiciones();
  }, [fetchDisposiciones]);

  const handleRegistrarDisposicion = async (payload: EquivalenciaDisposicionPayload) => {
    await crearDisposicionEquivalencia(payload);
    await fetchDisposiciones();
  };

  const handleDescargarPDF = async (pedido: PedidoEquivalenciaDTO) => {
    setDownloadingId(pedido.id);
    try {
      const blob = await descargarNotaPedidoEquivalencia(pedido.id);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `pedido_equivalencias_${pedido.estudiante_dni}.pdf`;
      link.click();
      window.URL.revokeObjectURL(url);
      enqueueSnackbar("Nota descargada.", { variant: "success" });
    } catch (error) {
      enqueueSnackbar(getErrorMessage(error, "No se pudo descargar la nota."), { variant: "error" });
    } finally {
      setDownloadingId(null);
    }
  };

  const handleEnviarPedido = async (pedido: PedidoEquivalenciaDTO) => {
    setEnviandoId(pedido.id);
    try {
      await enviarPedidoEquivalencia(pedido.id);
      enqueueSnackbar("Pedido enviado al circuito.", { variant: "success" });
      triggerRefresh();
    } catch (error) {
      enqueueSnackbar(getErrorMessage(error, "No se pudo enviar el pedido."), { variant: "error" });
    } finally {
      setEnviandoId(null);
    }
  };

  const handleOpenDocumentacionDialog = (pedido: PedidoEquivalenciaDTO) => {
    setDocumentacionForm({
      presentada: Boolean(pedido.documentacion_presentada),
      cantidad: pedido.documentacion_cantidad ? String(pedido.documentacion_cantidad) : "",
      detalle: pedido.documentacion_detalle || "",
    });
    setDocumentacionDialog({ open: true, pedido });
  };

  const handleCloseDocumentacionDialog = () => {
    if (documentacionSaving) return;
    setDocumentacionDialog({ open: false });
  };

  const handleSubmitDocumentacion = async () => {
    if (!documentacionDialog.pedido) return;
    setDocumentacionSaving(true);
    const cantidadRaw = documentacionForm.presentada ? Number(documentacionForm.cantidad) : undefined;
    const payload = {
      presentada: documentacionForm.presentada,
      cantidad: documentacionForm.presentada && Number.isFinite(cantidadRaw) ? Number(cantidadRaw) : undefined,
      detalle: documentacionForm.presentada ? documentacionForm.detalle.trim() || undefined : undefined,
    };
    try {
      await registrarDocumentacionEquivalencia(documentacionDialog.pedido.id, payload);
      enqueueSnackbar("Documentación registrada.", { variant: "success" });
      setDocumentacionDialog({ open: false });
      triggerRefresh();
    } catch (error) {
      enqueueSnackbar(getErrorMessage(error, "No se pudo registrar la documentación."), { variant: "error" });
    } finally {
      setDocumentacionSaving(false);
    }
  };

  const handleOpenEvaluacionDialog = (pedido: PedidoEquivalenciaDTO) => {
    setEvaluacionForm(
      (pedido.materias || []).map((materia) => ({
        id: materia.id,
        resultado: materia.resultado === "rechazada" ? "rechazada" : "otorgada",
        observaciones: materia.observaciones || "",
      })),
    );
    setEvaluacionObservaciones(pedido.evaluacion_observaciones || "");
    setEvaluacionDialog({ open: true, pedido });
  };

  const handleCloseEvaluacionDialog = () => {
    if (evaluacionSaving) return;
    setEvaluacionDialog({ open: false });
  };

  const handleSubmitEvaluacion = async () => {
    if (!evaluacionDialog.pedido) return;
    if (!evaluacionForm.length) {
      enqueueSnackbar("No hay materias para evaluar.", { variant: "warning" });
      return;
    }
    setEvaluacionSaving(true);
    const payload = {
      materias: evaluacionForm.map((item) => ({
        id: item.id,
        resultado: item.resultado,
        observaciones: item.observaciones.trim() || undefined,
      })),
      observaciones: evaluacionObservaciones.trim() || undefined,
    };
    try {
      await registrarEvaluacionEquivalencia(evaluacionDialog.pedido.id, payload);
      enqueueSnackbar("Evaluación registrada.", { variant: "success" });
      setEvaluacionDialog({ open: false });
      triggerRefresh();
    } catch (error) {
      enqueueSnackbar(getErrorMessage(error, "No se pudo registrar la evaluación."), { variant: "error" });
    } finally {
      setEvaluacionSaving(false);
    }
  };

  const handleOpenTitulosDialog = (pedido: PedidoEquivalenciaDTO) => {
    const formatDate = (value?: string | null) => (value ? value.slice(0, 10) : "");
    setTitulosForm({
      nota_numero: pedido.titulos_nota_numero || "",
      nota_fecha: formatDate(pedido.titulos_nota_fecha),
      disposicion_numero: pedido.titulos_disposicion_numero || "",
      disposicion_fecha: formatDate(pedido.titulos_disposicion_fecha),
      observaciones: pedido.titulos_observaciones || "",
    });
    setTitulosDialog({ open: true, pedido });
  };

  const handleCloseTitulosDialog = () => {
    if (titulosSaving) return;
    setTitulosDialog({ open: false });
  };

  const handleSubmitTitulos = async () => {
    if (!titulosDialog.pedido) return;
    setTitulosSaving(true);
    const payload = {
      nota_numero: titulosForm.nota_numero.trim() || undefined,
      nota_fecha: titulosForm.nota_fecha || undefined,
      disposicion_numero: titulosForm.disposicion_numero.trim() || undefined,
      disposicion_fecha: titulosForm.disposicion_fecha || undefined,
      observaciones: titulosForm.observaciones.trim() || undefined,
    };
    try {
      await registrarTitulosEquivalencia(titulosDialog.pedido.id, payload);
      enqueueSnackbar("Documentación de Títulos registrada.", { variant: "success" });
      setTitulosDialog({ open: false });
      triggerRefresh();
    } catch (error) {
      enqueueSnackbar(getErrorMessage(error, "No se pudo registrar la documentación de Títulos."), { variant: "error" });
    } finally {
      setTitulosSaving(false);
    }
  };

  const handleOpenNotificarDialog = (pedido: PedidoEquivalenciaDTO) => {
    setNotificarMensaje("");
    setNotificarDialog({ open: true, pedido });
  };

  const handleCloseNotificarDialog = () => {
    if (notificarSaving) return;
    setNotificarDialog({ open: false });
  };

  const handleSubmitNotificar = async () => {
    if (!notificarDialog.pedido) return;
    setNotificarSaving(true);
    try {
      await notificarPedidoEquivalencia(notificarDialog.pedido.id, {
        mensaje: notificarMensaje.trim() || undefined,
      });
      enqueueSnackbar("Pedido notificado al estudiante.", { variant: "success" });
      setNotificarDialog({ open: false });
      triggerRefresh();
    } catch (error) {
      enqueueSnackbar(getErrorMessage(error, "No se pudo notificar el pedido."), { variant: "error" });
    } finally {
      setNotificarSaving(false);
    }
  };

  const ventanaOptions = useMemo(() => ventanas.filter((v) => v.id != null).map((v) => ({
    id: v.id!,
    label: `${v.tipo} ${v.desde ? `(${v.desde})` : ""}`,
  })), [ventanas]);

  return {
    // roles
    isTutor,
    isEquivalencias,
    isTitulos,
    // data
    loading,
    pedidos,
    disposiciones,
    loadingDisposiciones,
    ventanaOptions,
    // filters
    filters,
    setFilters,
    // disposicion dialog
    openDisposicionDialog,
    setOpenDisposicionDialog,
    handleRegistrarDisposicion,
    // pdf
    downloadingId,
    handleDescargarPDF,
    // enviar
    enviandoId,
    handleEnviarPedido,
    // documentacion dialog
    documentacionDialog,
    documentacionForm,
    setDocumentacionForm,
    documentacionSaving,
    handleOpenDocumentacionDialog,
    handleCloseDocumentacionDialog,
    handleSubmitDocumentacion,
    // evaluacion dialog
    evaluacionDialog,
    evaluacionForm,
    setEvaluacionForm,
    evaluacionObservaciones,
    setEvaluacionObservaciones,
    evaluacionSaving,
    handleOpenEvaluacionDialog,
    handleCloseEvaluacionDialog,
    handleSubmitEvaluacion,
    // titulos dialog
    titulosDialog,
    titulosForm,
    setTitulosForm,
    titulosSaving,
    handleOpenTitulosDialog,
    handleCloseTitulosDialog,
    handleSubmitTitulos,
    // notificar dialog
    notificarDialog,
    notificarMensaje,
    setNotificarMensaje,
    notificarSaving,
    handleOpenNotificarDialog,
    handleCloseNotificarDialog,
    handleSubmitNotificar,
  };
};
