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
} from "@/api/estudiantes";
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
  certificado_estudiante_regular_sec: boolean;
  adeuda_materias: boolean;
  adeuda_materias_detalle: string;
  escuela_secundaria: string;
  es_certificacion_docente: boolean;
  titulo_terciario_univ: boolean;
  incumbencia: boolean;
};

type PerfilFormValues = {
  nombre: string;
  apellido: string;
  email: string;
  telefono: string;
  domicilio: string;
  fecha_nacimiento: string;
  lugar_nacimiento: string;
  genero: string;
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
    certificado_estudiante_regular_sec: Boolean(detail?.certificado_estudiante_regular_sec),
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

  const generoOptions = [
    { value: "", label: "Sin especificar" },
    { value: "F", label: "Femenino" },
    { value: "M", label: "Masculino" },
    { value: "X", label: "X" },
  ];

  const redirectTo =
    (location.state as any)?.from?.pathname && (location.state as any)?.from?.pathname !== "/estudiantes/completar-perfil"
      ? (location.state as any)?.from?.pathname
      : "/estudiantes";

  const form = useForm<PerfilFormValues>({
    defaultValues: {
      nombre: "",
      apellido: "",
      email: "",
      telefono: "",
      domicilio: "",
      fecha_nacimiento: "",
      lugar_nacimiento: "",
      genero: "",
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
        nombre: detail.nombre ?? "",
        apellido: detail.apellido ?? "",
        email: detail.email ?? "",
        telefono: detail.telefono ?? "",
        domicilio: detail.domicilio ?? "",
        fecha_nacimiento: detail.fecha_nacimiento ? detail.fecha_nacimiento.slice(0, 10) : "",
        lugar_nacimiento: detail.lugar_nacimiento ?? "",
        genero: detail.genero ?? toStringOrEmpty(extra.genero),
        documentacion: normalizeDocumentacion(detail.documentacion),
      };
      reset(values);
    }
  }, [detailQuery.data, reset]);

  const mutation = useMutation({
    mutationFn: async (values: PerfilFormValues) => {
      // Solo enviamos los datos permitidos
      const payload: EstudianteAdminUpdatePayload = {
        nombre: values.nombre.trim() || undefined,
        apellido: values.apellido.trim() || undefined,
        email: values.email.trim() || undefined,
        telefono: values.telefono.trim() || undefined,
        domicilio: values.domicilio.trim() || undefined,
        fecha_nacimiento: values.fecha_nacimiento.trim() || undefined,
        lugar_nacimiento: values.lugar_nacimiento.trim() || undefined,
        genero: values.genero.trim() || undefined,
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
    { label: "Constancia estudiante regular", value: Boolean(docDetail?.certificado_estudiante_regular_sec) },
    { label: "Trayecto certificación docente", value: Boolean(docDetail?.es_certificacion_docente) },
    { label: "Título terciario/universitario", value: Boolean(docDetail?.titulo_terciario_univ) },
    { label: "Incumbencia", value: Boolean(docDetail?.incumbencia) },
  ];

  return (
    <Box py={3} px={{ xs: 1, md: 4 }}>
      <Paper elevation={1} sx={{ maxWidth: 960, margin: "0 auto", p: { xs: 2, md: 4 } }}>
        <Stack spacing={3}>
          <PageHero
            title="Mis Datos Personales"
            subtitle="Mantené tu información actualizada. Los campos DNI y otros datos administrativos solo pueden ser modificados por Bedelía."
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
              <Stack direction="row" spacing={2} alignItems="center">
                <Typography variant="h6" fontWeight={600}>
                  DNI: {detail.dni}
                </Typography>
                <Chip label={detail.estado_legajo_display} size="small" color={detail.estado_legajo === 'COM' ? 'success' : 'warning'} />
              </Stack>

              {detail.condicion_calculada && (
                <Typography variant="body2" color="text.secondary">
                  Condición administrativa calculada: {detail.condicion_calculada}.
                </Typography>
              )}

              <Box component="form" onSubmit={handleSubmit(onSubmit)}>
                <Stack spacing={3} sx={{ mt: 2 }}>
                  <Typography variant="subtitle1" fontWeight={600}>Identificación</Typography>
                  <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
                    <Controller
                      name="nombre"
                      control={control}
                      render={({ field }) => (
                        <TextField {...field} label="Nombre" size="small" fullWidth />
                      )}
                    />
                    <Controller
                      name="apellido"
                      control={control}
                      render={({ field }) => (
                        <TextField {...field} label="Apellido" size="small" fullWidth />
                      )}
                    />
                  </Stack>

                  <Typography variant="subtitle1" fontWeight={600}>Contacto y Residencia</Typography>
                  <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
                    <Controller
                      name="email"
                      control={control}
                      render={({ field }) => (
                        <TextField {...field} label="Correo electrónico" size="small" fullWidth />
                      )}
                    />
                    <Controller
                      name="telefono"
                      control={control}
                      render={({ field }) => (
                        <TextField {...field} label="Teléfono" size="small" fullWidth />
                      )}
                    />
                  </Stack>
                  <Controller
                    name="domicilio"
                    control={control}
                    render={({ field }) => (
                      <TextField {...field} label="Domicilio completo" size="small" fullWidth />
                    )}
                  />

                  <Typography variant="subtitle1" fontWeight={600}>Información Personal</Typography>
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
                      name="lugar_nacimiento"
                      control={control}
                      render={({ field }) => (
                        <TextField {...field} label="Lugar de nacimiento" size="small" fullWidth />
                      )}
                    />
                    <Controller
                      name="genero"
                      control={control}
                      render={({ field }) => (
                        <TextField {...field} select label="Género" size="small" fullWidth>
                          {generoOptions.map((option) => (
                            <MenuItem key={option.value} value={option.value}>
                              {option.label}
                            </MenuItem>
                          ))}
                        </TextField>
                      )}
                    />
                  </Stack>

                  <Box>
                    <Typography variant="subtitle2" fontWeight={600} gutterBottom sx={{ mt: 2 }}>
                      Documentación registrada (Solo lectura)
                    </Typography>
                    <Stack
                      spacing={1}
                      sx={{
                        border: "1px solid",
                        borderColor: "divider",
                        borderRadius: 1,
                        p: 2,
                        bgcolor: 'action.hover'
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
                    </Stack>
                    <Alert severity="info" sx={{ mt: 1 }}>
                      Para añadir o corregir documentación, por favor acercate a Bedelía.
                    </Alert>
                  </Box>

                  <Stack direction="row" spacing={2} justifyContent="flex-end">
                    <Button
                      type="submit"
                      variant="contained"
                      disabled={mutation.isPending}
                    >
                      {mutation.isPending ? "Guardando..." : "Guardar mis datos"}
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
