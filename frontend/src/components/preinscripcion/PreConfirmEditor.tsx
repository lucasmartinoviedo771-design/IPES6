import { useForm, Controller } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  apiGetPreinscripcionByCodigo, apiUpdatePreinscripcion,
  apiConfirmarPreinscripcion, apiObservarPreinscripcion, apiRechazarPreinscripcion, apiCambiarCarrera, PreinscripcionDTO
} from "@/api/preinscripciones";
import { fetchCarreras } from "@/api/carreras";
import {
  Box, Button, Chip, CircularProgress, Grid, MenuItem, Paper, Stack, Tab, Tabs, TextField, Typography
} from "@mui/material";
import dayjs from "dayjs";
import { enqueueSnackbar } from "notistack";

const Schema = z.object({
  alumno: z.object({
    nombre: z.string().min(1, "Requerido"),
    apellido: z.string().min(1, "Requerido"),
    dni: z.string().min(7, "DNI inválido"),
    email: z.string().email("Email inválido"),
    telefono: z.string().optional(),
    domicilio: z.string().optional(),
    fecha_nacimiento: z.string().optional(),
  }),
  carrera_id: z.number().int().positive(),
});
type FormValues = z.infer<typeof Schema>;

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

  const { control, handleSubmit, reset, watch } = useForm<FormValues>({
    resolver: zodResolver(Schema),
    values: data ? {
      alumno: {
        nombre: data.alumno.nombre,
        apellido: data.alumno.apellido,
        dni: data.alumno.dni,
        email: data.alumno.email,
        telefono: data.alumno.telefono || "",
        domicilio: data.alumno.domicilio || "",
        fecha_nacimiento: data.alumno.fecha_nacimiento || "",
      },
      carrera_id: data.carrera.id,
    } : undefined,
  });

  const mUpdate = useMutation({
    mutationFn: (values: FormValues) => apiUpdatePreinscripcion(codigo, {
      alumno: values.alumno,
      carrera: { id: values.carrera_id },
    } as any),
    onSuccess: () => { enqueueSnackbar("Cambios guardados", { variant: "success" }); qc.invalidateQueries({ queryKey: ["preinscripcion", codigo] }); },
    onError: () => enqueueSnackbar("No se pudo guardar", { variant: "error" })
  });

  const mConfirm = useMutation({
    mutationFn: () => apiConfirmarPreinscripcion(codigo),
    onSuccess: () => { enqueueSnackbar("Preinscripción confirmada", { variant: "success" }); qc.invalidateQueries({ queryKey: ["preinscripcion", codigo] }); },
    onError: () => enqueueSnackbar("No se pudo confirmar", { variant: "error" })
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

  const onSubmit = (v: FormValues) => mUpdate.mutate(v);

  const [tab, setTab] = useState(0);

  if (isLoading) return <Box py={6} textAlign="center"><CircularProgress /></Box>;
  if (isError || !data) return <Typography color="error">No se pudo cargar la preinscripción.</Typography>;

  return (
    <Stack gap={2}>
      <Paper sx={{ p:2 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Box>
            <Typography variant="h6" fontWeight={800}>Preinscripción {data.codigo}</Typography>
            <Typography variant="body2" color="text.secondary">
              {dayjs(data.fecha).format("DD/MM/YYYY HH:mm")} • <EstadoChip estado={data.estado} />
            </Typography>
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
            <Button variant="contained" color="success" onClick={() => mConfirm.mutate()} disabled={mUpdate.isPending}>Confirmar</Button>
          </Stack>
        </Stack>
      </Paper>

      <Paper sx={{ px:2 }}>
        <Tabs value={tab} onChange={(_,v)=>setTab(v)} variant="scrollable">
          <Tab label="Datos personales" />
          <Tab label="Contacto" />
          <Tab label="Profesorado" />
          <Tab label="Resumen" />
        </Tabs>
      </Paper>

      <Paper component="form" onSubmit={handleSubmit(onSubmit)} sx={{ p:2 }}>
        {tab === 0 && (
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <Controller name="alumno.nombre" control={control} render={({ field, fieldState }) => (
                <TextField {...field} label="Nombre" fullWidth error={!!fieldState.error} helperText={fieldState.error?.message}/>
              )}/>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Controller name="alumno.apellido" control={control} render={({ field, fieldState }) => (
                <TextField {...field} label="Apellido" fullWidth error={!!fieldState.error} helperText={fieldState.error?.message}/>
              )}/>
            </Grid>
            <Grid item xs={12} sm={4}>
              <Controller name="alumno.dni" control={control} render={({ field, fieldState }) => (
                <TextField {...field} label="DNI" fullWidth error={!!fieldState.error} helperText={fieldState.error?.message}/>
              )}/>
            </Grid>
            <Grid item xs={12} sm={8}>
              <Controller name="alumno.fecha_nacimiento" control={control} render={({ field }) => (
                <TextField {...field} label="Fecha de nacimiento (YYYY-MM-DD)" fullWidth />
              )}/>
            </Grid>
          </Grid>
        )}

        {tab === 1 && (
          <Grid container spacing={2}>
            <Grid item xs={12} sm={7}>
              <Controller name="alumno.email" control={control} render={({ field, fieldState }) => (
                <TextField {...field} label="Email" fullWidth error={!!fieldState.error} helperText={fieldState.error?.message}/>
              )}/>
            </Grid>
            <Grid item xs={12} sm={5}>
              <Controller name="alumno.telefono" control={control} render={({ field }) => (
                <TextField {...field} label="Teléfono" fullWidth />
              )}/>
            </Grid>
            <Grid item xs={12}>
              <Controller name="alumno.domicilio" control={control} render={({ field }) => (
                <TextField {...field} label="Domicilio" fullWidth />
              )}/>
            </Grid>
          </Grid>
        )}

        {tab === 2 && (
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
        )}

        {tab === 3 && (
          <Stack gap={1}>
            <Typography variant="subtitle2">Resumen (preview)</Typography>
            <Typography variant="body2" color="text.secondary">
              Revisá todos los datos. Podés volver a las pestañas anteriores para corregir antes de confirmar.
            </Typography>
          </Stack>
        )}

        <Stack direction="row" gap={1} justifyContent="flex-end" sx={{ mt: 2 }}>
          <Button type="button" variant="outlined" onClick={() => reset()} disabled={mUpdate.isPending}>Deshacer cambios</Button>
          <Button type="submit" variant="contained" disabled={mUpdate.isPending}>Guardar cambios</Button>
        </Stack>
      </Paper>
    </Stack>
  );
}
