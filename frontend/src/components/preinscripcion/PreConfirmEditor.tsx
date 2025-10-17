import { useForm, Controller } from "react-hook-form";
import { useState, useEffect } from "react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  apiGetPreinscripcionByCodigo, apiUpdatePreinscripcion,
  apiConfirmarPreinscripcion, apiObservarPreinscripcion, apiRechazarPreinscripcion, apiCambiarCarrera, PreinscripcionDTO,
  eliminarPreinscripcion
} from "@/api/preinscripciones";
import { fetchCarreras } from "@/api/carreras";
import {
  Box, Button, Chip, CircularProgress, Grid, MenuItem, Paper, Stack, TextField, Typography, Divider, Checkbox, FormControlLabel, Switch
} from "@mui/material";
import dayjs from "dayjs";
import { enqueueSnackbar } from "notistack";
import { useNavigate } from "react-router-dom";

import { preinscripcionSchema, PreinscripcionForm } from "./schema";

function EstadoChip({ estado }: { estado: PreinscripcionDTO["estado"] }) {
  const map: Record<string, "default" | "success" | "warning" | "error"> = {
    enviada: "default", observada: "warning", confirmada: "success", rechazada: "error", borrador: "default",
  };
  return <Chip label={estado} color={map[estado] ?? "default"} size="small" sx={{ borderRadius: 99, textTransform: "capitalize" }} />;
}

export default function PreConfirmEditor({ codigo }: { codigo: string }) {
  const qc = useQueryClient();
  const { data, isLoading, isError } = useQuery({
    queryKey: ["preinscripcion", codigo],
    queryFn: () => apiGetPreinscripcionByCodigo(codigo),
  });

  const carrerasQ = useQuery({ queryKey: ["carreras"], queryFn: fetchCarreras });

  const { control, handleSubmit, reset, watch, setValue } = useForm<PreinscripcionForm>({
    resolver: zodResolver(preinscripcionSchema) as any,
  });

  // Setear todos los valores cuando llega `data` (incluye CUIL)
  useEffect(() => {
    if (!data) return;
    const initial: Partial<PreinscripcionForm> = {
      ...(((data as any).datos_extra) || {}),
      nombres: data.alumno.nombre,
      apellido: data.alumno.apellido,
      dni: data.alumno.dni,
      cuil: ((data as any).alumno?.cuil ?? (data as any).datos_extra?.cuil ?? ""),
      email: data.alumno.email,
      tel_movil: data.alumno.telefono,
      domicilio: data.alumno.domicilio,
      fecha_nacimiento: data.alumno.fecha_nacimiento,
      carrera_id: data.carrera.id ?? "",
    };
    reset(initial as any);
  }, [data, reset]);

  const mUpdate = useMutation({
    mutationFn: (values: PreinscripcionForm) => apiUpdatePreinscripcion(codigo, {
      // Re-build the nested structure the API expects for the alumno part
      alumno: {
        nombre: values.nombres,
        apellido: values.apellido,
        dni: values.dni,
        cuil: (values as any).cuil,
        email: values.email,
        telefono: values.tel_movil,
        domicilio: values.domicilio,
        fecha_nacimiento: values.fecha_nacimiento,
      },
      carrera: { id: values.carrera_id },
      // Pass the rest of the form data as `datos_extra`
      datos_extra: values,
    } as any),
    onSuccess: () => { enqueueSnackbar("Cambios guardados", { variant: "success" }); qc.invalidateQueries({ queryKey: ["preinscripcion", codigo] }); },
    onError: () => enqueueSnackbar("No se pudo guardar", { variant: "error" })
  });

    // Documentación requerida (checklist)
  const [docs, setDocs] = useState<{ [k: string]: boolean }>({
    dni_legalizada: false,
    fotos_4x4: false,
    folios_oficio: false,
    certificado_salud: false,
    titulo_secundario: false,
    titulo_en_tramite: false,
    analitico_legalizado: false,
    adeuda_materias: false,
  });
  const [adeudaDetalle, setAdeudaDetalle] = useState<{ materias: string; institucion: string }>({ materias: "", institucion: "" });
  const allDocs = !!(docs.dni_legalizada && docs.fotos_4x4 && docs.certificado_salud && docs.titulo_secundario);

  // Exclusividad en opciones de Secundario: solo una permitida
  const pickSecundario = (
    key: 'titulo_secundario' | 'titulo_en_tramite' | 'analitico_legalizado',
    checked: boolean,
  ) => {
    setDocs(s => ({
      ...s,
      titulo_secundario: false,
      titulo_en_tramite: false,
      analitico_legalizado: false,
      [key]: !!checked,
    }));
  };

  // DDJJ / Nota compromiso (requerida si es condicional)
  const [ddjjOk, setDdjjOk] = useState<boolean>(false);
  const canConfirm = allDocs || ddjjOk;

  const mConfirm = useMutation({
    mutationFn: () => apiConfirmarPreinscripcion(codigo, { documentos: docs, estado: allDocs ? "regular" : "condicional" }),
    onSuccess: () => { enqueueSnackbar("PreinscripciÃ³n confirmada", { variant: "success" }); qc.invalidateQueries({ queryKey: ["preinscripcion", codigo] }); },
    onError: () => enqueueSnackbar("No se pudo confirmar", { variant: "error" })
  });

  const mObservar = useMutation({
    mutationFn: (motivo: string) => apiObservarPreinscripcion(codigo, motivo),
    onSuccess: () => { enqueueSnackbar("Marcada como observada", { variant: "info" }); qc.invalidateQueries({ queryKey: ["preinscripcion", codigo] }); },
    onError: () => enqueueSnackbar("No se pudo observar", { variant: "error" })
  });

  const mRechazar = useMutation({
    mutationFn: (motivo: string) => apiRechazarPreinscripcion(codigo, motivo),
    onSuccess: () => { enqueueSnackbar("PreinscripciÃ³n rechazada", { variant: "warning" }); qc.invalidateQueries({ queryKey: ["preinscripcion", codigo] }); },
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
      if (!data?.id) throw new Error("ID de preinscripciÃ³n no encontrado");
      return eliminarPreinscripcion(data.id);
    },
    onSuccess: () => {
      enqueueSnackbar("PreinscripciÃ³n eliminada permanentemente", { variant: "success" });
      qc.invalidateQueries({ queryKey: ["preinscripciones"] }); // Invalidate list
      navigate("/preinscripciones");
    },
    onError: () => enqueueSnackbar("No se pudo eliminar la preinscripciÃ³n", { variant: "error" })
  });

  const onSubmit = (v: PreinscripcionForm) => mUpdate.mutate(v);

  // Editor unificado: sin tabs

  if (isLoading) return <Box py={6} textAlign="center"><CircularProgress /></Box>;
  if (isError || !data) return <Typography color="error">No se pudo cargar la preinscripciÃ³n.</Typography>;

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
              const m = prompt("Motivo de observaciÃ³n:");
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
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <Controller name="nombres" control={control} render={({ field, fieldState }) => (
                <TextField {...field} label="Nombres" fullWidth error={!!fieldState.error} helperText={fieldState.error?.message}/>
              )}/>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Controller name="apellido" control={control} render={({ field, fieldState }) => (
                <TextField {...field} label="Apellido" fullWidth error={!!fieldState.error} helperText={fieldState.error?.message}/>
              )}/>
            </Grid>
            <Grid item xs={12} sm={4}>
              <Controller name="dni" control={control} render={({ field, fieldState }) => (
                <TextField {...field} label="DNI" fullWidth error={!!fieldState.error} helperText={fieldState.error?.message}/>
              )}/>
            </Grid>
            <Grid item xs={12} sm={4}>
              <Controller name="cuil" control={control} render={({ field, fieldState }) => (
                <TextField {...field} label="CUIL" fullWidth error={!!fieldState.error} helperText={fieldState.error?.message}/>
              )}/>
            </Grid>
            <Grid item xs={12} sm={4}>
              <Controller name="fecha_nacimiento" control={control} render={({ field }) => (
                <TextField {...field} label="Fecha de nacimiento (YYYY-MM-DD)" fullWidth />
              )}/>
            </Grid>
            <Grid item xs={12} sm={4}>
              <Controller name="estado_civil" control={control} render={({ field, fieldState }) => (
                <TextField {...field} label="Estado Civil" fullWidth error={!!fieldState.error} helperText={fieldState.error?.message}/>
              )}/>
            </Grid>
            <Grid item xs={12} sm={4}>
              <Controller name="nacionalidad" control={control} render={({ field, fieldState }) => (
                <TextField {...field} label="Nacionalidad" fullWidth error={!!fieldState.error} helperText={fieldState.error?.message}/>
              )}/>
            </Grid>
            <Grid item xs={12} sm={4}>
              <Controller name="pais_nac" control={control} render={({ field, fieldState }) => (
                <TextField {...field} label="PaÃ­s de nacimiento" fullWidth error={!!fieldState.error} helperText={fieldState.error?.message}/>
              )}/>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Controller name="provincia_nac" control={control} render={({ field, fieldState }) => (
                <TextField {...field} label="Provincia de nacimiento" fullWidth error={!!fieldState.error} helperText={fieldState.error?.message}/>
              )}/>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Controller name="localidad_nac" control={control} render={({ field, fieldState }) => (
                <TextField {...field} label="Localidad de nacimiento" fullWidth error={!!fieldState.error} helperText={fieldState.error?.message}/>
              )}/>
            </Grid>
          </Grid>

        {/* SecciÃ³n: Contacto */}
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <Controller name="email" control={control} render={({ field, fieldState }) => (
                <TextField {...field} label="Email" fullWidth error={!!fieldState.error} helperText={fieldState.error?.message}/>
              )}/>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Controller name="tel_movil" control={control} render={({ field }) => (
                <TextField {...field} label="TelÃ©fono MÃ³vil" fullWidth />
              )}/>
            </Grid>
            <Grid item xs={12} sm={6}>
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
            <Grid item xs={12} sm={6}>
              <Controller name="emergencia_telefono" control={control} render={({ field, fieldState }) => (
                <TextField {...field} label="TelÃ©fono de Emergencia" fullWidth error={!!fieldState.error} helperText={fieldState.error?.message}/>
              )}/>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Controller name="emergencia_parentesco" control={control} render={({ field, fieldState }) => (
                <TextField {...field} label="Parentesco" fullWidth error={!!fieldState.error} helperText={fieldState.error?.message}/>
              )}/>
            </Grid>
          </Grid>

        {/* SecciÃ³n: Estudios (Secundario y Superiores) */}
          <Stack spacing={3}>
            <Box>
              <Typography variant="subtitle1" gutterBottom>Estudios Secundarios</Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={8}>
                  <Controller name="sec_establecimiento" control={control} render={({ field, fieldState }) => (
                    <TextField {...field} label="Establecimiento" fullWidth error={!!fieldState.error} helperText={fieldState.error?.message}/>
                  )}/>
                </Grid>
                <Grid item xs={12} sm={4}>
                  <Controller name="sec_fecha_egreso" control={control} render={({ field, fieldState }) => (
                    <TextField {...field} label="Fecha de Egreso" fullWidth type="date" InputLabelProps={{ shrink: true }} error={!!fieldState.error} helperText={fieldState.error?.message}/>
                  )}/>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Controller name="sec_titulo" control={control} render={({ field, fieldState }) => (
                    <TextField {...field} label="TÃ­tulo Obtenido" fullWidth error={!!fieldState.error} helperText={fieldState.error?.message}/>
                  )}/>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Controller name="sec_localidad" control={control} render={({ field, fieldState }) => (
                    <TextField {...field} label="Localidad" fullWidth error={!!fieldState.error} helperText={fieldState.error?.message}/>
                  )}/>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Controller name="sec_provincia" control={control} render={({ field, fieldState }) => (
                    <TextField {...field} label="Provincia" fullWidth error={!!fieldState.error} helperText={fieldState.error?.message}/>
                  )}/>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Controller name="sec_pais" control={control} render={({ field, fieldState }) => (
                    <TextField {...field} label="PaÃ­s" fullWidth error={!!fieldState.error} helperText={fieldState.error?.message}/>
                  )}/>
                </Grid>
              </Grid>
            </Box>
            <Box>
              <Typography variant="subtitle1" gutterBottom>Estudios Superiores</Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={8}>
                  <Controller name="sup1_establecimiento" control={control} render={({ field, fieldState }) => (
                    <TextField {...field} label="Establecimiento" fullWidth error={!!fieldState.error} helperText={fieldState.error?.message}/>
                  )}/>
                </Grid>
                <Grid item xs={12} sm={4}>
                  <Controller name="sup1_fecha_egreso" control={control} render={({ field, fieldState }) => (
                    <TextField {...field} label="Fecha de Egreso" fullWidth type="date" InputLabelProps={{ shrink: true }} error={!!fieldState.error} helperText={fieldState.error?.message}/>
                  )}/>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Controller name="sup1_titulo" control={control} render={({ field, fieldState }) => (
                    <TextField {...field} label="TÃ­tulo Obtenido" fullWidth error={!!fieldState.error} helperText={fieldState.error?.message}/>
                  )}/>
                </Grid>
              </Grid>
            </Box>
          </Stack>

        {/* SecciÃ³n: Profesorado */}
          <Grid container spacing={2}>
            <Grid item xs={12} sm={8}>
              <Controller
                name="carrera_id"
                control={control}
                render={({ field, fieldState }) => (
                  <TextField {...field} select label="Profesorado" fullWidth error={!!fieldState.error} helperText={fieldState.error?.message}>
                    {(carrerasQ.data || []).map((c:any) => (
                      <MenuItem key={c.id} value={c.id}>{c.nombre}</MenuItem>
                    ))}
                  </TextField>
                )}
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <Button
                fullWidth variant="outlined"
                onClick={() => mCambiarCarrera.mutate(watch("carrera_id"))}
                disabled={mCambiarCarrera.isPending}
              >
                Cambiar Profesorado
              </Button>
            </Grid>
          </Grid>

        {/* Datos laborales */}
          <Divider sx={{ my: 2 }} />
          <Typography variant="subtitle1" gutterBottom>Datos Laborales</Typography>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <Controller
                name="trabaja"
                control={control}
                render={({ field }) => (
                  <FormControlLabel control={<Switch {...field} checked={!!field.value} />}
                    label="Â¿Trabaja actualmente?" />
                )}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <Controller name="empleador" control={control} render={({ field }) => (
                <TextField {...field} label="Empleador" fullWidth />
              )}/>
            </Grid>
            <Grid item xs={12} sm={6}>
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
          <FormControlLabel control={<Checkbox checked={!!docs.dni_legalizada} onChange={(_, c)=>setDocs(s=>({...s,dni_legalizada:c}))} />} label="Fotocopia legalizada del DNI" />
          <FormControlLabel control={<Checkbox checked={!!docs.fotos_4x4} onChange={(_, c)=>setDocs(s=>({...s,fotos_4x4:c}))} />} label="2 fotos carnet 4×4" />
          <FormControlLabel control={<Checkbox checked={!!docs.folios_oficio} onChange={(_, c)=>setDocs(s=>({...s,folios_oficio:c}))} />} label="3 folios oficio" />
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
          <FormControlLabel control={<Checkbox checked={!!docs.adeuda_materias} onChange={(_, c)=>setDocs(s=>({...s,adeuda_materias:c}))} />} label="Si adeuda materias" />
          {docs.adeuda_materias && (
            <Grid container spacing={2}>
              <Grid item xs={12} sm={8}>
                <TextField label="Materias adeudadas" fullWidth value={adeudaDetalle.materias} onChange={(e)=>setAdeudaDetalle(d=>({...d,materias:e.target.value}))}/>
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField label="Colegio o institución" fullWidth value={adeudaDetalle.institucion} onChange={(e)=>setAdeudaDetalle(d=>({...d,institucion:e.target.value}))}/>
              </Grid>
            </Grid>
          )}
        </Stack>

        <Divider sx={{ my: 2 }} />
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="body2">Estado documental:</Typography>
          <Chip size="small" color={allDocs ? "success" : "warning"} label={allDocs ? "Regular" : "Condicional"} />
        </Stack>
        <Divider sx={{ my: 2 }} />
        <FormControlLabel
          control={<Checkbox checked={!!ddjjOk} onChange={(_, c)=> setDdjjOk(!!c)} />}
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








