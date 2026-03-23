import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Checkbox from "@mui/material/Checkbox";
import FormControlLabel from "@mui/material/FormControlLabel";
import TextField from "@mui/material/TextField";
import { Controller, Control } from "react-hook-form";
import { DetailFormValues, DetailDocumentacionForm } from "../types";

type Props = {
  docValues: DetailDocumentacionForm;
  anyMainSelected: boolean;
  control: Control<DetailFormValues>;
  setValue: (name: any, value: any, options?: any) => void;
  handleMainDocChange: (target: keyof DetailDocumentacionForm) => (_: unknown, checked: boolean) => void;
  handleAdeudaChange: (_: unknown, checked: boolean) => void;
  handleEstudianteRegularChange: (_: unknown, checked: boolean) => void;
};

export function DocumentacionSection({
  docValues,
  anyMainSelected,
  control,
  setValue,
  handleMainDocChange,
  handleAdeudaChange,
  handleEstudianteRegularChange,
}: Props) {
  return (
    <Box>
      <Typography variant="subtitle1" fontWeight={700} gutterBottom>
        Documentación presentada
      </Typography>

      <Typography variant="subtitle2" fontWeight={600} gutterBottom>
        Documentos generales
      </Typography>
      <Stack direction="row" spacing={2} flexWrap="wrap">
        <FormControlLabel
          control={
            <Checkbox
              checked={Boolean(docValues.dni_legalizado)}
              onChange={(_, checked) => setValue("documentacion.dni_legalizado" as const, checked, { shouldDirty: true })}
            />
          }
          label="DNI legalizado"
        />
        <FormControlLabel
          control={
            <Checkbox
              checked={Boolean(docValues.fotos_4x4)}
              onChange={(_, checked) => setValue("documentacion.fotos_4x4" as const, checked, { shouldDirty: true })}
            />
          }
          label="Fotos 4x4 presentes"
        />
        <FormControlLabel
          control={
            <Checkbox
              checked={Boolean(docValues.certificado_salud)}
              onChange={(_, checked) => setValue("documentacion.certificado_salud" as const, checked, { shouldDirty: true })}
            />
          }
          label="Certificado de salud"
        />
        <FormControlLabel
          control={
            <Checkbox
              checked={Boolean(docValues.folios_oficio)}
              onChange={(_, checked) => setValue("documentacion.folios_oficio" as const, checked, { shouldDirty: true })}
            />
          }
          label="Folios oficio"
        />
      </Stack>

      <Typography variant="subtitle2" fontWeight={600} gutterBottom sx={{ mt: 2 }}>
        Título secundario
      </Typography>
      <Stack direction="row" spacing={2} flexWrap="wrap">
        {docValues.es_certificacion_docente ? (
          <FormControlLabel
            control={
              <Checkbox
                checked={Boolean(docValues.titulo_terciario_univ)}
                onChange={(_, checked) =>
                  setValue("documentacion.titulo_terciario_univ" as const, checked, { shouldDirty: true })
                }
              />
            }
            label="Título terciario / universitario"
          />
        ) : (
          <>
            <FormControlLabel
              control={
                <Checkbox
                  checked={Boolean(docValues.titulo_secundario_legalizado)}
                  onChange={handleMainDocChange("titulo_secundario_legalizado")}
                />
              }
              label="Título secundario legalizado"
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={Boolean(docValues.certificado_titulo_en_tramite)}
                  onChange={handleMainDocChange("certificado_titulo_en_tramite")}
                />
              }
              label="Certificado título en trámite"
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={Boolean(docValues.analitico_legalizado)}
                  onChange={handleMainDocChange("analitico_legalizado")}
                />
              }
              label="Analítico legalizado"
            />
          </>
        )}
      </Stack>

      <Typography variant="subtitle2" fontWeight={600} gutterBottom sx={{ mt: 2 }}>
        Complementarios
      </Typography>
      <Stack direction="row" spacing={2} flexWrap="wrap">
        {!docValues.es_certificacion_docente && !docValues.articulo_7 && (
          <>
            <FormControlLabel
              control={
                <Checkbox
                  checked={Boolean(docValues.certificado_alumno_regular_sec)}
                  onChange={handleEstudianteRegularChange}
                  disabled={anyMainSelected}
                />
              }
              label="Constancia estudiante regular"
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={Boolean(docValues.adeuda_materias)}
                  onChange={handleAdeudaChange}
                  disabled={anyMainSelected}
                />
              }
              label="Adeuda materias"
            />
          </>
        )}
        <FormControlLabel
          control={
            <Checkbox
              checked={Boolean(docValues.es_certificacion_docente)}
              onChange={(_, checked) => setValue("documentacion.es_certificacion_docente" as const, checked, { shouldDirty: true })}
            />
          }
          label="Trayecto certificación docente"
        />
        {docValues.es_certificacion_docente && (
          <FormControlLabel
            control={
              <Checkbox
                checked={Boolean(docValues.incumbencia)}
                onChange={(_, checked) =>
                  setValue("documentacion.incumbencia" as const, checked, { shouldDirty: true })
                }
              />
            }
            label="Incumbencia"
          />
        )}
        <FormControlLabel
          control={
            <Checkbox
              checked={Boolean(docValues.articulo_7)}
              onChange={(_, checked) => setValue("documentacion.articulo_7" as const, checked, { shouldDirty: true })}
            />
          }
          label="Mayor de 25 años s/título (Art. 7mo)"
        />
      </Stack>

      {docValues.adeuda_materias && !docValues.es_certificacion_docente && !docValues.articulo_7 && (
        <Stack direction={{ xs: "column", md: "row" }} spacing={2} mt={1}>
          <Controller
            name="documentacion.adeuda_materias_detalle"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                label="Detalle adeuda materias"
                size="small"
                fullWidth
              />
            )}
          />
          <Controller
            name="documentacion.escuela_secundaria"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                label="Escuela secundaria"
                size="small"
                fullWidth
              />
            )}
          />
        </Stack>
      )}
    </Box>
  );
}
