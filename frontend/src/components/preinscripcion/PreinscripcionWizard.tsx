import React, { useEffect, useMemo, useState } from "react";
import { FieldErrors, FormProvider, SubmitErrorHandler, SubmitHandler, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Box, Button, Step, StepLabel, Stepper, Typography, Paper, CircularProgress, Alert, AlertTitle } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
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

const STORAGE_KEY = "preinscripcion_form_data";

const steps = [
  "Datos personales",
  "Contacto",
  "Estudios",
  "Accesibilidad",
  "Carrera y Docs",
  "Confirmar y Enviar",
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
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
        <CircularProgress />
      </Box>
    );
  }

  if (!ventanaActiva) {
    return (
      <Paper sx={{ p: 3, maxWidth: 720, mx: 'auto' }}>
        <Alert severity="info">
          <AlertTitle>La preinscripción está cerrada</AlertTitle>
          <Typography variant="body1" sx={{ mb: 1 }}>
            Actualmente no se encuentran habilitadas las preinscripciones.
          </Typography>
          <Typography variant="body1">
            Para más información, podés visitar <a href="http://www.ipespaulofreire.edu.ar" target="_blank" rel="noopener noreferrer">www.ipespaulofreire.edu.ar</a> o realizar consultas presencialmente en Estrada 1575, Río Grande, Tierra del Fuego.
          </Typography>
        </Alert>
      </Paper>
    );
  }

  const carreraNombre = carreras.find(c => c.id === form.watch("carrera_id"))?.nombre ?? "";

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
      <Paper sx={{ p: 3, maxWidth: 900, mx: "auto", borderRadius: 5 }}>
        <Typography variant="h4" sx={{ mb: 2 }}>Preinscripción</Typography>
        <Stepper activeStep={activeStep} sx={{ mb: 3 }}>
          {steps.map((label) => (
            <Step key={label}><StepLabel>{label}</StepLabel></Step>
          ))}
        </Stepper>

        {/* Contenido del paso */}
        <Box sx={{ p: 2.5, border: "1px solid #e5e7eb", borderRadius: 5 }}>
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
              <AlertTitle>¡Preinscripción enviada con éxito!</AlertTitle>
              Tu código de seguimiento es: <strong>{submit.data.codigo}</strong>
            </Alert>
          )}
        </Box>

        {/* Acciones */}
        <Box sx={{ mt: 3, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Button
            variant="outlined"
            color="secondary"
            onClick={() => {
              localStorage.removeItem(STORAGE_KEY);
              form.reset(defaultValues);
            }}
            sx={{ borderRadius: 5 }}
          >
            Limpiar Formulario
          </Button>
          <Box sx={{ display: "flex", gap: 1 }}>
            <Button onClick={handleBack} disabled={activeStep === 0 || submit.status === "loading"} sx={{ borderRadius: 5 }}>
              Atrás
            </Button>
          {activeStep < steps.length - 1 ? (
            <Button variant="contained" onClick={() => void handleNext()} sx={{ borderRadius: 5 }}>
              Siguiente
            </Button>
          ) : (
            <Button
              variant="contained"
              onClick={handleSubmit}
              disabled={!pdfDownloaded || submit.status === "loading" || submit.status === "ok"}
              sx={{ borderRadius: 5 }}
            >
              {submit.status === "loading" ? <CircularProgress size={24} /> : "Enviar Preinscripción"}
            </Button>
          )}
          </Box>
        </Box>

        {submit.status === "error" && (
          <Alert severity="error" sx={{ mt: 2 }}>{submit.message}</Alert>
        )}
      </Paper>
    </FormProvider>
  );
}










