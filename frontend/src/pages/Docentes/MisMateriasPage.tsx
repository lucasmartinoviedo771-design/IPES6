import { useMemo } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { listarComisiones, ComisionDTO } from "@/api/comisiones";
import { PageHero } from "@/components/ui/GradientTitles";
import BackButton from "@/components/ui/BackButton";
import { useAuth } from "@/context/AuthContext";

const currentYear = new Date().getFullYear();

export default function DocentesMisMateriasPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: comisiones, isLoading, isError } = useQuery<ComisionDTO[]>({
    queryKey: ["docente", "comisiones", currentYear],
    queryFn: () =>
      listarComisiones({
        anio_lectivo: currentYear,
      }),
  });

  const rows = useMemo(() => comisiones ?? [], [comisiones]);

  return (
    <Box sx={{ p: 3 }}>
      <Stack spacing={3}>
        <BackButton fallbackPath="/docentes" />
        <PageHero
          title="Mis comisiones"
          subtitle="Consulta las materias en las que sos docente y accede al listado de inscriptos."
        />

        {isLoading && (
          <Stack direction="row" spacing={1} alignItems="center">
            <CircularProgress size={18} />
            <Typography variant="body2" color="text.secondary">
              Cargando tus comisiones...
            </Typography>
          </Stack>
        )}

        {isError && (
          <Alert severity="error">
            No pudimos cargar tus comisiones. Intentá nuevamente o verifica tus permisos.
          </Alert>
        )}

        {!isLoading && !isError && rows.length === 0 && (
          <Alert severity="info">No encontramos comisiones asignadas para este año.</Alert>
        )}

        {!isLoading && !isError && rows.length > 0 && (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Materia</TableCell>
                  <TableCell>Plan</TableCell>
                  <TableCell>Profesorado</TableCell>
                  <TableCell>Código comisión</TableCell>
                  <TableCell>Año lectivo</TableCell>
                  <TableCell>Turno</TableCell>
                  <TableCell align="right">Inscriptos</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((comision) => (
                  <TableRow key={comision.id} hover>
                    <TableCell>{comision.materia_nombre}</TableCell>
                    <TableCell>{comision.plan_resolucion}</TableCell>
                    <TableCell>{comision.profesorado_nombre}</TableCell>
                    <TableCell>
                      <Chip label={comision.codigo || "Sin código"} size="small" />
                    </TableCell>
                    <TableCell>{comision.anio_lectivo}</TableCell>
                    <TableCell>{comision.turno_nombre || "-"}</TableCell>
                    <TableCell align="right">
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() =>
                          navigate(
                            `/carreras/${comision.profesorado_id}/planes/${comision.plan_id}/materias/${comision.materia_id}/inscriptos`,
                            {
                              state: {
                                materiaNombre: comision.materia_nombre,
                                planResolucion: comision.plan_resolucion,
                                profesoradoNombre: comision.profesorado_nombre,
                              },
                            },
                          )
                        }
                      >
                        Ver inscriptos
                      </Button>
                      <Button
                        size="small"
                        variant="contained"
                        color="primary"
                        sx={{ ml: 1 }}
                        onClick={async () => {
                          if (!user?.dni) return;
                          try {
                            const today = new Date().toISOString().split('T')[0];
                            // Importamos dinA A1micamente para no romper el ciclo si fuera necesario, aunque aquA A no lo es.
                            const { fetchDocenteClases } = await import("@/api/asistencia");
                            const data = await fetchDocenteClases(user.dni, { fecha: today });
                            const claseHoy = data.clases.find(c => c.comision_id === comision.id);
                            
                            if (claseHoy) {
                              navigate(`/docentes/clases/${claseHoy.id}/asistencia`);
                            } else {
                              alert("No tenés clases programadas para hoy en esta comisión.");
                            }
                          } catch (e) {
                            console.error(e);
                            alert("Error al buscar la clase de hoy.");
                          }
                        }}
                      >
                        Tomar Asistencia
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}

      </Stack>
    </Box>
  );
}
