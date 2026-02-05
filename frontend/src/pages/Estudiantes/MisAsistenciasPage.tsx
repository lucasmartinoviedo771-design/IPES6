import React, { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Alert,
  Box,
  Card,
  CardContent,
  Chip,
  CircularProgress,
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
  Cancel,
  AccessTime,
  EventNote,
} from "@mui/icons-material";
import dayjs from "dayjs";

import { fetchMisAsistencias, EstudianteAsistenciaItem } from "@/api/asistencia";
import { PageHero } from "@/components/ui/GradientTitles";
import BackButton from "@/components/ui/BackButton";

const EstadoChip = ({ estado, justificada }: { estado: string; justificada: boolean }) => {
  const normalized = estado.toLowerCase();
  let color: "success" | "error" | "warning" | "default" = "default";
  let icon = undefined;
  let label = estado;

  if (normalized === "presente") {
    color = "success";
    icon = <CheckCircle fontSize="small" />;
  } else if (normalized === "ausente") {
    color = "error";
    icon = <Cancel fontSize="small" />;
    if (justificada) {
      color = "default";
      label = "Ausente Justif.";
    }
  } else if (normalized.includes("tarde")) {
    color = "warning";
    icon = <AccessTime fontSize="small" />;
  }

  return <Chip label={label} color={color} icon={icon} size="small" variant="outlined" />;
};

export default function MisAsistenciasPage() {
  const { data: asistencias, isLoading, isError } = useQuery({
    queryKey: ["mis-asistencias"],
    queryFn: fetchMisAsistencias,
  });

  const stats = useMemo(() => {
    if (!asistencias) return null;
    const total = asistencias.length;
    const presentes = asistencias.filter((a) => a.estado.toLowerCase() === "presente").length;
    const ausentes = asistencias.filter((a) => a.estado.toLowerCase() === "ausente" && !a.justificada).length;
    const justificadas = asistencias.filter((a) => a.justificada).length;
    
    // Agrupar por materia
    const porMateria: Record<string, { total: number; presentes: number }> = {};
    asistencias.forEach(a => {
      if (!porMateria[a.materia]) {
        porMateria[a.materia] = { total: 0, presentes: 0 };
      }
      porMateria[a.materia].total++;
      if (a.estado.toLowerCase() === "presente") {
        porMateria[a.materia].presentes++;
      }
    });

    return { total, presentes, ausentes, justificadas, porMateria };
  }, [asistencias]);

  if (isLoading) {
    return (
      <Box sx={{ p: 4, display: "flex", justifyContent: "center" }}>
        <CircularProgress />
      </Box>
    );
  }

  if (isError) {
    return (
      <Container maxWidth="md" sx={{ mt: 4 }}>
        <Alert severity="error">
          No pudimos cargar tu historial de asistencias. Intentá nuevamente más tarde.
        </Alert>
      </Container>
    );
  }

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "#f4f6f8", pb: 8 }}>
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <BackButton fallbackPath="/estudiantes" />
        <Stack spacing={3} mt={2}>
          <PageHero
            title="Mis Asistencias"
            subtitle="Historial completo de tu presentismo por materia."
          />

          {/* Resumen Global */}
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Typography color="text.secondary" gutterBottom>
                    Total Clases
                  </Typography>
                  <Typography variant="h4">{stats?.total || 0}</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Typography color="success.main" gutterBottom fontWeight={600}>
                    Presentes
                  </Typography>
                  <Typography variant="h4" color="success.main">
                    {stats?.presentes || 0}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Typography color="error.main" gutterBottom fontWeight={600}>
                    Ausentes
                  </Typography>
                  <Typography variant="h4" color="error.main">
                    {stats?.ausentes || 0}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Typography color="info.main" gutterBottom fontWeight={600}>
                    Justificadas
                  </Typography>
                  <Typography variant="h4" color="info.main">
                    {stats?.justificadas || 0}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {/* Resumen por Materia */}
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Resumen por Materia
            </Typography>
            <Grid container spacing={2}>
              {Object.entries(stats?.porMateria || {}).map(([materia, data]) => {
                const porcentaje = data.total > 0 ? Math.round((data.presentes / data.total) * 100) : 0;
                return (
                  <Grid item xs={12} sm={6} md={4} key={materia}>
                    <Card variant="outlined">
                      <CardContent>
                        <Typography variant="subtitle2" noWrap title={materia}>
                          {materia}
                        </Typography>
                        <Stack direction="row" justifyContent="space-between" alignItems="center" mt={1}>
                          <Typography variant="body2" color="text.secondary">
                            {data.presentes}/{data.total} clases
                          </Typography>
                          <Chip 
                            label={`${porcentaje}%`} 
                            size="small" 
                            color={porcentaje >= 75 ? "success" : porcentaje >= 60 ? "warning" : "error"} 
                          />
                        </Stack>
                      </CardContent>
                    </Card>
                  </Grid>
                );
              })}
            </Grid>
          </Paper>

          {/* Listado Detallado */}
          <Paper sx={{ p: 0, overflow: "hidden" }}>
            <Box p={2} borderBottom="1px solid #eee">
              <Typography variant="h6">Historial Detallado</Typography>
            </Box>
            <TableContainer sx={{ maxHeight: 600 }}>
              <Table stickyHeader size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Fecha</TableCell>
                    <TableCell>Materia</TableCell>
                    <TableCell>Comisión</TableCell>
                    <TableCell>Estado</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {asistencias?.map((item) => (
                    <TableRow key={item.id} hover>
                      <TableCell>{dayjs(item.fecha).format("DD/MM/YYYY")}</TableCell>
                      <TableCell>{item.materia}</TableCell>
                      <TableCell>{item.comision}</TableCell>
                      <TableCell>
                        <EstadoChip estado={item.estado} justificada={item.justificada} />
                      </TableCell>
                    </TableRow>
                  ))}
                  {asistencias?.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} align="center">
                        <Typography color="text.secondary" sx={{ py: 4 }}>
                          No tenés registros de asistencia todavía.
                        </Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Stack>
      </Container>
    </Box>
  );
}
