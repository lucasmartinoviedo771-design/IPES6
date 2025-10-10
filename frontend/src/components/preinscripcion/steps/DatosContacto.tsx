import { Grid, TextField } from "@mui/material";
import { Controller, useFormContext } from "react-hook-form";
import { PreinscripcionSchema } from "../schema";

export default function DatosContacto() {
  const { control, formState: { errors } } = useFormContext<PreinscripcionSchema>();

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
              label="Teléfono Móvil"
              fullWidth
              error={!!errors.tel_movil}
              helperText={errors.tel_movil?.message}
            />
          )}
        />
      </Grid>
      <Grid item xs={12} md={6}>
        <Controller
          name="telefono_fijo"
          control={control}
          render={({ field }) => (
            <TextField
              {...field}
              label="Teléfono Fijo"
              fullWidth
              error={!!errors.telefono_fijo}
              helperText={errors.telefono_fijo?.message}
            />
          )}
        />
      </Grid>
    </Grid>
  );
}