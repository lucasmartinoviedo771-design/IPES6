import { Controller } from "react-hook-form";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Checkbox from "@mui/material/Checkbox";
import Divider from "@mui/material/Divider";
import FormControlLabel from "@mui/material/FormControlLabel";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { type Control, type UseFormSetValue, type UseFormWatch } from "react-hook-form";
import { compressImage } from "@/utils/compressImage";
import { enqueueSnackbar } from "notistack";
import { PreinscripcionForm } from "../schema";
import { FotoPreviewBox } from "./components";
import { PreDocItem, ChecklistDTO } from "@/api/preinscripciones";

interface DocumentacionSectionProps {
  control: Control<PreinscripcionForm>;
  watch: UseFormWatch<PreinscripcionForm>;
  setValue: UseFormSetValue<PreinscripcionForm>;
  docValues: PreinscripcionForm;
  isCertificacionDocente: boolean;
  anyMainSelected: boolean;
  allDocs: boolean;
  ddjjOk: boolean;
  canConfirm: boolean;
  mUpdate: { isPending: boolean };
  mConfirm: { isPending: boolean };
  docsQData: PreDocItem[] | undefined;
  checklistData: ChecklistDTO | null | undefined;
  onUploadFoto: (file: File) => void;
  onReset: () => void;
  onObservar: () => void;
  onRechazar: () => void;
  pickSecundario: (
    key: 'titulo_secundario' | 'titulo_en_tramite' | 'analitico_legalizado' | 'titulo_secundario_legalizado' | 'certificado_titulo_en_tramite',
    checked: boolean,
  ) => void;
  estado: string | undefined;
}

export default function DocumentacionSection({
  control, watch, setValue, docValues,
  isCertificacionDocente, anyMainSelected, allDocs, ddjjOk, canConfirm,
  mUpdate, mConfirm, docsQData, checklistData, onReset,
  onObservar, onRechazar, pickSecundario, estado, onUploadFoto,
}: DocumentacionSectionProps) {
  
  const currentStatus = checklistData?.estado_legajo;
  const statusConfig: Record<string, { label: string, color: "success" | "warning" | "default" }> = {
    COM: { label: "Completo", color: "success" },
    INC: { label: "Incompleto", color: "warning" },
    PEN: { label: "Pendiente", color: "default" },
  };
  
  const currentLabel = currentStatus ? (statusConfig[currentStatus]?.label || currentStatus) : "Pendiente";
  const currentColor = currentStatus ? (statusConfig[currentStatus]?.color || "default") : "default";

  return (
    <Paper variant="outlined" sx={{ p: 2, border: '1px solid #eee' }}>
      <Typography variant="subtitle1" fontWeight={700} gutterBottom>Documentación</Typography>

      <Typography variant="subtitle2" gutterBottom>Requisitos generales</Typography>
      <Stack>
        <FormControlLabel control={<Checkbox checked={!!docValues.dni_legalizado} onChange={(_, c) => setValue("dni_legalizado", !!c, { shouldDirty: true })} />} label="DNI legalizado" />
        <FormControlLabel control={<Checkbox checked={!!docValues.fotos_4x4} onChange={(_, c) => setValue("fotos_4x4", !!c, { shouldDirty: true })} />} label="Fotos 4x4" />
        <FormControlLabel control={<Checkbox checked={!!docValues.folios_oficio_ok} onChange={(_, c) => setValue("folios_oficio_ok", !!c, { shouldDirty: true })} />} label="Folios oficio" />
        <FormControlLabel control={<Checkbox checked={!!docValues.certificado_salud} onChange={(_, c) => setValue("certificado_salud", !!c, { shouldDirty: true })} />} label="Certificado Salud" />
        <FormControlLabel control={<Checkbox checked={!!docValues.libreta_entregada} onChange={(_, c) => setValue("libreta_entregada", !!c, { shouldDirty: true })} />} label="Libreta entregada" />
        <FormControlLabel control={<Checkbox checked={!!docValues.curso_introductorio_aprobado} onChange={(_, c) => setValue("curso_introductorio_aprobado", !!c, { shouldDirty: true })} />} label="Curso Intro. aprobado" />
        {isCertificacionDocente && <FormControlLabel control={<Checkbox checked={!!docValues.incumbencia} onChange={(_, c) => setValue("incumbencia", !!c, { shouldDirty: true })} />} label="Incumbencia" />}
      </Stack>

      <Divider sx={{ my: 1.5 }} />
      <Typography variant="subtitle2" gutterBottom>Secundario</Typography>
      <Stack>
        {isCertificacionDocente ? (
          <FormControlLabel control={<Checkbox checked={!!docValues.titulo_terciario_univ} onChange={(_, c) => setValue("titulo_terciario_univ", !!c, { shouldDirty: true })} />} label="Título superior" />
        ) : (
          <>
            <FormControlLabel control={<Checkbox checked={!!docValues.titulo_secundario_legalizado} onChange={(_, c) => pickSecundario('titulo_secundario_legalizado', c)} />} label="Título secundario" />
            <FormControlLabel control={<Checkbox checked={!!docValues.certificado_titulo_en_tramite} onChange={(_, c) => pickSecundario('certificado_titulo_en_tramite', c)} />} label="Título en trámite" />
            <FormControlLabel control={<Checkbox checked={!!docValues.analitico_legalizado} onChange={(_, c) => pickSecundario('analitico_legalizado', c)} />} label="Analítico" />
          </>
        )}
        {!isCertificacionDocente && (
          <>
            <FormControlLabel control={<Checkbox checked={!!docValues.certificado_alumno_regular_sec} onChange={(_, c) => setValue("certificado_alumno_regular_sec", !!c, { shouldDirty: true })} disabled={anyMainSelected} />} label="Alumno regular sec." />
            <FormControlLabel control={<Checkbox checked={!!docValues.adeuda_materias} onChange={(_, c) => setValue("adeuda_materias", !!c, { shouldDirty: true })} disabled={anyMainSelected} />} label="Adeuda materias" />
            <FormControlLabel control={<Checkbox checked={!!docValues.articulo_7} onChange={(_, c) => setValue("articulo_7", !!c, { shouldDirty: true })} />} label="Mayor de 25 años s/título (Art. 7mo)" />
          </>
        )}
      </Stack>

      {docValues.adeuda_materias && (
        <Box mt={1}>
          <Controller name="adeuda_materias_detalle" control={control} render={({ field }) => (
            <TextField {...field} label="¿Cuáles?" fullWidth size="small" sx={{ mb: 1 }} />
          )} />
          <Controller name="escuela_secundaria" control={control} render={({ field }) => (
            <TextField {...field} label="Escuela" fullWidth size="small" />
          )} />
        </Box>
      )}

      <Divider sx={{ my: 2 }} />
      <Typography variant="subtitle2" gutterBottom>Foto 4x4</Typography>
      <Stack direction="row" spacing={1} mb={1}>
        <input id="foto-input" type="file" accept="image/*" style={{ display: 'none' }} onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
          const f = e.target.files?.[0];
          if (f) compressImage(f).then(({ file }) => onUploadFoto(file)).catch(() => enqueueSnackbar("No se pudo procesar la imagen", { variant: "error" }));
        }} />
        <label htmlFor="foto-input"><Button size="small" variant="outlined" component="span">Cargar archivo</Button></label>
      </Stack>
      {(() => {
        const docs: PreDocItem[] = docsQData ?? [];
        const docFoto = docs.find(d => String(d.tipo).toLowerCase().includes('foto'));
        return <FotoPreviewBox dataUrl={watch('foto_dataUrl') || docFoto?.url} />;
      })()}

      <Divider sx={{ my: 2 }} />
      <Stack spacing={1}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="body2" fontWeight={600}>Estado actual (BD):</Typography>
          <Chip size="small" variant="outlined" color={currentColor} label={currentLabel} />
        </Stack>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="body2" fontWeight={600}>Estado proyectado:</Typography>
          <Chip size="small" color={allDocs ? "success" : "warning"} label={allDocs ? "Completo / Regular" : "Incompleto / Condicional"} />
        </Stack>
      </Stack>

      {!allDocs && (
        <Box sx={{ mt: 2, p: 1.5, bgcolor: 'warning.light', borderRadius: 2, border: '1px solid', borderColor: 'warning.main' }}>
          <Typography variant="caption" display="block" color="warning.dark" sx={{ mb: 1, fontWeight: 600 }}>
            Debe aceptar el compromiso/DDJJ para confirmar como Condicional.
          </Typography>
          <FormControlLabel
            control={<Checkbox checked={!!ddjjOk} onChange={(_, c) => setValue("ddjj_ok", !!c)} />}
            label={<Typography variant="body2">DDJJ / Compromiso aceptado</Typography>}
          />
        </Box>
      )}

      <Stack gap={1} mt={3}>
        <Button type="submit" variant="contained" color={canConfirm && estado !== "confirmada" ? "success" : "primary"} disabled={mUpdate.isPending || mConfirm.isPending} fullWidth sx={{ py: 1.5, fontWeight: 700 }}>
          {estado === "confirmada" ? "Guardar cambios" : canConfirm ? "Confirmar Inscripción" : "Guardar Borrador"}
        </Button>
        <Button variant="text" size="small" color="inherit" onClick={onReset} disabled={mUpdate.isPending}>Deshacer cambios</Button>
      </Stack>

      <Stack direction="row" spacing={1} mt={2} justifyContent="center">
        <Button size="small" color="warning" onClick={onObservar}>Observar</Button>
        <Button size="small" color="error" onClick={onRechazar}>Rechazar</Button>
      </Stack>
    </Paper>
  );
}
