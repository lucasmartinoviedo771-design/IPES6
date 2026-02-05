import React, { useMemo, useState } from "react";
import dayjs from "dayjs";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Grid,
  Stack,
  Typography,
} from "@mui/material";
import { useSnackbar } from "notistack";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import AssignmentTurnedInIcon from "@mui/icons-material/AssignmentTurnedIn";

import { PageHero, SectionTitlePill } from "@/components/ui/GradientTitles";
import BackButton from "@/components/ui/BackButton";
import {
  autoInscribirCursoIntro,
  CursoIntroCohorteDTO,
  fetchCursoIntroEstado,
} from "@/api/cursoIntro";
import { getErrorMessage } from "@/utils/errors";

const formatDate = (value?: string | null) => {
  if (!value) return "-";
  return dayjs(value).format("DD/MM/YYYY");
};

const CohorteCard: React.FC<{
  cohorte: CursoIntroCohorteDTO;
  disabled: boolean;
  loadingId: number | null;
  onInscribir: (cohorte: CursoIntroCohorteDTO) => void;
}> = ({ cohorte, disabled, loadingId, onInscribir }) => {
  const label = cohorte.nombre || `Cohorte ${cohorte.anio_academico}`;
  const fechas = `${formatDate(cohorte.fecha_inicio)} - ${formatDate(cohorte.fecha_fin)}`;
  const turno = cohorte.turno_nombre || "Turno a confirmar";
  const profesorado = cohorte.profesorado_nombre || "Profesorado general";
  const isLoading = loadingId === cohorte.id;

  return (
    <Card variant="outlined" sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <CardContent sx={{ flexGrow: 1 }}>
        <Stack spacing={1.5}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="h6">{label}</Typography>
            <Chip icon={<CalendarMonthIcon fontSize="small" />} label={`Año ${cohorte.anio_academico}`} />
          </Stack>
          <Typography variant="body2" color="text.secondary">
            Profesorado: {profesorado}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Turno: {turno}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Ventana: {fechas}
          </Typography>
          {cohorte.cupo !== null && (
            <Typography variant="body2" color="text.secondary">
              Cupo estimado: {cohorte.cupo}
            </Typography>
          )}
          {cohorte.observaciones && (
            <Typography variant="body2" color="text.secondary">
              Observaciones: {cohorte.observaciones}
            </Typography>
          )}
        </Stack>
      </CardContent>
      <Box sx={{ p: 2, pt: 0 }}>
        <Button
          variant="contained"
          fullWidth
          onClick={() => onInscribir(cohorte)}
          disabled={disabled || isLoading}
        >
          {isLoading ? "Inscribiendo..." : "Inscribirme"}
        </Button>
      </Box>
    </Card>
  );
};

const CursoIntroductorioEstudiantePage: React.FC = () => {
  const { enqueueSnackbar } = useSnackbar();
  const queryClient = useQueryClient();
  const [loadingCohorteId, setLoadingCohorteId] = useState<number | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["curso-intro", "estado"],
    queryFn: fetchCursoIntroEstado,
    staleTime: 60_000,
  });

  const mutation = useMutation({
    mutationFn: autoInscribirCursoIntro,
    onSuccess: () => {
      enqueueSnackbar("Tu inscripción se registró correctamente.", { variant: "success" });
      setLoadingCohorteId(null);
      queryClient.invalidateQueries({ queryKey: ["curso-intro", "estado"] });
    },
    onError: (error: unknown) => {
      enqueueSnackbar(getErrorMessage(error), { variant: "error" });
      setLoadingCohorteId(null);
    },
  });

  const aprobado = data?.aprobado ?? false;
  const registroActual = data?.registro_actual;
  const registroPendiente = registroActual?.resultado === "PEN";
  const cohortesDisponibles = data?.cohortes_disponibles ?? [];

  const puedeInscribirse = !aprobado && !registroPendiente;

  const estadoMensaje = useMemo(() => {
    if (aprobado) return "Curso introductorio aprobado.";
    if (registroActual) return `Estado actual: ${registroActual.resultado_display}.`;
    return "Aún no te inscribiste al curso introductorio.";
  }, [aprobado, registroActual]);

  const handleInscribir = (cohorte: CursoIntroCohorteDTO) => {
    if (!puedeInscribirse) {
      return;
    }
    setLoadingCohorteId(cohorte.id);
    mutation.mutate({ cohorte_id: cohorte.id });
  };

  return (
    <Box>
      <BackButton fallbackPath="/estudiantes" />
      <PageHero
        title="Curso Introductorio"
        subtitle="Inscribite al curso introductorio institucional y consultá el estado de tu aprobación."
      />

      {isLoading ? (
        <Box sx={{ display: "flex", justifyContent: "center", mt: 6 }}>
          <CircularProgress />
        </Box>
      ) : isError ? (
        <Alert severity="error" sx={{ mt: 3 }}>
          No pudimos cargar la información del curso introductorio. Probá nuevamente en unos instantes.
        </Alert>
      ) : (
        <Stack spacing={4}>
          <Stack spacing={2}>
            <Alert severity={aprobado ? "success" : registroPendiente ? "info" : "warning"}>
              {estadoMensaje}
            </Alert>
            {data?.ventanas?.length ? (
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                {data.ventanas.map((ventana) => (
                  <Chip
                    key={ventana.id}
                    color="success"
                    icon={<AssignmentTurnedInIcon fontSize="small" />}
                    label={`Ventana activa: ${formatDate(ventana.desde)} - ${formatDate(ventana.hasta)}`}
                  />
                ))}
              </Stack>
            ) : (
              <Alert severity="info">
                En este momento no hay una ventana de inscripción activa. Cuando se habilite, la verás en esta sección.
              </Alert>
            )}
          </Stack>

          {registroActual && (
            <Card variant="outlined">
              <CardContent>
                <Stack spacing={1.5}>
                  <Typography variant="h6">Tu última inscripción</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Resultado: {registroActual.resultado_display}
                  </Typography>
                  {registroActual.profesorado_nombre && (
                    <Typography variant="body2" color="text.secondary">
                      Profesorado: {registroActual.profesorado_nombre}
                    </Typography>
                  )}
                  {registroActual.turno_nombre && (
                    <Typography variant="body2" color="text.secondary">
                      Turno: {registroActual.turno_nombre}
                    </Typography>
                  )}
                  {registroActual.resultado_at && (
                    <Typography variant="body2" color="text.secondary">
                      Actualizado: {dayjs(registroActual.resultado_at).format("DD/MM/YYYY")}
                    </Typography>
                  )}
                </Stack>
              </CardContent>
            </Card>
          )}

          <Box>
            <SectionTitlePill title="Inscripciones disponibles" />
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Seleccioná la cohorte que te corresponda. Si ya tenés una inscripción pendiente deberás esperar su resultado.
            </Typography>
            {cohortesDisponibles.length === 0 ? (
              <Alert severity="info">
                No hay cohortes habilitadas en este momento. Consultá nuevamente cuando se habilite una nueva ventana.
              </Alert>
            ) : (
              <Grid container spacing={2}>
                {cohortesDisponibles.map((cohorte) => (
                  <Grid item xs={12} md={6} lg={4} key={cohorte.id}>
                    <CohorteCard
                      cohorte={cohorte}
                      disabled={!puedeInscribirse}
                      loadingId={loadingCohorteId}
                      onInscribir={handleInscribir}
                    />
                  </Grid>
                ))}
              </Grid>
            )}

            {aprobado && (
              <Alert severity="success" sx={{ mt: 3 }}>
                Ya no necesitás volver a inscribirte. ¡Felicitaciones por completar el curso introductorio!
              </Alert>
            )}
            {registroPendiente && (
              <Alert severity="info" sx={{ mt: 3 }}>
                Tenés una inscripción pendiente. Aguardá a que se registre tu asistencia y nota final antes de solicitar un nuevo curso.
              </Alert>
            )}
          </Box>
        </Stack>
      )}
    </Box>
  );
};

export default CursoIntroductorioEstudiantePage;
