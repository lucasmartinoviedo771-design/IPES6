import { useEffect } from "react";
import { Alert, FormControlLabel, Grid, TextField, Typography, Checkbox, Stack, FormControl, FormHelperText } from "@mui/material";
import { Controller, useFormContext } from "react-hook-form";
import { PreinscripcionForm } from "../schema";

export default function AccesibilidadApoyos() {
  const {
    control,
    watch,
    setValue,
    clearErrors,
    formState: { errors },
  } = useFormContext<PreinscripcionForm>();

  const condicionMarcada = watch("condicion_salud_informada");

  useEffect(() => {
    if (!condicionMarcada) {
      setValue("condicion_salud_detalle", "", { shouldDirty: false });
      clearErrors("condicion_salud_detalle");
    }
  }, [condicionMarcada, clearErrors, setValue]);

  return (
    <Stack spacing={3}>
      <Typography variant="h6">Accesibilidad y Apoyos</Typography>
      <Alert severity="info">
        Esta información nos ayuda a planificar acompañamientos y ajustes razonables durante tu cursada.
        Es opcional y confidencial.
      </Alert>
      <Grid container spacing={2}>
        <Grid item xs={12}>
          <Controller
            name="cud_informado"
            control={control}
            render={({ field }) => (
              <FormControlLabel
                control={<Checkbox {...field} checked={!!field.value} />}
                label="Poseo un Certificado Único de Discapacidad (CUD) y deseo informarlo."
              />
            )}
          />
        </Grid>
        <Grid item xs={12}>
          <Controller
            name="condicion_salud_informada"
            control={control}
            render={({ field }) => (
              <FormControlLabel
                control={<Checkbox {...field} checked={!!field.value} />}
                label="Deseo brindar información sobre alguna condición de salud que pueda requerir ajustes de accesibilidad, apoyo médico, pedagógico o una atención especial."
              />
            )}
          />
        </Grid>
        {condicionMarcada && (
          <Grid item xs={12}>
            <Controller
              name="condicion_salud_detalle"
              control={control}
              rules={{ required: "Por favor describí la condición o el apoyo requerido." }}
              render={({ field }) => (
                <TextField
                  {...field}
                  label="Detalle de la condición / asistencia requerida"
                  fullWidth
                  multiline
                  minRows={3}
                  error={!!errors.condicion_salud_detalle}
                  helperText={errors.condicion_salud_detalle?.message || "Ejemplo: uso de intérprete, apoyo pedagógico, medicación controlada, etc."}
                />
              )}
            />
          </Grid>
        )}
        <Grid item xs={12}>
          <Controller
            name="consentimiento_datos"
            control={control}
            render={({ field, fieldState }) => (
              <FormControl error={!!fieldState.error} sx={{ alignItems: "flex-start" }}>
                <FormControlLabel
                  control={<Checkbox {...field} checked={!!field.value} />}
                  label={
                    <Typography variant="body2">
                      Tomo conocimiento y doy mi <strong>Consentimiento expreso e informado</strong> para que los datos sensibles que aporte se utilicen únicamente para garantizar soporte académico y accesibilidad.
                    </Typography>
                  }
                />
                <FormHelperText>
                  {fieldState.error?.message ?? "Este consentimiento es obligatorio para completar la preinscripción."}
                </FormHelperText>
              </FormControl>
            )}
          />
        </Grid>
      </Grid>
    </Stack>
  );
}
