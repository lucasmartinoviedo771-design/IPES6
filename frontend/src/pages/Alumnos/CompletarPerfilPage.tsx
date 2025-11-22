import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  Paper,
  Stack,
  TextField,
  Typography,
  MenuItem,
} from "@mui/material";
import { Controller, useForm } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation, useNavigate } from "react-router-dom";
import { enqueueSnackbar } from "notistack";

import {
  completarPerfil,
  EstudianteAdminDetailDTO,
  EstudianteAdminDocumentacionDTO,
  EstudianteAdminUpdatePayload,
  fetchPerfilCompletar,
} from "@/api/alumnos";
import { useAuth } from "@/context/AuthContext";
import { PageHero } from "@/components/ui/GradientTitles";
import FinalConfirmationDialog from "@/components/ui/FinalConfirmationDialog";

type DocumentacionForm = {
  dni_legalizado: boolean;
  fotos_4x4: boolean;
  certificado_salud: boolean;
  folios_oficio: boolean;
  titulo_secundario_legalizado: boolean;
  certificado_titulo_en_tramite: boolean;
  analitico_legalizado: boolean;
  certificado_alumno_regular_sec: boolean;
  adeuda_materias: boolean;
  adeuda_materias_detalle: string;
  escuela_secundaria: string;
  es_certificacion_docente: boolean;
  titulo_terciario_univ: boolean;
  incumbencia: boolean;
};

type PerfilFormValues = {
  telefono: string;
  domicilio: string;
  fecha_nacimiento: string;
  anio_ingreso: string;
  genero: string;
  cuil: string;
  documentacion: DocumentacionForm;
};

function normalizeDocumentacion(detail?: EstudianteAdminDocumentacionDTO | null): DocumentacionForm {
  return {
    dni_legalizado: Boolean(detail?.dni_legalizado),
    fotos_4x4: Boolean(detail?.fotos_4x4),
    certificado_salud: Boolean(detail?.certificado_salud),
    folios_oficio: Boolean(detail?.folios_oficio && Number(detail.folios_oficio) > 0),
    titulo_secundario_legalizado: Boolean(detail?.titulo_secundario_legalizado),
    certificado_titulo_en_tramite: Boolean(detail?.certificado_titulo_en_tramite),
    analitico_legalizado: Boolean(detail?.analitico_legalizado),
    certificado_alumno_regular_sec: Boolean(detail?.certificado_alumno_regular_sec),
  adeuda_materias: Boolean(detail?.adeuda_materias),
  adeuda_materias_detalle: detail?.adeuda_materias_detalle ?? "",
  escuela_secundaria: detail?.escuela_secundaria ?? "",
  es_certificacion_docente: Boolean(detail?.es_certificacion_docente),
  titulo_terciario_univ: Boolean(detail?.titulo_terciario_univ),
  incumbencia: Boolean(detail?.incumbencia),
};
}

export default function CompletarPerfilPage() {
  const { refreshProfile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingValues, setPendingValues] = useState<PerfilFormValues | null>(null);

  const anioIngresoOptions = useMemo(() => {
    const start = 2010;
    const current = new Date().getFullYear();
    const values: string[] = [];
    for (let year = current; year >= start; year -= 1) {
      values.push(String(year));
    }
    return values;
  }, []);

  const generoOptions = [
    { value: "", label: "Sin especificar" },
    { value: "F", label: "Femenino" },
    { value: "M", label: "Masculino" },
    { value: "X", label: "X" },
  ];

  const redirectTo =
    (location.state as any)?.from?.pathname && (location.state as any)?.from?.pathname !== "/alumnos/completar-perfil"
      ? (location.state as any)?.from?.pathname
      : "/alumnos";

  const form = useForm<PerfilFormValues>({
    defaultValues: {
      telefono: "",
      domicilio: "",
      fecha_nacimiento: "",
      anio_ingreso: "",
      genero: "",
      cuil: "",
      documentacion: normalizeDocumentacion(),
    },
  });

const { control, handleSubmit, reset } = form;

  const detailQuery = useQuery({
    queryKey: ["perfil-completar"],
    queryFn: fetchPerfilCompletar,
  });

  useEffect(() => {
    if (detailQuery.data) {
      const detail = detailQuery.data;
      const extra = detail.datos_extra ?? {};
      const toStringOrEmpty = (value: unknown) => (value === null || value === undefined ? "" : String(value));
      const values: PerfilFormValues = {
        telefono: detail.telefono ?? "",
        domicilio: detail.domicilio ?? "",
        fecha_nacimiento: detail.fecha_nacimiento ? detail.fecha_nacimiento.slice(0, 10) : "",
        anio_ingreso: toStringOrEmpty(extra.anio_ingreso),
        genero: toStringOrEmpty(extra.genero),
        cuil: toStringOrEmpty(extra.cuil),
        documentacion: normalizeDocumentacion(detail.documentacion),
      };
      reset(values);
    }
  }, [detailQuery.data, reset]);

  const mutation = useMutation({
    mutationFn: async (values: PerfilFormValues) => {
      const documentacionPayload: Record<string, unknown> = {};
      const doc = values.documentacion;
      [
        "dni_legalizado",
        "fotos_4x4",
        "certificado_salud",
        "titulo_secundario_legalizado",
        "certificado_titulo_en_tramite",
        "analitico_legalizado",
        "certificado_alumno_regular_sec",
        "adeuda_materias",
        "es_certificacion_docente",
        "titulo_terciario_univ",
        "incumbencia",
      ].forEach((key) => {
        const current = (doc as Record<string, unknown>)[key];
        if (typeof current === "boolean") {
          documentacionPayload[key] = current;
        }
      });
      if (typeof doc.folios_oficio === "boolean") {
        documentacionPayload.folios_oficio = doc.folios_oficio ? 3 : 0;
      }
      const adeudaDetalle = doc.adeuda_materias_detalle.trim();
      documentacionPayload.adeuda_materias_detalle = adeudaDetalle || null;
      const escuela = doc.escuela_secundaria.trim();
      documentacionPayload.escuela_secundaria = escuela || null;

      const payload: EstudianteAdminUpdatePayload = {
        telefono: values.telefono.trim() || undefined,
        domicilio: values.domicilio.trim() || undefined,
        fecha_nacimiento: values.fecha_nacimiento.trim() || undefined,
        anio_ingreso: values.anio_ingreso.trim() || undefined,
        genero: values.genero.trim() || undefined,
        cuil: values.cuil.trim() || undefined,
        documentacion: Object.keys(documentacionPayload).length ? documentacionPayload : undefined,
      };

      const data = await completarPerfil(payload);
      return data;
    },
    onSuccess: async () => {
      await refreshProfile();
      await queryClient.invalidateQueries({ queryKey: ["perfil-completar"] });
      enqueueSnackbar("Datos actualizados correctamente.", { variant: "success" });
      navigate(redirectTo, { replace: true });
    },
    onError: (error: unknown) => {
      const err = error as { response?: { data?: { message?: string; detail?: string } } };
      const message =
        err?.response?.data?.message ||
        err?.response?.data?.detail ||
        (error instanceof Error ? error.message : "No se pudo guardar la informacion.");
      enqueueSnackbar(message, { variant: "error" });
    },
  });

  const onSubmit = (values: PerfilFormValues) => {
    setPendingValues(values);
    setConfirmOpen(true);
  };

  const handleConfirmSave = () => {
    if (!pendingValues) return;
    mutation.mutate(pendingValues, {
      onSettled: () => {
        setConfirmOpen(false);
        setPendingValues(null);
      },
    });
  };

  const handleCancelConfirm = () => {
    if (mutation.isPending) {
      return;
    }
    setConfirmOpen(false);
    setPendingValues(null);
  };

  const detail: EstudianteAdminDetailDTO | undefined = detailQuery.data;
  const docDetail = detail?.documentacion;
  const docSummary = [
    { label: "DNI legalizado", value: Boolean(docDetail?.dni_legalizado) },
    { label: "Fotos 4x4", value: Boolean(docDetail?.fotos_4x4) },
    { label: "Certificado de salud", value: Boolean(docDetail?.certificado_salud) },
    { label: "Folios de oficio", value: Boolean(docDetail?.folios_oficio && Number(docDetail.folios_oficio) > 0) },
    { label: "Título secundario legalizado", value: Boolean(docDetail?.titulo_secundario_legalizado) },
    { label: "Certificado título en trámite", value: Boolean(docDetail?.certificado_titulo_en_tramite) },
    { label: "Analítico legalizado", value: Boolean(docDetail?.analitico_legalizado) },
    { label: "Constancia alumno regular", value: Boolean(docDetail?.certificado_alumno_regular_sec) },
    { label: "Trayecto certificación docente", value: Boolean(docDetail?.es_certificacion_docente) },
    { label: "Título terciario/universitario", value: Boolean(docDetail?.titulo_terciario_univ) },
    { label: "Incumbencia", value: Boolean(docDetail?.incumbencia) },
  ];

  return (
    <Box py={3} px={{ xs: 1, md: 4 }}>
      <Paper elevation={1} sx={{ maxWidth: 960, margin: "0 auto", p: { xs: 2, md: 4 } }}>
        <Stack spacing={3}>
          <PageHero
            title="Completa tu información"
            subtitle="Necesitamos estos datos para finalizar tu inscripción. Revisá que todo esté correcto antes de guardar."
          />

          {detailQuery.isLoading && (
            <Box display="flex" justifyContent="center" py={6}>
              <CircularProgress />
            </Box>
          )}

          {detailQuery.isError && (
            <Alert severity="error">
              No se pudo cargar la informacion del estudiante. Intenta nuevamente mas tarde.
            </Alert>
          )}

          {detail && (
            <Stack spacing={2}>
              <Divider />
              <Typography fontWeight={600}>
                {detail.apellido}, {detail.nombre} - DNI {detail.dni}
              </Typography>
              {detail.condicion_calculada && (
                <Typography variant="body2" color="text.secondary">
                  Estado actual del legajo: {detail.condicion_calculada}.
                </Typography>
              )}

              <Box component="form" onSubmit={handleSubmit(onSubmit)}>
                <Stack spacing={3}>
                  <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
                    <Controller
                      name="telefono"
                      control={control}
                      render={({ field }) => (
                        <TextField {...field} label="Telefono de contacto" size="small" fullWidth />
                      )}
                    />
                    <Controller
                      name="domicilio"
                      control={control}
                      render={({ field }) => (
                        <TextField {...field} label="Domicilio" size="small" fullWidth />
                      )}
                    />
                  </Stack>

                  <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
                    <Controller
                      name="fecha_nacimiento"
                      control={control}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          label="Fecha de nacimiento"
                          size="small"
                          type="date"
                          InputLabelProps={{ shrink: true }}
                          fullWidth
                        />
                      )}
                    />
                    <Controller
                      name="anio_ingreso"
                      control={control}
                      render={({ field }) => (
                        <TextField {...field} select label="Anio de ingreso" size="small" fullWidth>
                          <MenuItem value="">
                            Sin especificar
                          </MenuItem>
                          {anioIngresoOptions.map((option) => (
                            <MenuItem key={option} value={option}>
                              {option}
                            </MenuItem>
                          ))}
                        </TextField>
                      )}
                    />
                    <Controller
                      name="genero"
                      control={control}
                      render={({ field }) => (
                        <TextField {...field} select label="Genero" size="small" fullWidth>
                          {generoOptions.map((option) => (
                            <MenuItem key={option.value} value={option.value}>
                              {option.label}
                            </MenuItem>
                          ))}
                        </TextField>
                      )}
                    />
                  </Stack>

                  <Controller
                    name="cuil"
                    control={control}
                    render={({ field }) => (
                      <TextField {...field} label="CUIL" size="small" fullWidth />
                    )}
                  />

                  <Box>
                    <Typography variant="subtitle2" fontWeight={600} gutterBottom sx={{ mt: 2 }}>
                      Documentación registrada
                    </Typography>
                    <Stack
                      spacing={1}
                      sx={{
                        border: "1px solid",
                        borderColor: "divider",
                        borderRadius: 1,
                        p: 2,
                      }}
                    >
                      {docSummary.map((item) => (
                        <Stack
                          key={item.label}
                          direction="row"
                          alignItems="center"
                          justifyContent="space-between"
                        >
                          <Typography variant="body2">{item.label}</Typography>
                          <Chip
                            size="small"
                            color={item.value ? "success" : "default"}
                            label={item.value ? "Presentado" : "Pendiente"}
                          />
                        </Stack>
                      ))}
                      {docDetail?.adeuda_materias && (
                        <Box>
                          <Typography variant="body2" fontWeight={600}>
                            Declaró materias adeudadas
                          </Typography>
                          <Typography variant="body2">
                            {docDetail.adeuda_materias_detalle || "Sin detalle"}
                          </Typography>
                          {docDetail.escuela_secundaria && (
                            <Typography variant="body2" color="text.secondary">
                              Escuela: {docDetail.escuela_secundaria}
                            </Typography>
                          )}
                        </Box>
                      )}
                    </Stack>
                    <Alert severity="info">
                      La documentación se confirma exclusivamente con Secretaría. Si detectás un error en los datos,
                      comunicate con el equipo administrativo.
                    </Alert>
                  </Box>

                  <Stack direction="row" spacing={2} justifyContent="flex-end">
                    <Button
                      type="submit"
                      variant="contained"
                      disabled={mutation.isPending}
                    >
                      {mutation.isPending ? "Guardando..." : "Guardar datos"}
                    </Button>
                  </Stack>
                </Stack>
              </Box>
            </Stack>
          )}
        </Stack>
      </Paper>
      <FinalConfirmationDialog
        open={confirmOpen}
        onConfirm={handleConfirmSave}
        onCancel={handleCancelConfirm}
        contextText="Cambios"
        loading={mutation.isPending}
      />
    </Box>
  );
}
