import { FormControlLabel, Grid, Switch, TextField } from "@mui/material";
import { Controller, useFormContext } from "react-hook-form";

import { PreinscripcionForm } from "../schema";

export default function DatosLaborales() {
  const {
    control,
    watch,
    formState: { errors, isSubmitting },
  } = useFormContext<PreinscripcionForm>();

  const trabaja = watch("trabaja");

  return (
    <Grid container spacing={2}>
      <Grid item xs={12}>
        <Controller
          name="trabaja"
          control={control}
          render={({ field }) => (
            <FormControlLabel
              control={<Switch {...field} checked={Boolean(field.value)} disabled={isSubmitting} />}
              label="¿Trabaja actualmente?"
            />
          )}
        />
      </Grid>

      {trabaja && (
        <>
          <Grid item xs={12} md={6}>
            <Controller
              name="empleador"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  label="Empleador"
                  fullWidth
                  error={!!errors.empleador}
                  helperText={errors.empleador?.message}
                />
              )}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <Controller
              name="horario_trabajo"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  label="Horario de trabajo"
                  fullWidth
                  error={!!errors.horario_trabajo}
                  helperText={errors.horario_trabajo?.message}
                />
              )}
            />
          </Grid>
          <Grid item xs={12}>
            <Controller
              name="domicilio_trabajo"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  label="Domicilio laboral"
                  fullWidth
                  error={!!errors.domicilio_trabajo}
                  helperText={errors.domicilio_trabajo?.message}
                />
              )}
            />
          </Grid>
        </>
      )}
    </Grid>
  );
}
