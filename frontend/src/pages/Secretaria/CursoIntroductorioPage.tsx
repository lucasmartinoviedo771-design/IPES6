import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  IconButton,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import AssignmentIndIcon from "@mui/icons-material/AssignmentInd";
import NotesIcon from "@mui/icons-material/Notes";
import { useSnackbar } from "notistack";

import { useAuth } from "@/context/AuthContext";
import { hasAnyRole } from "@/utils/roles";
import { getErrorMessage } from "@/utils/errors";
import { PageHero, SectionTitlePill } from "@/components/ui/GradientTitles";
import BackButton from "@/components/ui/BackButton";
import { INSTITUTIONAL_TERRACOTTA } from "@/styles/institutionalColors";
import { useCarreras } from "@/hooks/useCarreras";
import { useTurnos } from "@/hooks/useTurnos";
import { ProfesoradoDTO } from "@/api/cargaNotas";
import { TurnoDTO } from "@/api/comisiones";
import { fetchVentanas, VentanaDto } from "@/api/ventanas";
import {
  CursoIntroCohorteDTO,
  CursoIntroCohortePayload,
  CursoIntroPendienteDTO,
  CursoIntroRegistroDTO,
  fetchCursoIntroCohortes,
  crearCursoIntroCohorte,
  actualizarCursoIntroCohorte,
  listarCursoIntroPendientes,
  listarCursoIntroRegistros,
  inscribirCursoIntro,
  registrarCursoIntroAsistencia,
  cerrarCursoIntroRegistro,
} from "@/api/cursoIntro";

type CohorteFormState = {
  nombre: string;
  anio_academico: string;
  profesorado_id: string;
  turno_id: string;
  ventana_id: string;
  fecha_inicio: string;
  fecha_fin: string;
  cupo: string;
  observaciones: string;
};

type InscribirFormState = {
  cohorte_id: string;
  profesorado_id: string;
  turno_id: string;
};

type CierreFormState = {
  nota_final: string;
  asistencias_totales: string;
  resultado: string;
  observaciones: string;
};

const RESULTADO_OPTIONS = [
  { value: "PEN", label: "Pendiente" },
  { value: "APR", label: "Aprobado" },
  { value: "DES", label: "Desaprobado" },
  { value: "AUS", label: "Ausente" },
];

const buildCohorteForm = (): CohorteFormState => ({
  nombre: "",
  anio_academico: String(new Date().getFullYear()),
  profesorado_id: "",
  turno_id: "",
  ventana_id: "",
  fecha_inicio: "",
  fecha_fin: "",
  cupo: "",
  observaciones: "",
});

const buildInscribirForm = (): InscribirFormState => ({
  cohorte_id: "",
  profesorado_id: "",
  turno_id: "",
});

const buildCierreForm = (): CierreFormState => ({
  nota_final: "",
  asistencias_totales: "",
  resultado: "PEN",
  observaciones: "",
});

const CursoIntroductorioPage: React.FC = () => {
  const { user } = useAuth();
  const { enqueueSnackbar } = useSnackbar();

  const { data: profesorados = [] } = useCarreras();
  const { data: turnos = [] } = useTurnos();
  const [cohortes, setCohortes] = useState<CursoIntroCohorteDTO[]>([]);
  const [cohortesLoading, setCohortesLoading] = useState(false);
  const [ventanas, setVentanas] = useState<VentanaDto[]>([]);
  const [ventanasLoading, setVentanasLoading] = useState(false);

  const [cohorteDialogOpen, setCohorteDialogOpen] = useState(false);
  const [cohorteForm, setCohorteForm] = useState<CohorteFormState>(() => buildCohorteForm());
  const [editingCohorteId, setEditingCohorteId] = useState<number | null>(null);
  const [savingCohorte, setSavingCohorte] = useState(false);
  const [creatingCohortesTurnos, setCreatingCohortesTurnos] = useState(false);

  const [pendientesProfesoradoId, setPendientesProfesoradoId] = useState("");
  const [pendientes, setPendientes] = useState<CursoIntroPendienteDTO[]>([]);
  const [pendientesLoading, setPendientesLoading] = useState(false);

  const [registros, setRegistros] = useState<CursoIntroRegistroDTO[]>([]);
  const [registrosLoading, setRegistrosLoading] = useState(false);
  const [registroFiltros, setRegistroFiltros] = useState({
    cohorteId: "",
    profesoradoId: "",
    turnoId: "",
    resultado: "",
    anio: "",
  });

  const [inscribirDialogOpen, setInscribirDialogOpen] = useState(false);
  const [pendienteSeleccionado, setPendienteSeleccionado] = useState<CursoIntroPendienteDTO | null>(null);
  const [inscribirForm, setInscribirForm] = useState<InscribirFormState>(() => buildInscribirForm());
  const [inscribiendo, setInscribiendo] = useState(false);

  const [asistenciaDialogOpen, setAsistenciaDialogOpen] = useState(false);
  const [registroSeleccionado, setRegistroSeleccionado] = useState<CursoIntroRegistroDTO | null>(null);
  const [asistenciaValor, setAsistenciaValor] = useState("");
  const [guardandoAsistencia, setGuardandoAsistencia] = useState(false);

  const [cierreDialogOpen, setCierreDialogOpen] = useState(false);
  const [cierreForm, setCierreForm] = useState<CierreFormState>(() => buildCierreForm());
  const [guardandoCierre, setGuardandoCierre] = useState(false);

  const puedeGestionarCohortes = hasAnyRole(user, ["admin", "secretaria"]);
  const puedeGestionarRegistros = hasAnyRole(user, ["admin", "secretaria", "bedel", "curso_intro"]);
  const cohorteAccionBloqueada = savingCohorte || creatingCohortesTurnos;



  const loadCohortes = useCallback(async () => {
    setCohortesLoading(true);
    try {
      const data = await fetchCursoIntroCohortes();
      setCohortes(data);
    } catch (error) {
      enqueueSnackbar(getErrorMessage(error, "No se pudieron obtener las cohortes."), { variant: "error" });
    } finally {
      setCohortesLoading(false);
    }
  }, [enqueueSnackbar]);

  const loadVentanas = useCallback(async () => {
    setVentanasLoading(true);
    try {
      const data = await fetchVentanas({ tipo: "CURSO_INTRODUCTORIO" });
      setVentanas(data ?? []);
    } catch (error) {
      enqueueSnackbar(getErrorMessage(error, "No se pudieron obtener las ventanas."), { variant: "error" });
      setVentanas([]);
    } finally {
      setVentanasLoading(false);
    }
  }, [enqueueSnackbar]);

  const loadPendientes = useCallback(async () => {
    setPendientesLoading(true);
    try {
      const data = await listarCursoIntroPendientes(
        pendientesProfesoradoId ? Number(pendientesProfesoradoId) : undefined,
      );
      setPendientes(data);
    } catch (error) {
      enqueueSnackbar(getErrorMessage(error, "No se pudo cargar el listado de pendientes."), { variant: "error" });
    } finally {
      setPendientesLoading(false);
    }
  }, [enqueueSnackbar, pendientesProfesoradoId]);

  const loadRegistros = useCallback(async () => {
    setRegistrosLoading(true);
    try {
      const data = await listarCursoIntroRegistros({
        cohorte_id: registroFiltros.cohorteId ? Number(registroFiltros.cohorteId) : undefined,
        profesorado_id: registroFiltros.profesoradoId ? Number(registroFiltros.profesoradoId) : undefined,
        turno_id: registroFiltros.turnoId ? Number(registroFiltros.turnoId) : undefined,
        resultado: registroFiltros.resultado || undefined,
        anio: registroFiltros.anio ? Number(registroFiltros.anio) : undefined,
      });
      setRegistros(data);
    } catch (error) {
      enqueueSnackbar(getErrorMessage(error, "No se pudieron cargar los registros."), { variant: "error" });
    } finally {
      setRegistrosLoading(false);
    }
  }, [enqueueSnackbar, registroFiltros]);

  useEffect(() => {
    loadCohortes();
    loadVentanas();
  }, [loadCohortes, loadVentanas]);

  useEffect(() => {
    loadPendientes();
  }, [loadPendientes]);

  useEffect(() => {
    loadRegistros();
  }, [loadRegistros]);

  const cohorteOptions = useMemo(
    () =>
      cohortes.map((cohorte) => {
        const baseLabel = cohorte.nombre || `Cohorte ${cohorte.anio_academico}`;
        const turnoLabel = cohorte.turno_nombre || "Sin turno fijo";
        return {
          value: cohorte.id,
          label: `${baseLabel} · ${turnoLabel}`,
        };
      }),
    [cohortes],
  );

  const anioOptions = useMemo(() => {
    const set = new Set<number>();
    cohortes.forEach((c) => set.add(c.anio_academico));
    return Array.from(set).sort((a, b) => b - a);
  }, [cohortes]);

  const abrirDialogoCohorte = (cohorte?: CursoIntroCohorteDTO) => {
    if (cohorte) {
      setEditingCohorteId(cohorte.id);
      setCohorteForm({
        nombre: cohorte.nombre || "",
        anio_academico: String(cohorte.anio_academico),
        profesorado_id: cohorte.profesorado_id ? String(cohorte.profesorado_id) : "",
        turno_id: cohorte.turno_id ? String(cohorte.turno_id) : "",
        ventana_id: cohorte.ventana_id ? String(cohorte.ventana_id) : "",
        fecha_inicio: cohorte.fecha_inicio || "",
        fecha_fin: cohorte.fecha_fin || "",
        cupo: cohorte.cupo !== undefined && cohorte.cupo !== null ? String(cohorte.cupo) : "",
        observaciones: cohorte.observaciones || "",
      });
    } else {
      setEditingCohorteId(null);
      setCohorteForm(buildCohorteForm());
    }
    setCohorteDialogOpen(true);
  };

  const cerrarDialogoCohorte = () => {
    setCohorteDialogOpen(false);
    setEditingCohorteId(null);
    setCohorteForm(buildCohorteForm());
  };

  const buildCohortePayload = (): CursoIntroCohortePayload => ({
    nombre: cohorteForm.nombre.trim() || undefined,
    anio_academico: Number(cohorteForm.anio_academico),
    profesorado_id: cohorteForm.profesorado_id ? Number(cohorteForm.profesorado_id) : undefined,
    turno_id: cohorteForm.turno_id ? Number(cohorteForm.turno_id) : undefined,
    ventana_id: cohorteForm.ventana_id ? Number(cohorteForm.ventana_id) : undefined,
    fecha_inicio: cohorteForm.fecha_inicio || undefined,
    fecha_fin: cohorteForm.fecha_fin || undefined,
    cupo: cohorteForm.cupo ? Number(cohorteForm.cupo) : undefined,
    observaciones: cohorteForm.observaciones.trim() || undefined,
  });

  const ensureCohorteBaseValida = () => {
    if (!cohorteForm.anio_academico.trim()) {
      enqueueSnackbar("Indicá el año académico de la cohorte.", { variant: "warning" });
      return false;
    }
    return true;
  };

  const handleGuardarCohorte = async () => {
    if (!ensureCohorteBaseValida()) {
      return;
    }
    const payload = buildCohortePayload();
    setSavingCohorte(true);
    try {
      if (editingCohorteId) {
        await actualizarCursoIntroCohorte(editingCohorteId, payload);
        enqueueSnackbar("Cohorte actualizada.", { variant: "success" });
      } else {
        await crearCursoIntroCohorte(payload);
        enqueueSnackbar("Cohorte creada.", { variant: "success" });
      }
      cerrarDialogoCohorte();
      loadCohortes();
    } catch (error) {
      enqueueSnackbar(getErrorMessage(error, "No se pudo guardar la cohorte."), { variant: "error" });
    } finally {
      setSavingCohorte(false);
    }
  };

  const handleCrearCohortesTodosTurnos = async () => {
    if (editingCohorteId) {
      return;
    }
    if (!ensureCohorteBaseValida()) {
      return;
    }
    const turnosDisponibles = turnos.filter((turno) => Boolean(turno.id));
    if (!turnosDisponibles.length) {
      enqueueSnackbar("No hay turnos configurados para generar cohortes.", { variant: "warning" });
      return;
    }
    const basePayload = buildCohortePayload();
    setCreatingCohortesTurnos(true);
    try {
      for (const turno of turnosDisponibles) {
        await crearCursoIntroCohorte({ ...basePayload, turno_id: turno.id });
      }
      enqueueSnackbar(
        `Se crearon cohortes para ${turnosDisponibles.length} turno${turnosDisponibles.length > 1 ? "s" : ""}.`,
        { variant: "success" },
      );
      cerrarDialogoCohorte();
      loadCohortes();
    } catch (error) {
      enqueueSnackbar(getErrorMessage(error, "No se pudieron crear las cohortes."), { variant: "error" });
    } finally {
      setCreatingCohortesTurnos(false);
    }
  };

  const abrirDialogoInscripcion = (pendiente: CursoIntroPendienteDTO) => {
    setPendienteSeleccionado(pendiente);
    setInscribirForm({
      cohorte_id: registroFiltros.cohorteId,
      profesorado_id: pendiente.profesorados[0]?.id ? String(pendiente.profesorados[0]?.id) : "",
      turno_id: "",
    });
    setInscribirDialogOpen(true);
  };

  const cerrarDialogoInscripcion = () => {
    setPendienteSeleccionado(null);
    setInscribirForm(buildInscribirForm());
    setInscribirDialogOpen(false);
  };

  const handleInscribir = async () => {
    if (!pendienteSeleccionado || !inscribirForm.cohorte_id) {
      enqueueSnackbar("Seleccioná la cohorte donde inscribir.", { variant: "warning" });
      return;
    }
    setInscribiendo(true);
    try {
      await inscribirCursoIntro({
        cohorte_id: Number(inscribirForm.cohorte_id),
        estudiante_id: pendienteSeleccionado.estudiante_id,
        profesorado_id: inscribirForm.profesorado_id ? Number(inscribirForm.profesorado_id) : undefined,
        turno_id: inscribirForm.turno_id ? Number(inscribirForm.turno_id) : undefined,
      });
      enqueueSnackbar("Estudiante inscripto al curso.", { variant: "success" });
      cerrarDialogoInscripcion();
      loadPendientes();
      loadRegistros();
    } catch (error) {
      enqueueSnackbar(getErrorMessage(error, "No se pudo inscribir al estudiante."), { variant: "error" });
    } finally {
      setInscribiendo(false);
    }
  };

  const abrirDialogoAsistencia = (registro: CursoIntroRegistroDTO) => {
    setRegistroSeleccionado(registro);
    setAsistenciaValor(
      registro.asistencias_totales !== undefined && registro.asistencias_totales !== null
        ? String(registro.asistencias_totales)
        : "",
    );
    setAsistenciaDialogOpen(true);
  };

  const cerrarDialogoAsistencia = () => {
    setRegistroSeleccionado(null);
    setAsistenciaValor("");
    setAsistenciaDialogOpen(false);
  };

  const handleGuardarAsistencia = async () => {
    if (!registroSeleccionado) return;
    const total = Number(asistenciaValor);
    if (Number.isNaN(total) || !Number.isInteger(total)) {
      enqueueSnackbar("La asistencia debe ser un número entero.", { variant: "warning" });
      return;
    }
    if (total < 0 || total > 100) {
      enqueueSnackbar("La asistencia debe estar entre 0 y 100.", { variant: "warning" });
      return;
    }
    setGuardandoAsistencia(true);
    try {
      await registrarCursoIntroAsistencia(registroSeleccionado.id, total);
      enqueueSnackbar("Asistencia actualizada.", { variant: "success" });
      cerrarDialogoAsistencia();
      loadRegistros();
    } catch (error) {
      enqueueSnackbar(getErrorMessage(error, "No se pudo registrar la asistencia."), { variant: "error" });
    } finally {
      setGuardandoAsistencia(false);
    }
  };

  const abrirDialogoCierre = (registro: CursoIntroRegistroDTO) => {
    setRegistroSeleccionado(registro);
    setCierreForm({
      nota_final: registro.nota_final !== null && registro.nota_final !== undefined ? String(registro.nota_final) : "",
      asistencias_totales:
        registro.asistencias_totales !== null && registro.asistencias_totales !== undefined
          ? String(registro.asistencias_totales)
          : "",
      resultado: registro.resultado || "PEN",
      observaciones: registro.observaciones || "",
    });
    setCierreDialogOpen(true);
  };

  const cerrarDialogoCierre = () => {
    setRegistroSeleccionado(null);
    setCierreForm(buildCierreForm());
    setCierreDialogOpen(false);
  };

  const handleGuardarCierre = async () => {
    if (!registroSeleccionado) return;
    if (!cierreForm.resultado) {
      enqueueSnackbar("Seleccioná el resultado.", { variant: "warning" });
      return;
    }
    const nota = cierreForm.nota_final ? Number(cierreForm.nota_final) : undefined;
    const asistencias = cierreForm.asistencias_totales ? Number(cierreForm.asistencias_totales) : undefined;
    if (nota !== undefined && Number.isNaN(nota)) {
      enqueueSnackbar("La nota ingresada no es válida.", { variant: "warning" });
      return;
    }
    if (nota !== undefined && (nota < 1 || nota > 10)) {
      enqueueSnackbar("La nota debe estar entre 1 y 10.", { variant: "warning" });
      return;
    }
    if (asistencias !== undefined && Number.isNaN(asistencias)) {
      enqueueSnackbar("La asistencia ingresada no es válida.", { variant: "warning" });
      return;
    }
    if (asistencias !== undefined && (!Number.isInteger(asistencias) || asistencias < 0 || asistencias > 100)) {
      enqueueSnackbar("La asistencia debe ser un número entero entre 0 y 100.", { variant: "warning" });
      return;
    }
    setGuardandoCierre(true);
    try {
      await cerrarCursoIntroRegistro(registroSeleccionado.id, {
        resultado: cierreForm.resultado,
        nota_final: nota,
        asistencias_totales: asistencias,
        observaciones: cierreForm.observaciones.trim() || undefined,
      });
      enqueueSnackbar("Resultado guardado.", { variant: "success" });
      cerrarDialogoCierre();
      loadRegistros();
    } catch (error) {
      enqueueSnackbar(getErrorMessage(error, "No se pudo guardar el resultado."), { variant: "error" });
    } finally {
      setGuardandoCierre(false);
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <BackButton fallbackPath="/secretaria" />
      <PageHero
        title="Curso introductorio"
        subtitle="Gestioná cohortes, asistencias y resultados del Curso Introductorio."
        sx={{ background: `linear-gradient(120deg, ${INSTITUTIONAL_TERRACOTTA} 0%, #8e4a31 100%)` }}
      />

      {/* Cohortes */}
      <SectionTitlePill
        title="Cohortes"
        sx={{ background: `linear-gradient(120deg, ${INSTITUTIONAL_TERRACOTTA} 0%, #8e4a31 100%)` }}
      />
      <Card variant="outlined" sx={{ mb: 3 }}>
        <CardContent>
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={2}
            justifyContent="space-between"
            alignItems={{ xs: "flex-start", sm: "center" }}
          >
            <Typography variant="subtitle1" fontWeight={600}>
              Cohortes registradas
            </Typography>
            {puedeGestionarCohortes && (
              <Button startIcon={<AddIcon />} variant="contained" onClick={() => abrirDialogoCohorte()}>
                Nueva cohorte
              </Button>
            )}
          </Stack>
          {cohortesLoading ? (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
              Cargando cohortes...
            </Typography>
          ) : cohortes.length === 0 ? (
            <Alert severity="info" sx={{ mt: 2 }}>
              Todavía no se registraron cohortes.
            </Alert>
          ) : (
            <Table size="small" sx={{ mt: 2 }}>
              <TableHead>
                <TableRow>
                  <TableCell>Cohorte</TableCell>
                  <TableCell>Año</TableCell>
                  <TableCell>Profesorado</TableCell>
                  <TableCell>Turno</TableCell>
                  <TableCell>Fechas</TableCell>
                  <TableCell>Cupo</TableCell>
                  {puedeGestionarCohortes && <TableCell align="right">Acciones</TableCell>}
                </TableRow>
              </TableHead>
              <TableBody>
                {cohortes.map((cohorte) => (
                  <TableRow key={cohorte.id} hover>
                    <TableCell>{cohorte.nombre || `Cohorte ${cohorte.anio_academico}`}</TableCell>
                    <TableCell>{cohorte.anio_academico}</TableCell>
                    <TableCell>{cohorte.profesorado_nombre || "Todos"}</TableCell>
                    <TableCell>{cohorte.turno_nombre || "-"}</TableCell>
                    <TableCell>
                      {cohorte.fecha_inicio
                        ? `${new Date(cohorte.fecha_inicio).toLocaleDateString()} - ${cohorte.fecha_fin ? new Date(cohorte.fecha_fin).toLocaleDateString() : "-"
                        }`
                        : "-"}
                    </TableCell>
                    <TableCell>{cohorte.cupo ?? "-"}</TableCell>
                    {puedeGestionarCohortes && (
                      <TableCell align="right">
                        <IconButton size="small" onClick={() => abrirDialogoCohorte(cohorte)}>
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Pendientes */}
      <SectionTitlePill
        title="Estudiantes pendientes"
        sx={{ background: `linear-gradient(120deg, ${INSTITUTIONAL_TERRACOTTA} 0%, #8e4a31 100%)` }}
      />
      <Card variant="outlined" sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={2} sx={{ mb: 2 }}>
            <Grid item xs={12} md={4}>
              <TextField
                select
                label="Profesorado"
                size="small"
                fullWidth
                value={pendientesProfesoradoId}
                onChange={(event) => setPendientesProfesoradoId(event.target.value)}
              >
                <MenuItem value="">Todos</MenuItem>
                {profesorados.map((prof) => (
                  <MenuItem key={prof.id} value={String(prof.id)}>
                    {prof.nombre}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
          </Grid>
          {pendientesLoading ? (
            <Typography variant="body2" color="text.secondary">
              Buscando estudiantes...
            </Typography>
          ) : pendientes.length === 0 ? (
            <Alert severity="success">No hay estudiantes pendientes con los filtros aplicados.</Alert>
          ) : (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Estudiante</TableCell>
                  <TableCell>Profesorados</TableCell>
                  <TableCell width={160}>Acciones</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {pendientes.map((pendiente) => (
                  <TableRow key={pendiente.estudiante_id} hover>
                    <TableCell>
                      <Typography variant="body2" fontWeight={600}>
                        {pendiente.estudiante_nombre || "Sin nombre"}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        DNI {pendiente.estudiante_dni}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Stack spacing={0.5}>
                        {pendiente.profesorados.map((prof, idx) => (
                          <Typography key={`${prof.id || "none"}-${idx}`} variant="caption">
                            {prof.nombre} {prof.anio_ingreso ? `- Ingreso ${prof.anio_ingreso}` : ""}
                          </Typography>
                        ))}
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<AssignmentIndIcon fontSize="small" />}
                        onClick={() => abrirDialogoInscripcion(pendiente)}
                        disabled={!puedeGestionarRegistros || cohortes.length === 0}
                      >
                        Inscribir
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Registros */}
      <SectionTitlePill
        title="Registros y asistencias"
        sx={{ background: `linear-gradient(120deg, ${INSTITUTIONAL_TERRACOTTA} 0%, #8e4a31 100%)` }}
      />
      <Card variant="outlined">
        <CardContent>
          <Grid container spacing={2} sx={{ mb: 2 }}>
            <Grid item xs={12} md={3}>
              <TextField
                select
                label="Cohorte"
                size="small"
                fullWidth
                value={registroFiltros.cohorteId}
                onChange={(event) => setRegistroFiltros((prev) => ({ ...prev, cohorteId: event.target.value }))}
              >
                <MenuItem value="">Todas</MenuItem>
                {cohorteOptions.map((option) => (
                  <MenuItem key={option.value} value={String(option.value)}>
                    {option.label}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12} md={3}>
              <TextField
                select
                label="Profesorado"
                size="small"
                fullWidth
                value={registroFiltros.profesoradoId}
                onChange={(event) => setRegistroFiltros((prev) => ({ ...prev, profesoradoId: event.target.value }))}
              >
                <MenuItem value="">Todos</MenuItem>
                {profesorados.map((prof) => (
                  <MenuItem key={prof.id} value={String(prof.id)}>
                    {prof.nombre}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12} md={2}>
              <TextField
                select
                label="Turno"
                size="small"
                fullWidth
                value={registroFiltros.turnoId}
                onChange={(event) => setRegistroFiltros((prev) => ({ ...prev, turnoId: event.target.value }))}
              >
                <MenuItem value="">Todos</MenuItem>
                {turnos.map((turno) => (
                  <MenuItem key={turno.id} value={String(turno.id)}>
                    {turno.nombre}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12} md={2}>
              <TextField
                select
                label="Resultado"
                size="small"
                fullWidth
                value={registroFiltros.resultado}
                onChange={(event) => setRegistroFiltros((prev) => ({ ...prev, resultado: event.target.value }))}
              >
                <MenuItem value="">Todos</MenuItem>
                {RESULTADO_OPTIONS.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12} md={2}>
              <TextField
                select
                label="Año"
                size="small"
                fullWidth
                value={registroFiltros.anio}
                onChange={(event) => setRegistroFiltros((prev) => ({ ...prev, anio: event.target.value }))}
              >
                <MenuItem value="">Todos</MenuItem>
                {anioOptions.map((anio) => (
                  <MenuItem key={anio} value={String(anio)}>
                    {anio}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
          </Grid>
          <Stack direction="row" justifyContent="flex-end" sx={{ mb: 2 }}>
            <Button variant="outlined" onClick={loadRegistros}>
              Actualizar listado
            </Button>
          </Stack>
          {registrosLoading ? (
            <Typography variant="body2" color="text.secondary">
              Cargando registros...
            </Typography>
          ) : registros.length === 0 ? (
            <Alert severity="info">No hay registros para los filtros seleccionados.</Alert>
          ) : (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Estudiante</TableCell>
                  <TableCell>Profesorado</TableCell>
                  <TableCell>Cohorte</TableCell>
                  <TableCell>Resultado</TableCell>
                  <TableCell>Nota</TableCell>
                  <TableCell>Asistencias</TableCell>
                  <TableCell align="right">Acciones</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {registros.map((registro) => (
                  <TableRow key={registro.id} hover>
                    <TableCell>
                      <Typography variant="body2" fontWeight={600}>
                        {registro.estudiante_nombre || "Sin nombre"}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        DNI {registro.estudiante_dni}
                      </Typography>
                    </TableCell>
                    <TableCell>{registro.profesorado_nombre ?? "-"}</TableCell>
                    <TableCell>{registro.cohorte_nombre ?? "-"}</TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={registro.resultado_display}
                        color={
                          registro.resultado === "APR"
                            ? "success"
                            : registro.resultado === "DES"
                              ? "default"
                              : registro.resultado === "AUS"
                                ? "warning"
                                : "info"
                        }
                      />
                    </TableCell>
                    <TableCell>{registro.nota_final ?? "-"}</TableCell>
                    <TableCell>{registro.asistencias_totales ?? "-"}</TableCell>
                    <TableCell align="right">
                      <Stack direction="row" spacing={1} justifyContent="flex-end">
                        <Button
                          size="small"
                          variant="outlined"
                          startIcon={<NotesIcon fontSize="small" />}
                          disabled={!puedeGestionarRegistros || registro.es_historico}
                          onClick={() => abrirDialogoAsistencia(registro)}
                        >
                          Asistencia
                        </Button>
                        <Button
                          size="small"
                          variant="contained"
                          disabled={!puedeGestionarRegistros}
                          onClick={() => abrirDialogoCierre(registro)}
                        >
                          Resultado
                        </Button>
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Diálogo Cohorte */}
      <Dialog open={cohorteDialogOpen} onClose={cerrarDialogoCohorte} fullWidth maxWidth="sm">
        <DialogTitle>{editingCohorteId ? "Editar cohorte" : "Nueva cohorte"}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            <TextField
              label="Nombre"
              value={cohorteForm.nombre}
              onChange={(event) => setCohorteForm((prev) => ({ ...prev, nombre: event.target.value }))}
              fullWidth
            />
            <TextField
              label="Año académico"
              type="number"
              value={cohorteForm.anio_academico}
              onChange={(event) => setCohorteForm((prev) => ({ ...prev, anio_academico: event.target.value }))}
              fullWidth
            />
            <TextField
              select
              label="Profesorado"
              value={cohorteForm.profesorado_id}
              onChange={(event) => setCohorteForm((prev) => ({ ...prev, profesorado_id: event.target.value }))}
              fullWidth
            >
              <MenuItem value="">Todos</MenuItem>
              {profesorados.map((prof) => (
                <MenuItem key={prof.id} value={String(prof.id)}>
                  {prof.nombre}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              label="Turno"
              value={cohorteForm.turno_id}
              onChange={(event) => setCohorteForm((prev) => ({ ...prev, turno_id: event.target.value }))}
              fullWidth
            >
              <MenuItem value="">Sin turno fijo</MenuItem>
              {turnos.map((turno) => (
                <MenuItem key={turno.id} value={String(turno.id)}>
                  {turno.nombre}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              label="Ventana de inscripción"
              value={cohorteForm.ventana_id}
              onChange={(event) => setCohorteForm((prev) => ({ ...prev, ventana_id: event.target.value }))}
              fullWidth
              helperText="Seleccioná la ventana activa del Curso Introductorio."
              disabled={ventanasLoading}
            >
              <MenuItem value="">Sin ventana</MenuItem>
              {ventanas.map((ventana) => (
                <MenuItem key={ventana.id} value={String(ventana.id)}>
                  {`${ventana.desde} - ${ventana.hasta}`}
                </MenuItem>
              ))}
            </TextField>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <TextField
                label="Fecha inicio"
                type="date"
                InputLabelProps={{ shrink: true }}
                value={cohorteForm.fecha_inicio}
                onChange={(event) => setCohorteForm((prev) => ({ ...prev, fecha_inicio: event.target.value }))}
                fullWidth
              />
              <TextField
                label="Fecha fin"
                type="date"
                InputLabelProps={{ shrink: true }}
                value={cohorteForm.fecha_fin}
                onChange={(event) => setCohorteForm((prev) => ({ ...prev, fecha_fin: event.target.value }))}
                fullWidth
              />
            </Stack>
            <TextField
              label="Cupo"
              type="number"
              value={cohorteForm.cupo}
              onChange={(event) => setCohorteForm((prev) => ({ ...prev, cupo: event.target.value }))}
              fullWidth
            />
            <TextField
              label="Observaciones"
              value={cohorteForm.observaciones}
              onChange={(event) => setCohorteForm((prev) => ({ ...prev, observaciones: event.target.value }))}
              fullWidth
              multiline
              minRows={2}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={cerrarDialogoCohorte}>Cancelar</Button>
          {!editingCohorteId && (
            <Button onClick={handleCrearCohortesTodosTurnos} disabled={cohorteAccionBloqueada}>
              {creatingCohortesTurnos ? "Creando..." : "Crear para todos los turnos"}
            </Button>
          )}
          <Button variant="contained" onClick={handleGuardarCohorte} disabled={cohorteAccionBloqueada}>
            {savingCohorte ? "Guardando..." : "Guardar"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Diálogo Inscribir */}
      <Dialog open={inscribirDialogOpen} onClose={cerrarDialogoInscripcion} fullWidth maxWidth="sm">
        <DialogTitle>Inscribir estudiante</DialogTitle>
        <DialogContent dividers>
          {pendienteSeleccionado ? (
            <Stack spacing={2}>
              <Alert severity="info">
                {pendienteSeleccionado.estudiante_nombre || "Sin nombre"} - DNI {pendienteSeleccionado.estudiante_dni}
              </Alert>
              <TextField
                select
                label="Cohorte"
                value={inscribirForm.cohorte_id}
                onChange={(event) => setInscribirForm((prev) => ({ ...prev, cohorte_id: event.target.value }))}
                fullWidth
              >
                <MenuItem value="">Seleccioná una cohorte</MenuItem>
                {cohorteOptions.map((option) => (
                  <MenuItem key={option.value} value={String(option.value)}>
                    {option.label}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                select
                label="Profesorado"
                value={inscribirForm.profesorado_id}
                onChange={(event) => setInscribirForm((prev) => ({ ...prev, profesorado_id: event.target.value }))}
                fullWidth
              >
                <MenuItem value="">Sin especificar</MenuItem>
                {pendienteSeleccionado.profesorados.map((prof, idx) => (
                  <MenuItem key={`${prof.id || "none"}-${idx}`} value={prof.id ? String(prof.id) : ""}>
                    {prof.nombre}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                select
                label="Turno"
                value={inscribirForm.turno_id}
                onChange={(event) => setInscribirForm((prev) => ({ ...prev, turno_id: event.target.value }))}
                fullWidth
              >
                <MenuItem value="">Sin especificar</MenuItem>
                {turnos.map((turno) => (
                  <MenuItem key={turno.id} value={String(turno.id)}>
                    {turno.nombre}
                  </MenuItem>
                ))}
              </TextField>
            </Stack>
          ) : (
            <Alert severity="warning">Seleccioná un estudiante.</Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={cerrarDialogoInscripcion}>Cancelar</Button>
          <Button variant="contained" onClick={handleInscribir} disabled={inscribiendo}>
            {inscribiendo ? "Inscribiendo..." : "Confirmar"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Diálogo Asistencia */}
      <Dialog open={asistenciaDialogOpen} onClose={cerrarDialogoAsistencia} fullWidth maxWidth="xs">
        <DialogTitle>Actualizar asistencia</DialogTitle>
        <DialogContent dividers>
          <TextField
            label="Asistencias registradas"
            type="number"
            inputProps={{ min: 0, max: 100, step: 1 }}
            helperText="Porcentaje entre 0 y 100"
            value={asistenciaValor}
            onChange={(event) => setAsistenciaValor(event.target.value)}
            fullWidth
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={cerrarDialogoAsistencia}>Cancelar</Button>
          <Button variant="contained" onClick={handleGuardarAsistencia} disabled={guardandoAsistencia}>
            {guardandoAsistencia ? "Guardando..." : "Guardar"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Diálogo Cierre */}
      <Dialog open={cierreDialogOpen} onClose={cerrarDialogoCierre} fullWidth maxWidth="sm">
        <DialogTitle>Registrar resultado</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            <TextField
              label="Nota final"
              type="number"
              inputProps={{ min: 1, max: 10, step: 0.1 }}
              helperText="Valor entre 1 y 10"
              value={cierreForm.nota_final}
              onChange={(event) => setCierreForm((prev) => ({ ...prev, nota_final: event.target.value }))}
              fullWidth
            />
            <TextField
              label="Asistencias"
              type="number"
              inputProps={{ min: 0, max: 100, step: 1 }}
              helperText="Porcentaje entre 0 y 100"
              value={cierreForm.asistencias_totales}
              onChange={(event) => setCierreForm((prev) => ({ ...prev, asistencias_totales: event.target.value }))}
              fullWidth
            />
            <TextField
              select
              label="Resultado"
              value={cierreForm.resultado}
              onChange={(event) => setCierreForm((prev) => ({ ...prev, resultado: event.target.value }))}
              fullWidth
            >
              {RESULTADO_OPTIONS.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="Observaciones"
              value={cierreForm.observaciones}
              onChange={(event) => setCierreForm((prev) => ({ ...prev, observaciones: event.target.value }))}
              fullWidth
              multiline
              minRows={2}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={cerrarDialogoCierre}>Cancelar</Button>
          <Button variant="contained" onClick={handleGuardarCierre} disabled={guardandoCierre}>
            {guardandoCierre ? "Guardando..." : "Guardar"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default CursoIntroductorioPage;
