import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  FormControl,
  FormHelperText,
  Grid,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { useNavigate } from "react-router-dom";
import BackButton from "@/components/ui/BackButton";
import DownloadIcon from "@mui/icons-material/Download";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import AddIcon from "@mui/icons-material/Add";
import SaveIcon from "@mui/icons-material/Save";
import { useSnackbar } from "notistack";

import { useAuth } from "@/context/AuthContext";
import { PageHero, SectionTitlePill } from "@/components/ui/GradientTitles";
import { useCarreras as useCatalogoCarreras } from "@/hooks/useCarreras";
import { listarPlanes, PlanDetalle } from "@/api/carreras";
import {
  obtenerCarrerasActivas,
  TrayectoriaCarreraDetalleDTO,
  listarPedidosEquivalencia,
  crearPedidoEquivalencia,
  actualizarPedidoEquivalencia,
  eliminarPedidoEquivalencia,
  descargarNotaPedidoEquivalencia,
  PedidoEquivalenciaDTO,
  PedidoEquivalenciaPayload,
  PedidoEquivalenciaMateriaPayload,
  obtenerTrayectoriaEstudiante,
  TrayectoriaDTO,
} from "@/api/estudiantes";
import { fetchVentanas, VentanaDto } from "@/api/ventanas";
import { getErrorMessage } from "@/utils/errors";

const FORMATO_OPTIONS = ["Asignatura", "Modulo", "Taller", "Seminario", "Laboratorio", "Otro"];
const STAFF_ROLES = ["admin", "secretaria", "bedel"];
const DNI_COMPLETO_LENGTH = 8;

type MateriaRow = {
  nombre: string;
  formato: string;
  anio_cursada: string;
  nota: string;
};

type FormType = "" | "ANEXO_A" | "ANEXO_B";

type FormState = {
  tipo: FormType;
  cicloLectivo: string;
  profesoradoDestinoId: string;
  profesoradoDestinoNombre: string;
  planDestinoId: string;
  planDestinoResolucion: string;
  establecimientoOrigen: string;
  establecimientoLocalidad: string;
  establecimientoProvincia: string;
  profesoradoOrigenId: string;
  profesoradoOrigenNombre: string;
  planOrigenId: string;
  planOrigenResolucion: string;
};

const buildEmptyMateria = (): MateriaRow => ({ nombre: "", formato: "", anio_cursada: "", nota: "" });

const buildInitialForm = (): FormState => ({
  tipo: "",
  cicloLectivo: String(new Date().getFullYear()),
  profesoradoDestinoId: "",
  profesoradoDestinoNombre: "",
  planDestinoId: "",
  planDestinoResolucion: "",
  establecimientoOrigen: "",
  establecimientoLocalidad: "",
  establecimientoProvincia: "",
  profesoradoOrigenId: "",
  profesoradoOrigenNombre: "",
  planOrigenId: "",
  planOrigenResolucion: "",
});

type PreferiblePlan = {
  id: number;
  vigente?: boolean | null;
  anio_inicio?: number | null;
  resolucion?: string | null;
};

const preferPlan = <T extends PreferiblePlan>(planes: T[]): T | null => {
  if (!planes.length) return null;
  const vigente = planes.find((plan) => plan.vigente);
  if (vigente) return vigente;
  return [...planes].sort((a, b) => (b.anio_inicio || 0) - (a.anio_inicio || 0))[0] ?? null;
};
const PedidoEquivalenciasPage: React.FC = () => {
  console.log("PedidoEquivalenciasPage RENDERING", new Date().toISOString());
  const navigate = useNavigate();
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
  const [planesDestino, setPlanesDestino] = useState<PlanDetalle[]>([]);
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
    return () => {
      cancelado = true;
    };
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
    console.log("useEffect [fetchPedidos] triggered");
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
        if (!cancelado) {
          setTrayectoria(data);
        }
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
        if (!cancelado) {
          setTrayectoriaLoading(false);
        }
      });
    return () => {
      cancelado = true;
    };
  }, [canGestionar, dniObjetivo, requiereDni, enqueueSnackbar]);

  useEffect(() => {
    let cancelado = false;
    if (!form.profesoradoDestinoId) {
      setPlanesDestino([]);
      setForm((prev) => ({ ...prev, planDestinoId: "", planDestinoResolucion: "" }));
      return () => {
        cancelado = true;
      };
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
          if (prev.planDestinoId === nextId && prev.planDestinoResolucion === nextResol) {
            return prev;
          }
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
    return () => {
      cancelado = true;
    };
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
        if (prev.planOrigenResolucion === nextResol) {
          return prev;
        }
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
    if (!trayectoria || !form.profesoradoOrigenId || !form.planOrigenId || selectedId) {
      return;
    }
    const key = `${form.profesoradoOrigenId}|${form.planOrigenId}`;
    if (!key.trim() || autoFillKey === key) {
      return;
    }
    const plan = trayectoria.carton.find(
      (item) => String(item.profesorado_id) === form.profesoradoOrigenId && String(item.plan_id) === form.planOrigenId,
    );
    if (!plan) {
      return;
    }
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

  const buildPayload = (): PedidoEquivalenciaPayload => ({
    tipo: form.tipo as "ANEXO_A" | "ANEXO_B",
    ciclo_lectivo: form.cicloLectivo.trim() || undefined,
    profesorado_destino_id: form.profesoradoDestinoId ? Number(form.profesoradoDestinoId) : undefined,
    profesorado_destino_nombre: form.profesoradoDestinoNombre.trim() || undefined,
    plan_destino_id: form.planDestinoId ? Number(form.planDestinoId) : undefined,
    plan_destino_resolucion: form.planDestinoResolucion.trim() || undefined,
    profesorado_origen_nombre:
      form.tipo === "ANEXO_A" ? form.profesoradoOrigenNombre.trim() || undefined : undefined,
    plan_origen_resolucion:
      form.tipo === "ANEXO_A" ? form.planOrigenResolucion.trim() || undefined : undefined,
    establecimiento_origen:
      form.tipo === "ANEXO_B" ? form.establecimientoOrigen.trim() || undefined : undefined,
    establecimiento_localidad:
      form.tipo === "ANEXO_B" ? form.establecimientoLocalidad.trim() || undefined : undefined,
    establecimiento_provincia:
      form.tipo === "ANEXO_B" ? form.establecimientoProvincia.trim() || undefined : undefined,
    materias: materias
      .filter((item) => item.nombre.trim())
      .map<PedidoEquivalenciaMateriaPayload>((item) => ({
        nombre: item.nombre.trim(),
        formato: item.formato.trim() || undefined,
        anio_cursada: item.anio_cursada.trim() || undefined,
        nota: item.nota.trim() || undefined,
      })),
  });

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
    const payload = buildPayload();
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
  useEffect(() => {
    console.log("PedidoEquivalenciasPage MOUNTED");
    return () => console.log("PedidoEquivalenciasPage UNMOUNTED");
  }, []);

  return (
    <Box sx={{ p: 3 }}>
      <BackButton
        fallbackPath="/estudiantes"
        onClick={() => {
          console.log("BackButton Clicked - Attempting navigation");
          setSelectedId(null);
          setTimeout(() => {
            console.log("Calling navigate('/estudiantes')");
            navigate("/estudiantes", { replace: true });
          }, 0);
        }}
      />
      <PageHero
        title="Pedido de equivalencias"
        subtitle="Generá la nota oficial (Anexo A o B) y gestioná tus presentaciones ante Secretaría."
      />

      {!ventanaActiva && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          No hay una ventana activa para registrar pedidos de equivalencias.
        </Alert>
      )}

      {canGestionar && (
        <TextField
          label="DNI del estudiante"
          value={dniManual}
          onChange={(event) => setDniManual(event.target.value.replace(/\D/g, ""))}
          fullWidth
          size="small"
          sx={{ maxWidth: 360, mb: 2 }}
          helperText="Ingresá los 8 dígitos del DNI del estudiante para gestionar en su nombre."
          inputProps={{ maxLength: DNI_COMPLETO_LENGTH, inputMode: "numeric", pattern: "[0-9]*" }}
          error={dniParcial}
        />
      )}

      {requiereDni && (
        <Alert severity="info" sx={{ mb: 2 }}>
          {dniObjetivo.length === 0
            ? "Ingresá un DNI de 8 dígitos para cargar o revisar los pedidos."
            : "Completá los 8 dígitos del DNI para continuar."}
        </Alert>
      )}

      <Grid container spacing={3} alignItems="flex-start">
        <Grid item xs={12} lg={4}>
          <Card variant="outlined">
            <CardContent>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                <Typography variant="subtitle1" fontWeight={600}>
                  Pedidos registrados
                </Typography>
                <Button size="small" startIcon={<AddIcon fontSize="small" />} onClick={handleNuevoPedido}>
                  Nuevo
                </Button>
              </Stack>
              {loadingPedidos ? (
                <Typography variant="body2" color="text.secondary">
                  Cargando pedidos...
                </Typography>
              ) : pedidos.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  Todavía no registraste pedidos en esta ventana.
                </Typography>
              ) : (
                <Stack spacing={1.5}>
                  {pedidos.map((pedido) => (
                    <Card
                      key={pedido.id}
                      variant={pedido.id === selectedId ? "elevation" : "outlined"}
                      sx={{
                        borderColor: pedido.id === selectedId ? "primary.main" : "divider",
                        cursor: "pointer",
                      }}
                      onClick={() => handleSelectPedido(pedido)}
                    >
                      <CardContent sx={{ pb: "12px !important" }}>
                        <Stack spacing={1}>
                          <Stack direction="row" justifyContent="space-between" alignItems="center">
                            <Typography variant="subtitle2" fontWeight={600}>
                              {pedido.profesorado_destino_nombre || "Profesorado sin nombre"}
                            </Typography>
                            <Chip
                              size="small"
                              label={pedido.estado_display}
                              color={pedido.estado === "final" ? "success" : "default"}
                            />
                          </Stack>
                          {canGestionar && (
                            <Typography variant="caption" color="text.secondary">
                              {pedido.estudiante_nombre || ""} · DNI {pedido.estudiante_dni}
                            </Typography>
                          )}
                          <Stack direction="row" spacing={1} justifyContent="flex-end">
                            <Tooltip title="Editar">
                              <span>
                                <IconButton size="small" onClick={() => handleSelectPedido(pedido)}>
                                  <EditOutlinedIcon fontSize="small" />
                                </IconButton>
                              </span>
                            </Tooltip>
                            <Tooltip title="Descargar">
                              <span>
                                <IconButton
                                  size="small"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    handleSelectPedido(pedido);
                                    handleDescargar();
                                  }}
                                  disabled={descargando && pedido.id === selectedId}
                                >
                                  <DownloadIcon fontSize="small" />
                                </IconButton>
                              </span>
                            </Tooltip>
                            <Tooltip title="Eliminar">
                              <span>
                                <IconButton
                                  size="small"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    handleEliminar(pedido.id);
                                  }}
                                  disabled={eliminandoId === pedido.id}
                                >
                                  <DeleteOutlineIcon fontSize="small" />
                                </IconButton>
                              </span>
                            </Tooltip>
                          </Stack>
                        </Stack>
                      </CardContent>
                    </Card>
                  ))}
                </Stack>
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} lg={8}>
          <Stack spacing={3}>
            <Card variant="outlined">
              <CardContent>
                <Grid container spacing={2}>
                  <Grid item xs={12} md={6}>
                    <TextField
                      select
                      label="Tipo de formulario"
                      value={form.tipo}
                      onChange={(event) => {
                        const value = event.target.value as FormType;
                        setForm((prev) => ({ ...prev, tipo: value }));
                        if (!value) {
                          setMaterias([buildEmptyMateria()]);
                        }
                      }}
                      fullWidth
                      size="small"
                    >
                      <MenuItem value="">Seleccioná una opción</MenuItem>
                      <MenuItem value="ANEXO_A">Anexo A - Interno IPES</MenuItem>
                      <MenuItem value="ANEXO_B">Anexo B - Otra institución</MenuItem>
                    </TextField>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField
                      label="Ciclo lectivo"
                      value={form.cicloLectivo}
                      onChange={(event) => setForm((prev) => ({ ...prev, cicloLectivo: event.target.value }))}
                      fullWidth
                      size="small"
                      disabled={datosDeshabilitados}
                    />
                  </Grid>
                </Grid>
              </CardContent>
            </Card>

            <Box
              sx={{
                opacity: datosDeshabilitados ? 0.5 : 1,
                pointerEvents: datosDeshabilitados ? "none" : "auto",
                transition: "opacity 0.2s ease",
              }}
            >
              <SectionTitlePill title="Datos del trayecto" />
              <Card variant="outlined" sx={{ mb: 3 }}>
                <CardContent>
                  <Grid container spacing={2}>
                    <Grid item xs={12} md={6}>
                      <FormControl fullWidth size="small" disabled={datosDeshabilitados || !puedeEditar}>
                        <InputLabel>Profesorado destino (IPES)</InputLabel>
                        <Select
                          label="Profesorado destino (IPES)"
                          value={form.profesoradoDestinoId}
                          onChange={(event) => {
                            const value = String(event.target.value);
                            const seleccionado = carrerasDestino.find((item) => String(item.id) === value);
                            setForm((prev) => ({
                              ...prev,
                              profesoradoDestinoId: value,
                              profesoradoDestinoNombre: seleccionado?.nombre || "",
                            }));
                          }}
                        >
                          <MenuItem value="">Seleccioná...</MenuItem>
                          {carrerasDestino.map((item) => (
                            <MenuItem key={item.id} value={String(item.id)}>
                              {item.nombre}
                            </MenuItem>
                          ))}
                        </Select>
                        <FormHelperText>
                          El nombre seleccionado se utilizará en la nota final.
                        </FormHelperText>
                      </FormControl>
                    </Grid>
                    <Grid item xs={12}>
                      <TextField
                        label="Resolución destino"
                        value={form.planDestinoResolucion}
                        fullWidth
                        size="small"
                        InputProps={{ readOnly: true }}
                        disabled
                        helperText="Se completa automáticamente con el plan vigente."
                      />
                    </Grid>

                    {esAnexoA && (
                      <>
                        <Grid item xs={12} md={6}>
                          <FormControl
                            fullWidth
                            size="small"
                            disabled={datosDeshabilitados || !puedeEditar || carrerasLoading || carrerasEstudiante.length === 0}
                          >
                            <InputLabel>Profesorado de origen (IPES)</InputLabel>
                            <Select
                              label="Profesorado de origen (IPES)"
                              value={form.profesoradoOrigenId}
                              onChange={(event) => {
                                const value = String(event.target.value);
                                const carrera = carrerasEstudiante.find((item) => String(item.profesorado_id) === value);
                                setForm((prev) => ({
                                  ...prev,
                                  profesoradoOrigenId: value,
                                  profesoradoOrigenNombre: carrera?.nombre || "",
                                  planOrigenId: "",
                                  planOrigenResolucion: "",
                                }));
                                setAutoFillKey("");
                              }}
                            >
                              <MenuItem value="">Seleccioná...</MenuItem>
                              {carrerasEstudiante.map((carrera) => (
                                <MenuItem key={carrera.profesorado_id} value={String(carrera.profesorado_id)}>
                                  {carrera.nombre}
                                </MenuItem>
                              ))}
                            </Select>
                            <FormHelperText>Se tomará como profesorado de origen acreditado.</FormHelperText>
                          </FormControl>
                        </Grid>
                        <Grid item xs={12} md={6}>
                          <FormControl fullWidth size="small" disabled={datosDeshabilitados || !puedeEditar || !planesOrigenDisponibles.length}>
                            <InputLabel>Plan / resolución de origen</InputLabel>
                            <Select
                              label="Plan / resolución de origen"
                              value={form.planOrigenId}
                              onChange={(event) => {
                                const value = String(event.target.value);
                                const plan = planesOrigenDisponibles.find((item) => String(item.id) === value);
                                setForm((prev) => ({
                                  ...prev,
                                  planOrigenId: value,
                                  planOrigenResolucion: plan?.resolucion || `Plan ${plan?.id ?? ""}`,
                                }));
                                setAutoFillKey("");
                              }}
                            >
                              <MenuItem value="">Seleccioná...</MenuItem>
                              {planesOrigenDisponibles.map((plan) => (
                                <MenuItem key={plan.id} value={String(plan.id)}>
                                  {plan.resolucion || `Plan ${plan.id}`} {plan.vigente ? "(vigente)" : ""}
                                </MenuItem>
                              ))}
                            </Select>
                            <FormHelperText>
                              Resolución seleccionada: {form.planOrigenResolucion || "—"}
                            </FormHelperText>
                          </FormControl>
                        </Grid>
                      </>
                    )}

                    {esAnexoB && (
                      <>
                        <Grid item xs={12} md={4}>
                          <TextField
                            label="Establecimiento de origen"
                            value={form.establecimientoOrigen}
                            onChange={(event) => setForm((prev) => ({ ...prev, establecimientoOrigen: event.target.value }))}
                            fullWidth
                            size="small"
                            disabled={datosDeshabilitados || !puedeEditar}
                          />
                        </Grid>
                        <Grid item xs={12} md={4}>
                          <TextField
                            label="Ciudad / localidad"
                            value={form.establecimientoLocalidad}
                            onChange={(event) => setForm((prev) => ({ ...prev, establecimientoLocalidad: event.target.value }))}
                            fullWidth
                            size="small"
                            disabled={datosDeshabilitados || !puedeEditar}
                          />
                        </Grid>
                        <Grid item xs={12} md={4}>
                          <TextField
                            label="Provincia"
                            value={form.establecimientoProvincia}
                            onChange={(event) => setForm((prev) => ({ ...prev, establecimientoProvincia: event.target.value }))}
                            fullWidth
                            size="small"
                            disabled={datosDeshabilitados || !puedeEditar}
                          />
                        </Grid>
                      </>
                    )}
                  </Grid>
                </CardContent>
              </Card>

              <SectionTitlePill title="Detalle de espacios curriculares" />
              {trayectoriaLoading && esAnexoA && (
                <Alert severity="info" sx={{ mb: 2 }}>
                  Cargando espacios aprobados del plan de origen...
                </Alert>
              )}
              <Card variant="outlined">
                <CardContent>
                  <Stack spacing={1.5}>
                    {materias.map((materia, index) => (
                      <Grid container spacing={1} alignItems="center" key={`materia-${index}`}>
                        <Grid item xs={12} md={5}>
                          <TextField
                            label="Nombre del espacio curricular"
                            value={materia.nombre}
                            onChange={(event) => handleMateriaChange(index, "nombre", event.target.value)}
                            size="small"
                            fullWidth
                            disabled={datosDeshabilitados || !puedeEditar}
                          />
                        </Grid>
                        <Grid item xs={12} md={3}>
                          <TextField
                            select
                            label="Formato / tipo"
                            value={materia.formato}
                            onChange={(event) => handleMateriaChange(index, "formato", event.target.value)}
                            size="small"
                            fullWidth
                            disabled={datosDeshabilitados || !puedeEditar}
                          >
                            <MenuItem value="">Seleccioná...</MenuItem>
                            {FORMATO_OPTIONS.map((option) => (
                              <MenuItem key={option} value={option}>
                                {option}
                              </MenuItem>
                            ))}
                          </TextField>
                        </Grid>
                        <Grid item xs={6} md={2}>
                          <TextField
                            label="Año de cursada"
                            value={materia.anio_cursada}
                            onChange={(event) => handleMateriaChange(index, "anio_cursada", event.target.value)}
                            size="small"
                            fullWidth
                            disabled={datosDeshabilitados || !puedeEditar}
                          />
                        </Grid>
                        <Grid item xs={4} md={1}>
                          <TextField
                            label="Nota"
                            value={materia.nota}
                            onChange={(event) => handleMateriaChange(index, "nota", event.target.value)}
                            size="small"
                            fullWidth
                            disabled={datosDeshabilitados || !puedeEditar}
                          />
                        </Grid>
                        <Grid item xs={2} md={1} textAlign="right">
                          <IconButton onClick={() => handleRemoveMateria(index)} disabled={datosDeshabilitados || !puedeEditar}>
                            <DeleteOutlineIcon fontSize="small" />
                          </IconButton>
                        </Grid>
                      </Grid>
                    ))}
                    <Button
                      variant="text"
                      startIcon={<AddIcon />}
                      onClick={handleAddMateria}
                      disabled={datosDeshabilitados || !puedeEditar}
                    >
                      Agregar fila
                    </Button>
                  </Stack>
                </CardContent>
              </Card>

              {selectedPedido && !selectedPedido.puede_editar && (
                <Alert severity="info" sx={{ mt: 2 }}>
                  Este pedido ya fue finalizado. Sólo el personal autorizado puede modificarlo.
                </Alert>
              )}

              <Stack direction="row" spacing={2} justifyContent="flex-end" sx={{ mt: 3 }}>
                <Button
                  variant="outlined"
                  startIcon={<SaveIcon />}
                  onClick={handleGuardar}
                  disabled={!puedeGuardar || saving}
                >
                  {selectedId ? "Guardar cambios" : "Guardar borrador"}
                </Button>
                <Button
                  variant="contained"
                  startIcon={<DownloadIcon />}
                  onClick={handleDescargar}
                  disabled={!puedeDescargar || descargando}
                >
                  Descargar nota
                </Button>
              </Stack>
              {!selectedId && (
                <Typography variant="caption" color="text.secondary">
                  Guardá el pedido para habilitar la descarga del PDF.
                </Typography>
              )}
            </Box>
          </Stack>
        </Grid>
      </Grid>
    </Box >
  );
};

export default PedidoEquivalenciasPage;
