import { useForm } from "react-hook-form";
import { useState, useEffect, useMemo } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { ChecklistDTO, PreinscripcionDTO } from "@/api/preinscripciones";
import { useAuth } from "@/context/AuthContext";
import { type Carrera } from "@/api/carreras";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import Grid from "@mui/material/Grid";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { enqueueSnackbar } from "notistack";
import FinalConfirmationDialog from "@/components/ui/FinalConfirmationDialog";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Button from "@mui/material/Button";
import Alert from "@mui/material/Alert";
import Divider from "@mui/material/Divider";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";

import { preinscripcionSchema, PreinscripcionForm } from "./schema";
import { defaultValues as formDefaults } from "./defaultValues";
import { CriticalAction } from "./pre-confirm-editor/types";
import { usePreConfirmData } from "./pre-confirm-editor/usePreConfirmData";
import { useFormReset, useChecklistPrefill } from "./pre-confirm-editor/useFormSetup";
import PersonalesSection from "./pre-confirm-editor/PersonalesSection";
import DocumentacionSection from "./pre-confirm-editor/DocumentacionSection";
import ProfessoradosSection from "./pre-confirm-editor/ProfessoradosSection";
import AddCarreraDialog from "./pre-confirm-editor/AddCarreraDialog";

export default function PreConfirmEditor({ codigo, onActionSuccess }: { codigo: string; onActionSuccess?: () => void }) {
  const { control, handleSubmit, reset, watch, setValue, register } = useForm<PreinscripcionForm>({
    resolver: zodResolver(preinscripcionSchema) as any,
    defaultValues: formDefaults,
  });

  const { user: authUser } = useAuth();
  const myProfIds = authUser?.profesorado_ids || [];

  const selectedCarreraIdRef = { current: 0 };
  const checklistQDataRef = { current: null as ChecklistDTO | null | undefined };
  const getIsCertDoc = () => {
    const carrerasList: Carrera[] = carrerasQ?.data ?? [];
    const found = carrerasList.find(c => Number(c.id) === selectedCarreraIdRef.current);
    return Boolean(
      found?.es_certificacion_docente ||
      (checklistQDataRef.current as ChecklistDTO | undefined)?.es_certificacion_docente,
    );
  };

  const {
    data, isLoading, isError,
    checklistQ, carrerasQ, preinsEstudianteQ, docsQ,
    estudianteDni,
    mUpdate, mUploadFoto, mConfirm, mObservar, mRechazar, mCambiarCarrera, mDelete, agregarCarreraMutation,
  } = usePreConfirmData(codigo, onActionSuccess, getIsCertDoc);

  checklistQDataRef.current = checklistQ.data;

  // Asegurar registro del campo virtual de foto para que watch() funcione
  useEffect(() => {
    try { (register as any)('foto_dataUrl'); } catch { }
  }, [register]);

  useFormReset(data, reset);
  useChecklistPrefill(checklistQ.data, setValue);

  const docValues = watch();
  const condicionSaludActiva = watch("condicion_salud_informada");
  useEffect(() => {
    if (!condicionSaludActiva) setValue("condicion_salud_detalle", "", { shouldDirty: false });
  }, [condicionSaludActiva, setValue]);

  const selectedCarreraId = Number(watch("carrera_id") || data?.carrera?.id || 0);
  selectedCarreraIdRef.current = selectedCarreraId;

  const selectedCarrera = useMemo(() => {
    if (!selectedCarreraId) return data?.carrera;
    const lista: Carrera[] = carrerasQ.data ?? [];
    return lista.find((c) => Number(c.id) === selectedCarreraId) || data?.carrera;
  }, [selectedCarreraId, carrerasQ.data, data]);

  const isCertificacionDocente = Boolean(
    selectedCarrera?.es_certificacion_docente ||
    (checklistQ.data as ChecklistDTO | undefined)?.es_certificacion_docente,
  );

  useEffect(() => {
    if (!isCertificacionDocente) {
      if (docValues.titulo_terciario_univ || docValues.incumbencia) {
        setValue("titulo_terciario_univ", false);
        setValue("incumbencia", false);
      }
    } else {
      if (docValues.certificado_alumno_regular_sec || docValues.adeuda_materias) {
        setValue("certificado_alumno_regular_sec", false);
        setValue("adeuda_materias", false);
        setValue("adeuda_materias_detalle", "");
        setValue("escuela_secundaria", "");
      }
    }
  }, [isCertificacionDocente, setValue, docValues.titulo_terciario_univ, docValues.incumbencia, docValues.certificado_alumno_regular_sec, docValues.adeuda_materias]);

  const docsGeneralesBase = docValues.dni_legalizado && docValues.fotos_4x4 && docValues.certificado_salud && docValues.folios_oficio_ok;
  const docsGeneralesOk = docsGeneralesBase && (!isCertificacionDocente || docValues.incumbencia);
  const allDocs = isCertificacionDocente
    ? !!(docsGeneralesOk && docValues.titulo_terciario_univ)
    : !!(docsGeneralesOk && (docValues.titulo_secundario_legalizado || docValues.articulo_7));
  const anyMainSelected = isCertificacionDocente
    ? false
    : !!(docValues.titulo_secundario_legalizado || docValues.certificado_titulo_en_tramite || docValues.analitico_legalizado);

  const ddjjOk = watch("ddjj_ok");
  const canConfirm = allDocs || ddjjOk;

  const buildChecklistPayload = (): ChecklistDTO => ({
    dni_legalizado: !!docValues.dni_legalizado,
    fotos_4x4: !!docValues.fotos_4x4,
    certificado_salud: !!docValues.certificado_salud,
    folios_oficio: !!docValues.folios_oficio_ok,
    titulo_secundario_legalizado: !!docValues.titulo_secundario_legalizado,
    certificado_titulo_en_tramite: !!docValues.certificado_titulo_en_tramite,
    analitico_legalizado: !!docValues.analitico_legalizado,
    certificado_alumno_regular_sec: !!docValues.certificado_alumno_regular_sec,
    adeuda_materias: !!docValues.adeuda_materias,
    adeuda_materias_detalle: docValues.adeuda_materias_detalle || "",
    escuela_secundaria: docValues.escuela_secundaria || "",
    titulo_terciario_univ: !!docValues.titulo_terciario_univ,
    incumbencia: !!docValues.incumbencia,
    es_certificacion_docente: isCertificacionDocente,
  });

  const preinscripcionesEstudiante = useMemo(() => {
    const base = (preinsEstudianteQ.data as PreinscripcionDTO[] | undefined) ?? [];
    if (myProfIds.length === 0) return base;
    return [...base].sort((a, b) => {
      const aOk = myProfIds.includes(a.carrera?.id);
      const bOk = myProfIds.includes(b.carrera?.id);
      if (aOk && !bOk) return -1;
      if (!aOk && bOk) return 1;
      return 0;
    });
  }, [preinsEstudianteQ.data, myProfIds]);

  const existingCarreraIds = new Set<number>(
    preinscripcionesEstudiante
      .map((p: PreinscripcionDTO) => p?.carrera?.id)
      .filter((id: number | undefined): id is number => typeof id === "number"),
  );
  const availableCarreras = (carrerasQ.data ?? []).filter((c: Carrera) => !existingCarreraIds.has(c.id));

  const pickSecundario = (
    key: 'titulo_secundario' | 'titulo_en_tramite' | 'analitico_legalizado' | 'titulo_secundario_legalizado' | 'certificado_titulo_en_tramite',
    checked: boolean,
  ) => {
    const mapped: 'titulo_secundario_legalizado' | 'certificado_titulo_en_tramite' | 'analitico_legalizado' =
      (key === 'titulo_secundario' || key === 'titulo_secundario_legalizado') ? 'titulo_secundario_legalizado'
        : (key === 'titulo_en_tramite' || key === 'certificado_titulo_en_tramite') ? 'certificado_titulo_en_tramite'
          : 'analitico_legalizado';
    setValue("titulo_secundario_legalizado", false);
    setValue("certificado_titulo_en_tramite", false);
    setValue("analitico_legalizado", false);
    setValue(mapped, !!checked);
    const anyMain = checked && (mapped === 'titulo_secundario_legalizado' || mapped === 'certificado_titulo_en_tramite' || mapped === 'analitico_legalizado');
    if (anyMain) {
      setValue("certificado_alumno_regular_sec", false);
      setValue("adeuda_materias", false);
      setValue("adeuda_materias_detalle", "");
      setValue("escuela_secundaria", "");
    }
  };

  const [confirmInscripcionOpen, setConfirmInscripcionOpen] = useState(false);
  const [successInfo, setSuccessInfo] = useState<{ password?: string; username?: string } | null>(null);

  const executeConfirmInscripcion = () => {
    mConfirm.mutate(buildChecklistPayload(), {
      onSuccess: (resp: any) => {
        setConfirmInscripcionOpen(false);
        // Si la respuesta trae el password redactado o real lo mostramos
        if (resp?.data?.password_inicial || resp?.data?.password) {
          setSuccessInfo({
            password: resp.data.password_inicial || resp.data.password,
            username: resp.data.username || data?.estudiante?.dni
          });
        } else {
          onActionSuccess?.();
        }
      },
      onSettled: () => setConfirmInscripcionOpen(false)
    });
  };
  const cancelConfirmInscripcion = () => { if (!mConfirm.isPending) setConfirmInscripcionOpen(false); };

  const handleCopyPassword = () => {
    if (successInfo?.password) {
      navigator.clipboard.writeText(successInfo.password);
      enqueueSnackbar("Contraseña copiada al portapapeles", { variant: "info" });
    }
  };

  const [criticalAction, setCriticalAction] = useState<CriticalAction | null>(null);
  const requestMotivo = (label: string): string | null => { const v = window.prompt(label)?.trim(); return v || null; };
  const handleRequestObservada = () => { const m = requestMotivo("Motivo de observacin:"); if (m) setCriticalAction({ type: "observar", reason: m }); };
  const handleRequestRechazo = () => { const m = requestMotivo("Motivo de rechazo:"); if (m) setCriticalAction({ type: "rechazar", reason: m }); };
  const criticalActionLoading = criticalAction?.type === "observar" ? mObservar.isPending : criticalAction?.type === "rechazar" ? mRechazar.isPending : criticalAction?.type === "eliminar" ? mDelete.isPending : false;
  const executeCriticalAction = () => {
    if (!criticalAction) return;
    if (criticalAction.type === "observar" && criticalAction.reason) { mObservar.mutate(criticalAction.reason, { onSettled: () => setCriticalAction(null) }); return; }
    if (criticalAction.type === "rechazar" && criticalAction.reason) { mRechazar.mutate(criticalAction.reason, { onSettled: () => setCriticalAction(null) }); return; }
    if (criticalAction.type === "eliminar") mDelete.mutate(undefined, { onSettled: () => setCriticalAction(null) });
  };
  const cancelCriticalAction = () => { if (!criticalActionLoading) setCriticalAction(null); };
  const action = criticalAction;
  const criticalContextText = action?.type === "observar" ? `cambio de estado a Observada${action?.reason ? ` (motivo: "${action?.reason}")` : ""}` : action?.type === "rechazar" ? `cambio de estado a Rechazada${action?.reason ? ` (motivo: "${action?.reason}")` : ""}` : action?.type === "eliminar" ? "eliminación permanente de esta preinscripción" : "Cambios";

  const [addCarreraOpen, setAddCarreraOpen] = useState(false);
  const [nuevaCarreraId, setNuevaCarreraId] = useState<number | ''>('');
  const [nuevaCarreraCohorte, setNuevaCarreraCohorte] = useState<string>(() => String(new Date().getFullYear()));
  const resetAgregarCarreraForm = () => { setNuevaCarreraId(''); setNuevaCarreraCohorte(String(new Date().getFullYear())); };

  const [validationErrors, setValidationErrors] = useState<any>(null);
  const onInvalid = (errors: any) => { console.error("Validation errors", errors); setValidationErrors(errors); enqueueSnackbar("Hay errores en el formulario, revise los mensajes abajo", { variant: "error" }); };

  const onSubmit = async (values: PreinscripcionForm) => {
    console.log("Submit triggered", values);
    setValidationErrors(null);
    try {
      await mUpdate.mutateAsync(values);
      if (canConfirm && data?.estado !== "confirmada") setConfirmInscripcionOpen(true);
    } catch (error) {
      console.error("Error en flujo unificado:", error);
    }
  };

  if (isLoading) return <Box py={6} textAlign="center"><CircularProgress /></Box>;
  if (isError || !data) return <Typography color="error">No se pudo cargar la preinscripción.</Typography>;

  return (
    <Stack gap={2} component="form" onSubmit={handleSubmit(onSubmit as any, onInvalid)}>
      <Grid container spacing={2}>
        <Grid item xs={12} md={8}>
          <PersonalesSection
            control={control}
            condicionSaludActiva={!!condicionSaludActiva}
            carreras={carrerasQ.data || []}
            validationErrors={validationErrors}
          />
        </Grid>

        <Grid item xs={12} md={4}>
          <Stack spacing={2} sx={{ position: 'sticky', top: 16 }}>
            <ProfessoradosSection
              codigo={codigo}
              preinscripcionesEstudiante={preinscripcionesEstudiante}
              myProfIds={myProfIds}
              availableCarreras={availableCarreras}
              isLoading={preinsEstudianteQ.isLoading}
              onAddCarrera={() => setAddCarreraOpen(true)}
            />
            <DocumentacionSection
              control={control}
              watch={watch}
              setValue={setValue}
              docValues={docValues}
              isCertificacionDocente={isCertificacionDocente}
              anyMainSelected={anyMainSelected}
              allDocs={allDocs}
              ddjjOk={!!ddjjOk}
              canConfirm={canConfirm}
              mUpdate={mUpdate}
              mConfirm={mConfirm}
              docsQData={docsQ.data as any}
              onUploadFoto={(file) => mUploadFoto.mutate(file)}
              onReset={() => reset()}
              onObservar={handleRequestObservada}
              onRechazar={handleRequestRechazo}
              pickSecundario={pickSecundario}
              estado={data?.estado}
            />
          </Stack>
        </Grid>
      </Grid>

      <AddCarreraDialog
        open={addCarreraOpen}
        onClose={() => setAddCarreraOpen(false)}
        availableCarreras={availableCarreras}
        nuevaCarreraId={nuevaCarreraId}
        setNuevaCarreraId={setNuevaCarreraId}
        nuevaCarreraCohorte={nuevaCarreraCohorte}
        setNuevaCarreraCohorte={setNuevaCarreraCohorte}
        onAgregar={() => {
          if (typeof nuevaCarreraId === "number") {
            agregarCarreraMutation.mutate(
              { carreraId: nuevaCarreraId, anio: Number(nuevaCarreraCohorte) },
              { onSuccess: () => { setAddCarreraOpen(false); resetAgregarCarreraForm(); } },
            );
          }
        }}
        isPending={agregarCarreraMutation.isPending}
      />

      <FinalConfirmationDialog open={confirmInscripcionOpen} onConfirm={executeConfirmInscripcion} onCancel={cancelConfirmInscripcion} loading={mConfirm.isPending} contextText="Confirmación de Inscripción" />
      <FinalConfirmationDialog open={Boolean(criticalAction)} onConfirm={executeCriticalAction} onCancel={cancelCriticalAction} loading={criticalActionLoading} contextText={criticalContextText} />

      {/* Dialog de éxito con contraseña */}
      <Dialog open={!!successInfo} onClose={() => onActionSuccess?.()} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 800 }}>¡Preinscripción Confirmada!</DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ py: 1 }}>
            <Alert severity="success" variant="filled">
              El estudiante ha sido registrado correctamente en el sistema.
            </Alert>
            
            <Box sx={{ p: 2, bgcolor: "grey.50", borderRadius: 2, border: "1px dashed", borderColor: "divider" }}>
              <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                CREDENCIALES DE ACCESO
              </Typography>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Box>
                  <Typography variant="body2" sx={{ opacity: 0.7 }}>Usuario (DNI):</Typography>
                  <Typography variant="subtitle1" fontWeight={700}>{successInfo?.username}</Typography>
                </Box>
              </Stack>
              <Divider sx={{ my: 1 }} />
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Box>
                  <Typography variant="body2" sx={{ opacity: 0.7 }}>Contraseña inicial:</Typography>
                  <Typography variant="h6" color="primary.main" fontWeight={800} sx={{ letterSpacing: 1 }}>
                    {successInfo?.password}
                  </Typography>
                </Box>
                <Tooltip title="Copiar contraseña">
                  <IconButton onClick={handleCopyPassword} color="primary">
                    <ContentCopyIcon />
                  </IconButton>
                </Tooltip>
              </Stack>
            </Box>

            <Typography variant="body2" color="text.secondary" align="center">
              Por favor, entregue estas credenciales al estudiante. Se le solicitará cambiar la contraseña al ingresar por primera vez.
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => onActionSuccess?.()} fullWidth variant="contained">
            Entendido y cerrar
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
