import React, { useEffect, useState } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Box, Button, Step, StepLabel, Stepper, Typography, Paper, CircularProgress, Alert, AlertTitle } from "@mui/material";
import { useQuery } from "@tanstack/react-query";

// Lógica de negocio y tipos
import { preinscripcionSchema, PreinscripcionForm } from "./schema";
import { defaultValues } from "./defaultValues";
import { PreinscripcionIn, PreinscripcionOut } from "@/types/preinscripcion";
import { listarCarreras, crearPreinscripcion } from "@/services/preinscripcion";

// Pasos del Wizard
import DatosPersonales from "./steps/DatosPersonales";
import Contacto from "./steps/Contacto";
import EstudiosSecundarios from "./steps/EstudiosSecundarios";
import EstudiosSuperiores from "./steps/EstudiosSuperiores";
import DatosLaborales from "./steps/DatosLaborales";
import CarreraDocumentacion from "./steps/CarreraDocumentacion";
import Confirmacion from "./steps/Confirmacion";

const steps = [
  "Datos personales",
  "Contacto",
  "Estudios",
  "Carrera y Docs",
  "Confirmar y Enviar",
];

// Mapea los datos del formulario a la estructura que espera la API
const buildPayload = (v: PreinscripcionForm): PreinscripcionIn => ({
  carrera_id: Number(v.carrera_id),
  foto_4x4_dataurl: v.foto_dataUrl ?? null,
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
  const [activeStep, setActiveStep] = useState(0);
  const [submit, setSubmit] = useState<SubmitState>({ status: "idle" });

  const form = useForm<PreinscripcionForm>({
    resolver: zodResolver(preinscripcionSchema),
    defaultValues: defaultValues,
    mode: "onChange",
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
        console.log("Carreras recibidas:", rows);
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

  const handleNext = () => setActiveStep((s) => s + 1);
  const handleBack = () => setActiveStep((s) => s - 1);

  const handleSubmit = form.handleSubmit(
    async (values) => {
      setSubmit({ status: "loading" });
      try {
        const payload = buildPayload(values);
        const response = await crearPreinscripcion(payload); // Usando el nuevo servicio
        setSubmit({ status: "ok", data: response });
      } catch (err: any) {
        setSubmit({ status: "error", message: err.message || "Error desconocido" });
      }
    },
    (errors) => {
      console.error("Errores de validación del formulario:", errors);
    }
  );

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
              value={form.watch("foto_4x4_dataurl")}
              onFileChange={(dataUrl) => form.setValue("foto_4x4_dataurl", dataUrl)}
            />
          )}
          {activeStep === 4 && (
            submit.status !== "ok" ? 
            <Confirmacion carreraNombre={carreraNombre} /> : 
            <Alert severity="success">
              <AlertTitle>¡Preinscripción enviada con éxito!</AlertTitle>
              Tu código de seguimiento es: <strong>{submit.data.data.codigo}</strong>
            </Alert>
          )}
        </Box>

        {/* Acciones */}
        <Box sx={{ mt: 3, display: "flex", justifyContent: "space-between" }}>
          <Button onClick={handleBack} disabled={activeStep === 0 || submit.status === "loading"}>
            Atrás
          </Button>
          {activeStep < steps.length - 1 ? (
            <Button variant="contained" onClick={handleNext}>
              Siguiente
            </Button>
          ) : (
            <Button variant="contained" onClick={handleSubmit} disabled={submit.status === "loading" || submit.status === "ok"}>
              {submit.status === "loading" ? <CircularProgress size={24} /> : "Enviar Preinscripción"}
            </Button>
          )}
        </Box>

        {submit.status === "error" && (
          <Alert severity="error" sx={{ mt: 2 }}>{submit.message}</Alert>
        )}
      </Paper>
    </FormProvider>
  );
}