import { Controller } from "react-hook-form";
import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import Divider from "@mui/material/Divider";
import Checkbox from "@mui/material/Checkbox";
import FormControlLabel from "@mui/material/FormControlLabel";
import Switch from "@mui/material/Switch";
import Alert from "@mui/material/Alert";
import Stack from "@mui/material/Stack";
import { type Control } from "react-hook-form";
import { PreinscripcionForm } from "../schema";
import { type Carrera } from "@/api/carreras";

interface PersonalesSectionProps {
  control: Control<PreinscripcionForm>;
  condicionSaludActiva: boolean;
  carreras: Carrera[];
  validationErrors: any;
}

export default function PersonalesSection({ control, condicionSaludActiva, carreras, validationErrors }: PersonalesSectionProps) {
  return (
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
              {carreras.map((c: Carrera) => (
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
  );
}
