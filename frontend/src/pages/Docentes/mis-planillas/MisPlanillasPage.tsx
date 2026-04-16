import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { listarComisiones, ComisionDTO } from "@/api/comisiones";
import BackButton from "@/components/ui/BackButton";
import { PageHero } from "@/components/ui/GradientTitles";

const currentYear = new Date().getFullYear();

const CUATRIMESTRE_ACTUAL = (): string => {
  const mes = new Date().getMonth() + 1;
  if (mes <= 7) return "1C";
  return "2C";
};

const ESTADO_COLOR: Record<string, "warning" | "success" | "info" | "default"> = {
  BORRADOR: "warning",
  CERRADA: "default",
  REABIERTA: "info",
};

export default function MisPlanillasPage() {
  const navigate = useNavigate();

  const { data: comisiones, isLoading, isError } = useQuery<ComisionDTO[]>({
    queryKey: ["docente", "comisiones", currentYear],
    queryFn: () => listarComisiones({ anio_lectivo: currentYear }),
  });

  return (
    <Box sx={{ p: 3 }}>
      <Stack spacing={3}>
        <BackButton fallbackPath="/docentes" />
        <PageHero
          title="Mis planillas de regularidad"
          subtitle="Cargá y cerrá las planillas de tus materias del cuatrimestre actual."
        />

        <Typography variant="body2" color="text.secondary">
          Período actual: <strong>{currentYear} — {CUATRIMESTRE_ACTUAL()}</strong>.
          La asistencia se pre-carga desde el módulo de asistencia si hay clases
          registradas; de lo contrario, la ingresás a mano antes de cerrar.
        </Typography>

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
            No pudimos cargar tus comisiones. Verificá tus permisos e intentá nuevamente.
          </Alert>
        )}

        {!isLoading && !isError && (comisiones ?? []).length === 0 && (
          <Alert severity="info">
            No tenés comisiones asignadas para {currentYear}.
          </Alert>
        )}

        {!isLoading && !isError && (comisiones ?? []).length > 0 && (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Materia</TableCell>
                  <TableCell>Profesorado</TableCell>
                  <TableCell>Código comisión</TableCell>
                  <TableCell>Cuatrimestre</TableCell>
                  <TableCell align="right">Planilla</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(comisiones ?? []).map((comision) => (
                  <TableRow key={comision.id} hover>
                    <TableCell>{comision.materia_nombre}</TableCell>
                    <TableCell>{comision.profesorado_nombre}</TableCell>
                    <TableCell>
                      <Chip label={comision.codigo || "Sin código"} size="small" />
                    </TableCell>
                    <TableCell>{CUATRIMESTRE_ACTUAL()}</TableCell>
                    <TableCell align="right">
                      <Button
                        size="small"
                        variant="contained"
                        onClick={() =>
                          navigate(
                            `/docentes/mis-planillas/${comision.id}`,
                            {
                              state: {
                                comision,
                                cuatrimestre: CUATRIMESTRE_ACTUAL(),
                                anioLectivo: currentYear,
                              },
                            }
                          )
                        }
                      >
                        Abrir planilla
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
