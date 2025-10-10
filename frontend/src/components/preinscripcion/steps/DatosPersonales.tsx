// src/components/preinscripcion/steps/DatosPersonales.tsx
import { Grid, TextField, MenuItem } from "@mui/material";
import { Controller, useFormContext } from "react-hook-form";
import dayjs from "dayjs";
import "dayjs/locale/es";
import RHFDate from "@/components/RHFDate";
import { PreinscripcionSchema } from "../schema";

dayjs.locale("es");

const ESTADOS_CIVIL = [
  { value: "Soltero/a", label: "Soltero/a" },
  { value: "Casado/a", label: "Casado/a" },
  { value: "Divorciado/a", label: "Divorciado/a" },
  { value: "Viudo/a", label: "Viudo/a" },
  { value: "Unión conviv.", label: "Unión conviv." },
];

function DatosPersonales() {
  const { control, formState, setValue, watch } = useFormContext<PreinscripcionSchema>();
  const { errors } = formState;

  // debug mínimo para confirmar que el componente entra


  return (
    <Grid container spacing={2}>
      {/* Nombres */}
      <Grid item xs={12} md={6}>
        <Controller
          name="nombres"
          control={control}
          render={({ field }) => (
            <TextField
              {...field}
              label="Nombres *"
              fullWidth
              error={Boolean(errors.nombres)}
              helperText={errors.nombres?.message}
            />
          )}
        />
      </Grid>

      {/* Apellido */}
      <Grid item xs={12} md={6}>
        <Controller
          name="apellido"
          control={control}
          render={({ field }) => (
            <TextField
              {...field}
              label="Apellido *"
              fullWidth
              error={Boolean(errors.apellido)}
              helperText={errors.apellido?.message}
            />
          )}
        />
      </Grid>

      {/* DNI */}
      <Grid item xs={12} md={4}>
        <Controller
          name="dni"
          control={control}
          render={({ field }) => (
            <TextField
              {...field}
              label="DNI *"
              fullWidth
              inputProps={{ inputMode: "numeric", pattern: "[0-9]*" }}
              onChange={(e) => field.onChange(e.target.value.replace(/\D+/g, ""))}
              error={Boolean(errors.dni)}
              helperText={errors.dni?.message}
            />
          )}
        />
      </Grid>

      {/* CUIL */}
      <Grid item xs={12} md={4}>
        <Controller
          name="cuil"
          control={control}
          render={({ field }) => (
            <TextField
              {...field}
              label="CUIL *"
              fullWidth
              inputProps={{ inputMode: "numeric", pattern: "[0-9]*" }}
              onChange={(e) => field.onChange(e.target.value.replace(/\D+/g, ""))}
              error={Boolean(errors.cuil)}
              helperText={errors.cuil?.message}
            />
          )}
        />
      </Grid>

      {/* Fecha de nacimiento (DD/MM/YYYY) */}
      <Grid item xs={12} md={4}>
        <RHFDate name="fecha_nacimiento" label="Fecha de nacimiento *" maxDate={dayjs()} />
      </Grid>

      {/* Nacionalidad */}
      <Grid item xs={12} md={4}>
        <Controller
          name="nacionalidad"
          control={control}
          render={({ field }) => (
            <TextField
              {...field}
              label="Nacionalidad *"
              fullWidth
              error={Boolean(errors.nacionalidad)}
              helperText={errors.nacionalidad?.message}
            />
          )}
        />
      </Grid>

      {/* Estado civil */}
      <Grid item xs={12} md={4}>
        <Controller
          name="estado_civil"
          control={control}
          render={({ field }) => (
            <TextField
              {...field}
              select
              label="Estado civil *"
              fullWidth
              error={Boolean(errors.estado_civil)}
              helperText={errors.estado_civil?.message}
            >
              {ESTADOS_CIVIL.map((opt) => (
                <MenuItem key={opt.value} value={opt.value}>
                  {opt.label}
                </MenuItem>
              ))}
            </TextField>
          )}
        />
      </Grid>

      {/* Localidad, provincia y país de nacimiento */}
      <Grid item xs={12} md={4}>
        <Controller
          name="localidad_nac"
          control={control}
          render={({ field }) => (
            <TextField
              {...field}
              label="Localidad de nacimiento *"
              fullWidth
              error={Boolean(errors.localidad_nac)}
              helperText={errors.localidad_nac?.message}
            />
          )}
        />
      </Grid>

      <Grid item xs={12} md={4}>
        <Controller
          name="provincia_nac"
          control={control}
          render={({ field }) => (
            <TextField
              {...field}
              label="Provincia de nacimiento *"
              fullWidth
              error={Boolean(errors.provincia_nac)}
              helperText={errors.provincia_nac?.message}
            />
          )}
        />
      </Grid>

      <Grid item xs={12} md={4}>
        <Controller
          name="pais_nac"
          control={control}
          render={({ field }) => (
            <TextField
              {...field}
              label="País de nacimiento *"
              fullWidth
              error={Boolean(errors.pais_nac)}
              helperText={errors.pais_nac?.message}
            />
          )}
        />
      </Grid>

      {/* Domicilio */}
      <Grid item xs={12}>
        <Controller
          name="domicilio"
          control={control}
          render={({ field }) => (
            <TextField
              {...field}
              label="Domicilio *"
              fullWidth
              error={Boolean(errors.domicilio)}
              helperText={errors.domicilio?.message}
            />
          )}
        />
      </Grid>
    </Grid>
  );
}

export default DatosPersonales;