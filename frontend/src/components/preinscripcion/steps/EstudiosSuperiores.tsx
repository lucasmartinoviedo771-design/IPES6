import { Grid, TextField } from "@mui/material";
import dayjs from "dayjs";
import { Controller, useFormContext } from "react-hook-form";

import RHFDate from "@/components/RHFDate";
import { PreinscripcionForm } from "../schema";

export default function EstudiosSuperiores() {
  const {
    control,
    formState: { errors },
  } = useFormContext<PreinscripcionForm>();

  return (
    <Grid container spacing={2}>
      <Grid item xs={12} md={6}>
        <Controller
          name="sup1_titulo"
          control={control}
          render={({ field }) => (
            <TextField
              {...field}
              label="Título superior"
              fullWidth
              error={!!errors.sup1_titulo}
              helperText={errors.sup1_titulo?.message}
            />
          )}
        />
      </Grid>
      <Grid item xs={12} md={6}>
        <Controller
          name="sup1_establecimiento"
          control={control}
          render={({ field }) => (
            <TextField
              {...field}
              label="Establecimiento"
              fullWidth
              error={!!errors.sup1_establecimiento}
              helperText={errors.sup1_establecimiento?.message}
            />
          )}
        />
      </Grid>
      <Grid item xs={12} md={6}>
        <RHFDate name="sup1_fecha_egreso" label="Fecha de egreso" maxDate={dayjs()} />
      </Grid>
    </Grid>
  );
}
