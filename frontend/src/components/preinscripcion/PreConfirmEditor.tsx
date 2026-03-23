import { useForm, Controller } from "react-hook-form";
import { useState, useEffect, useMemo } from "react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  apiGetPreinscripcionByCodigo, apiUpdatePreinscripcion,
  apiConfirmarPreinscripcion, apiObservarPreinscripcion, apiRechazarPreinscripcion, apiCambiarCarrera, PreinscripcionDTO,
  eliminarPreinscripcion, apiGetChecklist, apiPutChecklist, ChecklistDTO, apiListPreDocs, apiUploadPreDoc, PreinscripcionUpdatePayload,
  listarPreinscripcionesEstudiante, agregarCarreraPreinscripcion
} from "@/api/preinscripciones";
import { useAuth } from "@/context/AuthContext";
import { fetchCarreras } from "@/api/carreras";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Grid from "@mui/material/Grid";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import Divider from "@mui/material/Divider";
import Checkbox from "@mui/material/Checkbox";
import FormControlLabel from "@mui/material/FormControlLabel";
import Switch from "@mui/material/Switch";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import Select from "@mui/material/Select";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemText from "@mui/material/ListItemText";
import FormHelperText from "@mui/material/FormHelperText";
import Alert from "@mui/material/Alert";
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
    <Box sx={{ mt: 1, width: 100, height: 120, overflow: 'hidden', border: '1px solid #ddd', borderRadius: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: '#fafafa' }}>
      {dataUrl && !error ? (
        <img src={String(dataUrl)} alt="Foto 4x4" onError={() => setError(true)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      ) : (
        <Typography variant="caption" color={error ? 'error' : 'text.secondary'}>{error ? 'Error al cargar foto' : 'Sin foto 4x4'}</Typography>
      )}
    </Box>
  );
}

export default function PreConfirmEditor({ codigo, onActionSuccess }: { codigo: string; onActionSuccess?: () => void }) {
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

  // Eliminated separate docs state and adeudaDetalle state, now using react-hook-form

  // Asegurar registro del campo virtual de foto para que watch() funcione
  useEffect(() => {
    try { (register as any)('foto_dataUrl'); } catch { }
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
    const estudianteDto = data.estudiante as any;
    sanitized.nombres = String(estudianteDto?.nombres ?? estudianteDto?.nombre ?? formDefaults.nombres);
    sanitized.apellido = String(estudianteDto?.apellido ?? formDefaults.apellido);
    sanitized.dni = String(estudianteDto?.dni ?? sanitized.dni ?? "");
    sanitized.cuil = String(estudianteDto?.cuil ?? (extra as any)?.cuil ?? sanitized.cuil ?? "");
    sanitized.email = String(estudianteDto?.email ?? sanitized.email ?? "");
    sanitized.tel_movil = String(estudianteDto?.telefono ?? sanitized.tel_movil ?? "");
    sanitized.domicilio = String(estudianteDto?.domicilio ?? sanitized.domicilio ?? "");
    const rawBirthDate =
      estudianteDto?.fecha_nacimiento ??
      (extra as any)?.fecha_nacimiento ??
      sanitized.fecha_nacimiento ??
      "";
    sanitized.fecha_nacimiento = toDisplayDate(String(rawBirthDate));
    sanitized.nacionalidad = String((extra as any)?.nacionalidad ?? (estudianteDto as any)?.nacionalidad ?? sanitized.nacionalidad ?? "");
    sanitized.estado_civil = String((extra as any)?.estado_civil ?? (estudianteDto as any)?.estado_civil ?? sanitized.estado_civil ?? "");
    sanitized.genero = String((extra as any)?.genero ?? (estudianteDto as any)?.genero ?? sanitized.genero ?? "");
    sanitized.pais_nac = String((extra as any)?.pais_nac ?? sanitized.pais_nac ?? "");
    sanitized.provincia_nac = String((extra as any)?.provincia_nac ?? sanitized.provincia_nac ?? "");
    sanitized.localidad_nac = String((extra as any)?.localidad_nac ?? sanitized.localidad_nac ?? "");
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
    setValue("dni_legalizado", !!cl.dni_legalizado, { shouldDirty: false });
    setValue("fotos_4x4", !!cl.fotos_4x4, { shouldDirty: false });
    setValue("folios_oficio_ok", !!cl.folios_oficio, { shouldDirty: false });
    setValue("certificado_salud", !!cl.certificado_salud, { shouldDirty: false });
    setValue("titulo_secundario_legalizado", !!cl.titulo_secundario_legalizado, { shouldDirty: false });
    setValue("certificado_titulo_en_tramite", !!cl.certificado_titulo_en_tramite, { shouldDirty: false });
    setValue("analitico_legalizado", !!cl.analitico_legalizado, { shouldDirty: false });
    setValue("certificado_alumno_regular_sec", !!cl.certificado_alumno_regular_sec, { shouldDirty: false });
    setValue("adeuda_materias", !!cl.adeuda_materias, { shouldDirty: false });
    setValue("titulo_terciario_univ", !!cl.titulo_terciario_univ, { shouldDirty: false });
    setValue("incumbencia", !!cl.incumbencia, { shouldDirty: false });

    setValue("adeuda_materias_detalle", cl.adeuda_materias_detalle || "", { shouldDirty: false });
    setValue("escuela_secundaria", cl.escuela_secundaria || "", { shouldDirty: false });
    setValue("curso_introductorio_aprobado", !!cl.curso_introductorio_aprobado, { shouldDirty: false });
    setValue("libreta_entregada", !!cl.libreta_entregada, { shouldDirty: false });
    setValue("articulo_7", !!cl.articulo_7, { shouldDirty: false });
  }, [checklistQ.data, setValue]);

  const onSubmit = async (values: PreinscripcionForm) => {
    console.log("Submit triggered", values);
    setValidationErrors(null);
    try {
      // 1. Guardar todos los cambios primero
      await mUpdate.mutateAsync(values);

      // 2. Si se puede confirmar y aún no está confirmada, procedemos
      if (canConfirm && data?.estado !== "confirmada") {
        // Mostramos el diálogo de confirmación final
        setConfirmInscripcionOpen(true);
      }
    } catch (error) {
      console.error("Error en flujo unificado:", error);
    }
  };

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
        ddjj_ok, // descartamos del payload de update si no existe en backend
        ...datos_extra
      } = values;

      const payload: PreinscripcionUpdatePayload = {
        estudiante: {
          dni,
          nombres,
          apellido,
          cuil: cuil ? cuil : null,
          genero: values.genero || null,
          email: email || null,
          telefono: tel_movil || null,
          domicilio: domicilio || null,
          fecha_nacimiento: fecha_nacimiento ? fecha_nacimiento : null,
        },
        datos_extra: {
          ...datos_extra,
          nacionalidad: values.nacionalidad || null,
          estado_civil: values.estado_civil || null,
          genero: values.genero || null,
          localidad_nac: values.localidad_nac || null,
          provincia_nac: values.provincia_nac || null,
          pais_nac: values.pais_nac || null,
          // contacto extra
          tel_fijo: values.tel_fijo || null,
          tel_movil: values.tel_movil || null,
          emergencia_telefono: values.emergencia_telefono || null,
          emergencia_parentesco: values.emergencia_parentesco || null,
        },
        checklist: {
          dni_legalizado: !!values.dni_legalizado,
          fotos_4x4: !!values.fotos_4x4,
          certificado_salud: !!values.certificado_salud,
          folios_oficio: !!values.folios_oficio_ok,
          titulo_secundario_legalizado: !!values.titulo_secundario_legalizado,
          certificado_titulo_en_tramite: !!values.certificado_titulo_en_tramite,
          analitico_legalizado: !!values.analitico_legalizado,
          certificado_alumno_regular_sec: !!values.certificado_alumno_regular_sec,
          adeuda_materias: !!values.adeuda_materias,
          adeuda_materias_detalle: values.adeuda_materias_detalle,
          escuela_secundaria: values.escuela_secundaria,
          titulo_terciario_univ: !!values.titulo_terciario_univ,
          incumbencia: !!values.incumbencia,
          curso_introductorio_aprobado: !!values.curso_introductorio_aprobado,
          libreta_entregada: !!values.libreta_entregada,
          articulo_7: !!values.articulo_7,
          es_certificacion_docente: !!(
            selectedCarrera?.es_certificacion_docente ||
            (checklistQ.data as ChecklistDTO | undefined)?.es_certificacion_docente
          ),
        },
      };

      const payloadExtra = payload.datos_extra as Record<string, unknown> || {};
      if (Object.keys(payloadExtra).length) {
        payload.datos_extra = payloadExtra;
      }

      const carreraValue = Number(carrera_id);
      if (Number.isFinite(carreraValue) && carreraValue > 0) {
        payload.carrera_id = carreraValue;
      }

      return apiUpdatePreinscripcion(codigo, payload);
    },
    onSuccess: () => {
      enqueueSnackbar("Cambios guardados", { variant: "success" });
      qc.invalidateQueries({ queryKey: ["preinscripcion", codigo] });
      qc.invalidateQueries({ queryKey: ["preinscripcion", codigo, "checklist"] });
      qc.invalidateQueries({ queryKey: ["preins-busq-sec"] });
      qc.invalidateQueries({ queryKey: ["preinscripciones"] });
    },
    onError: (err) => {
      console.error("Save error:", err);
      enqueueSnackbar("No se pudo guardar los cambios", { variant: "error" });
    }
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
  const docValues = watch(); // Get all values for derived calculations
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
      if (docValues.titulo_terciario_univ || docValues.incumbencia) {
        setValue("titulo_terciario_univ", false);
        setValue("incumbencia", false);
      }
    } else {
      if (docValues.certificado_alumno_regular_sec || docValues.adeuda_materias) {
        setValue("certificado_alumno_regular_sec", false);
        setValue("adeuda_materias", false);
        setValue("adeuda_materias_detalle", "");
        setValue("escuela_secundaria", "");
      }
    }
  }, [isCertificacionDocente, setValue, docValues.titulo_terciario_univ, docValues.incumbencia, docValues.certificado_alumno_regular_sec, docValues.adeuda_materias]);

  const docsGeneralesBase =
    docValues.dni_legalizado &&
    docValues.fotos_4x4 &&
    docValues.certificado_salud &&
    docValues.folios_oficio_ok;
  const docsGeneralesOk = docsGeneralesBase && (!isCertificacionDocente || docValues.incumbencia);
  const tituloSecundarioPresentado = isCertificacionDocente
    ? !!docValues.titulo_terciario_univ
    : !!(
      docValues.titulo_secundario_legalizado ||
      docValues.certificado_titulo_en_tramite ||
      docValues.analitico_legalizado
    );

  // Estado Regular solo si tiene el título completo (no en trámite ni solo analítico)
  // O si es mayor de 25 años sin título (Art. 7mo)
  const allDocs = isCertificacionDocente
    ? !!(docsGeneralesOk && docValues.titulo_terciario_univ)
    : !!(docsGeneralesOk && (docValues.titulo_secundario_legalizado || docValues.articulo_7));

  const anyMainSelected = isCertificacionDocente
    ? false
    : !!(docValues.titulo_secundario_legalizado || docValues.certificado_titulo_en_tramite || docValues.analitico_legalizado);

  const estudianteDni = data?.estudiante?.dni ?? "";
  const preinsEstudianteQ = useQuery({
    queryKey: ["preinscripciones", "estudiante", estudianteDni],
    queryFn: () => listarPreinscripcionesEstudiante(estudianteDni),
    enabled: !!estudianteDni,
    staleTime: 30_000,
  });

  const { user: authUser } = useAuth();
  const myProfIds = authUser?.profesorado_ids || [];

  const preinscripcionesEstudiante = useMemo(() => {
    const base = (preinsEstudianteQ.data as PreinscripcionDTO[] | undefined) ?? [];
    if (myProfIds.length === 0) return base;
    return [...base].sort((a, b) => {
      const aOk = myProfIds.includes(a.carrera?.id);
      const bOk = myProfIds.includes(b.carrera?.id);
      if (aOk && !bOk) return -1;
      if (!aOk && bOk) return 1;
      return 0;
    });
  }, [preinsEstudianteQ.data, myProfIds]);
  const existingCarreraIds = new Set<number>(
    preinscripcionesEstudiante
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
    setValue("titulo_secundario_legalizado", false);
    setValue("certificado_titulo_en_tramite", false);
    setValue("analitico_legalizado", false);

    setValue(mapped as any, !!checked);

    const anyMain = mapped === 'titulo_secundario_legalizado' || mapped === 'certificado_titulo_en_tramite' || mapped === 'analitico_legalizado' ? checked : false;
    if (anyMain) {
      setValue("certificado_alumno_regular_sec", false);
      setValue("adeuda_materias", false);
      setValue("adeuda_materias_detalle", "");
      setValue("escuela_secundaria", "");
    }
  };

  // DDJJ integrada en el form state (schema)
  const ddjjOk = watch("ddjj_ok");
  const canConfirm = allDocs || ddjjOk;

  const buildChecklistPayload = (): ChecklistDTO => ({
    dni_legalizado: !!docValues.dni_legalizado,
    fotos_4x4: !!docValues.fotos_4x4,
    certificado_salud: !!docValues.certificado_salud,
    folios_oficio: !!docValues.folios_oficio_ok,
    titulo_secundario_legalizado: !!docValues.titulo_secundario_legalizado,
    certificado_titulo_en_tramite: !!docValues.certificado_titulo_en_tramite,
    analitico_legalizado: !!docValues.analitico_legalizado,
    certificado_alumno_regular_sec: !!docValues.certificado_alumno_regular_sec,
    adeuda_materias: !!docValues.adeuda_materias,
    adeuda_materias_detalle: docValues.adeuda_materias_detalle || "",
    escuela_secundaria: docValues.escuela_secundaria || "",
    titulo_terciario_univ: !!docValues.titulo_terciario_univ,
    incumbencia: !!docValues.incumbencia,
    es_certificacion_docente: isCertificacionDocente,
  });
  const mConfirm = useMutation({
    mutationFn: async () => {
      return apiConfirmarPreinscripcion(codigo, buildChecklistPayload());
    },
    onSuccess: () => {
      enqueueSnackbar("Preinscripción confirmada", { variant: "success" });
      qc.invalidateQueries({ queryKey: ["preinscripcion", codigo] });
      qc.invalidateQueries({ queryKey: ["preinscripcion", codigo, "checklist"] });
      qc.invalidateQueries({ queryKey: ["preins-busq-sec"] });
      qc.invalidateQueries({ queryKey: ["preinscripciones"] });
      onActionSuccess?.();
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




  const mObservar = useMutation({
    mutationFn: (motivo: string) => apiObservarPreinscripcion(codigo, motivo),
    onSuccess: () => {
      enqueueSnackbar("Marcada como observada", { variant: "info" });
      qc.invalidateQueries({ queryKey: ["preinscripcion", codigo] });
      onActionSuccess?.();
    },
    onError: () => enqueueSnackbar("No se pudo observar", { variant: "error" })
  });

  const mRechazar = useMutation({
    mutationFn: (motivo: string) => apiRechazarPreinscripcion(codigo, motivo),
    onSuccess: () => {
      enqueueSnackbar("Preinscripción rechazada", { variant: "warning" });
      qc.invalidateQueries({ queryKey: ["preinscripcion", codigo] });
      onActionSuccess?.();
    },
    onError: () => enqueueSnackbar("No se pudo rechazar", { variant: "error" })
  });

  const mCambiarCarrera = useMutation({
    mutationFn: (carrera_id: number) => apiCambiarCarrera(codigo, carrera_id),
    onSuccess: () => {
      enqueueSnackbar("Profesorado actualizado", { variant: "success" });
      qc.invalidateQueries({ queryKey: ["preinscripcion", codigo] });
      qc.invalidateQueries({ queryKey: ["preinscripciones", "estudiante", estudianteDni] });
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
      if (onActionSuccess) {
        onActionSuccess();
      } else {
        navigate("/preinscripciones");
      }
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
      qc.invalidateQueries({ queryKey: ['preinscripciones', 'estudiante', estudianteDni] });
      if (resp.data?.codigo) {
        navigate(`/secretaria/confirmar-inscripcion?codigo=${resp.data.codigo}`);
      }
    },
    onError: (error: any) => {
      const msg = error?.response?.data?.message || 'No se pudo agregar el profesorado';
      enqueueSnackbar(msg, { variant: 'error' });
    },
  });

  const [validationErrors, setValidationErrors] = useState<any>(null);

  const onInvalid = (errors: any) => {
    console.error("Validation errors", errors);
    setValidationErrors(errors);
    enqueueSnackbar("Hay errores en el formulario, revise los mensajes abajo", { variant: "error" });
  };



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
    const motivo = requestMotivo("Motivo de observacin:");
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

  let criticalContextText = "Cambios";
  const action = criticalAction;
  if (action?.type === "observar") {
    criticalContextText = `cambio de estado a Observada${action?.reason ? ` (motivo: "${action?.reason}")` : ""}`;
  } else if (action?.type === "rechazar") {
    criticalContextText = `cambio de estado a Rechazada${action?.reason ? ` (motivo: "${action?.reason}")` : ""}`;
  } else if (action?.type === "eliminar") {
    criticalContextText = "eliminación permanente de esta preinscripción";
  }






  // Editor unificado: sin tabs

  if (isLoading) return <Box py={6} textAlign="center"><CircularProgress /></Box>;
  if (isError || !data) return <Typography color="error">No se pudo cargar la preinscripción.</Typography>;

  return (
    <Stack gap={2} component="form" onSubmit={handleSubmit(onSubmit as any, onInvalid)}>
      <Grid container spacing={2}>
        <Grid item xs={12} md={8}>
          <Paper variant="outlined" sx={{ p: 3, border: '1px solid #eee' }}>
            <Typography variant="subtitle1" fontWeight={700} gutterBottom>Datos personales</Typography>
            <Grid container spacing={2} mb={3}>
              <Grid item xs={12} md={4}>
                <Controller name="nombres" control={control} render={({ field, fieldState }) => (
                  <TextField {...field} label="Nombres" fullWidth error={!!fieldState.error} helperText={fieldState.error?.message} size="small" />
                )} />
              </Grid>
              <Grid item xs={12} md={4}>
                <Controller name="apellido" control={control} render={({ field, fieldState }) => (
                  <TextField {...field} label="Apellido" fullWidth error={!!fieldState.error} helperText={fieldState.error?.message} size="small" />
                )} />
              </Grid>
              <Grid item xs={12} md={4}>
                <Controller name="dni" control={control} render={({ field, fieldState }) => (
                  <TextField {...field} label="DNI" fullWidth error={!!fieldState.error} helperText={fieldState.error?.message} size="small" />
                )} />
              </Grid>
              <Grid item xs={12} md={4}>
                <Controller name="cuil" control={control} render={({ field, fieldState }) => (
                  <TextField {...field} label="CUIL" fullWidth error={!!fieldState.error} helperText={fieldState.error?.message} size="small" />
                )} />
              </Grid>
              <Grid item xs={12} md={4}>
                <Controller name="fecha_nacimiento" control={control} render={({ field, fieldState }) => (
                  <TextField {...field} label="Fecha de nacimiento" fullWidth error={!!fieldState.error} helperText={fieldState.error?.message} size="small" />
                )} />
              </Grid>
              <Grid item xs={12} md={4}>
                <Controller name="estado_civil" control={control} render={({ field, fieldState }) => (
                  <TextField {...field} label="Estado Civil" fullWidth error={!!fieldState.error} helperText={fieldState.error?.message} size="small" />
                )} />
              </Grid>
              <Grid item xs={12} md={4}>
                <Controller name="nacionalidad" control={control} render={({ field, fieldState }) => (
                  <TextField {...field} label="Nacionalidad" fullWidth error={!!fieldState.error} helperText={fieldState.error?.message} size="small" />
                )} />
              </Grid>
              <Grid item xs={12} md={4}>
                <Controller name="genero" control={control} render={({ field, fieldState }) => (
                  <TextField {...field} select label="Género" fullWidth error={!!fieldState.error} helperText={fieldState.error?.message} size="small">
                    <MenuItem value=""><em>Seleccione...</em></MenuItem>
                    <MenuItem value="Masculino">Masculino</MenuItem>
                    <MenuItem value="Femenino">Femenino</MenuItem>
                    <MenuItem value="No binarie">No binarie</MenuItem>
                    <MenuItem value="Otro">Otro</MenuItem>
                  </TextField>
                )} />
              </Grid>
            </Grid>

            <Typography variant="subtitle2" color="text.secondary" gutterBottom sx={{ mt: 2 }}>Lugar de Nacimiento</Typography>
            <Grid container spacing={2} mb={3}>
              <Grid item xs={12} md={4}>
                <Controller name="pais_nac" control={control} render={({ field, fieldState }) => (
                  <TextField {...field} label="País de nacimiento" fullWidth error={!!fieldState.error} helperText={fieldState.error?.message} size="small" />
                )} />
              </Grid>
              <Grid item xs={12} md={4}>
                <Controller name="provincia_nac" control={control} render={({ field, fieldState }) => (
                  <TextField {...field} label="Provincia de nacimiento" fullWidth error={!!fieldState.error} helperText={fieldState.error?.message} size="small" />
                )} />
              </Grid>
              <Grid item xs={12} md={4}>
                <Controller name="localidad_nac" control={control} render={({ field, fieldState }) => (
                  <TextField {...field} label="Localidad de nacimiento" fullWidth error={!!fieldState.error} helperText={fieldState.error?.message} size="small" />
                )} />
              </Grid>
            </Grid>

            <Divider sx={{ my: 3 }} />

            <Typography variant="subtitle1" fontWeight={700} gutterBottom>Contacto</Typography>
            <Grid container spacing={2} mb={3}>
              <Grid item xs={12} md={4}>
                <Controller name="email" control={control} render={({ field, fieldState }) => (
                  <TextField {...field} label="Email" fullWidth error={!!fieldState.error} helperText={fieldState.error?.message} size="small" />
                )} />
              </Grid>
              <Grid item xs={12} md={4}>
                <Controller name="tel_movil" control={control} render={({ field, fieldState }) => (
                  <TextField {...field} label="Teléfono Móvil" fullWidth error={!!fieldState.error} helperText={fieldState.error?.message} size="small" />
                )} />
              </Grid>
              <Grid item xs={12} md={4}>
                <Controller name="tel_fijo" control={control} render={({ field, fieldState }) => (
                  <TextField {...field} label="Teléfono fijo" fullWidth error={!!fieldState.error} helperText={fieldState.error?.message} size="small" />
                )} />
              </Grid>
              <Grid item xs={12}>
                <Controller name="domicilio" control={control} render={({ field, fieldState }) => (
                  <TextField {...field} label="Domicilio" fullWidth error={!!fieldState.error} helperText={fieldState.error?.message} size="small" />
                )} />
              </Grid>
              <Grid item xs={12}><Typography variant="subtitle2" color="text.secondary">Contacto de Emergencia</Typography></Grid>
              <Grid item xs={12} md={6}>
                <Controller name="emergencia_telefono" control={control} render={({ field, fieldState }) => (
                  <TextField {...field} label="Teléfono de Emergencia" fullWidth error={!!fieldState.error} helperText={fieldState.error?.message} size="small" />
                )} />
              </Grid>
              <Grid item xs={12} md={6}>
                <Controller name="emergencia_parentesco" control={control} render={({ field, fieldState }) => (
                  <TextField {...field} label="Parentesco" fullWidth error={!!fieldState.error} helperText={fieldState.error?.message} size="small" />
                )} />
              </Grid>
            </Grid>

            <Divider sx={{ my: 3 }} />

            <Typography variant="subtitle1" fontWeight={700} gutterBottom>Estudios</Typography>
            <Stack spacing={3} mb={3}>
              <Box>
                <Typography variant="subtitle2" color="secondary" gutterBottom>Secundario</Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={8}>
                    <Controller name="sec_establecimiento" control={control} render={({ field, fieldState }) => (
                      <TextField {...field} label="Establecimiento" fullWidth error={!!fieldState.error} helperText={fieldState.error?.message} size="small" />
                    )} />
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <Controller name="sec_fecha_egreso" control={control} render={({ field, fieldState }) => (
                      <TextField {...field} label="Fecha egreso" fullWidth error={!!fieldState.error} helperText={fieldState.error?.message} size="small" />
                    )} />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Controller name="sec_titulo" control={control} render={({ field, fieldState }) => (
                      <TextField {...field} label="Título Obtenido" fullWidth error={!!fieldState.error} helperText={fieldState.error?.message} size="small" />
                    )} />
                  </Grid>
                </Grid>
              </Box>
              <Box>
                <Typography variant="subtitle2" color="secondary" gutterBottom>Superior (opcional)</Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={8}>
                    <Controller name="sup1_establecimiento" control={control} render={({ field, fieldState }) => (
                      <TextField {...field} label="Establecimiento" fullWidth error={!!fieldState.error} helperText={fieldState.error?.message} size="small" />
                    )} />
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <Controller name="sup1_fecha_egreso" control={control} render={({ field, fieldState }) => (
                      <TextField {...field} label="Fecha egreso" fullWidth error={!!fieldState.error} helperText={fieldState.error?.message} size="small" />
                    )} />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Controller name="sup1_titulo" control={control} render={({ field, fieldState }) => (
                      <TextField {...field} label="Título Obtenido" fullWidth error={!!fieldState.error} helperText={fieldState.error?.message} size="small" />
                    )} />
                  </Grid>
                </Grid>
              </Box>
            </Stack>

            <Divider sx={{ my: 3 }} />

            <Typography variant="subtitle1" fontWeight={700} gutterBottom>Accesibilidad y Salud</Typography>
            <Grid container spacing={2} mb={3}>
              <Grid item xs={12} md={6}>
                <Controller name="cud_informado" control={control} render={({ field }) => (
                  <FormControlLabel control={<Checkbox {...field} checked={!!field.value} />} label="Posee CUD" />
                )} />
              </Grid>
              <Grid item xs={12} md={6}>
                <Controller name="condicion_salud_informada" control={control} render={({ field }) => (
                  <FormControlLabel control={<Checkbox {...field} checked={!!field.value} />} label="Condición de salud / Apoyo" />
                )} />
              </Grid>
              {condicionSaludActiva && (
                <Grid item xs={12}>
                  <Controller name="condicion_salud_detalle" control={control} render={({ field, fieldState }) => (
                    <TextField {...field} label="Detalle" fullWidth multiline minRows={2} error={!!fieldState.error} helperText={fieldState.error?.message} size="small" />
                  )} />
                </Grid>
              )}
            </Grid>

            <Divider sx={{ my: 3 }} />

            <Typography variant="subtitle1" fontWeight={700} gutterBottom>Preinscripción actual</Typography>
            <Grid container spacing={2} mb={3}>
              <Grid item xs={12} sm={8}>
                <Controller name="carrera_id" control={control} render={({ field, fieldState }) => (
                  <TextField {...field} select label="Profesorado" fullWidth error={!!fieldState.error} helperText={fieldState.error?.message} size="small" value={field.value ?? 0}>
                    <MenuItem value={0} disabled><em>Seleccione...</em></MenuItem>
                    {(carrerasQ.data || []).map((c: any) => (
                      <MenuItem key={c.id} value={c.id}>{c.nombre}</MenuItem>
                    ))}
                  </TextField>
                )} />
              </Grid>
              <Grid item xs={12} sm={4}>
                <Controller name="cohorte" control={control} render={({ field, fieldState }) => (
                  <TextField {...field} label="Cohorte" fullWidth required error={!!fieldState.error} helperText={fieldState.error?.message} size="small" />
                )} />
              </Grid>
              <Grid item xs={12}>
                <Controller name="trabaja" control={control} render={({ field }) => (
                  <FormControlLabel control={<Switch {...field} checked={!!field.value} />} label="¿Trabaja?" />
                )} />
              </Grid>
            </Grid>

            {validationErrors && (
              <Alert severity="error" sx={{ mt: 2 }}>
                <Typography variant="subtitle2">Existen errores en los datos personales o de contacto. Revise los campos marcados arriba.</Typography>
              </Alert>
            )}
          </Paper>
        </Grid>

        <Grid item xs={12} md={4}>
          <Stack spacing={2} sx={{ position: 'sticky', top: 16 }}>
            <Paper variant="outlined" sx={{ p: 2, border: '1px solid #eee' }}>
              <Typography variant="subtitle1" fontWeight={700} gutterBottom>Profesorados asociados</Typography>
              <Stack spacing={1} mb={2}>
                {preinsEstudianteQ.isLoading ? (
                  <Typography variant="caption">Cargando...</Typography>
                ) : preinscripcionesEstudiante.map((pre) => {
                  const activo = pre.codigo === codigo;
                  const esMio = myProfIds.includes(pre.carrera?.id);
                  return (
                    <Button
                      key={pre.codigo} size="small" variant={activo ? "contained" : "outlined"}
                      color={activo ? (esMio ? "success" : "primary") : "primary"}
                      onClick={() => { if (!activo) navigate(`/secretaria/confirmar-inscripcion?codigo=${pre.codigo}`); }}
                      sx={{ textAlign: 'left', justifyContent: 'flex-start', borderStyle: esMio ? 'dashed' : 'solid' }}
                    >
                      {esMio && <Box component="span" sx={{ mr: 1 }}>⭐</Box>}
                      {pre.carrera?.nombre} ({pre.codigo})
                    </Button>
                  );
                })}
              </Stack>
              <Button fullWidth size="small" variant="outlined" onClick={() => setAddCarreraOpen(true)} disabled={availableCarreras.length === 0}>
                Agregar nuevo profesorado
              </Button>
            </Paper>

            <Paper variant="outlined" sx={{ p: 2, border: '1px solid #eee' }}>
              <Typography variant="subtitle1" fontWeight={700} gutterBottom>Documentación</Typography>

              <Typography variant="subtitle2" gutterBottom>Requisitos generales</Typography>
              <Stack>
                <FormControlLabel control={<Checkbox checked={!!docValues.dni_legalizado} onChange={(_, c) => setValue("dni_legalizado", !!c, { shouldDirty: true })} />} label="DNI legalizado" />
                <FormControlLabel control={<Checkbox checked={!!docValues.fotos_4x4} onChange={(_, c) => setValue("fotos_4x4", !!c, { shouldDirty: true })} />} label="Fotos 4x4" />
                <FormControlLabel control={<Checkbox checked={!!docValues.folios_oficio_ok} onChange={(_, c) => setValue("folios_oficio_ok", !!c, { shouldDirty: true })} />} label="Folios oficio" />
                <FormControlLabel control={<Checkbox checked={!!docValues.certificado_salud} onChange={(_, c) => setValue("certificado_salud", !!c, { shouldDirty: true })} />} label="Certificado Salud" />
                <FormControlLabel control={<Checkbox checked={!!docValues.libreta_entregada} onChange={(_, c) => setValue("libreta_entregada", !!c, { shouldDirty: true })} />} label="Libreta entregada" />
                <FormControlLabel control={<Checkbox checked={!!docValues.curso_introductorio_aprobado} onChange={(_, c) => setValue("curso_introductorio_aprobado", !!c, { shouldDirty: true })} />} label="Curso Intro. aprobado" />
                {isCertificacionDocente && <FormControlLabel control={<Checkbox checked={!!docValues.incumbencia} onChange={(_, c) => setValue("incumbencia", !!c, { shouldDirty: true })} />} label="Incumbencia" />}
              </Stack>

              <Divider sx={{ my: 1.5 }} />
              <Typography variant="subtitle2" gutterBottom>Secundario</Typography>
              <Stack>
                {isCertificacionDocente ? (
                  <FormControlLabel control={<Checkbox checked={!!docValues.titulo_terciario_univ} onChange={(_, c) => setValue("titulo_terciario_univ", !!c, { shouldDirty: true })} />} label="Título superior" />
                ) : (
                  <>
                    <FormControlLabel control={<Checkbox checked={!!docValues.titulo_secundario_legalizado} onChange={(_, c) => pickSecundario('titulo_secundario_legalizado', c)} />} label="Título secundario" />
                    <FormControlLabel control={<Checkbox checked={!!docValues.certificado_titulo_en_tramite} onChange={(_, c) => pickSecundario('certificado_titulo_en_tramite', c)} />} label="Título en trámite" />
                    <FormControlLabel control={<Checkbox checked={!!docValues.analitico_legalizado} onChange={(_, c) => pickSecundario('analitico_legalizado', c)} />} label="Analítico" />
                  </>
                )}
                {!isCertificacionDocente && (
                  <>
                    <FormControlLabel control={<Checkbox checked={!!docValues.certificado_alumno_regular_sec} onChange={(_, c) => setValue("certificado_alumno_regular_sec", !!c, { shouldDirty: true })} disabled={anyMainSelected} />} label="Alumno regular sec." />
                    <FormControlLabel control={<Checkbox checked={!!docValues.adeuda_materias} onChange={(_, c) => setValue("adeuda_materias", !!c, { shouldDirty: true })} disabled={anyMainSelected} />} label="Adeuda materias" />
                    <FormControlLabel control={<Checkbox checked={!!docValues.articulo_7} onChange={(_, c) => setValue("articulo_7", !!c, { shouldDirty: true })} />} label="Mayor de 25 años s/título (Art. 7mo)" />
                  </>
                )}
              </Stack>

              {docValues.adeuda_materias && (
                <Box mt={1}>
                  <Controller name="adeuda_materias_detalle" control={control} render={({ field }) => (
                    <TextField {...field} label="¿Cuáles?" fullWidth size="small" sx={{ mb: 1 }} />
                  )} />
                  <Controller name="escuela_secundaria" control={control} render={({ field }) => (
                    <TextField {...field} label="Escuela" fullWidth size="small" />
                  )} />
                </Box>
              )}

              <Divider sx={{ my: 2 }} />
              <Typography variant="subtitle2" gutterBottom>Foto 4x4</Typography>
              <Stack direction="row" spacing={1} mb={1}>
                <input id="foto-input" type="file" accept="image/*" style={{ display: 'none' }} onChange={(e: any) => { const f = e.target.files?.[0]; if (f) mUploadFoto.mutate(f); }} />
                <label htmlFor="foto-input"><Button size="small" variant="outlined" component="span">Cargar archivo</Button></label>
              </Stack>
              {(() => {
                const docs: any[] = (docsQ.data as any[]) || [];
                const docFoto = docs.find(d => String(d.tipo).toLowerCase().includes('foto'));
                return <FotoPreviewBox dataUrl={watch('foto_dataUrl') || docFoto?.url} />;
              })()}

              <Divider sx={{ my: 2 }} />
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Typography variant="body2" fontWeight={600}>Estado proyectado:</Typography>
                <Chip size="small" color={allDocs ? "success" : "warning"} label={allDocs ? "Regular" : "Condicional"} />
              </Stack>

              {!allDocs && (
                <Box sx={{ mt: 2, p: 1.5, bgcolor: 'warning.light', borderRadius: 2, border: '1px solid', borderColor: 'warning.main' }}>
                  <Typography variant="caption" display="block" color="warning.dark" sx={{ mb: 1, fontWeight: 600 }}>
                    Debe aceptar el compromiso/DDJJ para confirmar como Condicional.
                  </Typography>
                  <FormControlLabel
                    control={<Checkbox checked={!!ddjjOk} onChange={(_, c) => setValue("ddjj_ok", !!c)} />}
                    label={<Typography variant="body2">DDJJ / Compromiso aceptado</Typography>}
                  />
                </Box>
              )}

              <Stack gap={1} mt={3}>
                <Button type="submit" variant="contained" color={canConfirm && data?.estado !== "confirmada" ? "success" : "primary"} disabled={mUpdate.isPending || mConfirm.isPending} fullWidth sx={{ py: 1.5, fontWeight: 700 }}>
                  {data?.estado === "confirmada" ? "Guardar cambios" : canConfirm ? "Confirmar Inscripción" : "Guardar Borrador"}
                </Button>
                <Button variant="text" size="small" color="inherit" onClick={() => reset()} disabled={mUpdate.isPending}>Deshacer cambios</Button>
              </Stack>

              <Stack direction="row" spacing={1} mt={2} justifyContent="center">
                <Button size="small" color="warning" onClick={handleRequestObservada}>Observar</Button>
                <Button size="small" color="error" onClick={handleRequestRechazo}>Rechazar</Button>
              </Stack>
            </Paper>
          </Stack>
        </Grid>
      </Grid>

      {/* Dialogs */}
      <Dialog open={addCarreraOpen} onClose={() => !agregarCarreraMutation.isPending && setAddCarreraOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Agregar nuevo profesorado</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Stack spacing={2}>
            <TextField select label="Profesorado" fullWidth size="small" value={nuevaCarreraId} onChange={(e) => setNuevaCarreraId(Number(e.target.value))}>
              {availableCarreras.map((c: any) => <MenuItem key={c.id} value={c.id}>{c.nombre}</MenuItem>)}
            </TextField>
            <TextField label="Cohorte" type="number" size="small" value={nuevaCarreraCohorte} onChange={(e) => setNuevaCarreraCohorte(e.target.value)} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddCarreraOpen(false)}>Cancelar</Button>
          <Button variant="contained" onClick={() => typeof nuevaCarreraId === "number" && agregarCarreraMutation.mutate({ carreraId: nuevaCarreraId, anio: Number(nuevaCarreraCohorte) })} disabled={agregarCarreraMutation.isPending}>Agregar</Button>
        </DialogActions>
      </Dialog>

      <FinalConfirmationDialog open={confirmInscripcionOpen} onConfirm={executeConfirmInscripcion} onCancel={cancelConfirmInscripcion} loading={mConfirm.isPending} contextText="Confirmación de Inscripción" />
      <FinalConfirmationDialog open={Boolean(criticalAction)} onConfirm={executeCriticalAction} onCancel={cancelCriticalAction} loading={criticalActionLoading} contextText={criticalContextText} />
    </Stack>
  );
}
