import { KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import { isAxiosError } from "axios";
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Container,
  Divider,
  Grid,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import type { ChipProps } from "@mui/material";
import {
  AccessTime,
  CalendarToday,
  CheckCircle,
  History,
  Person,
  Schedule,
} from "@mui/icons-material";

import {
  DocenteClase,
  DocenteClasesResponse,
  fetchDocenteClases,
  marcarDocentePresente,
  registrarDocenteDni,
} from "@/api/asistencia";
import { useAuth } from "@/context/AuthContext";
import { PageHero } from "@/components/ui/GradientTitles";

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

const clockChipSx = {
  ...highlightChipSx,
  fontSize: "1.85rem",
  "& .MuiChip-icon": {
    fontSize: "2.8rem",
    mr: 1,
  },
} satisfies ChipProps["sx"];

const resolveTurnoConfig = (turno: string | undefined | null): TurnoConfig | null => {
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
  const [historial, setHistorial] = useState<DocenteClasesResponse["historial"]>([]);
  const [observaciones, setObservaciones] = useState("");
  const [marcadas, setMarcadas] = useState<Set<number>>(new Set());
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

  const authorized = useMemo(() => {
    if (!user) return false;
    if (user.is_staff || user.is_superuser) return true;
    const roles = (user.roles || []).map((role) => role.toLowerCase());
    return roles.includes("admin") || roles.includes("secretaria") || roles.includes("kiosk");
  }, [user]);

  useEffect(() => {
    const timer = window.setInterval(() => setClock(new Date()), 1_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (authorized) {
      inputRef.current?.focus();
    }
  }, [authorized]);

  useEffect(() => {
    const trimmed = dni.trim();
    if (authorized && trimmed.length === 8 && trimmed !== lastLoggedDni) {
      registrarDocenteDni(trimmed).catch(() => {});
      setLastLoggedDni(trimmed);
    }
  }, [dni, lastLoggedDni, authorized]);

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
      setDni("");
      setLastLoggedDni(null);
      setTimeout(() => inputRef.current?.focus(), 80);
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

  const buscarDocente = async () => {
    if (!authorized) {
      mostrarFeedback({ severity: "warning", message: "Debés iniciar sesión para operar el kiosco." });
      return;
    }
    const trimmed = dni.trim();
    if (trimmed.length !== 8) {
      mostrarFeedback({ severity: "warning", message: "Ingresá un DNI de 8 dígitos para continuar." });
      return;
    }
    setLoadingDocente(true);
    mostrarFeedback({ severity: "info", message: "Verificando información del docente..." });
    try {
      const data = await fetchDocenteClases(trimmed);
      setDocente(data.docente);
      setClases(data.clases);
      setHistorial(data.historial);
      setMarcadas(new Set(data.clases.filter((clase) => clase.ya_registrada).map((clase) => clase.id)));
      if (data.clases.length === 0) {
        mostrarFeedback({ severity: "info", message: "No se encontraron clases programadas para hoy." }, true);
      } else {
        setFeedback(null);
      }
    } catch (err) {
      let message = "No se pudo cargar la información del docente.";
      if (isAxiosError(err) && err.response) {
        const status = err.response.status;
        const detail = err.response.data?.detail || err.response.data?.message;
        if (status === 404) {
          message = "El docente no existe en nuestros registros. Por favor, comunicate con Secretaría.";
        } else if (detail) {
          message = detail;
        }
      }
      mostrarFeedback({ severity: "error", message }, true);
    } finally {
      setLoadingDocente(false);
    }
  };

  const marcarAsistencia = async (claseId: number) => {
    if (!docente) return;
    setSaving(true);
    try {
      const response = await marcarDocentePresente(claseId, {
        dni: docente.dni,
        observaciones: observaciones || undefined,
        via: "docente",
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

  const algunaPendiente = useMemo(() => clases.some((clase) => !clase.ya_registrada), [clases]);

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      buscarDocente();
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
                  title="Acceso kiosco docente"
                  subtitle="Solo usuarios autorizados (admin, secretaría o kiosco) pueden operar esta pantalla."
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
                  autoFocus
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
              <Box display="flex" justifyContent="flex-end">
                <Button variant="text" color="secondary" onClick={handleLogout}>
                  Cerrar sesión
                </Button>
              </Box>
              <Stack spacing={1} textAlign="center">
                <Typography variant="h4" fontWeight={700}>
                  Registro de asistencia docente
                </Typography>
                <Typography variant="body1" color="text.secondary">
                  Ingresá tu DNI, presioná Enter y el sistema registrará tu presencia en el turno correspondiente.
                </Typography>
                <Grid container spacing={2} justifyContent="center">
                  <Grid item xs={12} sx={{ display: "flex", justifyContent: "center" }}>
                    <Chip icon={<CalendarToday />} label={fechaLegible} color="primary" variant="outlined" sx={highlightChipSx} />
                  </Grid>
                  <Grid item xs={12} sx={{ display: "flex", justifyContent: "center" }}>
                    <Chip icon={<AccessTime />} label={horaLegible} color="primary" sx={clockChipSx} />
                  </Grid>
                </Grid>
                {feedback && (
                  <Alert severity={feedback.severity} sx={{ mx: "auto", width: { xs: "100%", sm: "80%", md: "60%" } }}>
                    {feedback.message}
                  </Alert>
                )}
              </Stack>

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
                      onClick={buscarDocente}
                      sx={{ minWidth: 180 }}
                      disabled={loadingDocente || saving}
                    >
                      Buscar docente
                    </Button>
                    <Button variant="text" size="large" color="secondary" onClick={() => volverAInicio()}>
                      Limpiar
                    </Button>
                  </Stack>
                </Stack>
              </Paper>

              {docente && (
                <Grid container spacing={3}>
                  <Grid item xs={12} md={4}>
                    <Card elevation={2}>
                      <CardContent>
                        <Stack spacing={2} alignItems="center">
                          <Avatar sx={{ width: 96, height: 96, fontSize: 36 }}>
                            {docente.nombre
                              .split(" ")
                              .map((part) => part[0])
                              .join("")
                              .slice(0, 2)}
                          </Avatar>
                          <Stack spacing={0.5} alignItems="center">
                            <Typography variant="h6" fontWeight={700}>
                              {docente.nombre}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              DNI {docente.dni}
                            </Typography>
                          </Stack>
                          <Divider flexItem />
                          <Stack spacing={1} width="100%">
                            <Typography variant="subtitle2" sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                              <Person fontSize="small" /> Cursos asignados hoy
                            </Typography>
                            {clases.length === 0 ? (
                              <Alert severity="info" variant="outlined">
                                No se encontraron cátedras para este turno.
                              </Alert>
                            ) : (
                              clases.map((clase) => {
                                const turnoConfig = resolveTurnoConfig(clase.turno);
                                return (
                                  <Paper key={clase.id} variant="outlined" sx={{ p: 1.5, bgcolor: "grey.50" }}>
                                    <Stack spacing={0.75}>
                                      <Typography variant="subtitle2" fontWeight={600}>
                                        {clase.materia}
                                      </Typography>
                                      <Typography variant="body2" color="text.secondary">
                                        {clase.comision}
                                      </Typography>
                                      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                                        {turnoConfig && (
                                          <Chip
                                            size="small"
                                            icon={<Schedule fontSize="small" />}
                                            label={`${turnoConfig.label} · ${turnoConfig.horario}`}
                                            variant="outlined"
                                          />
                                        )}
                                        {clase.horario && (
                                          <Chip size="small" icon={<AccessTime fontSize="small" />} label={clase.horario} />
                                        )}
                                        {clase.aula && <Chip size="small" label={`Aula ${clase.aula}`} />}
                                      </Stack>
                                    </Stack>
                                  </Paper>
                                );
                              })
                            )}
                          </Stack>
                        </Stack>
                      </CardContent>
                    </Card>
                  </Grid>
                  <Grid item xs={12} md={8}>
                    <Stack spacing={3}>
                      <Paper elevation={3} sx={{ p: 3 }}>
                        <Stack spacing={2}>
                          <Typography variant="h6" fontWeight={600}>
                            Paso 2. Confirmá y marcá tu asistencia
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            Si necesitás dejar una observación para la secretaría, escribila antes de registrar tu presente.
                          </Typography>
                          <TextField
                            multiline
                            minRows={2}
                            label="Observaciones (opcional)"
                            value={observaciones}
                            onChange={(event) => setObservaciones(event.target.value)}
                            placeholder="Ej: llegué tarde por problemas de transporte."
                          />
                          {clases.length === 0 ? (
                            <Alert severity="info" variant="outlined">
                              No hay clases programadas para tu DNI en este turno.
                            </Alert>
                          ) : (
                            <Stack spacing={2}>
                              {clases.map((clase) => {
                                const turnoConfig = resolveTurnoConfig(clase.turno);
                                const yaMarcada = clase.ya_registrada || marcadas.has(clase.id);
                                const puedeMarcar = clase.puede_marcar && !yaMarcada;
                                const registradaEn =
                                  clase.registrada_en &&
                                  new Date(clase.registrada_en).toLocaleTimeString("es-AR", {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  });
                                const estadoTexto = yaMarcada
                                  ? registradaEn
                                    ? `Registrada a las ${registradaEn}.`
                                    : "Marcación registrada."
                                  : clase.puede_marcar
                                    ? "Dentro de la ventana de marcado."
                                    : "Fuera de la ventana de marcado.";
                                const estadoColor = yaMarcada
                                  ? "success.main"
                                  : clase.puede_marcar
                                    ? "info.main"
                                    : "error.main";
                                return (
                                  <Paper key={clase.id} variant="outlined" sx={{ p: 2 }}>
                                    <Stack spacing={1.5}>
                                      <Stack spacing={0.25}>
                                        <Typography variant="subtitle1" fontWeight={600}>
                                          {clase.materia}
                                        </Typography>
                                        <Typography variant="body2" color="text.secondary">
                                          {clase.comision}
                                        </Typography>
                                      </Stack>
                                      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                                        {turnoConfig && (
                                          <Chip
                                            size="small"
                                            icon={<Schedule fontSize="small" />}
                                            label={`${turnoConfig.label} · ${turnoConfig.horario}`}
                                            variant="outlined"
                                          />
                                        )}
                                        {clase.horario && (
                                          <Chip size="small" icon={<AccessTime fontSize="small" />} label={`Horario: ${clase.horario}`} />
                                        )}
                                        {clase.aula && <Chip size="small" label={`Aula ${clase.aula}`} />}
                                      </Stack>
                                      {clase.ventana_inicio && clase.ventana_fin && (
                                        <Typography variant="caption" color="text.secondary">
                                          Ventana de marcado: {clase.ventana_inicio} - {clase.ventana_fin}
                                        </Typography>
                                      )}
                                      {clase.umbral_tarde && (
                                        <Typography variant="caption" color="warning.main">
                                          Marca tardía a partir de {clase.umbral_tarde}.
                                        </Typography>
                                      )}
                                      <Stack
                                        direction={{ xs: "column", sm: "row" }}
                                        spacing={1}
                                        justifyContent="space-between"
                                        alignItems={{ xs: "stretch", sm: "center" }}
                                      >
                                        <Typography variant="body2" sx={{ color: estadoColor }}>
                                          {estadoTexto}
                                        </Typography>
                                        <Button
                                          variant={yaMarcada ? "outlined" : "contained"}
                                          color={yaMarcada ? "success" : "primary"}
                                          startIcon={<CheckCircle />}
                                          onClick={() => marcarAsistencia(clase.id)}
                                          disabled={!puedeMarcar || saving}
                                        >
                                          {yaMarcada ? "Marcada" : "Registrar presente"}
                                        </Button>
                                      </Stack>
                                    </Stack>
                                  </Paper>
                                );
                              })}
                            </Stack>
                          )}
                          {!algunaPendiente && clases.length > 0 && (
                            <Alert
                              severity="success"
                              action={
                                <Button color="inherit" size="small" onClick={() => volverAInicio()}>
                                  Nueva marcación
                                </Button>
                              }
                            >
                              Todas las clases del turno fueron marcadas. ¡Gracias!
                            </Alert>
                          )}
                        </Stack>
                      </Paper>

                      <Paper elevation={1} sx={{ p: 3 }}>
                        <Stack spacing={2}>
                          <Typography variant="h6" fontWeight={600} sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                            <History fontSize="small" /> Últimas marcaciones
                          </Typography>
                          {historial.length === 0 ? (
                            <Alert severity="info" variant="outlined">
                              Todavía no hay registros recientes para este docente.
                            </Alert>
                          ) : (
                            <Stack spacing={1.5}>
                              {historial.slice(0, 10).map((item, index) => {
                                const estado = item.estado.toLowerCase();
                                const chipColor: ChipProps["color"] = estado.includes("ausente")
                                  ? "error"
                                  : estado.includes("tarde")
                                    ? "warning"
                                    : "success";
                                return (
                                  <Stack
                                    key={`${item.fecha}-${index}`}
                                    direction={{ xs: "column", sm: "row" }}
                                    spacing={1}
                                    alignItems={{ sm: "center" }}
                                  >
                                    <Typography variant="body2" sx={{ minWidth: 110, fontWeight: 600 }}>
                                      {item.fecha}
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary" sx={{ flexGrow: 1 }}>
                                      {item.turno}
                                    </Typography>
                                    <Chip size="small" label={item.estado} color={chipColor} />
                                    {item.observacion && (
                                      <Typography variant="caption" color="text.secondary">
                                        {item.observacion}
                                      </Typography>
                                    )}
                                  </Stack>
                                );
                              })}
                            </Stack>
                          )}
                        </Stack>
                      </Paper>
                    </Stack>
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
