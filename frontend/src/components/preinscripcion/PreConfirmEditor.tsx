import { useForm, Controller } from "react-hook-form";
import { useState, useEffect } from "react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  apiGetPreinscripcionByCodigo, apiUpdatePreinscripcion,
  apiConfirmarPreinscripcion, apiObservarPreinscripcion, apiRechazarPreinscripcion, apiCambiarCarrera, PreinscripcionDTO,
  eliminarPreinscripcion, apiGetChecklist, apiPutChecklist, ChecklistDTO, apiListPreDocs, apiUploadPreDoc, PreinscripcionUpdatePayload
} from "@/api/preinscripciones";
import { fetchCarreras } from "@/api/carreras";
import {
  Box, Button, Chip, CircularProgress, Grid, MenuItem, Paper, Stack, TextField, Typography, Divider, Checkbox, FormControlLabel, Switch
} from "@mui/material";
import dayjs from "dayjs";
import { enqueueSnackbar } from "notistack";
import { useNavigate } from "react-router-dom";

import { preinscripcionSchema, PreinscripcionForm } from "./schema";
import { defaultValues as formDefaults } from "./defaultValues";

function EstadoChip({ estado }: { estado: PreinscripcionDTO["estado"] }) {
  const map: Record<string, "default" | "success" | "warning" | "error"> = {
    enviada: "default", observada: "warning", confirmada: "success", rechazada: "error", borrador: "default",
  };
  return <Chip label={estado} color={map[estado] ?? "default"} size="small" sx={{ borderRadius: 99, textTransform: "capitalize" }} />;
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
        (acc as any)[k] = (typeof v === 'boolean') ? v : String(v).toLowerCase() === 'true';
      } else if (typeof dv === 'string') {
        (acc as any)[k] = String(v);
      } else {
        (acc as any)[k] = v;
      }
      return acc;
    }, { ...formDefaults } as PreinscripcionForm);

    // Overwrites desde los campos normalizados del backend
    sanitized.nombres = String(data.alumno?.nombre ?? formDefaults.nombres);
    sanitized.apellido = String(data.alumno?.apellido ?? formDefaults.apellido);
    sanitized.dni = String((data.alumno as any)?.dni ?? sanitized.dni ?? "");
    sanitized.cuil = String((data as any).alumno?.cuil ?? (extra as any)?.cuil ?? sanitized.cuil ?? "");
    sanitized.email = String((data.alumno as any)?.email ?? sanitized.email ?? "");
    sanitized.tel_movil = String((data.alumno as any)?.telefono ?? sanitized.tel_movil ?? "");
    sanitized.domicilio = String((data.alumno as any)?.domicilio ?? sanitized.domicilio ?? "");
    sanitized.fecha_nacimiento = String((data.alumno as any)?.fecha_nacimiento ?? sanitized.fecha_nacimiento ?? "");
    sanitized.carrera_id = Number((data as any).carrera?.id ?? 0);

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
      // mirrors para la UI
      titulo_secundario: !!cl.titulo_secundario_legalizado,
      titulo_en_tramite: !!cl.certificado_titulo_en_tramite,
    });
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
    // mirrors para compatibilidad con UI existente
    titulo_secundario: false,
    titulo_en_tramite: false,
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
  // Estado completo (criterio similar al backend)
  // Criterio para estado Regular: solo con título secundario legalizado
  // Si no, queda Condicional (puede confirmarse con DDJJ)
  const allDocs = !!(
    docs.dni_legalizado &&
    docs.fotos_4x4 &&
    docs.certificado_salud &&
    docs.folios_oficio_ok &&
    docs.titulo_secundario_legalizado
  );

  const anyMainSelected = !!(docs.titulo_secundario_legalizado || docs.certificado_titulo_en_tramite || docs.analitico_legalizado);

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
  });
  const mConfirm = useMutation({
    mutationFn: async () => {
      return apiConfirmarPreinscripcion(codigo, buildChecklistPayload());
    },
    onSuccess: () => { enqueueSnackbar("Preinscripción confirmada", { variant: "success" }); qc.invalidateQueries({ queryKey: ["preinscripcion", codigo] }); },
    onError: () => enqueueSnackbar("No se pudo confirmar", { variant: "error" })
  });

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
    onSuccess: () => { enqueueSnackbar("Profesorado actualizado", { variant: "success" }); qc.invalidateQueries({ queryKey: ["preinscripcion", codigo] }); },
    onError: () => enqueueSnackbar("No se pudo cambiar el profesorado", { variant: "error" })
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

  const onSubmit = (v: PreinscripcionForm) => mUpdate.mutate(v);

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
            <Button variant="outlined" color="warning" onClick={() => {
              const m = prompt("Motivo de observación:");
              if (m) mObservar.mutate(m);
            }}>Marcar Observada</Button>
            <Button variant="outlined" color="error" onClick={() => {
              const m = prompt("Motivo de rechazo:");
              if (m) mRechazar.mutate(m);
            }}>Rechazar</Button>
            <Button variant="contained" color="error" sx={{ ml: 1 }} onClick={() => {
              const msg = "Esta seguro que quiere borrar la preinscripcion del estudiante? La baja sera logica (no fisica).";
              if (window.confirm(msg)) {
                mDelete.mutate();
              }
            }}>Eliminar</Button>
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
        <Typography variant="subtitle1" gutterBottom>Documentación</Typography>

        <Typography variant="subtitle2" gutterBottom>Requisitos generales</Typography>
        <Stack>
          <FormControlLabel control={<Checkbox checked={!!docs.dni_legalizado} onChange={(_, c)=>setDocs(s=>({...s,dni_legalizado:c}))} />} label="Fotocopia legalizada del DNI" />
          <FormControlLabel control={<Checkbox checked={!!docs.fotos_4x4} onChange={(_, c)=>setDocs(s=>({...s,fotos_4x4:c}))} />} label="2 fotos carnet 4×4" />
          <FormControlLabel control={<Checkbox checked={!!docs.folios_oficio_ok} onChange={(_, c)=>setDocs(s=>({...s,folios_oficio_ok:c}))} />} label="3 folios oficio" />
          <FormControlLabel control={<Checkbox checked={!!docs.certificado_salud} onChange={(_, c)=>setDocs(s=>({...s,certificado_salud:c}))} />} label="Certificado de Buena Salud" />
        </Stack>

        <Divider sx={{ my: 2 }} />
        <Typography variant="subtitle2" gutterBottom>Secundario</Typography>
        <Stack>
          <FormControlLabel control={<Checkbox checked={!!docs.titulo_secundario} onChange={(_, c)=>pickSecundario('titulo_secundario', c)} />} label="Título secundario" />
          <FormControlLabel control={<Checkbox checked={!!docs.titulo_en_tramite} onChange={(_, c)=>pickSecundario('titulo_en_tramite', c)} />} label="Certificado de título en trámite" />
          <FormControlLabel control={<Checkbox checked={!!docs.analitico_legalizado} onChange={(_, c)=>pickSecundario('analitico_legalizado', c)} />} label="Fotocopia de analítico legalizada" />
        </Stack>

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
              <FotoPreviewBox dataUrl={docUrl} />
              <Typography variant="caption" color="text.secondary">
                {docUrl ? `Fuente: archivo (len: ${String(docUrl).length})` : 'Sin foto'}
              </Typography>
            </>
          );
        })()}
        <Divider sx={{ my: 2 }} />
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="body2">Estado documental:</Typography>
          <Chip size="small" color={allDocs ? "success" : "warning"} label={allDocs ? "Regular" : "Condicional"} />
        </Stack>
        <Divider sx={{ my: 2 }} />
        <Button sx={{ mb: 1 }} variant="outlined" onClick={() => mSaveChecklist.mutate()} disabled={mUpdate.isPending}>Guardar checklist</Button>
        <FormControlLabel
          control={<Checkbox checked={!!ddjjOk} onChange={(_, c)=> setDdjjOk(!!c)} disabled={allDocs} />}
          label="DDJJ / Nota compromiso"
        />
        <Button sx={{ mt: 2 }} variant="contained" color="success" onClick={() => mConfirm.mutate()} disabled={!canConfirm || mUpdate.isPending}>
          Confirmar Inscripción
        </Button>
      </Paper>
        </Grid>
      </Grid>
    </Stack>
  );
}