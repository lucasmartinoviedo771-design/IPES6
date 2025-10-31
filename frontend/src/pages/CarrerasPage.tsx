import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  Divider,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  SelectChangeEvent,
  Skeleton,
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

import { useAuth } from "@/context/AuthContext";
import { hasAnyRole, isOnlyStudent } from "@/utils/roles";
import { fetchCarreras, Carrera } from "@/api/carreras";
import { listarPlanes, PlanDTO } from "@/api/cargaNotas";
import { listarMaterias, MateriaDTO } from "@/api/comisiones";

const STAFF_ROLES = [
  "admin",
  "secretaria",
  "bedel",
  "preinscripciones",
  "coordinador",
  "tutor",
  "jefes",
  "jefa_aaee",
  "consulta",
] as const;

const SELECTION_STORAGE_KEY = "carreras.selection";

const regimenLabel: Record<string, string> = {
  ANU: "Anual",
  PCU: "1.º Cuatrimestre",
  SCU: "2.º Cuatrimestre",
};

const formatoLabel: Record<string, string> = {
  ASI: "Asignatura",
  PRA: "Práctica",
  MOD: "Módulo",
  TAL: "Taller",
  LAB: "Laboratorio",
  SEM: "Seminario",
};

const tipoFormacionLabel: Record<string, string> = {
  FGN: "Formación general",
  FES: "Formación específica",
  PDC: "Práctica docente",
};

type MateriasTableProps = {
  materias: MateriaDTO[];
  loading: boolean;
  onVerInscriptos: (materia: MateriaDTO) => void;
};

const MateriasTable: React.FC<MateriasTableProps> = ({ materias, loading, onVerInscriptos }) => {
  if (loading) {
    return (
      <Box>
        <Skeleton variant="rounded" height={36} sx={{ mb: 1 }} />
        <Skeleton variant="rounded" height={36} sx={{ mb: 1 }} />
        <Skeleton variant="rounded" height={36} sx={{ mb: 1 }} />
      </Box>
    );
  }

  if (!materias.length) {
    return (
      <Alert severity="info" sx={{ mt: 1 }}>
        No encontramos materias para el plan seleccionado.
      </Alert>
    );
  }

  return (
    <TableContainer component={Paper} variant="outlined">
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Año</TableCell>
            <TableCell>Materia</TableCell>
            <TableCell>Cuatrimestre</TableCell>
            <TableCell>Formato</TableCell>
            <TableCell>Tipo de formación</TableCell>
            <TableCell align="right">Inscriptos</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {materias.map((materia) => (
            <TableRow key={materia.id} hover>
              <TableCell>{materia.anio_cursada ?? "-"}</TableCell>
              <TableCell>{materia.nombre}</TableCell>
              <TableCell>{regimenLabel[materia.regimen] ?? materia.regimen}</TableCell>
              <TableCell>{formatoLabel[materia.formato] ?? materia.formato}</TableCell>
              <TableCell>{tipoFormacionLabel[materia.tipo_formacion] ?? materia.tipo_formacion}</TableCell>
              <TableCell align="right">
                <Button
                  size="small"
                  variant="outlined"
                  onClick={(event) => {
                    event.stopPropagation();
                    onVerInscriptos(materia);
                  }}
                >
                  Ver inscriptos
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
};

export default function CarrerasPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const soloAlumno = isOnlyStudent(user);
  const puedeGestionarCarreras = hasAnyRole(user, STAFF_ROLES as unknown as string[]);



  const [profesoradoId, setProfesoradoId] = useState<number | "">("");
  const [planId, setPlanId] = useState<number | "">("");

  const carrerasQuery = useQuery({
    queryKey: ["carreras", "listado"],
    queryFn: fetchCarreras,
    enabled: puedeGestionarCarreras,
  });

  const planesQuery = useQuery({
    queryKey: ["carreras", "planes", profesoradoId],
    queryFn: () => listarPlanes(Number(profesoradoId)),
    enabled: puedeGestionarCarreras && typeof profesoradoId === "number",
  });

  const materiasQuery = useQuery({
    queryKey: ["carreras", "materias", planId],
    queryFn: () => listarMaterias(Number(planId)),
    enabled: puedeGestionarCarreras && typeof planId === "number",
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const payload = {
      profesoradoId: typeof profesoradoId === "number" ? profesoradoId : null,
      planId: typeof planId === "number" ? planId : null,
    };
    window.sessionStorage.setItem(SELECTION_STORAGE_KEY, JSON.stringify(payload));
  }, [profesoradoId, planId]);

  useEffect(() => {
    if (carrerasQuery.data) {
      const stored = (() => {
        try {
          const raw = window.sessionStorage.getItem(SELECTION_STORAGE_KEY);
          if (!raw) return null;
          const parsed = JSON.parse(raw);
          return parsed?.profesoradoId ?? null;
        } catch {
          return null;
        }
      })();

      if (stored && carrerasQuery.data.some((c) => c.id === stored)) {
        setProfesoradoId(stored);
      } else if (carrerasQuery.data.length > 0) {
        setProfesoradoId(carrerasQuery.data[0].id);
      }
    }
  }, [carrerasQuery.data]);

  useEffect(() => {
    if (planesQuery.data) {
      const stored = (() => {
        try {
          const raw = window.sessionStorage.getItem(SELECTION_STORAGE_KEY);
          if (!raw) return null;
          const parsed = JSON.parse(raw);
          return parsed?.planId ?? null;
        } catch {
          return null;
        }
      })();

      if (stored && planesQuery.data.some((p) => p.id === stored)) {
        setPlanId(stored);
      } else if (planesQuery.data.length > 0) {
        setPlanId(planesQuery.data[0].id);
      } else {
        setPlanId("");
      }
    }
  }, [planesQuery.data]);

  const carreraSeleccionada: Carrera | undefined = useMemo(() => {
    if (!carrerasQuery.data) return undefined;
    return carrerasQuery.data.find((carrera) => carrera.id === profesoradoId);
  }, [carrerasQuery.data, profesoradoId]);

  if (soloAlumno) {
    return (
      <Box sx={{ p: 4, maxWidth: 640, margin: "0 auto" }}>
        <Paper variant="outlined" sx={{ p: 3 }}>
          <Typography variant="h5" fontWeight={700} gutterBottom>
            Gestioná tus materias
          </Typography>
          <Typography paragraph color="text.secondary">
            La información detallada de carreras está disponible para personal administrativo. Podés inscribirte o revisar tus materias desde el Portal de Alumnos.
          </Typography>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2} justifyContent="flex-start">
            <Button variant="contained" onClick={() => navigate("/alumnos/inscripcion-materia")}>
              Ir a Inscripción de Materias
            </Button>
            <Button variant="outlined" onClick={() => navigate("/alumnos")}>
              Volver al portal de alumnos
            </Button>
          </Stack>
        </Paper>
      </Box>
    );
  }

  if (!puedeGestionarCarreras) {
    return (
      <Box sx={{ p: 4 }}>
        <Alert severity="warning">
          Tu cuenta no cuenta con permisos para gestionar la información de carreras.
        </Alert>
      </Box>
    );
  }

  const planes = planesQuery.data ?? [];
  const materias = materiasQuery.data ?? [];
  const planSeleccionado: PlanDTO | undefined = useMemo(() => {
    if (typeof planId !== "number") return undefined;
    return planes.find((plan) => plan.id === planId);
  }, [planes, planId]);

  const handleVerInscriptos = (materia: MateriaDTO) => {
    if (typeof planId !== "number" || typeof profesoradoId !== "number") {
      return;
    }
    navigate(`/carreras/${profesoradoId}/planes/${planId}/materias/${materia.id}/inscriptos`, {
      state: {
        materiaNombre: materia.nombre,
        planResolucion: planSeleccionado?.resolucion ?? null,
        profesoradoNombre: carreraSeleccionada?.nombre ?? null,
      },
    });
  };

  return (
    <Box sx={{ p: 3, bgcolor: "#f7f4ea", minHeight: "100vh" }}>
      <Stack spacing={3} maxWidth={1200} mx="auto">
        <Box>
          <Typography variant="h4" fontWeight={800}>
            Gestión de carreras
          </Typography>
          <Typography color="text.secondary">
            Visualizá profesorados, planes vigentes y sus materias asociadas.
          </Typography>
        </Box>

        <Paper variant="outlined" sx={{ p: 3, borderRadius: 3 }}>
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth size="small">
                <InputLabel id="select-profesorado">Profesorado</InputLabel>
                <Select
                  labelId="select-profesorado"
                  label="Profesorado"
                  value={profesoradoId === "" ? "" : String(profesoradoId)}
                  onChange={(event: SelectChangeEvent) => {
                    const value = event.target.value;
                    setProfesoradoId(value ? Number(value) : "");
                    setPlanId("");
                  }}
                  disabled={carrerasQuery.isLoading}
                >
                  {carrerasQuery.data?.map((carrera) => (
                    <MenuItem key={carrera.id} value={String(carrera.id)}>
                      {carrera.nombre}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={6} display="flex" alignItems="center">
              {carrerasQuery.isLoading && <Skeleton variant="rounded" width="100%" height={36} />}
              {!carrerasQuery.isLoading && carreraSeleccionada && (
                <Stack direction="row" spacing={1}>
                  <Chip
                    label={carreraSeleccionada.activo ? "Carrera activa" : "Carrera inactiva"}
                    color={carreraSeleccionada.activo ? "success" : "default"}
                  />
                  <Chip
                    label={carreraSeleccionada.inscripcion_abierta ? "Inscripción abierta" : "Inscripción cerrada"}
                    color={carreraSeleccionada.inscripcion_abierta ? "primary" : "default"}
                  />
                </Stack>
              )}
            </Grid>
          </Grid>
        </Paper>

        <Paper variant="outlined" sx={{ p: 3, borderRadius: 3 }}>
          <Typography variant="h6" fontWeight={700} gutterBottom>
            Planes de estudio
          </Typography>
          {planesQuery.isLoading ? (
            <Skeleton variant="rounded" height={120} />
          ) : planes.length === 0 ? (
            <Alert severity="info">Este profesorado aún no tiene planes de estudio registrados.</Alert>
          ) : (
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth size="small">
                  <InputLabel id="select-plan">Plan</InputLabel>
                  <Select
                    labelId="select-plan"
                    label="Plan"
                    value={planId === "" ? "" : String(planId)}
                    onChange={(event: SelectChangeEvent) => {
                      const value = event.target.value;
                      setPlanId(value ? Number(value) : "");
                    }}
                  >
                    {planes.map((plan) => (
                      <MenuItem key={plan.id} value={String(plan.id)}>
                        {plan.resolucion || `Plan ${plan.id}`}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={6} display="flex" alignItems="center">
                {typeof planId === "number" && (
                  <Typography variant="body2" color="text.secondary">
                    Visualizando materias del plan seleccionado.
                  </Typography>
                )}
              </Grid>
            </Grid>
          )}
        </Paper>

        <Paper variant="outlined" sx={{ p: 3, borderRadius: 3 }}>
          <Typography variant="h6" fontWeight={700} gutterBottom>
            Materias del plan
          </Typography>
          {typeof planId !== "number" && (
            <Alert severity="info">Seleccioná un plan para ver sus materias.</Alert>
          )}
          {typeof planId === "number" && (
            <MateriasTable
              materias={materias}
              loading={materiasQuery.isLoading}
              onVerInscriptos={handleVerInscriptos}
            />
          )}
        </Paper>

        {carrerasQuery.isError && (
          <Alert severity="error">
            No pudimos cargar el listado de profesorados. Intentá nuevamente más tarde.
          </Alert>
        )}
        {planesQuery.isError && (
          <Alert severity="error">
            Ocurrió un problema al obtener los planes de estudio del profesorado seleccionado.
          </Alert>
        )}
        {materiasQuery.isError && (
          <Alert severity="error">
            No fue posible cargar las materias del plan seleccionado.
          </Alert>
        )}


      </Stack>
    </Box>
  );
}
