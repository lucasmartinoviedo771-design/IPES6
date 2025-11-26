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
  "Teléfonos, email y domicilio de contacto.",
  "Títulos secundarios/superiores y situación laboral.",
  "Datos de salud, apoyos y consentimiento informado.",
  "Elegís carrera, cargás foto 4x4 y documentación requerida.",
  "Descargá la planilla PDF y enviamos tu preinscripción.",
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
            title="Preinscripción"
            subtitle="Todavía no hay una ventana habilitada para completar el formulario."
          />
          <Paper sx={{ p: 3, borderRadius: 4, border: "1px solid #e8e3d9", boxShadow: "0 20px 45px rgba(0,0,0,0.06)" }}>
            <Alert severity="info" sx={{ alignItems: "center" }}>
              <AlertTitle>Preinscripción cerrada</AlertTitle>
              <Typography variant="body1" sx={{ mb: 1 }}>
                Actualmente no se encuentran habilitadas las preinscripciones.
              </Typography>
              <Typography variant="body1">
                Para más información, visitá <a href="http://www.ipespaulofreire.edu.ar" target="_blank" rel="noopener noreferrer">www.ipespaulofreire.edu.ar</a> o acercate a Estrada 1575, Río Grande, Tierra del Fuego.
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
            title="Preinscripción 2025"
            subtitle="Completá los 6 pasos, descargá la planilla y presentala con tu documentación."
            actions={
              <Stack direction="row" spacing={1} flexWrap="wrap">
                <Chip label={`Inscripción abierta: ${ventanaLabel}`} size="small" color="success" />
              </Stack>
            }
          />
          <Grid container spacing={2.5} alignItems="stretch" direction={{ xs: "column-reverse", md: "row" }}>
            <Grid item xs={12} md={4}>
              <Stack spacing={2}>
                {/* Oferta Académica */}
                <Paper sx={{ p: 2.5, borderRadius: 4, border: "1px solid #e6ddd1", background: "#ffffff", boxShadow: "0 12px 30px rgba(0,0,0,0.05)" }}>
                   <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2, color: INSTITUTIONAL_GREEN }}>Oferta Académica</Typography>
                   
                   <Typography variant="subtitle2" fontWeight={700} color="text.secondary">Turno Mañana</Typography>
                   <Box component="ul" sx={{ pl: 2, mt: 0.5, mb: 1.5, typography: 'body2', color: 'text.secondary' }}>
                     <li>Geografía</li>
                     <li>Educación Inicial</li>
                     <li>Educación Primaria</li>
                   </Box>

                   <Typography variant="subtitle2" fontWeight={700} color="text.secondary">Turno Tarde</Typography>
                   <Box component="ul" sx={{ pl: 2, mt: 0.5, mb: 1.5, typography: 'body2', color: 'text.secondary' }}>
                     <li>Lengua y Literatura</li>
                     <li>Historia</li>
                   </Box>

                   <Typography variant="subtitle2" fontWeight={700} color="text.secondary">Turno Vespertino</Typography>
                   <Box component="ul" sx={{ pl: 2, mt: 0.5, mb: 0, typography: 'body2', color: 'text.secondary' }}>
                     <li>Biología</li>
                     <li>Matemática</li>
                     <li>Certificación Docente</li>
                     <li>Educación Especial</li>
                   </Box>
                </Paper>

                {/* Requisitos */}
                <Paper sx={{ p: 2.5, borderRadius: 4, border: "1px solid #e6ddd1", background: "#fffbf6", boxShadow: "0 12px 30px rgba(0,0,0,0.05)" }}>
                  <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1.5 }}>Requisitos de Inscripción</Typography>
                  <Stack spacing={1}>
                    <Typography variant="body2">• Preinscripción on-line</Typography>
                    <Typography variant="body2">• Fotocopia legalizada del DNI</Typography>
                    <Typography variant="body2">• Fotocopia legalizada del título secundario o analítico</Typography>
                    <Typography variant="body2">• Certificado de buena salud</Typography>
                    <Typography variant="body2">• 2 fotos carnet y 2 folios oficio</Typography>
                    <Typography variant="body2">• Curso introductorio obligatorio</Typography>
                    
                    <Divider sx={{ my: 1 }} />
                    
                    <Typography variant="subtitle2" fontWeight={700} fontSize={13}>Si adeuda materias:</Typography>
                    <Typography variant="body2" sx={{ mb: 1 }}>Certificado de estudios regularizados donde conste que adeuda materias.</Typography>
                    
                    <Typography variant="subtitle2" fontWeight={700} fontSize={13}>Si NO adeuda materias:</Typography>
                    <Typography variant="body2">Certificado provisorio final de estudios Secundarios.</Typography>

                    <Divider sx={{ my: 1 }} />
                     <Typography variant="subtitle2" fontWeight={700} fontSize={13}>Para Certificación Docente:</Typography>
                    <Typography variant="body2">Título del nivel superior legalizado e incumbencias.</Typography>
                  </Stack>
                </Paper>


              </Stack>
            </Grid>
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
                        <AlertTitle>Preinscripción enviada con éxito</AlertTitle>
                        Tu código de seguimiento es: <strong>{submit.data.codigo}</strong>
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
                        Atrás
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
                        {submit.status === "loading" ? <CircularProgress size={24} /> : "Enviar preinscripción"}
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
          </Grid>
        </Stack>
      </Box>
    </FormProvider>
  );
}
