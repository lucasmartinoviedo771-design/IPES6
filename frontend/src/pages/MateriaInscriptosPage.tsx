import React from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  Paper,
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
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import {
  listarInscriptosMateria,
  MateriaDetalleDTO,
  MateriaInscriptoDTO,
  obtenerMateria,
} from "@/api/comisiones";
import {
  CarreraDetalle,
  PlanDetalle,
  obtenerCarrera,
  obtenerPlanCarrera,
} from "@/api/carreras";
import { SectionTitlePill } from "@/components/ui/GradientTitles";
import { useAuth } from "@/context/AuthContext";

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

type LocationState = {
  materiaNombre?: string | null;
  planResolucion?: string | null;
  profesoradoNombre?: string | null;
};

const InscriptosTable: React.FC<{
  inscriptos: MateriaInscriptoDTO[];
  loading: boolean;
}> = ({ inscriptos, loading }) => {
  if (loading) {
    return (
      <Box>
        <Skeleton variant="rounded" height={36} sx={{ mb: 1 }} />
        <Skeleton variant="rounded" height={36} sx={{ mb: 1 }} />
        <Skeleton variant="rounded" height={36} sx={{ mb: 1 }} />
      </Box>
    );
  }

  if (!inscriptos.length) {
    return (
      <Alert severity="info" sx={{ mt: 1 }}>
        No encontramos estudiantes inscriptos para esta materia.
      </Alert>
    );
  }

  return (
    <TableContainer component={Paper} variant="outlined">
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Estudiante</TableCell>
            <TableCell>DNI</TableCell>
            <TableCell>Legajo</TableCell>
            <TableCell>Año</TableCell>
            <TableCell>Estado</TableCell>
            <TableCell>Comisión</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {inscriptos.map((inscripto) => (
            <TableRow key={inscripto.id} hover>
              <TableCell>{inscripto.estudiante}</TableCell>
              <TableCell>{inscripto.dni ?? "-"}</TableCell>
              <TableCell>{inscripto.legajo ?? "-"}</TableCell>
              <TableCell>{inscripto.anio ?? "-"}</TableCell>
              <TableCell>
                {inscripto.estado ? <Chip label={inscripto.estado} size="small" /> : "-"}
              </TableCell>
              <TableCell>{inscripto.comision_codigo ?? "-"}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
};

export default function MateriaInscriptosPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { profesoradoId, planId, materiaId } = useParams();
  const { user } = useAuth();

  const roles = React.useMemo(
    () => new Set((user?.roles ?? []).map((r) => (r || "").toLowerCase().trim())),
    [user],
  );
  const isDocente = roles.has("docente");

  const materiaIdNumber = Number(materiaId);
  const planIdNumber = Number(planId);
  const profesoradoIdNumber = Number(profesoradoId);

  const hasValidMateriaId = Number.isInteger(materiaIdNumber) && materiaIdNumber > 0;
  const hasValidPlanId = Number.isInteger(planIdNumber) && planIdNumber > 0;
  const hasValidProfesoradoId =
    Number.isInteger(profesoradoIdNumber) && profesoradoIdNumber > 0;

  const state = (location.state ?? {}) as LocationState;

  const materiaQuery = useQuery<MateriaDetalleDTO>({
    queryKey: ["materias", "detalle", materiaIdNumber],
    queryFn: () => obtenerMateria(materiaIdNumber),
    enabled: hasValidMateriaId && !isDocente,
  });

  const planQuery = useQuery<PlanDetalle>({
    queryKey: ["carreras", "plan", planIdNumber],
    queryFn: () => obtenerPlanCarrera(planIdNumber),
    enabled: hasValidPlanId && !isDocente,
  });

  const profesorIdForQuery =
    planQuery.data?.profesorado_id ??
    (hasValidProfesoradoId ? profesoradoIdNumber : undefined);

  const carreraQuery = useQuery<CarreraDetalle>({
    queryKey: ["carreras", "detalle", profesorIdForQuery],
    queryFn: () => obtenerCarrera(profesorIdForQuery!),
    enabled: Number.isInteger(profesorIdForQuery ?? NaN) && !isDocente,
  });

  const inscriptosQuery = useQuery<MateriaInscriptoDTO[]>({
    queryKey: ["materias", "inscriptos", materiaIdNumber],
    queryFn: () => listarInscriptosMateria(materiaIdNumber),
    enabled: hasValidMateriaId,
  });

  const materiaDetalle = materiaQuery.data;
  const planDetalle = planQuery.data;
  const carreraDetalle = carreraQuery.data;

  const materiaNombre =
    state.materiaNombre ?? materiaDetalle?.nombre ?? "Materia sin nombre";
  const planLabel =
    state.planResolucion ??
    (planDetalle ? `Resolución ${planDetalle.resolucion}` : null);
  const profesoradoNombre =
    state.profesoradoNombre ?? carreraDetalle?.nombre ?? null;

  const loadingSummary =
    !isDocente && (materiaQuery.isLoading || planQuery.isLoading || carreraQuery.isLoading);

  const summaryError =
    !isDocente && (materiaQuery.isError || planQuery.isError || carreraQuery.isError);

  if (!hasValidMateriaId || !hasValidPlanId) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">
          No pudimos interpretar la materia o el plan desde la URL proporcionada.
        </Alert>
        <Box mt={2}>
          <Button onClick={() => navigate("/carreras")} variant="outlined">
            Volver a Carreras
          </Button>
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3, bgcolor: "#f7f4ea", minHeight: "100vh" }}>
      <Stack spacing={3} maxWidth={1100} mx="auto">
        <Button
          variant="text"
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate(-1)}
          sx={{ alignSelf: "flex-start" }}
        >
          Volver
        </Button>

        <Paper variant="outlined" sx={{ p: 3, borderRadius: 3 }}>
          {loadingSummary ? (
            <Skeleton variant="text" width="60%" />
          ) : summaryError ? (
            <Alert severity="error">
              No pudimos obtener toda la información de la materia o el plan. Verificá tus
              permisos e intentá nuevamente.
            </Alert>
          ) : (
            <Stack spacing={1}>
              <SectionTitlePill title={materiaNombre ?? "Materia"} />
              <Typography color="text.secondary">
                {[profesoradoNombre, planLabel].filter(Boolean).join(" · ")}
              </Typography>
              {materiaDetalle && (
                <Stack direction="row" spacing={1} flexWrap="wrap">
                  <Chip
                    label={`Año ${materiaDetalle.anio_cursada ?? "-"}`}
                    size="small"
                    color="default"
                  />
                  <Chip
                    label={regimenLabel[materiaDetalle.regimen] ?? materiaDetalle.regimen}
                    size="small"
                    color="default"
                  />
                  <Chip
                    label={formatoLabel[materiaDetalle.formato] ?? materiaDetalle.formato}
                    size="small"
                    color="default"
                  />
                  <Chip
                    label={
                      tipoFormacionLabel[materiaDetalle.tipo_formacion] ??
                      materiaDetalle.tipo_formacion
                    }
                    size="small"
                    color="default"
                  />
                  <Chip
                    label={`${materiaDetalle.horas_semana} h/sem`}
                    size="small"
                    color="default"
                  />
                </Stack>
              )}
            </Stack>
          )}
        </Paper>

        <Paper variant="outlined" sx={{ p: 3, borderRadius: 3 }}>
          <Typography variant="h6" fontWeight={700} gutterBottom>
            Estudiantes inscriptos
          </Typography>
          {inscriptosQuery.isError ? (
            <Alert severity="error">
              No pudimos cargar los inscriptos de esta materia. Intentá nuevamente más tarde.
            </Alert>
          ) : (
            <InscriptosTable
              inscriptos={inscriptosQuery.data ?? []}
              loading={inscriptosQuery.isLoading || inscriptosQuery.isFetching}
            />
          )}
        </Paper>
      </Stack>
    </Box>
  );
}
