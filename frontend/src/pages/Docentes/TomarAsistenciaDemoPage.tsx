import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
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
} from "@mui/material";
import {
  CheckCircle,
  Person,
  Save,
  Warning,
  ArrowBack,
} from "@mui/icons-material";
import { useSnackbar } from "notistack";
import dayjs from "dayjs";
import "dayjs/locale/es";

import { PageHero } from "@/components/ui/GradientTitles";

// Mock Data
const MOCK_CLASE = {
  id: 999,
  materia: "Práctica Docente I",
  comision: "1º Año - Comisión A",
  fecha: new Date().toISOString(),
  docente_presente: false,
  alumnos: [
    { estudiante_id: 101, nombre: "Juan", apellido: "Pérez", dni: "40.123.456", estado: "ausente", justificada: false, porcentaje_asistencia: 85 },
    { estudiante_id: 102, nombre: "María", apellido: "Gómez", dni: "41.987.654", estado: "ausente", justificada: false, porcentaje_asistencia: 60 },
    { estudiante_id: 103, nombre: "Carlos", apellido: "López", dni: "39.555.444", estado: "ausente", justificada: true, porcentaje_asistencia: 35 },
    { estudiante_id: 104, nombre: "Ana", apellido: "Martínez", dni: "42.111.222", estado: "ausente", justificada: false, porcentaje_asistencia: 92 },
    { estudiante_id: 105, nombre: "Lucas", apellido: "Rodríguez", dni: "43.333.888", estado: "ausente", justificada: false, porcentaje_asistencia: 75 },
  ],
};

export default function TomarAsistenciaDemoPage() {
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();

  const [docentePresente, setDocentePresente] = useState(false);
  const [presentes, setPresentes] = useState<Set<number>>(new Set());
  const [tardes, setTardes] = useState<Set<number>>(new Set());
  const [hasChanges, setHasChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const fechaLegible = dayjs(MOCK_CLASE.fecha).locale("es").format("dddd D [de] MMMM");

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

  const handleMarcarDocente = () => {
    setIsSaving(true);
    setTimeout(() => {
      setDocentePresente(true);
      setIsSaving(false);
      enqueueSnackbar("Tu asistencia ha sido registrada (DEMO).", { variant: "success" });
    }, 1000);
  };

  const handleGuardarAlumnos = () => {
    setIsSaving(true);
    setTimeout(() => {
      setIsSaving(false);
      setHasChanges(false);
      enqueueSnackbar("Asistencia de alumnos guardada (DEMO).", { variant: "success" });
    }, 1000);
  };

  const getPercentageColor = (percentage: number) => {
    if (percentage < 40) return "#d32f2f"; // Rojo
    if (percentage < 65) return "#ed6c02"; // Naranja
    if (percentage < 80) return "#fbc02d"; // Amarillo
    return "#2e7d32"; // Verde
  };

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "#f4f6f8", pb: 8 }}>
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Button
          startIcon={<ArrowBack />}
          onClick={() => navigate("/docentes")}
          sx={{ mb: 2 }}
        >
          Volver
        </Button>
        
        <Stack spacing={3} mt={2}>
          <Box>
            <Chip label="MODO DEMOSTRACIÓN" color="warning" sx={{ mb: 2 }} />
            <PageHero
              title={`Asistencia: ${MOCK_CLASE.materia}`}
              subtitle={`${MOCK_CLASE.comision} · ${fechaLegible}`}
            />
          </Box>

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
                      icon={<CheckCircle />}
                      label="Presente Registrado"
                      color="success"
                      variant="outlined"
                      sx={{ px: 2, py: 2.5, borderRadius: 2, fontSize: "1rem" }}
                    />
                  ) : (
                    <Button
                      variant="contained"
                      size="large"
                      startIcon={<Person />}
                      onClick={handleMarcarDocente}
                      disabled={isSaving}
                      sx={{ px: 4, py: 1.5, borderRadius: 2 }}
                    >
                      {isSaving ? "Registrando..." : "Marcar mi Presente"}
                    </Button>
                  )}
                </Grid>
              </Grid>
            </CardContent>
          </Card>

          <Paper elevation={0} variant="outlined" sx={{ overflow: "hidden" }}>
            <Box sx={{ p: 2, bgcolor: "#fafafa", borderBottom: "1px solid #eee" }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Typography variant="subtitle1" fontWeight={600}>
                  Listado de Estudiantes ({MOCK_CLASE.alumnos.length})
                </Typography>
                <Button
                  variant="contained"
                  startIcon={<Save />}
                  onClick={handleGuardarAlumnos}
                  disabled={!docentePresente || isSaving || !hasChanges}
                >
                  {isSaving ? "Guardando..." : "Guardar Cambios"}
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
                  {MOCK_CLASE.alumnos.map((alumno, index) => {
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
