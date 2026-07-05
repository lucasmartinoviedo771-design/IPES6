/* eslint-disable react-doctor/js-combine-iterations, react-doctor/no-derived-state, react-doctor/rerender-state-only-in-handlers, react-doctor/no-giant-component, react-doctor/no-effect-chain, react-doctor/no-event-handler, react-doctor/prefer-useReducer */
import { KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import { isAxiosError } from "axios";
import Alert from "@mui/material/Alert";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import Container from "@mui/material/Container";
import Grid from "@mui/material/Grid";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import type { ChipProps } from "@mui/material";
import AccessTime from "@mui/icons-material/AccessTime";
import CalendarToday from "@mui/icons-material/CalendarToday";

import {
  DocenteClase,
  DocenteClasesResponse,
  fetchDocenteClases,
  marcarDocentePresente,
  registrarDocenteDni,
} from "@/api/asistencia";
import { useAuth } from "@/context/AuthContext";
import { PageHero } from "@/components/ui/GradientTitles";
import BackButton from "@/components/ui/BackButton";

type TurnoId = "morning" | "afternoon" | "evening";

interface TurnoConfig {
  label: string;
  horario: string;
  marginStart: string;
}

interface FeedbackState {
  severity: "success" | "warning" | "info" | "error";
  message: string;
}

const TURNOS: Record<TurnoId, TurnoConfig> = {
  morning: {
    label: "Turno Mañana",
    horario: "07:45 - 12:45",
    marginStart: "07:35",
  },
  afternoon: {
    label: "Turno Tarde",
    horario: "13:00 - 18:00",
    marginStart: "12:50",
  },
  evening: {
    label: "Turno Vespertino",
    horario: "18:10 - 23:10",
    marginStart: "18:00",
  },
};

const highlightChipSx = {
  px: 3,
  py: 1.5,
  height: "auto",
  fontSize: "1.35rem",
  borderRadius: "999px",
  fontWeight: 600,
  "& .MuiChip-icon": {
    fontSize: "2.2rem",
    mr: 1,
  },
  "& .MuiChip-label": {
    py: 0.5,
  },
} satisfies ChipProps["sx"];

const _clockChipSx = {
  ...highlightChipSx,
  fontSize: "1.85rem",
  "& .MuiChip-icon": {
    fontSize: "2.8rem",
    mr: 1,
  },
} satisfies ChipProps["sx"];

const _resolveTurnoConfig = (turno: string | undefined | null): TurnoConfig | null => {
  if (!turno) return null;
  const normalized = turno.toLowerCase();
  if (normalized.includes("mañana")) return TURNOS.morning;
  if (normalized.includes("tarde")) return TURNOS.afternoon;
  if (normalized.includes("vespertino") || normalized.includes("noche")) return TURNOS.evening;
  return null;
};

const DocenteAsistenciaPage = () => {
  const { user, login, logout, loading } = useAuth();
  const [dni, setDni] = useState("");
  const [docente, setDocente] = useState<DocenteClasesResponse["docente"] | null>(null);
  const [clases, setClases] = useState<DocenteClase[]>([]);
  const [_historial, setHistorial] = useState<DocenteClasesResponse["historial"]>([]);
  const [observaciones, setObservaciones] = useState("");
  const [_marcadas, setMarcadas] = useState<Set<number>>(new Set());
  const [clock, setClock] = useState(() => new Date());
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);
  const [loadingDocente, setLoadingDocente] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lastLoggedDni, setLastLoggedDni] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const resetTimeoutRef = useRef<number | null>(null);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [credentials, setCredentials] = useState({ username: "", password: "" });
  const [attemptingLogin, setAttemptingLogin] = useState(false);

  const isDocenteSession = useMemo(() => {
    if (!user) return false;
    const roles = (user.roles || []).map((role) => role.toLowerCase());
    return roles.includes("docente");
  }, [user]);

  const authorized = useMemo(() => {
    if (!user) return false;
    if (user.is_superuser) return true;
    const roles = (user.roles || []).map((role) => role.toLowerCase());
    return roles.includes("admin") || roles.includes("secretaria") || roles.includes("kiosk") || roles.includes("docente");
  }, [user]);

  useEffect(() => {
    const timer = window.setInterval(() => setClock(new Date()), 1_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (isDocenteSession && user?.dni) {
      const trimmed = user.dni.trim();
      setDni(trimmed);
      setLoadingDocente(true);
      fetchDocenteClases(trimmed)
        .then((data) => {
          setDocente(data.docente);
          setClases(data.clases);
          setHistorial(data.historial || []);
          setFeedback(null);
        })
        .catch(() => {
          setFeedback({ severity: "error", message: "No se pudieron obtener tus clases de hoy." });
        })
        .finally(() => {
          setLoadingDocente(false);
        });
    }
  }, [isDocenteSession, user?.dni]);

  useEffect(() => {
    if (authorized && !isDocenteSession) {
      inputRef.current?.focus();
    }
  }, [authorized, isDocenteSession]);

  useEffect(() => {
    const trimmed = dni.trim();
    if (authorized && !isDocenteSession && trimmed.length === 8 && trimmed !== lastLoggedDni) {
      registrarDocenteDni(trimmed).catch(() => { });
      setLastLoggedDni(trimmed);
    }
  }, [dni, lastLoggedDni, authorized, isDocenteSession]);

  const fechaLegible = useMemo(
    () =>
      clock.toLocaleDateString("es-AR", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      }),
    [clock],
  );

  const horaLegible = useMemo(
    () =>
      clock.toLocaleTimeString("es-AR", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }),
    [clock],
  );

  const limpiarEstado = () => {
    setDocente(null);
    setClases([]);
    setHistorial([]);
    setObservaciones("");
    setMarcadas(new Set());
    setFeedback(null);
    setLoadingDocente(false);
    setSaving(false);
    if (resetTimeoutRef.current) {
      window.clearTimeout(resetTimeoutRef.current);
      resetTimeoutRef.current = null;
    }
  };

  const volverAInicio = (delay = 0) => {
    if (resetTimeoutRef.current) {
      window.clearTimeout(resetTimeoutRef.current);
    }
    const executeReset = () => {
      limpiarEstado();
      if (isDocenteSession) {
        if (user?.dni) {
          const trimmed = user.dni.trim();
          setDni(trimmed);
          setLoadingDocente(true);
          fetchDocenteClases(trimmed)
            .then((data) => {
              setDocente(data.docente);
              setClases(data.clases);
              setHistorial(data.historial || []);
              setFeedback(null);
            })
            .catch(() => {
              setFeedback({ severity: "error", message: "No se pudieron obtener tus clases de hoy." });
            })
            .finally(() => {
              setLoadingDocente(false);
            });
        }
      } else {
        setDni("");
        setLastLoggedDni(null);
        setTimeout(() => inputRef.current?.focus(), 80);
      }
    };
    if (delay > 0) {
      resetTimeoutRef.current = window.setTimeout(executeReset, delay);
    } else {
      executeReset();
    }
  };

  const mostrarFeedback = (state: FeedbackState, autoReset = false, resetDelay = 10_000) => {
    setFeedback(state);
    if (autoReset) {
      volverAInicio(resetDelay);
    }
  };

  const procesarDni = async () => {
    if (!authorized) {
      mostrarFeedback({ severity: "warning", message: "Debés iniciar sesión para registrar asistencias." });
      return;
    }
    const trimmed = dni.trim();
    if (trimmed.length !== 8) {
      mostrarFeedback({ severity: "warning", message: "Ingresá un DNI de 8 dígitos para continuar." });
      return;
    }
    setLoadingDocente(true);
    mostrarFeedback({ severity: "info", message: "Procesando asistencia..." });
    try {
      const data = await fetchDocenteClases(trimmed);
      setDocente(data.docente);
      setClases(data.clases);
      setHistorial(data.historial);
      setMarcadas(new Set(data.clases.filter((clase) => clase.ya_registrada).map((clase) => clase.id)));
      
      if (data.clases.length === 0) {
        mostrarFeedback({ severity: "info", message: "No se encontraron clases programadas para hoy en este turno." }, true);
        return;
      }

      const clasePendiente = data.clases.find(c => c.puede_marcar && !c.ya_registrada);
      if (clasePendiente) {
        setSaving(true);
        try {
          const response = await marcarDocentePresente(clasePendiente.id, {
            dni: data.docente.dni,
            observaciones: observaciones || undefined,
            via: "docente",
            propagar_turno: true,
          });
          
          const updatedData = await fetchDocenteClases(trimmed);
          setClases(updatedData.clases);
          setMarcadas(new Set(updatedData.clases.filter((clase) => clase.ya_registrada).map((clase) => clase.id)));
          
          const message =
            response.mensaje ||
            (response.alerta ? "Llegada tarde registrada. Se notificará a Secretaría." : "Asistencia registrada correctamente para el turno.");
          mostrarFeedback({ severity: response.alerta ? "warning" : "success", message }, true, 8000);
        } catch (err) {
          const message = isAxiosError(err) && err.response ? err.response.data?.detail || err.response.data?.message || "No se pudo registrar la asistencia." : "No se pudo registrar la asistencia.";
          mostrarFeedback({ severity: "error", message }, true);
        } finally {
          setSaving(false);
        }
      } else {
        const todasMarcadas = data.clases.every(c => c.ya_registrada);
        if (todasMarcadas) {
          mostrarFeedback({ severity: "success", message: "Ya tenés la asistencia registrada para tus clases del turno." }, true, 8000);
        } else {
          mostrarFeedback({ severity: "warning", message: "No hay clases dentro de la ventana de marcado actual." }, true, 8000);
        }
      }
    } catch (err) {
      let message = "No se pudo cargar la información del docente.";
      if (isAxiosError(err) && err.response) {
        const status = err.response.status;
        const detail = err.response.data?.detail || err.response.data?.message;
        if (status === 404) {
          message = "El docente no existe en nuestros registros.";
        } else if (detail) {
          message = detail;
        }
      }
      mostrarFeedback({ severity: "error", message }, true);
    } finally {
      setLoadingDocente(false);
    }
  };

  const _marcarAsistencia = async (claseId: number) => {
    if (!docente) return;
    setSaving(true);
    try {
      const response = await marcarDocentePresente(claseId, {
        dni: docente.dni,
        observaciones: observaciones || undefined,
        via: "docente",
        propagar_turno: true,
      });
      setMarcadas((prev) => new Set(prev).add(claseId));
      setClases((prev) =>
        prev.map((clase) =>
          clase.id === claseId
            ? {
              ...clase,
              ya_registrada: true,
              registrada_en: response.registrada_en,
            }
            : clase,
        ),
      );
      const message =
        response.mensaje ||
        (response.alerta ? "Llegada tarde registrada. Se notificará a Secretaría." : "Asistencia registrada correctamente.");
      mostrarFeedback({ severity: response.alerta ? "warning" : "success", message }, true);
    } catch (err) {
      const message =
        isAxiosError(err) && err.response
          ? err.response.data?.detail || err.response.data?.message || "No se pudo registrar la asistencia."
          : "No se pudo registrar la asistencia.";
      mostrarFeedback({ severity: "error", message }, true);

      if (isAxiosError(err) && err.response?.status === 401) {
        await logout();
      }
    } finally {
      setSaving(false);
    }
  };

  const _algunaPendiente = useMemo(() => clases.some((clase) => !clase.ya_registrada), [clases]);

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      procesarDni();
    }
    if (event.key === "Escape") {
      event.preventDefault();
      volverAInicio();
    }
  };

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoginError(null);
    setAttemptingLogin(true);
    try {
      await login(credentials.username, credentials.password);
      setCredentials({ username: "", password: "" });
      setFeedback({ severity: "success", message: "Sesión iniciada. Podés registrar asistencias." });
      setTimeout(() => inputRef.current?.focus(), 150);
    } catch (err) {
      const message = err instanceof Error ? err.message : "No se pudo iniciar sesión.";
      setLoginError(message);
    } finally {
      setAttemptingLogin(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    volverAInicio();
  };

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default", py: 4 }}>
      <Container maxWidth="lg">
        <Stack spacing={3}>
          {!authorized && !loading && (
            <Paper elevation={4} sx={{ p: 4, maxWidth: 420, mx: "auto" }}>
              <Stack spacing={2} component="form" onSubmit={handleLogin}>
                <PageHero
                  title="Acceso - Asistencia Docente"
                  subtitle="Solo usuarios autorizados (admin, secretaría o asistencia) pueden operar esta pantalla."
                  sx={{
                    width: "100%",
                    boxShadow: "none",
                    borderRadius: 3,
                    background: "linear-gradient(135deg, rgba(125,127,110,0.95), rgba(183,105,78,0.95))",
                    textAlign: "center",
                  }}
                />
                <TextField
                  label="Usuario"
                  value={credentials.username}
                  onChange={(event) => setCredentials((prev) => ({ ...prev, username: event.target.value }))}
                  required
                  autoFocus // eslint-disable-line jsx-a11y/no-autofocus
                />
                <TextField
                  label="Contraseña"
                  type="password"
                  value={credentials.password}
                  onChange={(event) => setCredentials((prev) => ({ ...prev, password: event.target.value }))}
                  required
                />
                {loginError && <Alert severity="error">{loginError}</Alert>}
                <Stack direction="row" spacing={1} justifyContent="flex-end">
                  <Button variant="outlined" color="secondary" onClick={() => setCredentials({ username: "", password: "" })}>
                    Limpiar
                  </Button>
                  <Button variant="contained" type="submit" disabled={attemptingLogin}>
                    Ingresar
                  </Button>
                </Stack>
              </Stack>
            </Paper>
          )}

          {authorized && (
            <>
              {isDocenteSession ? (
                <Box display="flex" justifyContent="flex-start" mb={2}>
                  <BackButton fallbackPath="/login" />
                </Box>
              ) : (
                <Box display="flex" justifyContent="flex-end">
                  <Button variant="text" color="secondary" onClick={handleLogout}>
                    Cerrar sesión
                  </Button>
                </Box>
              )}
              <Stack spacing={1} textAlign="center">
                <Typography variant="h4" fontWeight={700}>
                  Registro de asistencia docente
                </Typography>
                <Typography variant="body1" color="text.secondary">
                  {isDocenteSession
                    ? "Confirmá tu asistencia en tus materias asignadas de hoy."
                    : "Ingresá tu DNI, presioná Enter y el sistema registrará tu presencia en el turno correspondiente."}
                </Typography>
                <Grid container spacing={3} justifyContent="center" sx={{ my: 1 }}>
                  <Grid item xs={12} sx={{ display: "flex", justifyContent: "center" }}>
                    <Chip icon={<CalendarToday />} label={fechaLegible} color="primary" variant="outlined" sx={{ ...highlightChipSx, fontSize: "1.5rem", px: 4 }} />
                  </Grid>
                  <Grid item xs={12} sx={{ display: "flex", justifyContent: "center" }}>
                    <Box
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        bgcolor: "primary.main",
                        color: "primary.contrastText",
                        borderRadius: 4,
                        px: { xs: 4, sm: 6 },
                        py: { xs: 2, sm: 3 },
                        boxShadow: "0 8px 32px 0 rgba(183, 105, 78, 0.25)",
                        background: "linear-gradient(135deg, #7d7f6e, #b7694e)",
                      }}
                    >
                      <Stack direction="row" spacing={2} alignItems="center">
                        <AccessTime sx={{ fontSize: { xs: "2.8rem", sm: "3.8rem" } }} />
                        <Typography
                          variant="h2"
                          fontWeight={800}
                          sx={{
                            fontFamily: "monospace",
                            letterSpacing: "1px",
                            fontSize: { xs: "2.8rem", sm: "4rem", md: "4.8rem" },
                            lineHeight: 1,
                          }}
                        >
                          {horaLegible}
                        </Typography>
                      </Stack>
                    </Box>
                  </Grid>
                </Grid>
                {feedback && (
                  <Alert severity={feedback.severity} sx={{ mx: "auto", width: { xs: "100%", sm: "80%", md: "60%" } }}>
                    {feedback.message}
                  </Alert>
                )}
              </Stack>

              {isDocenteSession && loadingDocente && (
                <Box display="flex" justifyContent="center" py={4}>
                  <CircularProgress />
                </Box>
              )}

              {!isDocenteSession && (
                <Paper elevation={3} sx={{ p: 3 }}>
                  <Stack spacing={2}>
                    <Typography variant="h6" fontWeight={600}>
                      Paso 1. Ingresá tu DNI
                    </Typography>
                    <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                      <TextField
                        fullWidth
                        label="DNI del docente"
                        value={dni}
                        onChange={(event) => setDni(event.target.value)}
                        placeholder="Ej: 12345678"
                        inputProps={{ inputMode: "numeric", pattern: "[0-9]*", maxLength: 8 }}
                        disabled={loadingDocente || saving}
                        inputRef={inputRef}
                        onKeyDown={handleKeyDown}
                      />
                      <Button
                        variant="contained"
                        size="large"
                        onClick={procesarDni}
                        sx={{ minWidth: 180 }}
                        disabled={loadingDocente || saving}
                      >
                        Marcar asistencia
                      </Button>
                      <Button variant="text" size="large" color="secondary" onClick={() => volverAInicio()}>
                        Limpiar
                      </Button>
                    </Stack>
                  </Stack>
                </Paper>
              )}

              {docente && (
                <Grid container spacing={3} justifyContent="center">
                  <Grid item xs={12} md={6}>
                    <Card elevation={4} sx={{ borderRadius: 4, overflow: "hidden" }}>
                      <Box sx={{ bgcolor: feedback?.severity === "warning" ? "warning.main" : (feedback?.severity === "error" ? "error.main" : "success.main"), py: 2, px: 3 }}>
                        <Typography variant="h5" color="white" fontWeight={700} textAlign="center">
                          {feedback?.message || "Procesando..."}
                        </Typography>
                      </Box>
                      <CardContent sx={{ pt: 4, pb: 4 }}>
                        <Stack spacing={3} alignItems="center">
                          <Avatar sx={{ width: 120, height: 120, fontSize: 48, bgcolor: "grey.200", color: "grey.700" }}>
                            {docente.nombre
                              .split(" ")
                              .map((part) => part[0])
                              .join("")
                              .slice(0, 2)}
                          </Avatar>
                          <Stack spacing={0.5} alignItems="center">
                            <Typography variant="h5" fontWeight={800}>
                              {docente.nombre}
                            </Typography>
                            <Typography variant="h6" color="text.secondary">
                              DNI {docente.dni}
                            </Typography>
                          </Stack>
                          {isDocenteSession && (
                            <Button variant="outlined" onClick={() => volverAInicio()}>
                              Volver
                            </Button>
                          )}
                        </Stack>
                      </CardContent>
                    </Card>
                  </Grid>
                </Grid>
              )}
            </>
          )}
        </Stack>
      </Container>
    </Box>
  );
};

export default DocenteAsistenciaPage;
