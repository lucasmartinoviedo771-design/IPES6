import React, { useEffect, useMemo, useState } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Box, Button, Step, StepLabel, Stepper, Typography, Paper, CircularProgress, Alert, AlertTitle } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
// import { useNavigate } from "react-router-dom";

// Lógica de negocio y tipos
import { preinscripcionSchema, PreinscripcionForm } from "./schema";
import { defaultValues } from "./defaultValues";
import { PreinscripcionIn, PreinscripcionOut } from "@/types/preinscripcion";
import { listarCarreras, crearPreinscripcion } from "@/services/preinscripcion";
import { apiUploadPreDoc } from "@/api/preinscripciones";
import { client } from "@/api/client";

// Pasos del Wizard
import DatosPersonales from "./steps/DatosPersonales";
import Contacto from "./steps/Contacto";
import EstudiosSecundarios from "./steps/EstudiosSecundarios";
import EstudiosSuperiores from "./steps/EstudiosSuperiores";
import DatosLaborales from "./steps/DatosLaborales";
import CarreraDocumentacion from "./steps/CarreraDocumentacion";
import Confirmacion from "./steps/Confirmacion";

const STORAGE_KEY = "preinscripcion_form_data";

const steps = [
  "Datos personales",
  "Contacto",
  "Estudios",
  "Carrera y Docs",
  "Confirmar y Enviar",
];

// Mapea los datos del formulario a la estructura que espera la API
const buildPayload = (v: PreinscripcionForm): PreinscripcionIn => ({
  ...v, // Incluir todos los campos del formulario
  carrera_id: Number(v.carrera_id),
  alumno: {
    dni: v.dni,
    nombres: v.nombres,
    apellido: v.apellido,
    cuil: v.cuil || null,
    fecha_nacimiento: v.fecha_nacimiento ? v.fecha_nacimiento.split('/').reverse().join('-') : null, // DD/MM/YYYY -> YYYY-MM-DD
    email: v.email || null,
    telefono: v.tel_movil || v.tel_fijo || null,
    domicilio: v.domicilio || null,
  },
});

type SubmitState = 
  | { status: "idle" | "loading" }
  | { status: "error"; message: string }
  | { status: "ok"; data: PreinscripcionOut };

export default function PreinscripcionWizard() {
  // const navigate = useNavigate();
  const [activeStep, setActiveStep] = useState(0);
  const [submit, setSubmit] = useState<SubmitState>({ status: "idle" });
  const [pdfDownloaded, setPdfDownloaded] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);

  const form = useForm<PreinscripcionForm>({
    resolver: zodResolver(preinscripcionSchema),
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

  const { isLoading: loadingVentana, data: ventanasPre } = useQuery({
    queryKey: ["ventanas-preinscripcion"],
    queryFn: async () => {
      const { data } = await client.get<Ventana[]>("/ventanas", {
        params: { tipo: "PREINSCRIPCION" },
      });
      return data;
    },
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

  const proximaVentana = useMemo(() => {
    if (!ventanasPre) return null;
    const hoy = dayjs();
    return ventanasPre
      .filter((v) => dayjs(v.desde).isAfter(hoy, "day"))
      .sort((a, b) => dayjs(a.desde).diff(dayjs(b.desde)))[0];
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

  const handleNext = () => setActiveStep((s) => s + 1);
  const handleBack = () => setActiveStep((s) => s - 1);

  const handleSubmit = form.handleSubmit(
    async (values) => {
      setSubmit({ status: "loading" });
      try {
        const payload = buildPayload(values);
        const response = await crearPreinscripcion(payload);

        if (photoFile && response?.data?.id) {
          try {
            await apiUploadPreDoc(response.data.id, "foto4x4", photoFile);
          } catch (uploadError) {
            console.error("La preinscripción se creó, pero falló la subida de la foto:", uploadError);
            // Opcional: notificar al usuario que la foto no se subió.
          }
        }

        setSubmit({ status: "ok", data: response });
        // Limpiar y volver al paso 1
        setTimeout(() => {
          try { localStorage.removeItem(STORAGE_KEY); } catch {}
          form.reset(defaultValues);
          setActiveStep(0);
          setPdfDownloaded(false);
          setSubmit({ status: "idle" } as any);
        }, 300);
      } catch (err: any) {
        setSubmit({ status: "error", message: err.message || "Error desconocido" });
      }
    },
    (errors) => {
      console.error("Errores de validación del formulario:", errors);
    }
  );

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
      <Paper sx={{ p: 3, maxWidth: 900, mx: "auto" }}>
        <Typography variant="h4" sx={{ mb: 2 }}>Preinscripción</Typography>
        <Stepper activeStep={activeStep} sx={{ mb: 3 }}>
          {steps.map((label) => (
            <Step key={label}><StepLabel>{label}</StepLabel></Step>
          ))}
        </Stepper>

        {/* Contenido del paso */}
        <Box sx={{ p: 2, border: "1px solid #eee", borderRadius: 2 }}>
          {activeStep === 0 && <DatosPersonales />}
          {activeStep === 1 && <Contacto />}
          {activeStep === 2 && <><EstudiosSecundarios /><Box mt={2}><EstudiosSuperiores /></Box></>}
          {activeStep === 3 && (
            <CarreraDocumentacion
              carreras={carreras}
              isLoading={carrerasLoading}
              onFileChange={setPhotoFile}
            />
          )}
          {activeStep === 4 && (
            submit.status !== "ok" ? 
            <Confirmacion carreraNombre={carreraNombre} onDownloaded={() => setPdfDownloaded(true)} /> : 
            <Alert severity="success">
              <AlertTitle>¡Preinscripción enviada con éxito!</AlertTitle>
              Tu código de seguimiento es: <strong>{submit.data.data.codigo}</strong>
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
          >
            Limpiar Formulario
          </Button>
          <Box sx={{ display: "flex", gap: 1 }}>
            <Button onClick={handleBack} disabled={activeStep === 0 || submit.status === "loading"}>
              Atrás
            </Button>
          {activeStep < steps.length - 1 ? (
            <Button variant="contained" onClick={handleNext}>
              Siguiente
            </Button>
          ) : (
            <Button variant="contained" onClick={handleSubmit} disabled={!pdfDownloaded || submit.status === "loading" || submit.status === "ok"}>
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