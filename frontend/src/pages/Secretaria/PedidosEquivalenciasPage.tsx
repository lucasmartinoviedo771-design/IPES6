import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import DownloadIcon from "@mui/icons-material/Download";
import { useSnackbar } from "notistack";

import { PageHero, SectionTitlePill } from "@/components/ui/GradientTitles";
import { useCarreras as useCatalogoCarreras } from "@/hooks/useCarreras";
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
import EquivalenciaDisposicionDialog from "@/components/equivalencias/EquivalenciaDisposicionDialog";

const ESTADOS = [
  { value: "draft", label: "Borrador" },
  { value: "final", label: "Finalizado" },
];

const WORKFLOW_ESTADOS = [
  { value: "", label: "Todos" },
  { value: "draft", label: "Borrador" },
  { value: "pending_docs", label: "Pendiente de documentación" },
  { value: "review", label: "En evaluación" },
  { value: "titulos", label: "En Títulos" },
  { value: "notified", label: "Notificado" },
];

type EstadoFiltro = "" | "draft" | "final";

const WORKFLOW_CHIP_COLOR: Record<string, "default" | "warning" | "info" | "secondary" | "success"> = {
  draft: "default",
  pending_docs: "warning",
  review: "info",
  titulos: "secondary",
  notified: "success",
};

type ResultadoFinal = "pendiente" | "otorgada" | "denegada" | "mixta";

const RESULTADO_LABEL: Record<ResultadoFinal, string> = {
  pendiente: "Evaluaci�n pendiente",
  otorgada: "Equivalencia otorgada",
  denegada: "Equivalencia denegada",
  mixta: "Resultado mixto",
};

const RESULTADO_COLOR: Record<ResultadoFinal, "default" | "success" | "error" | "warning"> = {
  pendiente: "default",
  otorgada: "success",
  denegada: "error",
  mixta: "warning",
};

const formatFecha = (iso: string) => {
  try {
    return new Date(iso).toLocaleDateString("es-AR");
  } catch {
    return iso;
  }
};

const PedidosEquivalenciasPage: React.FC = () => {
  const { enqueueSnackbar } = useSnackbar();
  const { user } = useAuth();
  const roles = (user?.roles || []).map((rol) => (rol || "").toLowerCase());
  const isAdmin = roles.includes("admin") || roles.includes("secretaria");
  const isTutor = isAdmin || roles.includes("tutor");
  const isEquivalencias = isAdmin || roles.includes("equivalencias");
  const isTitulos = isAdmin || roles.includes("titulos");
  const { data: profesorados = [] } = useCatalogoCarreras();
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
      enqueueSnackbar("Documentaci�n registrada.", { variant: "success" });
      setDocumentacionDialog({ open: false });
      triggerRefresh();
    } catch (error) {
      enqueueSnackbar(getErrorMessage(error, "No se pudo registrar la documentaci�n."), { variant: "error" });
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
      enqueueSnackbar("Evaluaci�n registrada.", { variant: "success" });
      setEvaluacionDialog({ open: false });
      triggerRefresh();
    } catch (error) {
      enqueueSnackbar(getErrorMessage(error, "No se pudo registrar la evaluaci�n."), { variant: "error" });
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
      enqueueSnackbar("Documentaci�n de T�tulos registrada.", { variant: "success" });
      setTitulosDialog({ open: false });
      triggerRefresh();
    } catch (error) {
      enqueueSnackbar(getErrorMessage(error, "No se pudo registrar la documentaci�n de T�tulos."), { variant: "error" });
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

  const ventanaOptions = useMemo(() => ventanas.map((v) => ({
    id: v.id,
    label: `${v.tipo} ${v.desde ? `(${v.desde})` : ""}`,
  })), [ventanas]);

  return (
    <Box sx={{ p: 3 }}>
      <PageHero
        title="Pedidos de equivalencias"
        subtitle="Consulta, descarga y exporta las notas solicitadas por los estudiantes."
      />

      <Card variant="outlined" sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={2}>
            <Grid item xs={12} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel>Profesorado destino</InputLabel>
                <Select
                  label="Profesorado destino"
                  value={filters.profesoradoId}
                  onChange={(event) => setFilters((prev) => ({ ...prev, profesoradoId: String(event.target.value) }))}
                >
                  <MenuItem value="">Todos</MenuItem>
                  {profesorados.map((prof) => (
                    <MenuItem key={prof.id} value={String(prof.id)}>
                      {prof.nombre}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel>Etapa</InputLabel>
                <Select
                  label="Etapa"
                  value={filters.workflow}
                  onChange={(event) => setFilters((prev) => ({ ...prev, workflow: event.target.value }))}
                >
                  {WORKFLOW_ESTADOS.map((option) => (
                    <MenuItem key={option.value} value={option.value}>
                      {option.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel>Ventana</InputLabel>
                <Select
                  label="Ventana"
                  value={filters.ventanaId}
                  onChange={(event) => setFilters((prev) => ({ ...prev, ventanaId: String(event.target.value) }))}
                >
                  <MenuItem value="">Todas</MenuItem>
                  {ventanaOptions.map((item) => (
                    <MenuItem key={item.id} value={String(item.id)}>
                      {item.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={2}>
              <FormControl fullWidth size="small">
                <InputLabel>Estado</InputLabel>
                <Select
                  label="Estado"
                  value={filters.estado}
                  onChange={(event) => setFilters((prev) => ({ ...prev, estado: event.target.value as EstadoFiltro }))}
                >
                  <MenuItem value="">Todos</MenuItem>
                  {ESTADOS.map((estado) => (
                    <MenuItem key={estado.value} value={estado.value}>
                      {estado.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                label="DNI del estudiante"
                value={filters.dni}
                onChange={(event) => setFilters((prev) => ({ ...prev, dni: event.target.value }))}
                fullWidth
                size="small"
                helperText={
                  filters.dni && filters.dni.length > 0 && filters.dni.length < 7
                    ? "Ingresá al menos 7 dígitos para filtrar por DNI."
                    : "Opcional: filtra por un estudiante puntual."
                }
              />
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      <SectionTitlePill title="Disposiciones de equivalencia" />
      <Card variant="outlined" sx={{ mb: 3 }}>
        <CardContent>
          <Stack spacing={2}>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Box>
                <Typography variant="subtitle1" fontWeight={600}>
                  Registro de disposiciones
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Gestioná las materias aprobadas por equivalencia con número y fecha de disposición.
                </Typography>
              </Box>
              <Button
                variant="contained"
                startIcon={<DownloadIcon />}
                onClick={() => setOpenDisposicionDialog(true)}
              >
                Registrar disposición
              </Button>
            </Stack>
            {loadingDisposiciones ? (
              <Typography variant="body2" color="text.secondary">
                Cargando disposiciones...
              </Typography>
            ) : disposiciones.length === 0 ? (
              <Alert severity="info">
                {filters.dni
                  ? "No hay disposiciones para el DNI filtrado."
                  : "Aún no se registraron disposiciones mediante este módulo."}
              </Alert>
            ) : (
              <Stack spacing={1.5}>
                {disposiciones.map((dispo) => (
                  <Box
                    key={dispo.id}
                    sx={{
                      border: "1px solid",
                      borderColor: "divider",
                      borderRadius: 2,
                      p: 2,
                    }}
                  >
                    <Typography variant="subtitle2" fontWeight={600}>
                      Disposición {dispo.numero_disposicion} · {formatFecha(dispo.fecha_disposicion)}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {dispo.profesorado_nombre} — {dispo.plan_resolucion}
                    </Typography>
                    <Typography variant="body2" sx={{ mt: 0.5 }}>
                      Materias:{" "}
                      {dispo.detalles
                        .map((detalle) => `${detalle.materia_nombre} (Nota ${detalle.nota})`)
                        .join(" · ")}
                    </Typography>
                  </Box>
                ))}
              </Stack>
            )}
          </Stack>
        </CardContent>
      </Card>

      <SectionTitlePill title="Resultados" />
      {loading ? (
        <Typography variant="body2" color="text.secondary">
          Cargando pedidos...
        </Typography>
      ) : pedidos.length === 0 ? (
        <Alert severity="info">No se encontraron pedidos con los filtros aplicados.</Alert>
      ) : (
        <Card variant="outlined">
          <CardContent sx={{ p: 0 }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Estudiante</TableCell>
                  <TableCell>Profesorado destino</TableCell>
                  <TableCell>Tipo</TableCell>
                  <TableCell>Estado</TableCell>
                  <TableCell>Actualizado</TableCell>
                  <TableCell>Seguimiento</TableCell>
                  <TableCell align="right">Acciones</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {pedidos.map((pedido) => {
                  const workflowColor = WORKFLOW_CHIP_COLOR[pedido.workflow_estado] || "default";
                  const docRegistrada = Boolean(pedido.documentacion_registrada_en);
                  const docPresentada = Boolean(pedido.documentacion_presentada);
                  const docChipLabel = docRegistrada
                    ? docPresentada
                      ? "Documentaci�n registrada"
                      : "Sin documentaci�n"
                    : "Documentaci�n pendiente";
                  const docChipColor = docPresentada ? "success" : docRegistrada ? "warning" : "default";
                  const titulosRegistrados = Boolean(pedido.titulos_registrado_en);
                  const notificado = pedido.workflow_estado === "notified";
                  const resultadoFinal = (pedido.resultado_final || "pendiente") as ResultadoFinal;
                  const titulosLabel = titulosRegistrados
                    ? pedido.titulos_documento_tipo === "ambos"
                      ? "Nota y disposici�n registradas"
                      : pedido.titulos_documento_tipo === "nota"
                        ? "Nota registrada"
                        : pedido.titulos_documento_tipo === "disposicion"
                          ? "Disposici�n registrada"
                          : "Documentaci�n cargada"
                    : "T�tulos pendiente";
                  const canRegistrarDocumentacion = isTutor && ["pending_docs", "review"].includes(pedido.workflow_estado);
                  const canRegistrarEvaluacion = isEquivalencias && pedido.workflow_estado === "review";
                  const canRegistrarTitulos = isTitulos && pedido.workflow_estado === "titulos";
                  const canNotificar = isTutor && ["titulos", "notified"].includes(pedido.workflow_estado) && titulosRegistrados;
                  const canEnviar = isTutor && pedido.workflow_estado === "draft";
                  return (
                    <TableRow key={pedido.id} hover>
                      <TableCell>
                        <Typography variant="body2" fontWeight={600}>
                          {pedido.estudiante_nombre || "Sin nombre"}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          DNI {pedido.estudiante_dni}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">{pedido.profesorado_destino_nombre}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {pedido.plan_destino_resolucion}
                        </Typography>
                      </TableCell>
                      <TableCell>{pedido.tipo === "ANEXO_A" ? "Anexo A" : "Anexo B"}</TableCell>
                      <TableCell>
                        <Stack spacing={0.5}>
                          <Chip
                            size="small"
                            label={pedido.estado_display}
                            color={pedido.estado === "final" ? "success" : "default"}
                          />
                          <Chip
                            size="small"
                            variant="outlined"
                            label={pedido.workflow_estado_display}
                            color={workflowColor}
                          />
                        </Stack>
                      </TableCell>
                      <TableCell>{new Date(pedido.updated_at).toLocaleString()}</TableCell>
                      <TableCell>
                        <Stack spacing={0.5}>
                          <Chip size="small" label={docChipLabel} color={docChipColor} />
                          <Chip size="small" label={RESULTADO_LABEL[resultadoFinal]} color={RESULTADO_COLOR[resultadoFinal]} />
                          <Chip size="small" label={titulosLabel} color={titulosRegistrados ? "success" : "default"} />
                          <Chip size="small" label={notificado ? "Notificado" : "Sin notificar"} color={notificado ? "success" : "default"} />
                        </Stack>
                      </TableCell>
                      <TableCell align="right">
                        <Stack
                          direction="row"
                          spacing={1}
                          justifyContent="flex-end"
                          sx={{ flexWrap: "wrap" }}
                        >
                          <Button
                            size="small"
                            startIcon={<DownloadIcon fontSize="small" />}
                            onClick={() => handleDescargarPDF(pedido)}
                            disabled={downloadingId === pedido.id}
                          >
                            Descargar PDF
                          </Button>
                          {canEnviar && (
                            <Button
                              size="small"
                              variant="outlined"
                              onClick={() => handleEnviarPedido(pedido)}
                              disabled={enviandoId === pedido.id}
                            >
                              {enviandoId === pedido.id ? "Enviando..." : "Enviar a circuito"}
                            </Button>
                          )}
                          {canRegistrarDocumentacion && (
                            <Button size="small" variant="outlined" onClick={() => handleOpenDocumentacionDialog(pedido)}>
                              Documentaci�n
                            </Button>
                          )}
                          {canRegistrarEvaluacion && (
                            <Button size="small" variant="outlined" onClick={() => handleOpenEvaluacionDialog(pedido)}>
                              Evaluaci�n
                            </Button>
                          )}
                          {canRegistrarTitulos && (
                            <Button size="small" variant="outlined" onClick={() => handleOpenTitulosDialog(pedido)}>
                              T�tulos
                            </Button>
                          )}
                          {canNotificar && (
                            <Button size="small" variant="outlined" onClick={() => handleOpenNotificarDialog(pedido)}>
                              Notificar
                            </Button>
                          )}
                        </Stack>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Dialog open={documentacionDialog.open} onClose={handleCloseDocumentacionDialog} fullWidth maxWidth="sm">
        <DialogTitle>Registro de documentaci�n</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            {documentacionDialog.pedido && (
              <Typography variant="body2" color="text.secondary">
                {documentacionDialog.pedido.estudiante_nombre} · DNI {documentacionDialog.pedido.estudiante_dni}
              </Typography>
            )}
            <FormControlLabel
              control={(
                <Checkbox
                  checked={documentacionForm.presentada}
                  onChange={(event) =>
                    setDocumentacionForm((prev) => ({ ...prev, presentada: event.target.checked }))
                  }
                />
              )}
              label="El/la estudiante present� la documentaci�n solicitada."
            />
            <TextField
              label="Cantidad de fojas"
              type="number"
              size="small"
              value={documentacionForm.cantidad}
              onChange={(event) => setDocumentacionForm((prev) => ({ ...prev, cantidad: event.target.value }))}
              disabled={!documentacionForm.presentada}
            />
            <TextField
              label="Detalle / Observaciones"
              multiline
              minRows={3}
              value={documentacionForm.detalle}
              onChange={(event) => setDocumentacionForm((prev) => ({ ...prev, detalle: event.target.value }))}
              disabled={!documentacionForm.presentada}
            />
            {!documentacionForm.presentada && (
              <Alert severity="warning">
                Marque la casilla anterior cuando la documentaci�n sea presentada. El pedido quedar� pendiente de tutor�a
                hasta que se adjunte el respaldo.
              </Alert>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDocumentacionDialog} disabled={documentacionSaving}>
            Cancelar
          </Button>
          <Button variant="contained" onClick={handleSubmitDocumentacion} disabled={documentacionSaving}>
            {documentacionSaving ? "Guardando..." : "Guardar"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={evaluacionDialog.open} onClose={handleCloseEvaluacionDialog} fullWidth maxWidth="md">
        <DialogTitle>Evaluaci�n del pedido</DialogTitle>
        <DialogContent dividers>
          {evaluacionDialog.pedido ? (
            <Stack spacing={2}>
              <Typography variant="body2" color="text.secondary">
                {evaluacionDialog.pedido.estudiante_nombre} · {evaluacionDialog.pedido.profesorado_destino_nombre}
              </Typography>
              {(evaluacionDialog.pedido.materias || []).map((materia) => {
                const formEntry = evaluacionForm.find((item) => item.id === materia.id) || {
                  id: materia.id,
                  resultado: "otorgada" as const,
                  observaciones: "",
                };
                return (
                  <Box
                    key={materia.id}
                    sx={{
                      border: "1px solid",
                      borderColor: "divider",
                      borderRadius: 2,
                      p: 2,
                    }}
                  >
                    <Typography variant="subtitle2">{materia.nombre}</Typography>
                    <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ mt: 1 }}>
                      <TextField
                        select
                        label="Resultado"
                        value={formEntry.resultado}
                        onChange={(event) =>
                          setEvaluacionForm((prev) =>
                            prev.map((entry) =>
                              entry.id === materia.id
                                ? { ...entry, resultado: event.target.value as "otorgada" | "rechazada" }
                                : entry,
                            ),
                          )
                        }
                        size="small"
                        sx={{ minWidth: 160 }}
                      >
                        <MenuItem value="otorgada">Otorgada</MenuItem>
                        <MenuItem value="rechazada">Rechazada</MenuItem>
                      </TextField>
                      <TextField
                        label="Observaciones"
                        value={formEntry.observaciones}
                        onChange={(event) =>
                          setEvaluacionForm((prev) =>
                            prev.map((entry) =>
                              entry.id === materia.id ? { ...entry, observaciones: event.target.value } : entry,
                            ),
                          )
                        }
                        fullWidth
                      />
                    </Stack>
                  </Box>
                );
              })}
              <TextField
                label="Observaciones generales"
                multiline
                minRows={3}
                value={evaluacionObservaciones}
                onChange={(event) => setEvaluacionObservaciones(event.target.value)}
              />
            </Stack>
          ) : (
            <Typography variant="body2">Seleccion� un pedido para poder evaluarlo.</Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseEvaluacionDialog} disabled={evaluacionSaving}>
            Cancelar
          </Button>
          <Button variant="contained" onClick={handleSubmitEvaluacion} disabled={evaluacionSaving}>
            {evaluacionSaving ? "Guardando..." : "Guardar evaluaci�n"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={titulosDialog.open} onClose={handleCloseTitulosDialog} fullWidth maxWidth="sm">
        <DialogTitle>Registro de T�tulos</DialogTitle>
        <DialogContent dividers>
          {titulosDialog.pedido ? (
            <Stack spacing={2}>
              <Typography variant="body2" color="text.secondary">
                {titulosDialog.pedido.estudiante_nombre} · {titulosDialog.pedido.profesorado_destino_nombre}
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="N�mero de nota"
                    value={titulosForm.nota_numero}
                    onChange={(event) => setTitulosForm((prev) => ({ ...prev, nota_numero: event.target.value }))}
                    fullWidth
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="Fecha de nota"
                    type="date"
                    value={titulosForm.nota_fecha}
                    onChange={(event) => setTitulosForm((prev) => ({ ...prev, nota_fecha: event.target.value }))}
                    fullWidth
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="N�mero de disposici�n"
                    value={titulosForm.disposicion_numero}
                    onChange={(event) => setTitulosForm((prev) => ({ ...prev, disposicion_numero: event.target.value }))}
                    fullWidth
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="Fecha de disposici�n"
                    type="date"
                    value={titulosForm.disposicion_fecha}
                    onChange={(event) => setTitulosForm((prev) => ({ ...prev, disposicion_fecha: event.target.value }))}
                    fullWidth
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
              </Grid>
              <TextField
                label="Observaciones"
                multiline
                minRows={3}
                value={titulosForm.observaciones}
                onChange={(event) => setTitulosForm((prev) => ({ ...prev, observaciones: event.target.value }))}
              />
            </Stack>
          ) : (
            <Typography variant="body2">Seleccion� un pedido para completar los datos de T�tulos.</Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseTitulosDialog} disabled={titulosSaving}>
            Cancelar
          </Button>
          <Button variant="contained" onClick={handleSubmitTitulos} disabled={titulosSaving}>
            {titulosSaving ? "Guardando..." : "Guardar"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={notificarDialog.open} onClose={handleCloseNotificarDialog} fullWidth maxWidth="sm">
        <DialogTitle>Notificar al estudiante</DialogTitle>
        <DialogContent dividers>
          {notificarDialog.pedido ? (
            <Stack spacing={2}>
              <Typography variant="body2" color="text.secondary">
                {notificarDialog.pedido.estudiante_nombre} · {notificarDialog.pedido.profesorado_destino_nombre}
              </Typography>
              <Alert severity="info">
                Este mensaje se adjuntar� al correo de notificaci�n. Pod�s dejarlo en blanco para utilizar el mensaje
                institucional por defecto.
              </Alert>
              <TextField
                label="Mensaje opcional"
                multiline
                minRows={4}
                value={notificarMensaje}
                onChange={(event) => setNotificarMensaje(event.target.value)}
              />
            </Stack>
          ) : (
            <Typography variant="body2">Seleccion� un pedido que se encuentre listo para notificar.</Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseNotificarDialog} disabled={notificarSaving}>
            Cancelar
          </Button>
          <Button variant="contained" onClick={handleSubmitNotificar} disabled={notificarSaving}>
            {notificarSaving ? "Notificando..." : "Enviar notificaci�n"}
          </Button>
        </DialogActions>
      </Dialog>

      <EquivalenciaDisposicionDialog
        open={openDisposicionDialog}
        onClose={() => setOpenDisposicionDialog(false)}
        title="Registrar disposición de equivalencias"
        submitLabel="Registrar disposición"
        onSubmit={handleRegistrarDisposicion}
      />
    </Box>
  );
};

export default PedidosEquivalenciasPage;
