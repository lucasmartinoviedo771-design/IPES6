/* eslint-disable react-doctor/async-defer-await, react-doctor/control-has-associated-label, react-doctor/prefer-module-scope-static-value, react-doctor/no-giant-component, react-doctor/exhaustive-deps, react-doctor/prefer-useReducer */
import React, { useEffect, useState } from "react";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { FieldErrors, FormProvider, SubmitErrorHandler, SubmitHandler, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Step from "@mui/material/Step";
import StepLabel from "@mui/material/StepLabel";
import Stepper from "@mui/material/Stepper";
import Typography from "@mui/material/Typography";
import Paper from "@mui/material/Paper";
import CircularProgress from "@mui/material/CircularProgress";
import Alert from "@mui/material/Alert";
import AlertTitle from "@mui/material/AlertTitle";
import Stack from "@mui/material/Stack";
import Grid from "@mui/material/Grid";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import { useQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";

import { useGoogleReCaptcha } from "react-google-recaptcha-v3";

import { preinscripcionSchema, PreinscripcionForm } from "./schema";
import { defaultValues } from "./defaultValues";
import { PreinscripcionOut } from "@/types/preinscripcion";
import { listarCarreras, crearPreinscripcion, recuperarPreinscripcion } from "@/services/preinscripcion";
import { apiUploadPreDoc, descargarPdf } from "@/api/preinscripciones";
import PrintIcon from "@mui/icons-material/Print";
import { client } from "@/api/client";

export type VentanaPublicaDto = {
  id?: number;
  tipo: string;
  desde: string;
  hasta: string;
  activo: boolean;
};

async function fetchVentanaActivaPublica(): Promise<VentanaPublicaDto | null> {
  try {
    const { data } = await client.get("/preinscripciones/ventana-activa", {
      validateStatus: () => true,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    if (data?.ok && data?.data) return data.data as VentanaPublicaDto;
    return null;
  } catch {
    return null;
  }
}

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
  const recaptchaContext = useGoogleReCaptcha();
  const executeRecaptcha = recaptchaContext?.executeRecaptcha;
  const [honeypotValue, setHoneypotValue] = useState('');
  const [activeStep, setActiveStep] = useState(0);
  const [submit, setSubmit] = useState<SubmitState>({ status: "idle" });
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [recuperarOpen, setRecuperarOpen] = useState(false);
  const [duplicatePdfUrl, setDuplicatePdfUrl] = useState<string | null>(null);
  const pageBgSx = {
    minHeight: "100vh",
    background: "radial-gradient(circle at 20% 20%, #f8f1e7 0, #f8f1e7 25%, #f0ede5 40%, #f7f5ef 100%)",
    py: { xs: 3, md: 5 },
    px: { xs: 1.5, md: 3 },
  };

  const form = useForm<PreinscripcionForm>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const subscription = form.watch((value, { name, type }) => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
      } catch (_e) {
        void 0;
      }
      if (name === "carrera_id" || name === "dni") {
        setDuplicatePdfUrl(null);
        form.clearErrors("carrera_id");
      }
    });
    return () => subscription.unsubscribe();
  }, [form]);

  const { isLoading: loadingVentana, data: ventanaActiva } = useQuery<VentanaPublicaDto | null>({
    queryKey: ["ventana-preinscripcion-publica"],
    queryFn: fetchVentanaActivaPublica,
    staleTime: 60_000,
  });

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
      } catch (_e) {
        void 0;
      } finally {
        if (alive) setCarrerasLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  // pdfDownloaded was removed since download is automatic on submission

  const handleNext = async () => {
    if (activeStep === 3) {
      const consentGiven = form.getValues("consentimiento_datos");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
    
    if (activeStep === 4) {
      const carreraId = form.getValues("carrera_id");
      const dni = form.getValues("dni");
      const fechaNac = form.getValues("fecha_nacimiento");
      
      if (carreraId && dni && fechaNac) {
        setSubmit({ status: "loading" });
        try {
          const res = await recuperarPreinscripcion(dni, Number(carreraId), fechaNac);
          if (res.ok && res.data) {
            setSubmit({ status: "idle" });
            form.setError("carrera_id", {
              type: "manual",
              message: "Ya existe una preinscripción activa para esta carrera en el ciclo lectivo actual.",
            });
            setDuplicatePdfUrl(res.data.pdf_url);
            return;
          }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars
        } catch (err: any) {
          setSubmit({ status: "idle" });
          form.clearErrors("carrera_id");
          setDuplicatePdfUrl(null);
        }
      }
    }
    
    setActiveStep((s) => Math.min(s + 1, steps.length - 1));
  };
  const handleBack = () => setActiveStep((s) => s - 1);

  const handleResetWizard = () => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch { /* localStorage no disponible */ }
    form.reset(defaultValues);
    setActiveStep(0);
    setHoneypotValue("");
    setPhotoFile(null);
    setSubmit({ status: "idle" });
  };

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
        } catch (_uploadError) {
          void 0;
        }
      }

      // Descargar PDF automáticamente tras la preinscripción exitosa
      if (response?.id) {
        try {
          descargarPdf(response.id);
        } catch (_pdfError) {
          void 0;
        }
      }

      setSubmit({ status: "ok", data: response });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      setSubmit({ status: "error", message: err.message || "Error desconocido" });
    }
  };

  const onSubmitError: SubmitErrorHandler<PreinscripcionForm> = (errors) => {
    void 0;
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
          <Grid container spacing={2.5}>
            <Grid item xs={12}>
              <PageHero
                title="Preinscripción 2026"
                subtitle="Completá los 6 pasos, descargá la planilla y presentala con tu documentación."
                actions={
                  <Stack spacing={1.5} alignItems="flex-end">
                    <Chip label={`Inscripción abierta: ${ventanaLabel}`} color="success" sx={{ fontSize: "1rem", fontWeight: 700, px: 2, py: 2.5, height: "auto", "& .MuiChip-label": { px: 1 } }} />
                    <Button
                      variant="contained"
                      startIcon={<PrintIcon />}
                      onClick={() => setRecuperarOpen(true)}
                      sx={{
                        borderRadius: 4,
                        height: "auto",
                        py: 1.2,
                        px: 3,
                        fontWeight: 700,
                        bgcolor: "#ffffff !important",
                        color: "#7D7F6E !important",
                        boxShadow: "0 4px 14px rgba(0,0,0,0.12)",
                        textTransform: "none",
                        "&:hover": {
                          bgcolor: "#f5f3eb !important",
                          boxShadow: "0 6px 20px rgba(0,0,0,0.18)",
                        }
                      }}
                    >
                      Reimprimir planilla
                    </Button>
                  </Stack>
                }
              />
              <RecuperarPreinscripcionDialog
                open={recuperarOpen}
                onClose={() => setRecuperarOpen(false)}
                carreras={carreras}
              />
            </Grid>
          </Grid>
          <Grid container spacing={2.5} alignItems="stretch" direction={{ xs: "column-reverse", md: "row" }}>
            <Grid item xs={12} md={4}>
              <Stack spacing={2}>
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
                      <Stack spacing={2.5}>
                        {duplicatePdfUrl && (
                          <Alert severity="warning">
                            <AlertTitle>Preinscripción duplicada detectada</AlertTitle>
                            Ya te encontrás preinscripto/a en este profesorado. Podés descargar tu planilla haciendo clic abajo:
                            <Box sx={{ mt: 1.5 }}>
                              <Button variant="contained" color="warning" onClick={() => window.open(duplicatePdfUrl, "_blank")}>
                                Descargar Planilla Existente (PDF)
                              </Button>
                            </Box>
                          </Alert>
                        )}
                        <CarreraDocumentacion
                          carreras={carreras}
                          isLoading={carrerasLoading}
                          onFileChange={setPhotoFile}
                        />
                      </Stack>
                    )}
                    {activeStep === 5 && (
                      submit.status !== "ok" ? 
                      <Confirmacion carreraNombre={carreraNombre} /> : 
                      <Stack spacing={3}>
                        <Alert severity="success">
                          <AlertTitle>Preinscripción enviada con éxito</AlertTitle>
                          Tu código de seguimiento es: <strong>{submit.data.codigo}</strong>
                        </Alert>
                        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2, justifyContent: "center" }}>
                          <Button
                            variant="contained"
                            color="success"
                            onClick={() => descargarPdf(submit.data.id)}
                            startIcon={<PrintIcon />}
                            sx={{ borderRadius: 4, py: 1.2, px: 3, fontWeight: 700 }}
                          >
                            Descargar Planilla nuevamente (PDF)
                          </Button>
                          <Button
                            variant="outlined"
                            onClick={handleResetWizard}
                            sx={{ borderRadius: 4, py: 1.2, px: 3, fontWeight: 700 }}
                          >
                            Hacer otra preinscripción
                          </Button>
                        </Box>
                      </Stack>
                    )}
                  </Box>

                  {submit.status !== "ok" && (
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
                          disabled={submit.status === "loading"}
                          sx={{ borderRadius: 4, width: { xs: "100%", sm: "auto" } }}
                        >
                          {submit.status === "loading" ? <CircularProgress size={24} /> : "Confirmar y Descargar Planilla (PDF)"}
                        </Button>
                      )}
                      </Stack>
                    </Stack>
                  )}

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

interface RecuperarDialogProps {
  open: boolean;
  onClose: () => void;
  carreras: Array<{ id: number; nombre: string }>;
}

function RecuperarPreinscripcionDialog({ open, onClose, carreras }: RecuperarDialogProps) {
  const [dni, setDni] = useState("");
  const [carreraId, setCarreraId] = useState<number | "">("");
  const [fechaNac, setFechaNac] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [codigo, setCodigo] = useState<string | null>(null);

  const handleRecuperar = async () => {
    if (!dni || !carreraId || !fechaNac) {
      setError("Por favor, completa todos los campos.");
      return;
    }
    setLoading(true);
    setError(null);
    setPdfUrl(null);
    setCodigo(null);
    try {
      const res = await recuperarPreinscripcion(dni, Number(carreraId), fechaNac);
      if (res.ok && res.data) {
        setPdfUrl(res.data.pdf_url);
        setCodigo(res.data.codigo);
      } else {
        setError(res.message || "Error al verificar los datos.");
      }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      setError(err?.message || "Ocurrió un error al verificar.");
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    if (pdfUrl) {
      window.open(pdfUrl, "_blank");
      onClose();
      // Reset state
      setDni("");
      setCarreraId("");
      setFechaNac("");
      setPdfUrl(null);
      setCodigo(null);
      setError(null);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>Reimprimir Planilla de Preinscripción</DialogTitle>
      <DialogContent>
        <Stack spacing={2.5} sx={{ mt: 1 }}>
          <Typography variant="body2" color="text.secondary">
            Ingresá tus datos para validar tu identidad y descargar la planilla PDF de tu preinscripción.
          </Typography>

          {error && <Alert severity="error">{error}</Alert>}

          {pdfUrl ? (
            <Alert severity="success">
              <AlertTitle>Preinscripción encontrada</AlertTitle>
              Código de preinscripción: <strong>{codigo}</strong>
              <Box sx={{ mt: 2 }}>
                <Button variant="contained" color="success" onClick={handleDownload} fullWidth>
                  Descargar Planilla PDF
                </Button>
              </Box>
            </Alert>
          ) : (
            <>
              <TextField
                label="DNI"
                value={dni}
                onChange={(e) => setDni(e.target.value.trim())}
                size="small"
                fullWidth
              />
              <TextField
                select
                label="Carrera en la que te preinscribiste"
                value={carreraId}
                onChange={(e) => setCarreraId(Number(e.target.value))}
                size="small"
                fullWidth
              >
                {carreras.map((c) => (
                  <MenuItem key={c.id} value={c.id}>
                    {c.nombre}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                label="Fecha de nacimiento"
                type="date"
                value={fechaNac}
                onChange={(e) => setFechaNac(e.target.value)}
                InputLabelProps={{ shrink: true }}
                size="small"
                fullWidth
              />
            </>
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ p: 2, px: 3 }}>
        <Button onClick={onClose} color="inherit">
          Cancelar
        </Button>
        {!pdfUrl && (
          <Button
            variant="contained"
            onClick={handleRecuperar}
            disabled={loading || !dni || !carreraId || !fechaNac}
          >
            {loading ? <CircularProgress size={24} /> : "Verificar e Imprimir"}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
