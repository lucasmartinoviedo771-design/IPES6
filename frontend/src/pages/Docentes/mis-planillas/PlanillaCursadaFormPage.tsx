import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Divider from "@mui/material/Divider";
import InputAdornment from "@mui/material/InputAdornment";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { enqueueSnackbar } from "notistack";
import {
  generarPlanillasCursada,
  guardarBorradorPlanilla,
  cerrarPlanillaCursada,
  FilaCursadaOut,
  PlanillaCursadaOut,
} from "@/api/planillasCursada";
import BackButton from "@/components/ui/BackButton";
import { PageHero } from "@/components/ui/GradientTitles";
import { ComisionDTO } from "@/api/comisiones";

const ESTADO_COLOR: Record<string, "warning" | "success" | "info" | "default"> = {
  BORRADOR: "warning",
  CERRADA: "default",
  REABIERTA: "info",
};

type FilaEditable = FilaCursadaOut & { _asistencia: string; _situacion: string };

function filaToEditable(f: FilaCursadaOut): FilaEditable {
  return {
    ...f,
    _asistencia: f.asistencia_porcentaje !== null ? String(f.asistencia_porcentaje) : "",
    _situacion: f.situacion,
  };
}

export default function PlanillaCursadaFormPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { comisionId } = useParams<{ comisionId: string }>();
  const queryClient = useQueryClient();

  const state = location.state as {
    comision: ComisionDTO;
    cuatrimestre: string;
    anioLectivo: number;
  } | null;

  const comision = state?.comision;
  const cuatrimestre = state?.cuatrimestre ?? "1C";
  const anioLectivo = state?.anioLectivo ?? new Date().getFullYear();

  const [planillas, setPlanillas] = useState<PlanillaCursadaOut[]>([]);
  const [filasEditables, setFilasEditables] = useState<Record<number, FilaEditable[]>>({});

  // Genera o trae las planillas de esta comisión
  const { isLoading, isError, error } = useQuery({
    queryKey: ["planillas-cursada", comisionId, anioLectivo, cuatrimestre],
    queryFn: () =>
      generarPlanillasCursada({
        comision_id: Number(comisionId),
        anio_lectivo: anioLectivo,
        cuatrimestre,
      }),
    enabled: !!comisionId,
    onSuccess: (data: PlanillaCursadaOut[]) => {
      setPlanillas(data);
      const editable: Record<number, FilaEditable[]> = {};
      data.forEach((p) => {
        editable[p.id] = p.filas.map(filaToEditable);
      });
      setFilasEditables(editable);
    },
  } as any);

  const buildFilasPayload = (filas: FilaEditable[]) =>
    filas.map((f) => ({
      fila_id: f.fila_id,
      asistencia_porcentaje:
        f._asistencia !== "" ? parseInt(f._asistencia, 10) : null,
      excepcion: f.excepcion,
      columnas_datos: f.columnas_datos,
      situacion: f._situacion,
    }));

  const guardarMutation = useMutation({
    mutationFn: ({ planillaId, filas }: { planillaId: number; filas: FilaEditable[] }) =>
      guardarBorradorPlanilla(planillaId, { filas: buildFilasPayload(filas) }),
    onSuccess: () => {
      enqueueSnackbar("Borrador guardado correctamente.", { variant: "success" });
      queryClient.invalidateQueries({ queryKey: ["planillas-cursada", comisionId] });
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message ?? "Error al guardar el borrador.";
      enqueueSnackbar(msg, { variant: "error" });
    },
  });

  const cerrarMutation = useMutation({
    mutationFn: async ({ planillaId, filas }: { planillaId: number; filas: FilaEditable[] }) => {
      // Guardar primero y luego cerrar
      await guardarBorradorPlanilla(planillaId, { filas: buildFilasPayload(filas) });
      return cerrarPlanillaCursada(planillaId);
    },
    onSuccess: (data) => {
      enqueueSnackbar(data.message, { variant: "success" });
      queryClient.invalidateQueries({ queryKey: ["planillas-cursada", comisionId] });
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message ?? "Error al cerrar la planilla.";
      enqueueSnackbar(msg, { variant: "error" });
    },
  });

  const handleAsistenciaChange = (
    planillaId: number,
    filaId: number,
    value: string
  ) => {
    setFilasEditables((prev) => ({
      ...prev,
      [planillaId]: prev[planillaId].map((f) =>
        f.fila_id === filaId ? { ...f, _asistencia: value } : f
      ),
    }));
  };

  const handleSituacionChange = (
    planillaId: number,
    filaId: number,
    value: string
  ) => {
    setFilasEditables((prev) => ({
      ...prev,
      [planillaId]: prev[planillaId].map((f) =>
        f.fila_id === filaId ? { ...f, _situacion: value } : f
      ),
    }));
  };

  if (!comision) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="warning">
          No se encontró información de la comisión. Volvé al listado de planillas.
        </Alert>
        <Button sx={{ mt: 2 }} onClick={() => navigate("/docentes/mis-planillas")}>
          Volver
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Stack spacing={3}>
        <BackButton fallbackPath="/docentes/mis-planillas" />
        <PageHero
          title={comision.materia_nombre}
          subtitle={`${comision.profesorado_nombre} — ${cuatrimestre} ${anioLectivo}`}
        />

        {isLoading && (
          <Stack direction="row" spacing={1} alignItems="center">
            <CircularProgress size={18} />
            <Typography variant="body2" color="text.secondary">
              Cargando planilla...
            </Typography>
          </Stack>
        )}

        {isError && (
          <Alert severity="error">
            {(error as any)?.response?.data?.message ??
              "No se pudo cargar la planilla. Verificá tus permisos."}
          </Alert>
        )}

        {!isLoading && !isError && planillas.length === 0 && (
          <Alert severity="info">
            No hay estudiantes inscriptos activos en esta comisión.
          </Alert>
        )}

        {planillas.map((planilla) => {
          const filas = filasEditables[planilla.id] ?? [];
          const esCerrada = planilla.estado === "CERRADA";
          const esInterProf =
            planilla.profesorado_id !== planilla.profesorado_destino_id;

          return (
            <Paper key={planilla.id} variant="outlined" sx={{ p: 2 }}>
              <Stack spacing={2}>
                {/* Encabezado de planilla */}
                <Stack
                  direction="row"
                  justifyContent="space-between"
                  alignItems="flex-start"
                  flexWrap="wrap"
                  gap={1}
                >
                  <Box>
                    <Typography variant="subtitle1" fontWeight={600}>
                      {planilla.numero}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {planilla.materia_nombre}
                      {esInterProf && (
                        <Tooltip title={`Nota va a: ${planilla.profesorado_destino_nombre}`}>
                          <Chip
                            label={`→ ${planilla.profesorado_destino_nombre}`}
                            size="small"
                            color="info"
                            sx={{ ml: 1 }}
                          />
                        </Tooltip>
                      )}
                    </Typography>
                  </Box>
                  <Chip
                    label={planilla.estado}
                    size="small"
                    color={ESTADO_COLOR[planilla.estado] ?? "default"}
                  />
                </Stack>

                {esCerrada && (
                  <Alert severity="info">
                    Esta planilla está cerrada. Solo Secretaría puede reabrirla.
                  </Alert>
                )}

                {/* Tabla de filas */}
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell width={40}>#</TableCell>
                        <TableCell>Apellido y nombre</TableCell>
                        <TableCell>DNI</TableCell>
                        <TableCell width={120}>Asistencia %</TableCell>
                        <TableCell width={160}>Situación</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {filas.map((fila) => (
                        <TableRow key={fila.fila_id}>
                          <TableCell>{fila.orden}</TableCell>
                          <TableCell>
                            {fila.apellido_nombre}
                            {fila.en_resguardo && (
                              <Tooltip title="Nota en resguardo — legajo incompleto">
                                <Chip
                                  label="Resguardo"
                                  size="small"
                                  color="warning"
                                  sx={{ ml: 1 }}
                                />
                              </Tooltip>
                            )}
                          </TableCell>
                          <TableCell>{fila.dni}</TableCell>
                          <TableCell>
                            <TextField
                              size="small"
                              type="number"
                              value={fila._asistencia}
                              disabled={esCerrada}
                              onChange={(e) =>
                                handleAsistenciaChange(
                                  planilla.id,
                                  fila.fila_id,
                                  e.target.value
                                )
                              }
                              inputProps={{ min: 0, max: 100 }}
                              InputProps={{
                                endAdornment: (
                                  <InputAdornment position="end">%</InputAdornment>
                                ),
                              }}
                              sx={{ width: 100 }}
                            />
                          </TableCell>
                          <TableCell>
                            <TextField
                              size="small"
                              value={fila._situacion}
                              disabled={esCerrada}
                              onChange={(e) =>
                                handleSituacionChange(
                                  planilla.id,
                                  fila.fila_id,
                                  e.target.value
                                )
                              }
                              sx={{ width: 150 }}
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>

                {!esCerrada && (
                  <>
                    <Divider />
                    <Typography variant="caption" color="text.secondary">
                      La asistencia se pre-carga desde el módulo de asistencia si hay
                      clases registradas. Podés modificarla hasta el cierre.
                    </Typography>
                    <Stack direction="row" spacing={2} justifyContent="flex-end">
                      <Button
                        variant="outlined"
                        disabled={guardarMutation.isPending || cerrarMutation.isPending}
                        onClick={() =>
                          guardarMutation.mutate({ planillaId: planilla.id, filas })
                        }
                      >
                        Guardar borrador
                      </Button>
                      <Button
                        variant="contained"
                        color="success"
                        disabled={guardarMutation.isPending || cerrarMutation.isPending}
                        onClick={() =>
                          cerrarMutation.mutate({ planillaId: planilla.id, filas })
                        }
                      >
                        Guardar y cerrar planilla
                      </Button>
                    </Stack>
                  </>
                )}
              </Stack>
            </Paper>
          );
        })}
      </Stack>
    </Box>
  );
}
