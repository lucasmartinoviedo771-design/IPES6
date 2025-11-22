import { useForm, Controller } from "react-hook-form";
import { useState, useEffect, useMemo } from "react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  apiGetPreinscripcionByCodigo, apiUpdatePreinscripcion,
  apiConfirmarPreinscripcion, apiObservarPreinscripcion, apiRechazarPreinscripcion, apiCambiarCarrera, PreinscripcionDTO,
  eliminarPreinscripcion, apiGetChecklist, apiPutChecklist, ChecklistDTO, apiListPreDocs, apiUploadPreDoc, PreinscripcionUpdatePayload,
  listarPreinscripcionesAlumno, agregarCarreraPreinscripcion
} from "@/api/preinscripciones";
import { fetchCarreras } from "@/api/carreras";
import {
  Box, Button, Chip, CircularProgress, Grid, MenuItem, Paper, Stack, TextField, Typography, Divider, Checkbox, FormControlLabel, Switch,
  Dialog, DialogTitle, DialogContent, DialogActions, FormControl, InputLabel, Select, List, ListItemButton, ListItemText, FormHelperText
} from "@mui/material";
import dayjs from "dayjs";
import { enqueueSnackbar } from "notistack";
import { useNavigate } from "react-router-dom";
import FinalConfirmationDialog from "@/components/ui/FinalConfirmationDialog";

import { preinscripcionSchema, PreinscripcionForm } from "./schema";
import { defaultValues as formDefaults } from "./defaultValues";

const toDisplayDate = (value: string): string => {
  if (!value) return "";
  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    return `${day}/${month}/${year}`;
  }
  return value;
};

function EstadoChip({ estado }: { estado: PreinscripcionDTO["estado"] }) {
  const map: Record<string, "default" | "success" | "warning" | "error"> = {
    enviada: "default", observada: "warning", confirmada: "success", rechazada: "error", borrador: "default",
  };
  return <Chip label={estado} color={map[estado] ?? "default"} size="small" sx={{ borderRadius: 2, textTransform: "capitalize" }} />;
}

function FotoPreviewBox({ dataUrl }: { dataUrl?: string }) {
  const [error, setError] = useState(false);
  useEffect(() => { setError(false); }, [dataUrl]);
  return (
    <Box sx={{ mt:1, width: 100, height: 120, overflow:'hidden', border:'1px solid #ddd', borderRadius:1, display:'flex', alignItems:'center', justifyContent:'center', bgcolor:'#fafafa' }}>
      {dataUrl && !error ? (
        <img src={String(dataUrl)} alt="Foto 4x4" onError={() => setError(true)} style={{ width:'100%', height:'100%', objectFit:'cover' }} />
      ) : (
        <Typography variant="caption" color={error ? 'error' : 'text.secondary'}>{error ? 'Error al cargar foto' : 'Sin foto 4x4'}</Typography>
      )}
    </Box>
  );
}

export default function PreConfirmEditor({ codigo }: { codigo: string }) {
  const qc = useQueryClient();
  const { data, isLoading, isError } = useQuery({
    queryKey: ["preinscripcion", codigo],
    queryFn: () => apiGetPreinscripcionByCodigo(codigo),
  });

  // Cargar checklist asociado para prellenar documentación
  const checklistQ = useQuery({
    queryKey: ["preinscripcion", codigo, "checklist"],
    queryFn: async () => {
      if (!data?.id) return null as any;
      return await apiGetChecklist(data.id);
    },
    enabled: !!data?.id,
  });

  const carrerasQ = useQuery({ queryKey: ["carreras"], queryFn: fetchCarreras });

  const { control, handleSubmit, reset, watch, setValue, register } = useForm<PreinscripcionForm>({
    resolver: zodResolver(preinscripcionSchema) as any,
    defaultValues: formDefaults,
  });

  // Documentación requerida (checklist)
  const [docs, setDocs] = useState<{ [k: string]: boolean }>({
    dni_legalizado: false,
    fotos_4x4: false,
    folios_oficio_ok: false,
    certificado_salud: false,
    titulo_secundario_legalizado: false,
    certificado_titulo_en_tramite: false,
    analitico_legalizado: false,
    certificado_alumno_regular_sec: false,
    adeuda_materias: false,
    curso_introductorio_aprobado: false,
    titulo_terciario_univ: false,
    incumbencia: false,
    // mirrors para compatibilidad con UI existente
    titulo_secundario: false,
    titulo_en_tramite: false,
  });

  // Asegurar registro del campo virtual de foto para que watch() funcione
  useEffect(() => {
    try { (register as any)('foto_dataUrl'); } catch {}
  }, [register]);

  // Setear todos los valores cuando llega `data` (incluye saneo de null/undefined)
  useEffect(() => {
    if (!data) return;

    const extra = ((data as any).datos_extra) || {};

    // Sanear valores provenientes de la API contra los defaults del formulario
    const sanitized: PreinscripcionForm = Object.keys(formDefaults).reduce((acc, key) => {
      const k = key as keyof PreinscripcionForm;
      const dv = formDefaults[k] as any;
      let v: any = (extra as any)[k];
      if (v === null || v === undefined) {
        (acc as any)[k] = dv;
      } else if (typeof dv === 'number') {
        const n = typeof v === 'number' ? v : Number(v);
        (acc as any)[k] = Number.isFinite(n) ? n : dv;
      } else if (typeof dv === 'boolean') {
        if (typeof v === 'boolean') {
          (acc as any)[k] = v;
        } else {
          const normalized = String(v).trim().toLowerCase();
          if (!normalized) {
            (acc as any)[k] = dv;
          } else if (
            [
              'si',
              'sí',
              'true',
              '1',
              'aprobado',
              'aprobada',
              'entregado',
              'entregada',
              'ok',
              'presentado',
            ].includes(normalized)
          ) {
            (acc as any)[k] = true;
          } else if (
            [
              'no',
              'false',
              '0',
              'desaprobado',
              'desaprobada',
              'no_entregada',
              'no entregada',
              'noentregada',
              'noentregado',
              'pendiente',
              'ausente',
            ].includes(normalized)
          ) {
            (acc as any)[k] = false;
          } else {
            (acc as any)[k] = dv;
          }
        }
      } else if (typeof dv === 'string') {
        (acc as any)[k] = String(v);
      } else {
        (acc as any)[k] = v;
      }
      return acc;
    }, { ...formDefaults } as PreinscripcionForm);

    // Overwrites desde los campos normalizados del backend
    const alumnoDto = data.alumno as any;
    sanitized.nombres = String(alumnoDto?.nombres ?? alumnoDto?.nombre ?? formDefaults.nombres);
    sanitized.apellido = String(alumnoDto?.apellido ?? formDefaults.apellido);
    sanitized.dni = String(alumnoDto?.dni ?? sanitized.dni ?? "");
    sanitized.cuil = String(alumnoDto?.cuil ?? (extra as any)?.cuil ?? sanitized.cuil ?? "");
    sanitized.email = String(alumnoDto?.email ?? sanitized.email ?? "");
    sanitized.tel_movil = String(alumnoDto?.telefono ?? sanitized.tel_movil ?? "");
    sanitized.domicilio = String(alumnoDto?.domicilio ?? sanitized.domicilio ?? "");
    const rawBirthDate =
      alumnoDto?.fecha_nacimiento ??
      (extra as any)?.fecha_nacimiento ??
      sanitized.fecha_nacimiento ??
      "";
    sanitized.fecha_nacimiento = toDisplayDate(String(rawBirthDate));
    sanitized.nacionalidad = String((extra as any)?.nacionalidad ?? sanitized.nacionalidad ?? "");
    sanitized.carrera_id = Number((data as any).carrera?.id ?? 0);
    const cohorteFallback = (extra as any)?.cohorte ?? (data as any)?.anio ?? formDefaults.cohorte ?? "";
    const cohorteResolved = cohorteFallback ? String(cohorteFallback) : String(new Date().getFullYear());
    sanitized.cohorte = cohorteResolved;

    const fotoExtra =
      (extra as any)?.foto_dataUrl ||
      (extra as any)?.foto_4x4_dataurl ||
      (data as any)?.foto_4x4_dataurl ||
      null;
    sanitized.foto_dataUrl = fotoExtra ? String(fotoExtra) : "";
    const fotoWExtra = (extra as any)?.fotoW ?? (extra as any)?.foto_4x4_w;
    const fotoHExtra = (extra as any)?.fotoH ?? (extra as any)?.foto_4x4_h;
    const parsedW = Number(fotoWExtra);
    const parsedH = Number(fotoHExtra);
    sanitized.fotoW = Number.isFinite(parsedW) ? parsedW : undefined;
    sanitized.fotoH = Number.isFinite(parsedH) ? parsedH : undefined;

    reset(sanitized as any);
  }, [data, reset]);

  // Prefill checklist cuando esté disponible
  useEffect(() => {
    const cl = checklistQ.data as ChecklistDTO | null | undefined;
    if (!cl) return;
    setDocs({
      dni_legalizado: !!cl.dni_legalizado,
      fotos_4x4: !!cl.fotos_4x4,
      folios_oficio_ok: (cl.folios_oficio || 0) >= 3,
      certificado_salud: !!cl.certificado_salud,
      titulo_secundario_legalizado: !!cl.titulo_secundario_legalizado,
      certificado_titulo_en_tramite: !!cl.certificado_titulo_en_tramite,
      analitico_legalizado: !!cl.analitico_legalizado,
      certificado_alumno_regular_sec: !!cl.certificado_alumno_regular_sec,
      adeuda_materias: !!cl.adeuda_materias,
      curso_introductorio_aprobado: !!cl.curso_introductorio_aprobado,
      titulo_terciario_univ: !!cl.titulo_terciario_univ,
      incumbencia: !!cl.incumbencia,
      // mirrors para la UI
      titulo_secundario: !!cl.titulo_secundario_legalizado,
      titulo_en_tramite: !!cl.certificado_titulo_en_tramite,
    });
    setValue("curso_introductorio_aprobado", !!cl.curso_introductorio_aprobado, { shouldDirty: false });
    setAdeudaDetalle({
      materias: cl.adeuda_materias_detalle || "",
      institucion: cl.escuela_secundaria || "",
    });
  }, [checklistQ.data]);

  const mUpdate = useMutation({
    mutationFn: (values: PreinscripcionForm) => {
      const {
        nombres,
        apellido,
        dni,
        cuil,
        email,
        tel_movil,
        domicilio,
        fecha_nacimiento,
        carrera_id,
        ...datos_extra
      } = values;

      const payload: PreinscripcionUpdatePayload = {
        alumno: {
          dni,
          nombres,
          apellido,
          cuil: cuil || null,
          email: email || null,
          telefono: tel_movil || null,
          domicilio: domicilio || null,
          fecha_nacimiento: fecha_nacimiento || null,
        },
      };

      const extra = datos_extra as Record<string, unknown>;
      if (Object.keys(extra).length) {
        payload.datos_extra = extra;
      }

      const carreraValue = Number(carrera_id);
      if (Number.isFinite(carreraValue) && carreraValue > 0) {
        payload.carrera_id = carreraValue;
      }

      return apiUpdatePreinscripcion(codigo, payload);
    },
    onSuccess: () => { enqueueSnackbar("Cambios guardados", { variant: "success" }); qc.invalidateQueries({ queryKey: ["preinscripcion", codigo] }); },
    onError: () => enqueueSnackbar("No se pudo guardar", { variant: "error" })
  });



  // Listado de documentos (para detectar una foto ya subida por archivos)
  const docsQ = useQuery({
    queryKey: ["preinscripcion", data?.id, "docs"],
    queryFn: async () => (data?.id ? await apiListPreDocs(data.id) : []),
    enabled: !!data?.id,
  });

  // Subida directa de la foto al endpoint de documentos
  const mUploadFoto = useMutation({
    mutationFn: async (file: File) => {
      if (!data?.id) throw new Error("ID faltante");
      return await apiUploadPreDoc(data.id, "foto4x4", file);
    },
    onSuccess: () => { enqueueSnackbar("Foto subida", { variant: "success" }); qc.invalidateQueries({ queryKey: ["preinscripcion", data?.id, "docs"] }); },
    onError: () => enqueueSnackbar("No se pudo subir la foto", { variant: "error" })
  });
  const [adeudaDetalle, setAdeudaDetalle] = useState<{ materias: string; institucion: string }>({ materias: "", institucion: "" });
  const libretaEntregada = watch("libreta_entregada");
  const condicionSaludActiva = watch("condicion_salud_informada");
  useEffect(() => {
    if (!condicionSaludActiva) {
      setValue("condicion_salud_detalle", "", { shouldDirty: false });
    }
  }, [condicionSaludActiva, setValue]);
  // Estado completo (criterio similar al backend)
  const selectedCarreraId = Number(watch("carrera_id") || data?.carrera?.id || 0);
  const selectedCarrera = useMemo(() => {
    if (!selectedCarreraId) {
      return (data as any)?.carrera;
    }
    const lista = (carrerasQ.data as any[]) || [];
    return lista.find((c) => Number(c.id) === selectedCarreraId) || (data as any)?.carrera;
  }, [selectedCarreraId, carrerasQ.data, data]);
  const isCertificacionDocente = Boolean(
    selectedCarrera?.es_certificacion_docente ||
      (checklistQ.data as ChecklistDTO | undefined)?.es_certificacion_docente,
  );

  useEffect(() => {
    if (!isCertificacionDocente) {
      setDocs((prev) => {
        if (!prev.titulo_terciario_univ && !prev.incumbencia && !prev.certificado_alumno_regular_sec && !prev.adeuda_materias) {
          return prev;
        }
        return {
          ...prev,
          titulo_terciario_univ: false,
          incumbencia: false,
          certificado_alumno_regular_sec: prev.certificado_alumno_regular_sec,
          adeuda_materias: prev.adeuda_materias,
        };
      });
    } else {
      setDocs((prev) => ({
        ...prev,
        certificado_alumno_regular_sec: false,
        adeuda_materias: false,
      }));
      setAdeudaDetalle({ materias: "", institucion: "" });
    }
  }, [isCertificacionDocente]);

  const docsGeneralesBase = docs.dni_legalizado && docs.fotos_4x4 && docs.certificado_salud && docs.folios_oficio_ok;
  const docsGeneralesOk = docsGeneralesBase && (!isCertificacionDocente || docs.incumbencia);
  const tituloSecundarioPresentado = isCertificacionDocente
    ? !!docs.titulo_terciario_univ
    : !!(
        docs.titulo_secundario_legalizado ||
        docs.certificado_titulo_en_tramite ||
        docs.analitico_legalizado
      );

  const allDocs = isCertificacionDocente
    ? !!(docsGeneralesOk && docs.titulo_terciario_univ)
    : !!(docsGeneralesOk && tituloSecundarioPresentado && !docs.adeuda_materias);

  const anyMainSelected = isCertificacionDocente
    ? false
    : !!(docs.titulo_secundario_legalizado || docs.certificado_titulo_en_tramite || docs.analitico_legalizado);

  const alumnoDni = data?.alumno?.dni ?? "";
  const preinsAlumnoQ = useQuery({
    queryKey: ["preinscripciones", "alumno", alumnoDni],
    queryFn: () => listarPreinscripcionesAlumno(alumnoDni),
    enabled: !!alumnoDni,
    staleTime: 30_000,
  });
  
  const preinscripcionesAlumno = (preinsAlumnoQ.data as PreinscripcionDTO[] | undefined) ?? [];
  const existingCarreraIds = new Set<number>(
    preinscripcionesAlumno
      .map((p: any) => p?.carrera?.id)
      .filter((id: number | undefined): id is number => typeof id === "number"),
  );
  const availableCarreras = (carrerasQ.data ?? []).filter((c: any) => !existingCarreraIds.has(c.id));


  // Exclusividad en opciones de Secundario: solo una permitida
  const pickSecundario = (
    key: 'titulo_secundario' | 'titulo_en_tramite' | 'analitico_legalizado' | 'titulo_secundario_legalizado' | 'certificado_titulo_en_tramite',
    checked: boolean,
  ) => {
    const mapped: 'titulo_secundario_legalizado' | 'certificado_titulo_en_tramite' | 'analitico_legalizado' =
      key === 'titulo_secundario' ? 'titulo_secundario_legalizado'
      : key === 'titulo_en_tramite' ? 'certificado_titulo_en_tramite'
      : (key as any);
    setDocs(prev => {
      const next = {
        ...prev,
        titulo_secundario_legalizado: false,
        certificado_titulo_en_tramite: false,
        analitico_legalizado: false,
        titulo_secundario: false,
        titulo_en_tramite: false,
      } as typeof prev;
      (next as any)[mapped] = !!checked;
      next.titulo_secundario = mapped === 'titulo_secundario_legalizado' ? !!checked : false;
      next.titulo_en_tramite = mapped === 'certificado_titulo_en_tramite' ? !!checked : false;
      const anyMain = !!(next.titulo_secundario_legalizado || next.certificado_titulo_en_tramite || next.analitico_legalizado);
      if (anyMain) {
        next.certificado_alumno_regular_sec = false;
        next.adeuda_materias = false;
        setAdeudaDetalle({ materias: "", institucion: "" });
      }
      return next;
    });
  };

  // DDJJ / Nota compromiso (requerida si es condicional)
  const [ddjjOk, setDdjjOk] = useState<boolean>(false);
  const canConfirm = allDocs || ddjjOk;

  const buildChecklistPayload = (): ChecklistDTO => ({
    dni_legalizado: !!docs.dni_legalizado,
    fotos_4x4: !!docs.fotos_4x4,
    certificado_salud: !!docs.certificado_salud,
    folios_oficio: docs.folios_oficio_ok ? 3 : 0,
    titulo_secundario_legalizado: !!docs.titulo_secundario_legalizado,
    certificado_titulo_en_tramite: !!docs.certificado_titulo_en_tramite,
    analitico_legalizado: !!docs.analitico_legalizado,
    certificado_alumno_regular_sec: !!docs.certificado_alumno_regular_sec,
    adeuda_materias: !!docs.adeuda_materias,
    adeuda_materias_detalle: adeudaDetalle.materias,
    escuela_secundaria: adeudaDetalle.institucion,
    curso_introductorio_aprobado: !!docs.curso_introductorio_aprobado,
    titulo_terciario_univ: !!docs.titulo_terciario_univ,
    incumbencia: !!docs.incumbencia,
    es_certificacion_docente: isCertificacionDocente,
  });
  const mConfirm = useMutation({
    mutationFn: async () => {
      return apiConfirmarPreinscripcion(codigo, buildChecklistPayload());
    },
    onSuccess: () => {
      enqueueSnackbar("Preinscripción confirmada", { variant: "success" });
      qc.invalidateQueries({ queryKey: ["preinscripcion", codigo] });
      qc.invalidateQueries({ queryKey: ["preinscripciones"] });
    },
    onError: () => enqueueSnackbar("No se pudo confirmar", { variant: "error" })
  });

  const [confirmInscripcionOpen, setConfirmInscripcionOpen] = useState(false);

  const handleConfirmInscripcionClick = () => {
    if (!canConfirm || mUpdate.isPending) return;
    setConfirmInscripcionOpen(true);
  };

  const executeConfirmInscripcion = () => {
    mConfirm.mutate(undefined, {
      onSettled: () => {
        setConfirmInscripcionOpen(false);
      },
    });
  };

  const cancelConfirmInscripcion = () => {
    if (mConfirm.isPending) return;
    setConfirmInscripcionOpen(false);
  };

  const mSaveChecklist = useMutation({
    mutationFn: async () => {
      if (!data?.id) throw new Error("ID de preinscripcion no encontrado");
      return await apiPutChecklist(data.id, buildChecklistPayload());
    },
    onSuccess: () => { enqueueSnackbar("Checklist guardado", { variant: "success" }); qc.invalidateQueries({ queryKey: ["preinscripcion", codigo, "checklist"] }); },
    onError: () => enqueueSnackbar("No se pudo guardar el checklist", { variant: "error" })
  });


  const mObservar = useMutation({
    mutationFn: (motivo: string) => apiObservarPreinscripcion(codigo, motivo),
    onSuccess: () => { enqueueSnackbar("Marcada como observada", { variant: "info" }); qc.invalidateQueries({ queryKey: ["preinscripcion", codigo] }); },
    onError: () => enqueueSnackbar("No se pudo observar", { variant: "error" })
  });

  const mRechazar = useMutation({
    mutationFn: (motivo: string) => apiRechazarPreinscripcion(codigo, motivo),
    onSuccess: () => { enqueueSnackbar("Preinscripción rechazada", { variant: "warning" }); qc.invalidateQueries({ queryKey: ["preinscripcion", codigo] }); },
    onError: () => enqueueSnackbar("No se pudo rechazar", { variant: "error" })
  });

  const mCambiarCarrera = useMutation({
    mutationFn: (carrera_id: number) => apiCambiarCarrera(codigo, carrera_id),
    onSuccess: () => {
      enqueueSnackbar("Profesorado actualizado", { variant: "success" });
      qc.invalidateQueries({ queryKey: ["preinscripcion", codigo] });
      qc.invalidateQueries({ queryKey: ["preinscripciones", "alumno", alumnoDni] });
    },
    onError: (error: any) => {
      const msg = error?.response?.data?.message || "No se pudo cambiar el profesorado";
      enqueueSnackbar(msg, { variant: "error" });
    },
  });

  const navigate = useNavigate();
  const mDelete = useMutation({
    mutationFn: () => {
      if (!data?.id) throw new Error("ID de preinscripción no encontrado");
      return eliminarPreinscripcion(data.id);
    },
    onSuccess: () => {
      enqueueSnackbar("Preinscripción eliminada permanentemente", { variant: "success" });
      qc.invalidateQueries({ queryKey: ["preinscripciones"] }); // Invalidate list
      navigate("/preinscripciones");
    },
    onError: () => enqueueSnackbar("No se pudo eliminar la preinscripción", { variant: "error" })
  });

  const agregarCarreraMutation = useMutation({
    mutationFn: ({ carreraId, anio }: { carreraId: number; anio?: number }) =>
      agregarCarreraPreinscripcion(codigo, carreraId, anio),
    onSuccess: (resp) => {
      enqueueSnackbar(resp.message || 'Profesorado agregado', { variant: 'success' });
      setAddCarreraOpen(false);
      resetAgregarCarreraForm();
      qc.invalidateQueries({ queryKey: ['preinscripciones', 'alumno', alumnoDni] });
      if (resp.data?.codigo) {
        navigate(`/secretaria/confirmar-inscripcion?codigo=${resp.data.codigo}`);
      }
    },
    onError: (error: any) => {
      const msg = error?.response?.data?.message || 'No se pudo agregar el profesorado';
      enqueueSnackbar(msg, { variant: 'error' });
    },
  });

  const onSubmit = (v: PreinscripcionForm) => mUpdate.mutate(v);

  const [addCarreraOpen, setAddCarreraOpen] = useState(false);
  const [nuevaCarreraId, setNuevaCarreraId] = useState<number | ''>('');
  const [nuevaCarreraCohorte, setNuevaCarreraCohorte] = useState<string>(() => String(new Date().getFullYear()));

  const resetAgregarCarreraForm = (preset?: string) => {
    setNuevaCarreraId('');
    const fallback = (preset?.trim() || String(new Date().getFullYear()));
    setNuevaCarreraCohorte(fallback);
  };

  type CriticalAction = { type: "observar" | "rechazar" | "eliminar"; reason?: string };
  const [criticalAction, setCriticalAction] = useState<CriticalAction | null>(null);

  const requestMotivo = (label: string): string | null => {
    const value = window.prompt(label);
    const trimmed = value?.trim();
    return trimmed ? trimmed : null;
  };

  const handleRequestObservada = () => {
    const motivo = requestMotivo("Motivo de observaci�n:");
    if (!motivo) return;
    setCriticalAction({ type: "observar", reason: motivo });
  };

  const handleRequestRechazo = () => {
    const motivo = requestMotivo("Motivo de rechazo:");
    if (!motivo) return;
    setCriticalAction({ type: "rechazar", reason: motivo });
  };

  const handleRequestEliminar = () => {
    setCriticalAction({ type: "eliminar" });
  };

  const criticalActionLoading =
    criticalAction?.type === "observar"
      ? mObservar.isPending
      : criticalAction?.type === "rechazar"
        ? mRechazar.isPending
        : criticalAction?.type === "eliminar"
          ? mDelete.isPending
          : false;

  const executeCriticalAction = () => {
    if (!criticalAction) return;
    if (criticalAction.type === "observar" && criticalAction.reason) {
      mObservar.mutate(criticalAction.reason, {
        onSettled: () => setCriticalAction(null),
      });
      return;
    }
    if (criticalAction.type === "rechazar" && criticalAction.reason) {
      mRechazar.mutate(criticalAction.reason, {
        onSettled: () => setCriticalAction(null),
      });
      return;
    }
    if (criticalAction.type === "eliminar") {
      mDelete.mutate(undefined, {
        onSettled: () => setCriticalAction(null),
      });
    }
  };

  const cancelCriticalAction = () => {
    if (criticalActionLoading) return;
    setCriticalAction(null);
  };

  const criticalContextText = criticalAction
    ? criticalAction.type === "observar"
      ? `cambio de estado a Observada${criticalAction.reason ? ` (motivo: "${criticalAction.reason}")` : ""}`
      : criticalAction.type === "rechazar"
        ? `cambio de estado a Rechazada${criticalAction.reason ? ` (motivo: "${criticalAction.reason}")` : ""}`
        : "eliminación permanente de esta preinscripción"
    : "Cambios";







  // Editor unificado: sin tabs

  if (isLoading) return <Box py={6} textAlign="center"><CircularProgress /></Box>;
  if (isError || !data) return <Typography color="error">No se pudo cargar la preinscripción.</Typography>;

  return (
    <Stack gap={2}>
      <Paper sx={{ p:2 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Box>
            <Typography variant="h6" fontWeight={800}>Preinscripción {data.codigo}</Typography>
            <Box>
              {dayjs(data.fecha).format("DD/MM/YYYY HH:mm")} • <EstadoChip estado={data.estado} />
            </Box>
          </Box>
          <Stack direction="row" gap={1}>
            <Button variant="outlined" color="warning" onClick={handleRequestObservada}>Marcar Observada</Button>
            <Button variant="outlined" color="error" onClick={handleRequestRechazo}>Rechazar</Button>
            <Button variant="contained" color="error" sx={{ ml: 1 }} onClick={handleRequestEliminar}>Eliminar</Button>
            {/* Boton Confirmar superior removido */}          </Stack>
        </Stack>
      </Paper>

      {/* Tabs removidos */}

      <Grid container spacing={2}>
        <Grid item xs={12} md={8}>
      <Paper component="form" onSubmit={handleSubmit(onSubmit as any)} sx={{ p:2 }}>
          <Typography variant="subtitle1" fontWeight={700} gutterBottom>Datos personales</Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} md={4}>
              <Controller name="nombres" control={control} render={({ field, fieldState }) => (
                <TextField {...field} label="Nombres" fullWidth error={!!fieldState.error} helperText={fieldState.error?.message}/>
              )}/>
            </Grid>
            <Grid item xs={12} md={4}>
              <Controller name="apellido" control={control} render={({ field, fieldState }) => (
                <TextField {...field} label="Apellido" fullWidth error={!!fieldState.error} helperText={fieldState.error?.message}/>
              )}/>
            </Grid>
            <Grid item xs={12} md={4}>
              <Controller name="dni" control={control} render={({ field, fieldState }) => (
                <TextField {...field} label="DNI" fullWidth error={!!fieldState.error} helperText={fieldState.error?.message}/>
              )}/>
            </Grid>
            <Grid item xs={12} md={4}>
              <Controller name="cuil" control={control} render={({ field, fieldState }) => (
                <TextField {...field} label="CUIL" fullWidth error={!!fieldState.error} helperText={fieldState.error?.message}/>
              )}/>
            </Grid>
            <Grid item xs={12} md={4}>
              <Controller name="fecha_nacimiento" control={control} render={({ field }) => (
                <TextField {...field} label="Fecha de nacimiento (YYYY-MM-DD)" fullWidth />
              )}/>
            </Grid>
            <Grid item xs={12} md={4}>
              <Controller name="estado_civil" control={control} render={({ field, fieldState }) => (
                <TextField {...field} label="Estado Civil" fullWidth error={!!fieldState.error} helperText={fieldState.error?.message}/>
              )}/>
            </Grid>
            <Grid item xs={12} md={4}>
              <Controller name="nacionalidad" control={control} render={({ field, fieldState }) => (
                <TextField {...field} label="Nacionalidad" fullWidth error={!!fieldState.error} helperText={fieldState.error?.message}/>
              )}/>
            </Grid>
            <Grid item xs={12} md={4}>
              <Controller name="pais_nac" control={control} render={({ field, fieldState }) => (
                <TextField {...field} label="País de nacimiento" fullWidth error={!!fieldState.error} helperText={fieldState.error?.message}/>
              )}/>
            </Grid>
            <Grid item xs={12} md={4}>
              <Controller name="provincia_nac" control={control} render={({ field, fieldState }) => (
                <TextField {...field} label="Provincia de nacimiento" fullWidth error={!!fieldState.error} helperText={fieldState.error?.message}/>
              )}/>
            </Grid>
            <Grid item xs={12} md={4}>
              <Controller name="localidad_nac" control={control} render={({ field, fieldState }) => (
                <TextField {...field} label="Localidad de nacimiento" fullWidth error={!!fieldState.error} helperText={fieldState.error?.message}/>
              )}/>
            </Grid>
          </Grid>
          <Divider sx={{ my:2 }} />

        {/* Sección: Contacto */}
          {/* Sección: Contacto */}
          
<Typography variant="subtitle1" fontWeight={700} gutterBottom>Contacto</Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} md={4}>
              <Controller name="email" control={control} render={({ field, fieldState }) => (
                <TextField {...field} label="Email" fullWidth error={!!fieldState.error} helperText={fieldState.error?.message}/>
              )}/>
            </Grid>
            <Grid item xs={12} md={4}>
              <Controller name="tel_movil" control={control} render={({ field }) => (
                <TextField {...field} label="Teléfono Móvil" fullWidth />
              )}/>
            </Grid>
            <Grid item xs={12} md={4}>
              <Controller name="tel_fijo" control={control} render={({ field }) => (
                <TextField {...field} label="Teléfono fijo" fullWidth />
              )}/>
            </Grid>
            <Grid item xs={12}>
              <Controller name="domicilio" control={control} render={({ field }) => (
                <TextField {...field} label="Domicilio" fullWidth />
              )}/>
            </Grid>
            <Grid item xs={12}><Typography variant="subtitle2">Contacto de Emergencia</Typography></Grid>
            <Grid item xs={12} md={4}>
              <Controller name="emergencia_telefono" control={control} render={({ field, fieldState }) => (
                <TextField {...field} label="Teléfono de Emergencia" fullWidth error={!!fieldState.error} helperText={fieldState.error?.message}/>
              )}/>
            </Grid>
            <Grid item xs={12} md={4}>
              <Controller name="emergencia_parentesco" control={control} render={({ field, fieldState }) => (
                <TextField {...field} label="Parentesco" fullWidth error={!!fieldState.error} helperText={fieldState.error?.message}/>
              )}/>
            </Grid>
          </Grid>

        {/* Sección: Estudios (Secundario y Superiores) */}
          <Stack spacing={3}>
            <Box>
              <Typography variant="subtitle1" fontWeight={700} gutterBottom>Estudios Secundarios</Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={8}>
                  <Controller name="sec_establecimiento" control={control} render={({ field, fieldState }) => (
                    <TextField {...field} label="Establecimiento" fullWidth error={!!fieldState.error} helperText={fieldState.error?.message}/>
                  )}/>
                </Grid>
                <Grid item xs={12} md={4}>
                  <Controller name="sec_fecha_egreso" control={control} render={({ field, fieldState }) => (
                    <TextField {...field} label="Fecha de egreso" fullWidth type="date" InputLabelProps={{ shrink: true }} error={!!fieldState.error} helperText={fieldState.error?.message}/>
                  )}/>
                </Grid>
                <Grid item xs={12} md={4}>
                  <Controller name="sec_titulo" control={control} render={({ field, fieldState }) => (
                    <TextField {...field} label="Título Obtenido" fullWidth error={!!fieldState.error} helperText={fieldState.error?.message}/>
                  )}/>
                </Grid>
                <Grid item xs={12} md={4}>
                  <Controller name="sec_localidad" control={control} render={({ field, fieldState }) => (
                    <TextField {...field} label="Localidad" fullWidth error={!!fieldState.error} helperText={fieldState.error?.message}/>
                  )}/>
                </Grid>
                <Grid item xs={12} md={4}>
                  <Controller name="sec_provincia" control={control} render={({ field, fieldState }) => (
                    <TextField {...field} label="Provincia" fullWidth error={!!fieldState.error} helperText={fieldState.error?.message}/>
                  )}/>
                </Grid>
                <Grid item xs={12} md={4}>
                  <Controller name="sec_pais" control={control} render={({ field, fieldState }) => (
                    <TextField {...field} label="País" fullWidth error={!!fieldState.error} helperText={fieldState.error?.message}/>
                  )}/>
                </Grid>
              </Grid>
            </Box>
            <Box>
              <Typography variant="subtitle1" fontWeight={700} gutterBottom>Estudios Superiores</Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={8}>
                  <Controller name="sup1_establecimiento" control={control} render={({ field, fieldState }) => (
                    <TextField {...field} label="Establecimiento" fullWidth error={!!fieldState.error} helperText={fieldState.error?.message}/>
                  )}/>
                </Grid>
                <Grid item xs={12} md={4}>
                  <Controller name="sup1_fecha_egreso" control={control} render={({ field, fieldState }) => (
                    <TextField {...field} label="Fecha de egreso" fullWidth type="date" InputLabelProps={{ shrink: true }} error={!!fieldState.error} helperText={fieldState.error?.message}/>
                  )}/>
                </Grid>
                <Grid item xs={12} md={4}>
                  <Controller name="sup1_titulo" control={control} render={({ field, fieldState }) => (
                    <TextField {...field} label="Título Obtenido" fullWidth error={!!fieldState.error} helperText={fieldState.error?.message}/>
                  )}/>
                </Grid>
              </Grid>
            </Box>
        </Stack>

        <Divider sx={{ my:2 }} />
        <Typography variant="subtitle1" fontWeight={700} gutterBottom>Accesibilidad y datos sensibles</Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <Controller
              name="cud_informado"
              control={control}
              render={({ field }) => (
                <FormControlLabel
                  control={<Checkbox {...field} checked={!!field.value} />}
                  label="El/la aspirante informó que posee CUD"
                />
              )}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <Controller
              name="condicion_salud_informada"
              control={control}
              render={({ field }) => (
                <FormControlLabel
                  control={<Checkbox {...field} checked={!!field.value} />}
                  label="Informó una condición de salud o ajuste requerido"
                />
              )}
            />
          </Grid>
          {condicionSaludActiva && (
            <Grid item xs={12}>
              <Controller
                name="condicion_salud_detalle"
                control={control}
                render={({ field, fieldState }) => (
                  <TextField
                    {...field}
                    label="Detalle de la condición o apoyo requerido"
                    fullWidth
                    multiline
                    minRows={3}
                    error={!!fieldState.error}
                    helperText={fieldState.error?.message}
                  />
                )}
              />
            </Grid>
          )}
          <Grid item xs={12}>
            <Controller
              name="consentimiento_datos"
              control={control}
              render={({ field, fieldState }) => (
                <FormControl error={!!fieldState.error} component="fieldset" sx={{ alignItems: "flex-start" }}>
                  <FormControlLabel
                    control={<Checkbox {...field} checked={!!field.value} />}
                    label="Consentimiento expreso e informado para tratar datos sensibles con fines de accesibilidad"
                  />
                  <FormHelperText>
                    {fieldState.error?.message ?? "Debe estar aceptado antes de confirmar la inscripción."}
                  </FormHelperText>
                </FormControl>
              )}
            />
          </Grid>
        </Grid>

        <Divider sx={{ my:2 }} />
        <Typography variant="subtitle1" fontWeight={700} gutterBottom>Profesorado</Typography>
        {/* Sección: Profesorado */}
          <Grid container spacing={2}>
            <Grid item xs={12} sm={8}>
              <Controller
                name="carrera_id"
                control={control}
                render={({ field, fieldState }) => (
                  <TextField
                    {...field}
                    select
                    label="Profesorado"
                    fullWidth
                    error={!!fieldState.error}
                    helperText={fieldState.error?.message}
                    value={field.value ?? 0}
                    onChange={(event) => {
                      const next = Number((event.target as HTMLInputElement).value);
                      field.onChange(next);
                    }}
                    SelectProps={{ displayEmpty: true }}
                  >
                    <MenuItem value={0} disabled>
                      <em>{carrerasQ.isFetching ? "Cargando..." : "Seleccione..."}</em>
                    </MenuItem>
                    {(carrerasQ.data || []).map((c: any) => (
                      <MenuItem key={c.id} value={c.id}>{c.nombre}</MenuItem>
                    ))}
                  </TextField>
                )}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <Button
                fullWidth variant="outlined"
                onClick={() => {
                  const currentCarrera = Number(watch("carrera_id") || 0);
                  if (!currentCarrera) {
                    enqueueSnackbar("Selecciona un profesorado antes de confirmar", { variant: "warning" });
                    return;
                  }
                  mCambiarCarrera.mutate(currentCarrera);
                }}
                disabled={mCambiarCarrera.isPending}
              >
                Cambiar Profesorado
              </Button>
            </Grid>
            <Grid item xs={12} sm={4}>
              <Controller
                name="cohorte"
                control={control}
                render={({ field, fieldState }) => (
                  <TextField
                    {...field}
                    label="Cohorte (año de ingreso)"
                    fullWidth
                    required
                    error={!!fieldState.error}
                    helperText={fieldState.error?.message ?? "Ej: 2025"}
                  />
                )}
              />
            </Grid>
          </Grid>
        {/* Datos laborales */}
          <Divider sx={{ my: 2 }} />
          <Typography variant="subtitle1" fontWeight={700} gutterBottom>Datos Laborales</Typography>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <Controller
                name="trabaja"
                control={control}
                render={({ field }) => (
                  <FormControlLabel control={<Switch {...field} checked={!!field.value} />}
                    label="¿Trabaja actualmente?" />
                )}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <Controller name="empleador" control={control} render={({ field }) => (
                <TextField {...field} label="Empleador" fullWidth />
              )}/>
            </Grid>
            <Grid item xs={12} md={4}>
              <Controller name="horario_trabajo" control={control} render={({ field }) => (
                <TextField {...field} label="Horario de trabajo" fullWidth />
              )}/>
            </Grid>
            <Grid item xs={12}>
              <Controller name="domicilio_trabajo" control={control} render={({ field }) => (
                <TextField {...field} label="Domicilio laboral" fullWidth />
              )}/>
            </Grid>
          </Grid>

        {/* Resumen eliminado */}

        <Stack direction="row" gap={1} justifyContent="flex-end" sx={{ mt: 2 }}>
          <Button type="button" variant="outlined" onClick={() => reset()} disabled={mUpdate.isPending}>Deshacer cambios</Button>
          <Button type="submit" variant="contained" disabled={mUpdate.isPending}>Guardar cambios</Button>
        </Stack>
      </Paper>
        </Grid>
        <Grid item xs={12} md={4}>
      <Paper sx={{ p:2 }}>
        <Typography variant="subtitle1" fontWeight={700} gutterBottom>Profesorados asociados</Typography>
        {preinsAlumnoQ.isLoading ? (
          <Typography variant="body2" color="text.secondary">Cargando profesorados…</Typography>
        ) : preinscripcionesAlumno.length === 0 ? (
          <Typography variant="body2" color="text.secondary">No se encontraron otras preinscripciones.</Typography>
        ) : (
          <Stack direction="column" spacing={1} mb={2}>
            {preinscripcionesAlumno.map((pre) => {
              const activo = pre.codigo === codigo;
              return (
                <Button
                  key={pre.codigo}
                  size="small"
                  variant={activo ? "contained" : "outlined"}
                  color={activo ? "success" : "primary"}
                  onClick={() => {
                    if (!activo) navigate(`/secretaria/confirmar-inscripcion?codigo=${pre.codigo}`);
                  }}
                >
                  {pre.carrera?.nombre ?? "Carrera sin nombre"} · {pre.codigo}
                </Button>
              );
            })}
          </Stack>
        )}
        <Button
          size="small"
          variant="outlined"
          onClick={() => {
            resetAgregarCarreraForm(watch("cohorte"));
            setAddCarreraOpen(true);
          }}
          disabled={availableCarreras.length === 0 || agregarCarreraMutation.isPending}
          sx={{ mb: 2 }}
        >
          Agregar nuevo profesorado
        </Button>
        <Typography variant="subtitle1" gutterBottom>Documentación</Typography>

        <Typography variant="subtitle2" gutterBottom>Requisitos generales</Typography>
        <Stack>
          <FormControlLabel control={<Checkbox checked={!!docs.dni_legalizado} onChange={(_, c)=>setDocs(s=>({...s,dni_legalizado:c}))} />} label="Fotocopia legalizada del DNI" />
          <FormControlLabel control={<Checkbox checked={!!docs.fotos_4x4} onChange={(_, c)=>setDocs(s=>({...s,fotos_4x4:c}))} />} label="2 fotos carnet 4×4" />
          <FormControlLabel control={<Checkbox checked={!!docs.folios_oficio_ok} onChange={(_, c)=>setDocs(s=>({...s,folios_oficio_ok:c}))} />} label="3 folios oficio" />
          <FormControlLabel control={<Checkbox checked={!!docs.certificado_salud} onChange={(_, c)=>setDocs(s=>({...s,certificado_salud:c}))} />} label="Certificado de Buena Salud" />
          <FormControlLabel control={<Checkbox checked={!!docs.curso_introductorio_aprobado} onChange={(_, c)=>{ setDocs(s=>({...s,curso_introductorio_aprobado:c})); setValue('curso_introductorio_aprobado', !!c, { shouldDirty: true }); }} />} label="Curso Introductorio Aprobado" />
          <FormControlLabel control={<Checkbox checked={!!libretaEntregada} onChange={(_, checked)=> setValue('libreta_entregada', checked, { shouldDirty: true })} />} label="Libreta entregada" />
          {isCertificacionDocente && (
            <FormControlLabel
              control={
                <Checkbox
                  checked={!!docs.incumbencia}
                  onChange={(_, c) => setDocs((s) => ({ ...s, incumbencia: c }))}
                />
              }
              label="Incumbencia"
            />
          )}
        </Stack>

        <Divider sx={{ my: 2 }} />
        <Typography variant="subtitle2" gutterBottom>Secundario</Typography>
        <Stack>
          {isCertificacionDocente ? (
            <FormControlLabel
              control={
                <Checkbox
                  checked={!!docs.titulo_terciario_univ}
                  onChange={(_, c) => setDocs((s) => ({ ...s, titulo_terciario_univ: c }))}
                />
              }
              label="Título terciario / universitario"
            />
          ) : (
            <>
              <FormControlLabel control={<Checkbox checked={!!docs.titulo_secundario} onChange={(_, c)=>pickSecundario('titulo_secundario', c)} />} label="Título secundario" />
              <FormControlLabel control={<Checkbox checked={!!docs.titulo_en_tramite} onChange={(_, c)=>pickSecundario('titulo_en_tramite', c)} />} label="Certificado de título en trámite" />
              <FormControlLabel control={<Checkbox checked={!!docs.analitico_legalizado} onChange={(_, c)=>pickSecundario('analitico_legalizado', c)} />} label="Fotocopia de analítico legalizada" />
            </>
          )}
        </Stack>

        {!isCertificacionDocente && (
          <>
            <Divider sx={{ my: 2 }} />
            <Stack>
              <FormControlLabel control={<Checkbox checked={!!docs.certificado_alumno_regular_sec} onChange={(_, c)=>setDocs(s=>({...s,certificado_alumno_regular_sec:c}))} disabled={anyMainSelected} />} label="Certificado de alumno regular del secundario" />
              <FormControlLabel control={<Checkbox checked={!!docs.adeuda_materias} onChange={(_, c)=>setDocs(s=>({...s,adeuda_materias:c}))} disabled={anyMainSelected} />} label="Si adeuda materias" />
              {docs.adeuda_materias && (
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={8}>
                    <TextField label="Materias adeudadas" fullWidth value={adeudaDetalle.materias} onChange={(e)=>setAdeudaDetalle(d=>({...d,materias:e.target.value}))}/>
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <TextField label="Colegio o institución" fullWidth value={adeudaDetalle.institucion} onChange={(e)=>setAdeudaDetalle(d=>({...d,institucion:e.target.value}))}/>
                  </Grid>
                </Grid>
              )}
            </Stack>
          </>
        )}

        <Divider sx={{ my: 2 }} />
        <Typography variant="subtitle2" gutterBottom>Foto 4x4</Typography>
        <Stack direction="row" spacing={2} alignItems="center">
          <input id="foto4x4-input" type="file" accept="image/png, image/jpeg" style={{ display: 'none' }}
            onChange={(e:any)=>{
              const f=e.target.files?.[0];
              if(f) mUploadFoto.mutate(f);
            }} />
          <label htmlFor="foto4x4-input">
            <Button variant="outlined" component="span">Agregar/Cambiar foto</Button>
          </label>
        </Stack>
        {/* Indicador visual cuando no hay foto o falla la carga */}
        {(() => {
          const docs: any[] = (docsQ.data as any[]) || [];
          const docFoto = docs.find(d => String(d.tipo).toLowerCase().includes('foto'));
          const docUrl = docFoto?.url || '';
          return (
            <>
              <FotoPreviewBox dataUrl={watch('foto_dataUrl') || docUrl} />
              <Typography variant="caption" color="text.secondary">
                {docUrl ? `Fuente: archivo (len: ${String(docUrl).length})` : 'Sin foto'}
              </Typography>
            </>
          );
        })()}
        <Divider sx={{ my: 2 }} />
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="body2">Estado documental:</Typography>
          <Chip
            size="small"
            color={allDocs ? "success" : "warning"}
            label={allDocs ? "Regular" : "Condicional"}
            sx={{ borderRadius: 2 }}
          />
        </Stack>
        <Divider sx={{ my: 2 }} />
        <Button sx={{ mb: 1 }} variant="outlined" onClick={() => mSaveChecklist.mutate()} disabled={mUpdate.isPending}>Guardar checklist</Button>
        <FormControlLabel
          control={<Checkbox checked={!!ddjjOk} onChange={(_, c)=> setDdjjOk(!!c)} disabled={allDocs} />}
          label="DDJJ / Nota compromiso"
        />
        <Button
          sx={{ mt: 2 }}
          variant="contained"
          color="success"
          onClick={handleConfirmInscripcionClick}
          disabled={!canConfirm || mUpdate.isPending}
        >
          Confirmar Inscripción
        </Button>
      </Paper>
        </Grid>
      </Grid>
      <Dialog
        open={addCarreraOpen}
        onClose={() => {
          if (!agregarCarreraMutation.isPending) {
            setAddCarreraOpen(false);
            resetAgregarCarreraForm();
          }
        }}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Agregar nuevo profesorado</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          {availableCarreras.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              Este alumno ya tiene cargados todos los profesorados disponibles.
            </Typography>
          ) : (
            <Stack spacing={2}>
              <FormControl fullWidth size="small">
                <InputLabel id="nueva-carrera-label">Profesorado</InputLabel>
                <Select
                  labelId="nueva-carrera-label"
                  label="Profesorado"
                  value={nuevaCarreraId === "" ? "" : String(nuevaCarreraId)}
                  onChange={(event) => {
                    const value = event.target.value === "" ? "" : Number(event.target.value);
                    setNuevaCarreraId(value);
                  }}
                >
                  <MenuItem value="">
                    <em>Seleccioná un profesorado</em>
                  </MenuItem>
                  {availableCarreras.map((c: any) => (
                    <MenuItem key={c.id} value={c.id}>
                      {c.nombre}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <TextField
                label="Cohorte (año de ingreso)"
                type="number"
                size="small"
                value={nuevaCarreraCohorte}
                onChange={(event) => setNuevaCarreraCohorte(event.target.value)}
                helperText="Por defecto usamos el año actual; modificalo si corresponde a una cohorte anterior."
                inputProps={{ min: 1900, max: 2100 }}
              />
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              if (!agregarCarreraMutation.isPending) {
                setAddCarreraOpen(false);
                resetAgregarCarreraForm();
              }
            }}
          >
            Cancelar
          </Button>
          <Button
            variant="contained"
            onClick={() => {
              if (typeof nuevaCarreraId === "number") {
                const cohorteTrimmed = (nuevaCarreraCohorte ?? "").trim();
                const cohorteParsed = cohorteTrimmed ? Number(cohorteTrimmed) : NaN;
                const anioPayload = Number.isFinite(cohorteParsed) ? cohorteParsed : undefined;
                agregarCarreraMutation.mutate({ carreraId: nuevaCarreraId, anio: anioPayload });
              }
            }}
            disabled={availableCarreras.length === 0 || typeof nuevaCarreraId !== "number" || agregarCarreraMutation.isPending}
          >
            {agregarCarreraMutation.isPending ? "Agregando..." : "Agregar"}
          </Button>
        </DialogActions>
      </Dialog>
      <FinalConfirmationDialog
        open={confirmInscripcionOpen}
        onConfirm={executeConfirmInscripcion}
        onCancel={cancelConfirmInscripcion}
        loading={mConfirm.isPending}
        contextText="Nuevos Registros"
      />
      <FinalConfirmationDialog
        open={Boolean(criticalAction)}
        onConfirm={executeCriticalAction}
        onCancel={cancelCriticalAction}
        loading={criticalActionLoading}
        contextText={criticalContextText}
      />
    </Stack>
  );
}
