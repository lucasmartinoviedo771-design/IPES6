import React from "react";
import { Controller, useFormContext } from "react-hook-form";
import { TextField, Grid, Typography, Box } from "@mui/material";
import dayjs from "dayjs";
import { PreinscripcionForm } from "../schema";

export default function EstudiosSecundarios() {
  const { control } = useFormContext<PreinscripcionForm>();
  return (
    <Box>
      <Typography variant="h6" sx={{ mb: 2 }}>Estudios Secundarios</Typography>
      <Grid container spacing={2}>
        <Grid item xs={12} md={4}>
          <Controller
            name="sec_titulo"
            control={control}
            render={({ field, fieldState }) => (
              <TextField {...field} label="Título" fullWidth
                error={!!fieldState.error} helperText={fieldState.error?.message} />
            )}
          />
        </Grid>
        <Grid item xs={12} md={4}>
          <Controller
            name="sec_establecimiento"
            control={control}
            render={({ field, fieldState }) => (
              <TextField {...field} label="Establecimiento" fullWidth
                error={!!fieldState.error} helperText={fieldState.error?.message} />
            )}
          />
        </Grid>
        <Grid item xs={12} md={4}>
          <Controller
            name="sec_fecha_egreso"
            control={control}
            render={({ field, fieldState }) => (
              <TextField
                {...field}
                type="date"
                label="Fecha de egreso"
                fullWidth
                InputLabelProps={{ shrink: true }}
                inputProps={{ max: dayjs().format("YYYY-MM-DD") }}
                error={!!fieldState.error}
                helperText={fieldState.error?.message || "Formato YYYY-MM-DD"}
              />
            )}
          />
        </Grid>

        {/* NUEVOS CAMPOS */}
        <Grid item xs={12} md={4}>
          <Controller
            name="sec_localidad"
            control={control}
            render={({ field, fieldState }) => (
              <TextField {...field} label="Localidad" fullWidth
                error={!!fieldState.error} helperText={fieldState.error?.message} />
            )}
          />
        </Grid>
        <Grid item xs={12} md={4}>
          <Controller
            name="sec_provincia"
            control={control}
            render={({ field, fieldState }) => (
              <TextField {...field} label="Provincia" fullWidth
                error={!!fieldState.error} helperText={fieldState.error?.message} />
            )}
          />
        </Grid>
        <Grid item xs={12} md={4}>
          <Controller
            name="sec_pais"
            control={control}
            render={({ field, fieldState }) => (
              <TextField {...field} label="País" fullWidth
                error={!!fieldState.error} helperText={fieldState.error?.message} />
            )}
          />
        </Grid>
      </Grid>
    </Box>
  );
}
