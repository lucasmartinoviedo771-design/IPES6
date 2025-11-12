import React, { useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  CircularProgress,
  Divider,
  Grid,
  IconButton,
  MenuItem,
  Paper,
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
import DeleteIcon from "@mui/icons-material/Delete";
import SearchIcon from "@mui/icons-material/Search";
import { useMutation, useQuery } from "@tanstack/react-query";
import { enqueueSnackbar } from "notistack";

import {
  ActaAlumnoPayload,
  ActaCreatePayload,
  ActaMetadataDTO,
  ActaMetadataDocente,
  MesaResumenDTO,
  buscarMesaPorCodigo,
  crearActaExamen,
  fetchActaMetadata,
} from "@/api/cargaNotas";
import { fetchEstudianteAdminDetail } from "@/api/alumnos";

const DOCENTE_ROLES = [
  { value: "PRES", label: "Presidente" },
  { value: "VOC1", label: "Vocal 1" },
  { value: "VOC2", label: "Vocal 2" },
];

const DOCENTE_ROL_LABEL: Record<string, string> = {
  PRES: "Presidente",
  VOC1: "Vocal 1",
  VOC2: "Vocal 2",
};

const MESA_EXAMEN_TIPO_LABEL: Record<string, string> = {
  FIN: "Ordinaria",
  EXT: "Extraordinaria",
  ESP: "Especial",
};

const getMesaTipoNombre = (tipo: string) => MESA_EXAMEN_TIPO_LABEL[tipo] ?? tipo;

const ACTA_TIPOS = [
  { value: "REG", label: "Acta de alumnos regulares" },
  { value: "LIB", label: "Acta de alumnos libres" },
];

type DocenteState = {
  rol: string;
  docente_id: number | null;
  nombre: string;
  dni: string;
  inputValue: string;
};

type AlumnoState = ActaAlumnoPayload & { internoId: string };

type ActaExamenFormProps = {
  strict?: boolean;
  title?: string;
  subtitle?: string;
  successMessage?: string;
};

const createEmptyDocentes = (): DocenteState[] =>
  DOCENTE_ROLES.map((item) => ({
    rol: item.value,
    docente_id: null,
    nombre: "",
    dni: "",
    inputValue: "",
  }));

const createEmptyAlumno = (orden: number): AlumnoState => ({
  internoId: `${orden}-${Date.now()}-${Math.random()}`,
  numero_orden: orden,
  permiso_examen: "",
  dni: "",
  apellido_nombre: "",
  examen_escrito: "",
  examen_oral: "",
  calificacion_definitiva: "",
  observaciones: "",
});

const isAusente = (value: string) => value === "AJ" || value === "AI";

const clasificarNota = (value: string) => {
  if (isAusente(value)) return "ausente";
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "desaprobado";
  return numeric >= 6 ? "aprobado" : "desaprobado";
};

const ActaExamenForm: React.FC<ActaExamenFormProps> = ({
  strict = true,
  title = "Generar acta de examen",
  subtitle = "Complete los datos del acta y registre los resultados obtenidos por cada estudiante.",
  successMessage = "Acta generada correctamente.",
}) => {
  const metadataQuery = useQuery<ActaMetadataDTO>({
    queryKey: ["acta-examen-metadata"],
    queryFn: fetchActaMetadata,
  });

  const [tipo, setTipo] = useState<"REG" | "LIB">("REG");
  const [profesoradoId, setProfesoradoId] = useState<string>("");
  const [planId, setPlanId] = useState<string>("");
  const [materiaId, setMateriaId] = useState<string>("");
  const [fecha, setFecha] = useState<string>(dayjs().format("YYYY-MM-DD"));
  const [folio, setFolio] = useState<string>("");
  const [libro, setLibro] = useState<string>("");
  const [observaciones, setObservaciones] = useState<string>("");
  const [docentes, setDocentes] = useState<DocenteState[]>(createEmptyDocentes);
  const [alumnos, setAlumnos] = useState<AlumnoState[]>([createEmptyAlumno(1)]);
  const [, setLoadingAlumnoDni] = useState<string | null>(null);
  const [mesaCodigo, setMesaCodigo] = useState<string>("");
  const [mesaBuscando, setMesaBuscando] = useState(false);
  const [mesaBusquedaError, setMesaBusquedaError] = useState<string | null>(null);
  const [mesaSeleccionada, setMesaSeleccionada] = useState<MesaResumenDTO | null>(null);

  const metadata = metadataQuery.data;
  const notaOptions = metadata?.nota_opciones ?? [];

  const profesorados = metadata?.profesorados ?? [];
  const docentesDisponibles = metadata?.docentes ?? [];

  const applyMesaSeleccionada = (mesa: MesaResumenDTO) => {
    if (mesa.profesorado_id) {
      setProfesoradoId(String(mesa.profesorado_id));
    }
    if (mesa.plan_id) {
      setPlanId(String(mesa.plan_id));
    }
    if (mesa.materia_id) {
      setMateriaId(String(mesa.materia_id));
    }
    if (mesa.fecha) {
      setFecha(dayjs(mesa.fecha).format("YYYY-MM-DD"));
    }
    if (mesa.modalidad === "LIB") {
      setTipo("LIB");
    } else if (mesa.modalidad === "REG") {
      setTipo("REG");
    }
    if (mesa.docentes && mesa.docentes.length) {
      setDocentes((prev) =>
        prev.map((doc) => {
          const remoto = mesa.docentes?.find((item) => item.rol === doc.rol);
          if (!remoto) {
            return doc;
          }
          return {
            ...doc,
            docente_id: remoto.docente_id ?? null,
            nombre: remoto.nombre ?? "",
            dni: remoto.dni ?? "",
            inputValue: remoto.nombre ?? "",
          };
        })
      );
    }
  };

  const handleBuscarMesa = async () => {
    const code = mesaCodigo.trim();
    if (!code) {
      setMesaBusquedaError("Ingresá un código de mesa.");
      setMesaSeleccionada(null);
      return;
    }
    setMesaBuscando(true);
    setMesaBusquedaError(null);
    try {
      const encontrada = await buscarMesaPorCodigo(code);
      if (!encontrada) {
        setMesaSeleccionada(null);
        setMesaBusquedaError("No se encontró una mesa con ese código.");
        return;
      }
      setMesaSeleccionada(encontrada);
      applyMesaSeleccionada(encontrada);
    } catch (error) {
      console.error("No se pudo buscar la mesa", error);
      setMesaBusquedaError("No se pudo buscar la mesa. Intenta nuevamente.");
    } finally {
      setMesaBuscando(false);
    }
  };
  const docenteOptions = useMemo(
    () =>
      docentesDisponibles.map((doc) => {
        const labelDni = doc.dni ?? "";
        return labelDni ? `${labelDni} - ${doc.nombre}` : doc.nombre;
      }),
    [docentesDisponibles],
  );

  const selectedProfesorado = useMemo(
    () => profesorados.find((p) => String(p.id) === profesoradoId),
    [profesorados, profesoradoId],
  );

  const planesDisponibles = selectedProfesorado?.planes ?? [];

  const selectedPlan = useMemo(
    () => planesDisponibles.find((p) => String(p.id) === planId),
    [planesDisponibles, planId],
  );

  const materiasDisponibles = selectedPlan?.materias ?? [];

  useEffect(() => {
    if (selectedPlan && !selectedPlan.materias.some((m) => String(m.id) === materiaId)) {
      setMateriaId("");
    }
  }, [selectedPlan, materiaId]);

  useEffect(() => {
    if (selectedProfesorado && !selectedProfesorado.planes.some((p) => String(p.id) === planId)) {
      setPlanId("");
      setMateriaId("");
    }
  }, [selectedProfesorado, planId]);

  const summary = useMemo(() => {
    const total = alumnos.length;
    let aprobados = 0;
    let desaprobados = 0;
    let ausentes = 0;
    alumnos.forEach((alumno) => {
      const categoria = clasificarNota(alumno.calificacion_definitiva);
      if (categoria === "aprobado") aprobados += 1;
      if (categoria === "desaprobado") desaprobados += 1;
      if (categoria === "ausente") ausentes += 1;
    });
    return { total, aprobados, desaprobados, ausentes };
  }, [alumnos]);

  const mutation = useMutation({
    mutationFn: (payload: ActaCreatePayload) => crearActaExamen(payload),
    onSuccess: (response) => {
      enqueueSnackbar(response.message || successMessage, { variant: "success" });
      setDocentes(createEmptyDocentes());
      setAlumnos([createEmptyAlumno(1)]);
      setFolio("");
      setLibro("");
      setObservaciones("");
    },
    onError: (error: any) => {
      enqueueSnackbar(error?.response?.data?.message || "No se pudo generar el acta.", { variant: "error" });
    },
  });

  const handleAgregarAlumno = () => {
    setAlumnos((prev) => [...prev, createEmptyAlumno(prev.length + 1)]);
  };

  const handleEliminarAlumno = (internoId: string) => {
    setAlumnos((prev) => {
      const filtered = prev.filter((item) => item.internoId !== internoId);
      return filtered.map((item, index) => ({ ...item, numero_orden: index + 1 }));
    });
  };

  const updateAlumno = (internoId: string, patch: Partial<AlumnoState>) => {
    setAlumnos((prev) => prev.map((item) => (item.internoId === internoId ? { ...item, ...patch } : item)));
  };

  const handleAlumnoDniChange = async (internoId: string, dni: string) => {
    const numeric = dni.replace(/\D/g, "").slice(0, 8);

    updateAlumno(internoId, {
      dni: numeric,
      apellido_nombre: "",
    });

    if (numeric.length !== 8) {
      return;
    }

    try {
      setLoadingAlumnoDni(internoId);
      const data = await fetchEstudianteAdminDetail(numeric);
      setAlumnos((prev) =>
        prev.map((item) =>
          item.internoId === internoId && item.dni === numeric
            ? { ...item, apellido_nombre: `${data.apellido}, ${data.nombre}` }
            : item,
        ),
      );
    } catch (error: any) {
      enqueueSnackbar(error?.response?.data?.message || "No se encontr\u00f3 un estudiante con ese DNI.", {
        variant: "error",
      });
    } finally {
      setLoadingAlumnoDni((current) => (current === internoId ? null : current));
    }
  };

  const updateDocente = (index: number, patch: Partial<DocenteState>) => {
    setDocentes((prev) =>
      prev.map((doc, idx) => (idx === index ? { ...doc, ...patch } : doc)),
    );
  };

  const handleDocenteInputChange = (index: number, rawValue: string) => {
    const value = rawValue;
    const trimmed = value.trim();

    if (!trimmed) {
      updateDocente(index, {
        docente_id: null,
        dni: "",
        nombre: "",
        inputValue: "",
      });
      return;
    }

    const normalized = trimmed.replace(/\s+/g, " ");
    const hyphenIndex = normalized.indexOf("-");
    const dniSegmentRaw =
      hyphenIndex >= 0 ? normalized.slice(0, hyphenIndex).trim() : normalized;
    const sanitizedDni = dniSegmentRaw.replace(/\D/g, "");

    if (sanitizedDni.length !== 8) {
      const nombreOnly =
        hyphenIndex >= 0
          ? normalized.slice(hyphenIndex + 1).trim()
          : sanitizedDni.length === 0
            ? normalized
            : "";
      updateDocente(index, {
        docente_id: null,
        dni: sanitizedDni,
        nombre: nombreOnly,
        inputValue: value,
      });
      return;
    }

    const match = docentesDisponibles.find((doc) => {
      const candidateDni = doc.dni ? doc.dni.replace(/\D/g, "") : null;
      return candidateDni === sanitizedDni;
    });

    if (match) {
      const formattedDni = match.dni ?? sanitizedDni;
      updateDocente(index, {
        docente_id: match.id,
        dni: sanitizedDni,
        nombre: match.nombre,
        inputValue: `${formattedDni} - ${match.nombre}`,
      });
      return;
    }

    const nombreFromInput =
      hyphenIndex >= 0 ? normalized.slice(hyphenIndex + 1).trim() : "";
    const displayValue = nombreFromInput
      ? `${dniSegmentRaw || sanitizedDni} - ${nombreFromInput}`
      : value;

    updateDocente(index, {
      docente_id: null,
      dni: sanitizedDni,
      nombre: nombreFromInput,
      inputValue: displayValue,
    });
  };

  const handleSubmit = () => {
    if (!profesoradoId || !planId || !materiaId) {
      enqueueSnackbar("Seleccione profesorado, plan y materia.", { variant: "warning" });
      return;
    }
    if (!folio.trim()) {
      enqueueSnackbar("Ingrese el número de folio del acta.", { variant: "warning" });
      return;
    }
    if (alumnos.some((alumno) => !alumno.calificacion_definitiva)) {
      enqueueSnackbar("Complete la calificación definitiva en todas las filas.", { variant: "warning" });
      return;
    }

    const docentesPayload = docentes.map((doc) => ({
      rol: doc.rol,
      docente_id: doc.docente_id ?? null,
      nombre: doc.nombre.trim(),
      dni: doc.dni?.trim() || null,
    }));

    const alumnosPayload: ActaAlumnoPayload[] = alumnos.map((alumno, index) => ({
      numero_orden: index + 1,
      permiso_examen: alumno.permiso_examen?.trim() || undefined,
      dni: alumno.dni.trim(),
      apellido_nombre: alumno.apellido_nombre.trim(),
      examen_escrito: alumno.examen_escrito || undefined,
      examen_oral: alumno.examen_oral || undefined,
      calificacion_definitiva: alumno.calificacion_definitiva,
      observaciones: alumno.observaciones?.trim() || undefined,
    }));

    const payload: ActaCreatePayload = {
      tipo,
      profesorado_id: Number(profesoradoId),
      materia_id: Number(materiaId),
      fecha,
      folio: folio.trim(),
      libro: libro.trim() || undefined,
      observaciones: observaciones.trim() || undefined,
      docentes: docentesPayload,
      alumnos: alumnosPayload,
      total_aprobados: summary.aprobados,
      total_desaprobados: summary.desaprobados,
      total_ausentes: summary.ausentes,
    };

    if (strict) {
      if (summary.total === 0) {
        enqueueSnackbar("Debe agregar al menos un estudiante al acta.", { variant: "warning" });
        return;
      }
    }

    mutation.mutate(payload);
  };

  if (metadataQuery.isLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
        <CircularProgress />
      </Box>
    );
  }

  if (metadataQuery.isError || !metadata) {
    return (
      <Alert severity="error">
        No se pudo cargar la información inicial para generar actas de examen.
      </Alert>
    );
  }

  return (
    <Stack spacing={3} sx={{ p: { xs: 1, md: 3 } }}>
      <Box>
        <Typography variant="h4" fontWeight={700}>
          {title}
        </Typography>
        <Typography color="text.secondary">
          {subtitle}
        </Typography>
      </Box>

      <Paper variant="outlined" sx={{ p: 3 }}>
        <Typography variant="h6" fontWeight={600} sx={{ mb: 1 }}>
          Asociar una mesa
        </Typography>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
          <TextField
            label="Código de mesa (opcional)"
            size="small"
            value={mesaCodigo}
            onChange={(event) => setMesaCodigo(event.target.value)}
            placeholder="Ej: MESA-20251112-00010"
            fullWidth
          />
          <Button
            variant="contained"
            onClick={handleBuscarMesa}
            disabled={mesaBuscando}
            startIcon={mesaBuscando ? <CircularProgress size={18} color="inherit" /> : <SearchIcon />}
          >
            {mesaBuscando ? "Buscando..." : "Buscar"}
          </Button>
        </Stack>
        {mesaBusquedaError && (
          <Alert severity="warning" sx={{ mt: 1 }}>
            {mesaBusquedaError}
          </Alert>
        )}
        {mesaSeleccionada && (
          <Alert severity="info" sx={{ mt: 1 }}>
            <Stack spacing={0.5}>
              <Typography variant="body2">
                <strong>Código:</strong> {mesaSeleccionada.codigo || mesaSeleccionada.id} - {mesaSeleccionada.materia_nombre}
              </Typography>
              <Typography variant="body2">
                <strong>Tipo:</strong> {getMesaTipoNombre(mesaSeleccionada.tipo)} | <strong>Modalidad:</strong>{" "}
                {mesaSeleccionada.modalidad === "LIB" ? "Libre" : "Regular"}
              </Typography>
              {mesaSeleccionada.docentes && mesaSeleccionada.docentes.length ? (
                <Typography variant="body2">
                  <strong>Tribunal:</strong>{" "}
                  {mesaSeleccionada.docentes
                    .map((doc) => `${DOCENTE_ROL_LABEL[doc.rol] ?? doc.rol}: ${doc.nombre || "Sin asignar"}`)
                    .join(" | ")}
                </Typography>
              ) : (
                <Typography variant="body2">Tribunal sin designar.</Typography>
              )}
            </Stack>
          </Alert>
        )}
      </Paper>

      <Paper variant="outlined" sx={{ p: 3 }}>
        <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>
          Encabezado del acta
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} md={6} lg={4}>
            <TextField
              select
              label="Tipo de acta"
              fullWidth
              value={tipo}
              onChange={(event) => setTipo(event.target.value as "REG" | "LIB")}
            >
              {ACTA_TIPOS.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid item xs={12} md={6} lg={4}>
            <TextField
              select
              label="Profesorado"
              fullWidth
              value={profesoradoId}
              onChange={(event) => {
                setProfesoradoId(event.target.value);
                setPlanId("");
                setMateriaId("");
              }}
            >
              <MenuItem value="">Seleccionar</MenuItem>
              {profesorados.map((prof) => (
                <MenuItem key={prof.id} value={String(prof.id)}>
                  {prof.nombre}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid item xs={12} md={6} lg={4}>
            <TextField
              select
              label="Plan de estudio"
              fullWidth
              value={planId}
              onChange={(event) => {
                setPlanId(event.target.value);
                setMateriaId("");
              }}
              disabled={!selectedProfesorado}
            >
              <MenuItem value="">Seleccionar</MenuItem>
              {planesDisponibles.map((plan) => (
                <MenuItem key={plan.id} value={String(plan.id)}>
                  {plan.resolucion}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid item xs={12} md={6} lg={4}>
            <TextField
              select
              label="Materia"
              fullWidth
              value={materiaId}
              onChange={(event) => setMateriaId(event.target.value)}
              disabled={!selectedPlan}
            >
              <MenuItem value="">Seleccionar</MenuItem>
              {materiasDisponibles.map((materia) => (
                <MenuItem key={materia.id} value={String(materia.id)}>
                  {materia.nombre} {materia.anio_cursada ? `(${materia.anio_cursada}° año)` : ""}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid item xs={12} md={6} lg={4}>
            <TextField
              label="Fecha"
              type="date"
              fullWidth
              value={fecha}
              onChange={(event) => setFecha(event.target.value)}
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
          <Grid item xs={12} md={6} lg={4}>
            <TextField
              label="Número de folio"
              fullWidth
              value={folio}
              onChange={(event) => setFolio(event.target.value)}
              required
            />
          </Grid>
          <Grid item xs={12} md={6} lg={4}>
            <TextField
              label="Libro"
              fullWidth
              value={libro}
              onChange={(event) => setLibro(event.target.value)}
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              label="Observaciones generales"
              fullWidth
              multiline
              minRows={2}
              value={observaciones}
              onChange={(event) => setObservaciones(event.target.value)}
            />
          </Grid>
        </Grid>
      </Paper>

      <Paper variant="outlined" sx={{ p: 3 }}>
        <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>
          Tribunal examinador
        </Typography>
        <Stack spacing={2}>
          {docentes.map((docente, index) => {
            const role = DOCENTE_ROLES[index];
            return (
              <Grid
                container
                spacing={2}
                alignItems="center"
                key={role.value}
              >
                <Grid item xs={12} md={3}>
                  <Typography variant="subtitle2" fontWeight={600}>
                    {role.label}
                  </Typography>
                </Grid>
                <Grid item xs={12} md={9}>
                  <Autocomplete
                    freeSolo
                    options={docenteOptions}
                    value={docente.inputValue || ""}
                    onInputChange={(_, newInputValue) =>
                      handleDocenteInputChange(index, newInputValue || "")
                    }
                    onChange={(_, newValue) =>
                      handleDocenteInputChange(index, newValue || "")
                    }
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label="DNI y nombre (ej: 29825234 - Apellido, Nombre)"
                        fullWidth
                      />
                    )}
                  />
                </Grid>
              </Grid>
            );
          })}
        </Stack>
      </Paper>

      <Paper variant="outlined" sx={{ p: 3 }}>
        <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" alignItems={{ xs: "stretch", md: "center" }} sx={{ mb: 2 }} spacing={2}>
          <Typography variant="h6" fontWeight={600}>
            Resultados del examen
          </Typography>
          <Button startIcon={<AddIcon />} variant="outlined" onClick={handleAgregarAlumno}>
            Agregar fila
          </Button>
        </Stack>
        <Box sx={{ overflowX: "auto" }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell align="center">N°</TableCell>
                <TableCell>Permiso examen</TableCell>
                <TableCell>DNI</TableCell>
                <TableCell>Apellido y nombre</TableCell>
                <TableCell>Examen escrito</TableCell>
                <TableCell>Examen oral</TableCell>
                <TableCell>Calificación definitiva</TableCell>
                <TableCell>Observaciones</TableCell>
                <TableCell align="center">Acciones</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {alumnos.map((alumno) => (
                <TableRow key={alumno.internoId}>
                  <TableCell align="center">{alumno.numero_orden}</TableCell>
                  <TableCell>
                    <TextField
                      size="small"
                      value={alumno.permiso_examen ?? ""}
                      onChange={(event) =>
                        updateAlumno(alumno.internoId, { permiso_examen: event.target.value })
                      }
                    />
                  </TableCell>
                  <TableCell>
                    <TextField
                      size="small"
                      value={alumno.dni}
                      onChange={(event) => handleAlumnoDniChange(alumno.internoId, event.target.value)}
                    />
                  </TableCell>
                  <TableCell>
                    <TextField
                      size="small"
                      fullWidth
                      value={alumno.apellido_nombre}
                      onChange={(event) =>
                        updateAlumno(alumno.internoId, { apellido_nombre: event.target.value })
                      }
                    />
                  </TableCell>
                  <TableCell>
                    <TextField
                      select
                      size="small"
                      value={alumno.examen_escrito ?? ""}
                      onChange={(event) =>
                        updateAlumno(alumno.internoId, { examen_escrito: event.target.value })
                      }
                    >
                      <MenuItem value="">-</MenuItem>
                      {notaOptions.map((option) => (
                        <MenuItem key={option.value} value={option.value}>
                          {option.label}
                        </MenuItem>
                      ))}
                    </TextField>
                  </TableCell>
                  <TableCell>
                    <TextField
                      select
                      size="small"
                      value={alumno.examen_oral ?? ""}
                      onChange={(event) =>
                        updateAlumno(alumno.internoId, { examen_oral: event.target.value })
                      }
                    >
                      <MenuItem value="">-</MenuItem>
                      {notaOptions.map((option) => (
                        <MenuItem key={option.value} value={option.value}>
                          {option.label}
                        </MenuItem>
                      ))}
                    </TextField>
                  </TableCell>
                  <TableCell>
                    <TextField
                      select
                      size="small"
                      required
                      value={alumno.calificacion_definitiva}
                      onChange={(event) =>
                        updateAlumno(alumno.internoId, { calificacion_definitiva: event.target.value })
                      }
                    >
                      <MenuItem value="">Seleccionar</MenuItem>
                      {notaOptions.map((option) => (
                        <MenuItem key={option.value} value={option.value}>
                          {option.label}
                        </MenuItem>
                      ))}
                    </TextField>
                  </TableCell>
                  <TableCell>
                    <TextField
                      size="small"
                      value={alumno.observaciones ?? ""}
                      onChange={(event) =>
                        updateAlumno(alumno.internoId, { observaciones: event.target.value })
                      }
                    />
                  </TableCell>
                  <TableCell align="center">
                    <IconButton
                      color="error"
                      size="small"
                      onClick={() => handleEliminarAlumno(alumno.internoId)}
                      disabled={alumnos.length === 1}
                    >
                      <DeleteIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>

        <Divider sx={{ my: 2 }} />
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
          <Alert severity="info" sx={{ flex: 1 }}>
            <Typography variant="subtitle2">Resumen automático</Typography>
            <Typography variant="body2">
              Total de alumnos: <strong>{summary.total}</strong> — Aprobados: <strong>{summary.aprobados}</strong> — Desaprobados: <strong>{summary.desaprobados}</strong> — Ausentes: <strong>{summary.ausentes}</strong>
            </Typography>
          </Alert>
        </Stack>
      </Paper>

      <Stack direction="row" justifyContent="flex-end">
        <Button
          variant="contained"
          size="large"
          onClick={handleSubmit}
          disabled={mutation.isPending}
          startIcon={mutation.isPending ? <CircularProgress size={18} color="inherit" /> : undefined}
        >
          {mutation.isPending ? "Generando..." : "Generar acta"}
        </Button>
      </Stack>
    </Stack>
  );
};

export default ActaExamenForm;
