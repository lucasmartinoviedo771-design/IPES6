console.log("[Contacto] render v2 (con emergencia)");
import { Controller, useFormContext } from "react-hook-form";
import { TextField, Grid, Typography, Box } from "@mui/material";
import { PreinscripcionForm } from "../schema";

export default function Contacto() {
  const { control } = useFormContext<PreinscripcionForm>();

  return (
    <Box>
      <Typography variant="h6" sx={{ mb: 2 }}>Contacto</Typography>
      <Grid container spacing={2}>
        <Grid item xs={12} md={6}>
          <Controller
            name="email"
            control={control}
            render={({ field, fieldState }) => (
              <TextField {...field} label="Email" fullWidth
                error={!!fieldState.error} helperText={fieldState.error?.message} />
            )}
          />
        </Grid>
        <Grid item xs={12} md={3}>
          <Controller
            name="tel_movil"
            control={control}
            render={({ field, fieldState }) => (
              <TextField {...field} label="Teléfono móvil" fullWidth
                error={!!fieldState.error} helperText={fieldState.error?.message} />
            )}
          />
        </Grid>
        <Grid item xs={12} md={3}>
          <Controller
            name="tel_fijo"
            control={control}
            render={({ field, fieldState }) => (
              <TextField {...field} label="Teléfono fijo" fullWidth
                error={!!fieldState.error} helperText={fieldState.error?.message} />
            )}
          />
        </Grid>
      </Grid>

      <Typography variant="h6" sx={{ mt: 4, mb: 2 }}>
        Contacto de emergencia
      </Typography>
      <Grid container spacing={2}>
        <Grid item xs={12} md={6}>
          <Controller
            name="emergencia_telefono"
            control={control}
            render={({ field, fieldState }) => (
              <TextField {...field} label="Teléfono de emergencia" fullWidth
                error={!!fieldState.error} helperText={fieldState.error?.message} />
            )}
          />
        </Grid>
        <Grid item xs={12} md={6}>
          <Controller
            name="emergencia_parentesco"
            control={control}
            render={({ field, fieldState }) => (
              <TextField {...field} label="Parentesco" fullWidth
                error={!!fieldState.error} helperText={fieldState.error?.message} />
            )}
          />
        </Grid>
      </Grid>
    </Box>
  );
}