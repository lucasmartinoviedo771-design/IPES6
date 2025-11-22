import { Grid, TextField } from "@mui/material";
import { Controller, useFormContext } from "react-hook-form";
import { PreinscripcionForm } from "../schema";

export default function DatosContacto() {
  const {
    control,
    formState: { errors },
  } = useFormContext<PreinscripcionForm>();

  return (
    <Grid container spacing={2}>
      <Grid item xs={12} md={6}>
        <Controller
          name="email"
          control={control}
          render={({ field }) => (
            <TextField
              {...field}
              label="Email"
              fullWidth
              error={!!errors.email}
              helperText={errors.email?.message}
            />
          )}
        />
      </Grid>
      <Grid item xs={12} md={6}>
        <Controller
          name="tel_movil"
          control={control}
          render={({ field }) => (
            <TextField
              {...field}
              label="Teléfono móvil"
              fullWidth
              error={!!errors.tel_movil}
              helperText={errors.tel_movil?.message}
            />
          )}
        />
      </Grid>
      <Grid item xs={12} md={6}>
        <Controller
          name="tel_fijo"
          control={control}
          render={({ field }) => (
            <TextField
              {...field}
              label="Teléfono fijo"
              fullWidth
              error={!!errors.tel_fijo}
              helperText={errors.tel_fijo?.message}
            />
          )}
        />
      </Grid>
    </Grid>
  );
}
