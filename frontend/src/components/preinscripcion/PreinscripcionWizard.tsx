import React, { useEffect, useMemo, useState } from "react";
import { FieldErrors, FormProvider, SubmitErrorHandler, SubmitHandler, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Box,
  Button,
  Step,
  StepLabel,
  Stepper,
  Typography,
  Paper,
  CircularProgress,
  Alert,
  AlertTitle,
  Stack,
  Grid,
  Chip,
  Divider,
} from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import isSameOrAfter from "dayjs/plugin/isSameOrAfter";
import isSameOrBefore from "dayjs/plugin/isSameOrBefore";
import { useGoogleReCaptcha } from "react-google-recaptcha-v3";
// import { useNavigate } from "react-router-dom";

// Lógica de negocio y tipos
import { preinscripcionSchema, PreinscripcionForm } from "./schema";
import { defaultValues } from "./defaultValues";
import { PreinscripcionOut } from "@/types/preinscripcion";
import { listarCarreras, crearPreinscripcion } from "@/services/preinscripcion";
import { apiUploadPreDoc } from "@/api/preinscripciones";
import { fetchVentanas, VentanaDto } from "@/api/ventanas";

// Pasos del Wizard
import DatosPersonales from "./steps/DatosPersonales";
import Contacto from "./steps/Contacto";
import EstudiosSecundarios from "./steps/EstudiosSecundarios";
import EstudiosSuperiores from "./steps/EstudiosSuperiores";
import DatosLaborales from "./steps/DatosLaborales";
import AccesibilidadApoyos from "./steps/AccesibilidadApoyos";
import CarreraDocumentacion from "./steps/CarreraDocumentacion";
import Confirmacion from "./steps/Confirmacion";
import { PageHero } from "@/components/ui/GradientTitles";
import { INSTITUTIONAL_GREEN } from "@/styles/institutionalColors";

const STORAGE_KEY = "preinscripcion_form_data";

dayjs.extend(isSameOrBefore);
dayjs.extend(isSameOrAfter);

const steps = [
  "Datos personales",
  "Contacto",
  "Estudios",
  "Accesibilidad",
  "Carrera y Docs",
  "Confirmar y Enviar",
];
const stepHints = [
  "Validamos identidad y fecha de nacimiento.",
  "Telefonos, email y domicilio de contacto.",
  "Titulos secundarios/superiores y situacion laboral.",
  "Datos de salud, apoyos y consentimiento informado.",
  "Elegis carrera, cargas foto 4x4 y documentacion requerida.",
  "Descarga la planilla PDF y enviamos tu preinscripcion.",
];

// Mapea los datos del formulario a la estructura que espera la API
type SubmissionPayload = PreinscripcionForm & {
  carrera_id: number;
  captcha_token?: string | null;
  honeypot?: string | null;
  foto_4x4_dataurl?: string | null;
};

const buildPayload = (
  values: PreinscripcionForm,
  captchaToken?: string | null,
  honeypotValue?: string,
): SubmissionPayload => ({
  ...values,
  carrera_id: Number(values.carrera_id),
  captcha_token: captchaToken ?? null,
  honeypot: honeypotValue || undefined,
  foto_4x4_dataurl: values.foto_dataUrl || null,
});

type SubmitState = 
  | { status: "idle" | "loading" }
  | { status: "error"; message: string }
  | { status: "ok"; data: PreinscripcionOut };

export default function PreinscripcionWizard() {
  // const navigate = useNavigate();
  let recaptchaContext: ReturnType<typeof useGoogleReCaptcha> | null = null;
  try {
    recaptchaContext = useGoogleReCaptcha();
  } catch {
    // El hook lanza si no existe provider; ignoramos en entornos sin reCAPTCHA
    recaptchaContext = null;
  }
  const executeRecaptcha = recaptchaContext?.executeRecaptcha;
  const [honeypotValue, setHoneypotValue] = useState('');
  const [activeStep, setActiveStep] = useState(0);
  const [submit, setSubmit] = useState<SubmitState>({ status: "idle" });
  const [pdfDownloaded, setPdfDownloaded] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const pageBgSx = {
    minHeight: "100vh",
    background: "radial-gradient(circle at 20% 20%, #f8f1e7 0, #f8f1e7 25%, #f0ede5 40%, #f7f5ef 100%)",
    py: { xs: 3, md: 5 },
    px: { xs: 1.5, md: 3 },
  };

  const form = useForm<PreinscripcionForm>({
    resolver: zodResolver(preinscripcionSchema) as any,
    defaultValues: (() => {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        return saved ? JSON.parse(saved) : defaultValues;
      } catch {
        return defaultValues;
      }
    })(),
    mode: "onChange",
  });

  // Persistir el formulario en localStorage
  useEffect(() => {
    const subscription = form.watch((value, { name, type }) => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
      } catch (e) {
        console.error("Error saving form to localStorage", e);
      }
    });
    return () => subscription.unsubscribe();
  }, [form]);

  const { isLoading: loadingVentana, data: ventanasPre } = useQuery<VentanaDto[]>({
    queryKey: ["ventanas-preinscripcion"],
    queryFn: () => fetchVentanas({ tipo: "PREINSCRIPCION" }),
  });

  const ventanaActiva = useMemo(() => {
    if (!ventanasPre) return null;
    const hoy = dayjs();
    return ventanasPre.find(
      (v) =>
        v.activo &&
        dayjs(v.desde).isSameOrBefore(hoy, "day") &&
        dayjs(v.hasta).isSameOrAfter(hoy, "day")
    );
  }, [ventanasPre]);

  const [carreras, setCarreras] = useState<{id:number; nombre:string}[]>([]);
  const [carrerasLoading, setCarrerasLoading] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      setCarrerasLoading(true);
      try {
        const rows = await listarCarreras();
        if (!alive) return;

        setCarreras(rows ?? []);
        if ((rows?.length ?? 0) === 1) {
          form.setValue("carrera_id", rows[0].id);
        }
      } catch (e) {
        console.error("[carreras] fallo", e);
      } finally {
        if (alive) setCarrerasLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  // Eliminamos la apertura del PDF del backend; usaremos el comprobante local
  // Exigir descarga previa del PDF en el paso final
  useEffect(() => {
    if (activeStep === steps.length - 1) setPdfDownloaded(false);
  }, [activeStep]);

  const handleNext = async () => {
    if (activeStep === 3) {
      const consentGiven = form.getValues("consentimiento_datos");
      const valid = await form.trigger(["condicion_salud_detalle", "consentimiento_datos"] as any, { shouldFocus: true });
      if (!consentGiven) {
        form.setError("consentimiento_datos", {
          type: "manual",
          message: "Debés aceptar el consentimiento expreso para continuar.",
        });
        return;
      }
      if (!valid) return;
    }
    setActiveStep((s) => Math.min(s + 1, steps.length - 1));
  };
  const handleBack = () => setActiveStep((s) => s - 1);

  const onSubmit: SubmitHandler<PreinscripcionForm> = async (values) => {
    setSubmit({ status: "loading" });
    try {
      let captchaToken: string | null = null;
      if (executeRecaptcha) {
        try {
          captchaToken = await executeRecaptcha("preinscripcion_submit");
        } catch {
          /* ignored */
        }
      }
      const payload = buildPayload(values, captchaToken, honeypotValue);
      const response = await crearPreinscripcion(payload);

      if (photoFile && response?.id) {
        try {
          await apiUploadPreDoc(response.id, "foto4x4", photoFile);
        } catch (uploadError) {
          console.error("La preinscripción se creó, pero falló la subida de la foto:", uploadError);
        }
      }

      setSubmit({ status: "ok", data: response });
      setTimeout(() => {
        try {
          localStorage.removeItem(STORAGE_KEY);
        } catch {}
        form.reset(defaultValues);
        setActiveStep(0);
        setPdfDownloaded(false);
        setHoneypotValue("");
        setSubmit({ status: "idle" });
      }, 300);
    } catch (err: any) {
      setSubmit({ status: "error", message: err.message || "Error desconocido" });
    }
  };

  const onSubmitError: SubmitErrorHandler<PreinscripcionForm> = (errors) => {
    console.error("Errores de validación del formulario:", errors);
    // Find the first field with an error and scroll to it
    const errorKeys = Object.keys(errors) as Array<keyof typeof errors>;
    const firstErrorField = errorKeys.find((field) => !!errors[field]);
    if (firstErrorField) {
      const element = document.getElementById(firstErrorField);
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }
    setSubmit({ status: "error", message: "Por favor, corrige los errores en el formulario." });
  };

  const handleSubmit = form.handleSubmit(onSubmit, onSubmitError);

  if (loadingVentana) {
    return (
      <Box sx={pageBgSx}>
        <Stack alignItems="center" justifyContent="center" minHeight="60vh">
          <CircularProgress />
        </Stack>
      </Box>
    );
  }

  if (!ventanaActiva) {
    return (
      <Box sx={pageBgSx}>
        <Stack spacing={3} maxWidth={960} mx="auto">
          <PageHero
            title="Preinscripcion"
            subtitle="Todavia no hay una ventana habilitada para completar el formulario."
          />
          <Paper sx={{ p: 3, borderRadius: 4, border: "1px solid #e8e3d9", boxShadow: "0 20px 45px rgba(0,0,0,0.06)" }}>
            <Alert severity="info" sx={{ alignItems: "center" }}>
              <AlertTitle>Preinscripcion cerrada</AlertTitle>
              <Typography variant="body1" sx={{ mb: 1 }}>
                Actualmente no se encuentran habilitadas las preinscripciones.
              </Typography>
              <Typography variant="body1">
                Para mas informacion, visita <a href="http://www.ipespaulofreire.edu.ar" target="_blank" rel="noopener noreferrer">www.ipespaulofreire.edu.ar</a> o acercate a Estrada 1575, Rio Grande, Tierra del Fuego.
              </Typography>
            </Alert>
          </Paper>
        </Stack>
      </Box>
    );
  }

  const carreraNombre = carreras.find(c => c.id === form.watch("carrera_id"))?.nombre ?? "";
  const ventanaLabel = `${dayjs(ventanaActiva.desde).format("DD/MM")} al ${dayjs(ventanaActiva.hasta).format("DD/MM")}`;

  return (
    <FormProvider {...form}>
      <input
        type="text"
        value={honeypotValue}
        onChange={(event) => setHoneypotValue(event.target.value)}
        tabIndex={-1}
        autoComplete="off"
        name="website"
        style={{ position: 'absolute', left: '-10000px', top: 'auto', width: '1px', height: '1px', overflow: 'hidden' }}
      />
      <Box sx={pageBgSx}>
        <Stack spacing={3} maxWidth={1200} mx="auto">
          <PageHero
            title="Preinscripcion 2025"
            subtitle="Completa los 6 pasos, descarga la planilla y presentala con tu documentacion."
            actions={
              <Stack direction="row" spacing={1} flexWrap="wrap">
                <Chip label="Formulario publico" size="small" variant="outlined" />
                <Chip label={`Ventana: ${ventanaLabel}`} size="small" color="success" />
              </Stack>
            }
          />
          <Grid container spacing={2.5} alignItems="stretch">
            <Grid item xs={12} md={8}>
              <Paper sx={{ p: { xs: 2, md: 3 }, borderRadius: 4, boxShadow: "0 20px 45px rgba(0,0,0,0.08)", border: "1px solid #e8e3d9", height: "100%" }}>
                <Stack spacing={2.5}>
                  <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" alignItems={{ xs: "flex-start", md: "center" }} spacing={1}>
                    <Stack spacing={0.4}>
                      <Typography variant="overline" sx={{ color: INSTITUTIONAL_GREEN, letterSpacing: 1 }}>
                        Paso {activeStep + 1} de {steps.length}
                      </Typography>
                      <Typography variant="h6" fontWeight={700}>{steps[activeStep]}</Typography>
                      <Typography variant="body2" color="text.secondary">{stepHints[activeStep]}</Typography>
                    </Stack>
                    <Chip label="Guardado local en este dispositivo" size="small" variant="outlined" />
                  </Stack>

                  <Stepper activeStep={activeStep} alternativeLabel sx={{ mb: 1, "& .MuiStepLabel-label": { fontSize: 13 }, "& .MuiStepConnector-line": { borderColor: "#d9d2c6" } }}>
                    {steps.map((label) => (
                      <Step key={label}><StepLabel>{label}</StepLabel></Step>
                    ))}
                  </Stepper>

                  <Box sx={{ p: { xs: 2, md: 2.5 }, border: "1px solid #e5e7eb", borderRadius: 4, backgroundColor: "#fff" }}>
                    {activeStep === 0 && <DatosPersonales />}
                    {activeStep === 1 && <Contacto />}
                    {activeStep === 2 && (
                      <>
                        <EstudiosSecundarios />
                        <Box mt={2}>
                          <EstudiosSuperiores />
                        </Box>
                        <Box mt={2}>
                          <DatosLaborales />
                        </Box>
                      </>
                    )}
                    {activeStep === 3 && <AccesibilidadApoyos />}
                    {activeStep === 4 && (
                      <CarreraDocumentacion
                        carreras={carreras}
                        isLoading={carrerasLoading}
                        onFileChange={setPhotoFile}
                      />
                    )}
                    {activeStep === 5 && (
                      submit.status !== "ok" ? 
                      <Confirmacion carreraNombre={carreraNombre} onDownloaded={() => setPdfDownloaded(true)} /> : 
                      <Alert severity="success">
                        <AlertTitle>Preinscripcion enviada con exito</AlertTitle>
                        Tu codigo de seguimiento es: <strong>{submit.data.codigo}</strong>
                      </Alert>
                    )}
                  </Box>

                  <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ xs: "stretch", sm: "center" }} spacing={1.5}>
                    <Button
                      variant="outlined"
                      color="secondary"
                      onClick={() => {
                        localStorage.removeItem(STORAGE_KEY);
                        form.reset(defaultValues);
                      }}
                      sx={{ borderRadius: 4, width: { xs: "100%", sm: "auto" } }}
                    >
                      Limpiar formulario
                    </Button>
                    <Stack direction="row" spacing={1} justifyContent={{ xs: "flex-start", sm: "flex-end" }} flexWrap="wrap">
                      <Button onClick={handleBack} disabled={activeStep === 0 || submit.status === "loading"} sx={{ borderRadius: 4, width: { xs: "100%", sm: "auto" } }}>
                        Atras
                      </Button>
                    {activeStep < steps.length - 1 ? (
                      <Button variant="contained" onClick={() => void handleNext()} sx={{ borderRadius: 4, width: { xs: "100%", sm: "auto" } }}>
                        Siguiente
                      </Button>
                    ) : (
                      <Button
                        variant="contained"
                        onClick={handleSubmit}
                        disabled={!pdfDownloaded || submit.status === "loading" || submit.status === "ok"}
                        sx={{ borderRadius: 4, width: { xs: "100%", sm: "auto" } }}
                      >
                        {submit.status === "loading" ? <CircularProgress size={24} /> : "Enviar preinscripcion"}
                      </Button>
                    )}
                    </Stack>
                  </Stack>

                  {submit.status === "error" && (
                    <Alert severity="error">{submit.message}</Alert>
                  )}
                </Stack>
              </Paper>
            </Grid>
            <Grid item xs={12} md={4}>
              <Stack spacing={2}>
                <Paper sx={{ p: 2.5, borderRadius: 4, border: "1px solid #e6ddd1", background: "#fffbf6", boxShadow: "0 12px 30px rgba(0,0,0,0.05)" }}>
                  <Typography variant="subtitle1" fontWeight={700}>Checklist rapido</Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    Tenelo a mano para avanzar sin frenos:
                  </Typography>
                  <Stack component="ul" spacing={1} sx={{ pl: 2.2, mt: 0, mb: 0, color: "text.secondary", listStyle: "disc" }}>
                    <Typography component="li" variant="body2">DNI y numero de CUIL.</Typography>
                    <Typography component="li" variant="body2">Email y telefonos actualizados.</Typography>
                    <Typography component="li" variant="body2">Foto 4x4 digital (JPG/PNG) si ya la tenes.</Typography>
                    <Typography component="li" variant="body2">Titulo secundario o constancia y datos del establecimiento.</Typography>
                    <Typography component="li" variant="body2">Contacto de emergencia (nombre y telefono).</Typography>
                  </Stack>
                </Paper>
                <Paper sx={{ p: 2.5, borderRadius: 4, border: "1px solid #e6ddd1", background: "#ffffff", boxShadow: "0 12px 30px rgba(0,0,0,0.05)" }}>
                  <Typography variant="subtitle1" fontWeight={700}>Tips rapidos</Typography>
                  <Stack spacing={1} mt={1}>
                    <Typography variant="body2" color="text.secondary">- Guardamos lo que completas en este dispositivo mientras sigas en esta pagina.</Typography>
                    <Typography variant="body2" color="text.secondary">- En el paso 6 descarga la planilla PDF; recien despues se habilita el envio.</Typography>
                    <Typography variant="body2" color="text.secondary">- Si necesitas corregir, podes reiniciar con "Limpiar formulario".</Typography>
                  </Stack>
                  <Divider sx={{ my: 1.5 }} />
                  <Typography variant="body2" color="text.secondary">
                    Recorda presentar la planilla impresa con tu DNI en Bedelia (Estrada 1575, Rio Grande).
                  </Typography>
                </Paper>
              </Stack>
            </Grid>
          </Grid>
        </Stack>
      </Box>
    </FormProvider>
  );
}
