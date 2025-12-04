import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  Container,
  Grid,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  Select,
  MenuItem,
} from "@mui/material";
import {
  CheckCircle,
  Person,
  Save,
  Warning,
  ArrowBack,
  AccessTime,
} from "@mui/icons-material";
import { useSnackbar } from "notistack";
import dayjs from "dayjs";
import "dayjs/locale/es";

import {
  fetchClaseAlumnos,
  registrarAsistenciaAlumnos,
  marcarDocentePresente,
} from "@/api/asistencia";
import { useAuth } from "@/context/AuthContext";
import { PageHero } from "@/components/ui/GradientTitles";

export default function TomarAsistenciaPage() {
  const { claseId } = useParams<{ claseId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { enqueueSnackbar } = useSnackbar();
  const queryClient = useQueryClient();

  const [presentes, setPresentes] = useState<Set<number>>(new Set());
  const [tardes, setTardes] = useState<Set<number>>(new Set());
  const [hasChanges, setHasChanges] = useState(false);

  const { data: clase, isLoading, error } = useQuery({
    queryKey: ["clase-alumnos", claseId],
    queryFn: () => fetchClaseAlumnos(Number(claseId)),
    enabled: !!claseId,
  });

  // Inicializar estados cuando carga la data
  useEffect(() => {
    if (clase) {
      const newPresentes = new Set<number>();
      const newTardes = new Set<number>();
      
      clase.alumnos.forEach((alumno) => {
        if (alumno.estado === "presente") {
          newPresentes.add(alumno.estudiante_id);
        } else if (alumno.estado === "tarde") {
          newTardes.add(alumno.estudiante_id);
        }
      });
      setPresentes(newPresentes);
      setTardes(newTardes);
      setHasChanges(false);
    }
  }, [clase]);

  const marcarDocenteMutation = useMutation({
    mutationFn: () =>
      marcarDocentePresente(Number(claseId), {
        dni: user?.dni || "", 
        via: "docente",
      }),
    onSuccess: () => {
      enqueueSnackbar("Tu asistencia ha sido registrada.", { variant: "success" });
      queryClient.invalidateQueries({ queryKey: ["clase-alumnos", claseId] });
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || "Error al registrar tu asistencia.";
      enqueueSnackbar(msg, { variant: "error" });
    },
  });

  const guardarAlumnosMutation = useMutation({
    mutationFn: () =>
      registrarAsistenciaAlumnos(Number(claseId), {
        presentes: Array.from(presentes),
        tardes: Array.from(tardes),
      }),
    onSuccess: () => {
      enqueueSnackbar("Asistencia de alumnos guardada.", { variant: "success" });
      setHasChanges(false);
      queryClient.invalidateQueries({ queryKey: ["clase-alumnos", claseId] });
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || "Error al guardar asistencia.";
      enqueueSnackbar(msg, { variant: "error" });
    },
  });

  const handleCheck = (estudianteId: number, tipo: "presente" | "ausente" | "tarde") => {
    setPresentes((prevPresentes) => {
      const nextPresentes = new Set(prevPresentes);
      setTardes((prevTardes) => {
        const nextTardes = new Set(prevTardes);

        if (tipo === "presente") {
          if (nextPresentes.has(estudianteId)) {
             nextPresentes.delete(estudianteId);
          } else {
            nextPresentes.add(estudianteId);
            nextTardes.delete(estudianteId);
          }
        } else if (tipo === "tarde") {
          if (nextTardes.has(estudianteId)) {
            nextTardes.delete(estudianteId);
          } else {
            nextTardes.add(estudianteId);
            nextPresentes.delete(estudianteId);
          }
        } else if (tipo === "ausente") {
          nextPresentes.delete(estudianteId);
          nextTardes.delete(estudianteId);
        }

        return nextTardes;
      });
      return nextPresentes;
    });
    setHasChanges(true);
  };

  const getPercentageColor = (percentage: number) => {
    if (percentage < 40) return "#d32f2f"; // Rojo
    if (percentage < 65) return "#ed6c02"; // Naranja
    if (percentage < 80) return "#fbc02d"; // Amarillo
    return "#2e7d32"; // Verde
  };

  if (isLoading) return <Container sx={{ py: 4 }}>Cargando clase...</Container>;
  if (error || !clase) return <Container sx={{ py: 4 }}>Error al cargar la clase.</Container>;

  const fechaLegible = dayjs(clase.fecha).locale("es").format("dddd D [de] MMMM");
  const docentePresente = clase.docente_presente;

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "#f4f6f8", pb: 8 }}>
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Button
          startIcon={<ArrowBack />}
          onClick={() => navigate("/docentes/mis-materias")}
          sx={{ mb: 2 }}
        >
          Volver a Mis Materias
        </Button>
        
        <Stack spacing={3} mt={2}>
          <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" alignItems={{ xs: "flex-start", md: "center" }} spacing={2}>
            <PageHero
              title={`Asistencia: ${clase.materia}`}
              subtitle={`${clase.comision} · ${fechaLegible}`}
            />
            
            {clase.otras_clases && clase.otras_clases.length > 0 && (
              <Box sx={{ minWidth: 250 }}>
                <Typography variant="caption" color="text.secondary" display="block" mb={0.5}>
                  Historial de Clases
                </Typography>
                <Select
                  fullWidth
                  size="small"
                  value={clase.clase_id}
                  onChange={(e) => navigate(`/docentes/tomar-asistencia/${e.target.value}`)}
                  sx={{ bgcolor: "white" }}
                >
                  {clase.otras_clases.map((c) => (
                    <MenuItem key={c.id} value={c.id}>
                      {c.descripcion} {c.actual ? "(Actual)" : ""}
                    </MenuItem>
                  ))}
                </Select>
              </Box>
            )}
          </Stack>

          {/* Tarjeta de Estado del Docente */}
          <Card elevation={0} variant="outlined" sx={{ bgcolor: "white" }}>
            <CardContent>
              <Grid container spacing={2} alignItems="center">
                <Grid item xs={12} md={8}>
                  <Stack spacing={1}>
                    <Typography variant="h6" fontWeight={600}>
                      Tu Asistencia
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {docentePresente
                        ? "Ya registraste tu presencia para esta clase. Podés gestionar la asistencia de los alumnos."
                        : "Para habilitar la lista de alumnos, primero debés confirmar tu presencia en el aula."}
                    </Typography>
                  </Stack>
                </Grid>
                <Grid item xs={12} md={4} sx={{ display: "flex", justifyContent: { xs: "flex-start", md: "flex-end" } }}>
                  {docentePresente ? (
                    <Chip
                      icon={
                        clase.docente_categoria_asistencia === "tarde" ? <Warning /> : 
                        clase.docente_categoria_asistencia === "diferida" ? <AccessTime /> : <CheckCircle />
                      }
                      label={
                        clase.docente_categoria_asistencia === "tarde" ? "Presente (Llegada Tarde)" : 
                        clase.docente_categoria_asistencia === "diferida" ? "Presente (Carga Diferida)" : "Presente Registrado"
                      }
                      color={
                        clase.docente_categoria_asistencia === "tarde" ? "warning" : 
                        clase.docente_categoria_asistencia === "diferida" ? "info" : "success"
                      }
                      variant="outlined"
                      sx={{ px: 2, py: 2.5, borderRadius: 2, fontSize: "1rem" }}
                    />
                  ) : (
                    <Button
                      variant="contained"
                      size="large"
                      startIcon={<Person />}
                      onClick={() => marcarDocenteMutation.mutate()}
                      disabled={marcarDocenteMutation.isPending}
                      sx={{ px: 4, py: 1.5, borderRadius: 2 }}
                    >
                      {marcarDocenteMutation.isPending ? "Registrando..." : "Marcar mi Presente"}
                    </Button>
                  )}
                </Grid>
              </Grid>
            </CardContent>
          </Card>

          {/* Lista de Alumnos */}
          <Paper elevation={0} variant="outlined" sx={{ overflow: "hidden" }}>
            <Box sx={{ p: 2, bgcolor: "#fafafa", borderBottom: "1px solid #eee" }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Typography variant="subtitle1" fontWeight={600}>
                  Listado de Estudiantes ({clase.alumnos.length})
                </Typography>
                <Button
                  variant="contained"
                  startIcon={<Save />}
                  onClick={() => guardarAlumnosMutation.mutate()}
                  disabled={!docentePresente || guardarAlumnosMutation.isPending || !hasChanges}
                >
                  {guardarAlumnosMutation.isPending ? "Guardando..." : "Guardar Cambios"}
                </Button>
              </Stack>
            </Box>

            {!docentePresente && (
              <Alert severity="warning" sx={{ m: 2 }} icon={<Warning />}>
                La lista de estudiantes está bloqueada hasta que registres tu asistencia.
              </Alert>
            )}

            <TableContainer sx={{ opacity: docentePresente ? 1 : 0.5, pointerEvents: docentePresente ? "auto" : "none" }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell width="5%">Nº</TableCell>
                    <TableCell width="15%">DNI</TableCell>
                    <TableCell width="25%">Apellido y Nombre</TableCell>
                    <TableCell width="10%" align="center">% Asist.</TableCell>
                    <TableCell width="10%" align="center">Presente</TableCell>
                    <TableCell width="10%" align="center">Ausente</TableCell>
                    <TableCell width="10%" align="center">Tarde</TableCell>
                    <TableCell width="15%">Observaciones</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {clase.alumnos.map((alumno, index) => {
                    const isPresent = presentes.has(alumno.estudiante_id);
                    const isLate = tardes.has(alumno.estudiante_id);
                    const isAbsent = !isPresent && !isLate;
                    const isJustified = alumno.justificada;
                    const percentage = alumno.porcentaje_asistencia || 0;
                    const percentageColor = getPercentageColor(percentage);

                    return (
                      <TableRow key={alumno.estudiante_id} hover>
                        <TableCell>{String(index + 1).padStart(3, '0')}</TableCell>
                        <TableCell>{alumno.dni}</TableCell>
                        <TableCell sx={{ fontWeight: 500 }}>{`${alumno.apellido}, ${alumno.nombre}`}</TableCell>
                        <TableCell align="center">
                          <Chip 
                            label={`${percentage}%`} 
                            size="small" 
                            sx={{ 
                              bgcolor: percentageColor, 
                              color: 'white',
                              fontWeight: 'bold',
                              minWidth: 50
                            }} 
                          />
                        </TableCell>
                        <TableCell align="center">
                          <Checkbox
                            checked={isPresent}
                            onChange={() => handleCheck(alumno.estudiante_id, "presente")}
                            disabled={isJustified}
                            color="success"
                          />
                        </TableCell>
                        <TableCell align="center">
                          <Checkbox
                            checked={isAbsent}
                            onChange={() => handleCheck(alumno.estudiante_id, "ausente")}
                            disabled={isJustified}
                            color="error"
                          />
                        </TableCell>
                        <TableCell align="center">
                          <Checkbox
                            checked={isLate}
                            onChange={() => handleCheck(alumno.estudiante_id, "tarde")}
                            disabled={isJustified}
                            color="warning"
                          />
                        </TableCell>
                        <TableCell>
                          {isJustified ? (
                            <Chip label="Justificada" size="small" variant="outlined" />
                          ) : (
                            null
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Stack>
      </Container>
    </Box>
  );
}
