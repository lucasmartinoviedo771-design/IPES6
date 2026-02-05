import { useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  IconButton,
  MenuItem,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import VisibilityIcon from "@mui/icons-material/Visibility";
import dayjs from "dayjs";
import {
  listarProfesorados,
  listarPlanes,
  listarMesasFinales,
  obtenerDatosCargaNotas,
  type PlanDTO,
  type ProfesoradoDTO,
  type MateriaOptionDTO,
} from "@/api/cargaNotas";
import { obtenerMesaPlanilla, type MesaPlanillaDTO, type MesaPlanillaEstudianteDTO } from "@/api/estudiantes";
import { PageHero } from "@/components/ui/GradientTitles";
import logoMinisterio from "@/assets/escudo_ministerio_tdf.png";
import logoIpes from "@/assets/logo_ipes.png";

const CURRENT_YEAR = new Date().getFullYear().toString();

const CUATRIMESTRE_LABELS: Record<string, string> = {
  PCU: "1º cuatrimestre",
  SCU: "2º cuatrimestre",
  ANU: "Ciclo anual",
};

const MODALIDAD_LABELS: Record<string, string> = {
  REG: "Regular",
  LIB: "Libre",
};

const MESA_TIPO_LABELS: Record<string, string> = {
  FIN: "Ordinaria",
  EXT: "Extraordinaria",
  ESP: "Especial",
};

const formatDictado = (value?: string | null) => {
  if (!value) return "-";
  const key = value.toUpperCase();
  return CUATRIMESTRE_LABELS[key] ?? value;
};

const formatHora = (value?: string | null) => {
  if (!value) return "-";
  const trimmed = value.length > 5 ? value.slice(0, 5) : value;
  return `${trimmed} hs`;
};

const formatModalidad = (value?: string | null) => {
  if (!value) return "-";
  return MODALIDAD_LABELS[value] ?? value;
};

const formatMesaTipo = (value?: string | null) => {
  if (!value) return "-";
  return MESA_TIPO_LABELS[value] ?? value;
};

const formatDate = (iso: string) => {
  try {
    return new Date(iso).toLocaleDateString("es-AR");
  } catch {
    return iso;
  }
};

function MesaPlanillaDialog({
  open,
  planilla,
  loading,
  onClose,
}: {
  open: boolean;
  planilla: MesaPlanillaDTO | null;
  loading: boolean;
  onClose: () => void;
}) {
  const sortedEstudiantes = useMemo(() => {
    if (!planilla) return [];
    return [...planilla.estudiantes].sort((a, b) => (a.apellido_nombre || "").localeCompare(b.apellido_nombre || ""));
  }, [planilla]);
  const horaDesdeTexto = planilla?.hora_desde ? formatHora(planilla.hora_desde) : "-";
  const horaHastaTexto = planilla?.hora_hasta ? formatHora(planilla.hora_hasta) : "-";
  const horarioLabel =
    horaDesdeTexto === "-" && horaHastaTexto === "-" ? "-" : `${horaDesdeTexto} a ${horaHastaTexto === "-" ? "-" : horaHastaTexto}`;
  const modalidadLabel = planilla ? formatModalidad(planilla.modalidad) : "-";
  const tipoLabel = planilla ? formatMesaTipo(planilla.tipo) : "-";
  const dictadoLabel = planilla ? formatDictado(planilla.regimen) : "-";
  const materiaLabel = planilla
    ? planilla.materia_anio
      ? `${planilla.materia_nombre} · ${planilla.materia_anio}º año`
      : planilla.materia_nombre
    : "-";
  const fechaMesa = planilla ? dayjs(planilla.fecha).format("DD/MM/YYYY") : "-";
  const planillaProfesorado = planilla?.profesorado_nombre ?? "-";
  const planillaResolucion = planilla?.plan_resolucion ?? "-";
  const codigoMesa = planilla?.mesa_codigo ?? "-";

  const renderEstudianteRow = (estudiante: MesaPlanillaEstudianteDTO) => (
    <TableRow key={estudiante.estudiante_id ?? estudiante.inscripcion_id}>
      <TableCell>{estudiante.apellido_nombre}</TableCell>
      <TableCell>{estudiante.dni}</TableCell>
      <TableCell>{estudiante.condicion_display || estudiante.condicion || "-"}</TableCell>
      <TableCell>{estudiante.nota ?? "-"}</TableCell>
      <TableCell>{estudiante.folio || "-"}</TableCell>
      <TableCell>{estudiante.libro || "-"}</TableCell>
      <TableCell>{estudiante.fecha_resultado ? formatDate(estudiante.fecha_resultado) : "-"}</TableCell>
      <TableCell>{estudiante.observaciones || "-"}</TableCell>
    </TableRow>
  );

  const handlePrint = () => {
    if (!planilla) return;
    const horaDesde = planilla.hora_desde ? formatHora(planilla.hora_desde) : "-";
    const horaHasta = planilla.hora_hasta ? formatHora(planilla.hora_hasta) : "-";
    const horarioTexto = horaDesde === "-" && horaHasta === "-" ? "-" : `${horaDesde} a ${horaHasta === "-" ? "-" : horaHasta}`;
    const modalidadTexto = formatModalidad(planilla.modalidad);
    const tipoTexto = formatMesaTipo(planilla.tipo);
    const dictadoTexto = formatDictado(planilla.regimen);
    const materiaTexto = planilla.materia_anio
      ? `${planilla.materia_nombre} · ${planilla.materia_anio}º año`
      : planilla.materia_nombre;
    const fechaTexto = dayjs(planilla.fecha).format("DD/MM/YYYY");
    const metaLeft = [
      { label: "UNIDAD CURRICULAR", value: materiaTexto },
      { label: "PLAN / RESOLUCIÓN", value: planilla.plan_resolucion || "-" },
      { label: "MODALIDAD", value: modalidadTexto },
      { label: "MESA / CÓDIGO", value: planilla.mesa_codigo || "-" },
    ];
    const metaRight = [
      { label: "FECHA", value: fechaTexto },
      { label: "HORARIO", value: horarioTexto },
      { label: "TIPO", value: tipoTexto },
      { label: "DICTADO", value: dictadoTexto },
    ];
    const metaRows = metaLeft
      .map((item, idx) => {
        const counterpart = metaRight[idx];
        return `
          <tr>
            <td><strong>${item.label}:</strong> ${item.value ?? ""}</td>
            <td><strong>${counterpart.label}:</strong> ${counterpart.value ?? ""}</td>
          </tr>
        `;
      })
      .join("");
    const estudiantesRows = sortedEstudiantes
      .map(
        (estudiante, index) => `
        <tr>
          <td>${index + 1}</td>
          <td>${estudiante.apellido_nombre || "-"}</td>
          <td>${estudiante.dni}</td>
          <td>${estudiante.condicion_display || estudiante.condicion || "-"}</td>
          <td>${estudiante.nota ?? "-"}</td>
          <td>${estudiante.folio || "-"}</td>
          <td>${estudiante.libro || "-"}</td>
          <td>${estudiante.observaciones || "-"}</td>
        </tr>
      `,
      )
      .join("");
    const firmas = [
      { label: "Firma Presidente", value: planilla.tribunal_presidente },
      { label: "Firma Vocal 1", value: planilla.tribunal_vocal1 },
      { label: "Firma Vocal 2", value: planilla.tribunal_vocal2 },
    ]
      .map(
        (item) => `
        <div>
          <div class="linea">${item.value || "................................"}</div>
          <span>${item.label}</span>
        </div>
      `,
      )
      .join("");
    const html = `
    <html>
      <head>
        <title>Planilla de mesa final</title>
        <style>
          body {
            font-family: "Helvetica", Arial, sans-serif;
            margin: 0;
            padding: 0;
            color: #222;
            background: #fff;
          }
          .sheet {
            width: 210mm;
            min-height: 297mm;
            padding: 15mm;
            margin: auto;
          }
          .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 8mm;
          }
          .header img {
            height: 90px;
          }
          .header-center {
            text-align: center;
            font-size: 14px;
            font-weight: bold;
          }
          .titulo {
            text-align: center;
            background: #1f4f6b;
            color: #fff;
            padding: 6px;
            margin-bottom: 4mm;
            font-size: 14px;
            letter-spacing: 1px;
          }
          .subtitulo {
            text-align: center;
            font-size: 13px;
            font-weight: 600;
            margin-bottom: 4mm;
          }
          .meta-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 6mm;
            font-size: 12px;
          }
          .meta-table td {
            border: 1px solid #999;
            padding: 6px 8px;
            width: 50%;
            vertical-align: top;
          }
          .meta-table strong {
            display: inline-block;
            min-width: 140px;
          }
          .planilla-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 11px;
          }
          .planilla-table th,
          .planilla-table td {
            border: 1px solid #777;
            padding: 4px 6px;
          }
          .planilla-table th {
            background: #f2f2f2;
            text-transform: uppercase;
            font-size: 10px;
          }
          .firmas {
            display: flex;
            justify-content: space-between;
            gap: 8mm;
            margin-top: 12mm;
          }
          .firmas div {
            flex: 1;
            text-align: center;
          }
          .firmas .linea {
            border-top: 1px solid #000;
            padding-top: 32px;
            margin-bottom: 4px;
          }
        </style>
      </head>
      <body>
        <div class="sheet">
          <div class="header">
            <img src="${logoMinisterio}" alt="Ministerio" />
            <div class="header-center">
              IPES PAULO FREIRE<br/>
              Instituto Provincial de Educación Superior
            </div>
            <img src="${logoIpes}" alt="IPES" />
          </div>
          <div class="titulo">PLANILLA DE RESULTADOS DE EXAMEN FINAL</div>
          <div class="subtitulo">${planilla.profesorado_nombre ?? "-"}</div>
          <table class="meta-table">
            ${metaRows}
          </table>
          <table class="planilla-table">
            <thead>
              <tr>
                <th>Orden</th>
                <th>Estudiante</th>
                <th>DNI</th>
                <th>Condición</th>
                <th>Nota</th>
                <th>Folio</th>
                <th>Libro</th>
                <th>Observaciones</th>
              </tr>
            </thead>
            <tbody>
              ${estudiantesRows}
            </tbody>
          </table>
          <div class="firmas">
            ${firmas}
          </div>
        </div>
      </body>
    </html>
    `;
    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.focus();
      printWindow.print();
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="lg">
      <DialogTitle>Planilla de mesa final</DialogTitle>
      <DialogContent dividers>
        {loading ? (
          <Box display="flex" justifyContent="center" py={4}>
            <CircularProgress />
          </Box>
        ) : planilla ? (
          <Stack spacing={2}>
            <Stack direction="row" spacing={3} flexWrap="wrap">
              <Box>
                <Typography variant="subtitle2" color="text.secondary">
                  Profesorado
                </Typography>
                <Typography>{planillaProfesorado}</Typography>
              </Box>
              <Box>
                <Typography variant="subtitle2" color="text.secondary">
                  Materia
                </Typography>
                <Typography>{materiaLabel}</Typography>
              </Box>
              <Box>
                <Typography variant="subtitle2" color="text.secondary">
                  Fecha
                </Typography>
                <Typography>{fechaMesa}</Typography>
              </Box>
              <Box>
                <Typography variant="subtitle2" color="text.secondary">
                  Horario
                </Typography>
                <Typography>{horarioLabel}</Typography>
              </Box>
              <Box>
                <Typography variant="subtitle2" color="text.secondary">
                  Modalidad
                </Typography>
                <Typography>{modalidadLabel}</Typography>
              </Box>
              <Box>
                <Typography variant="subtitle2" color="text.secondary">
                  Tipo
                </Typography>
                <Typography>{tipoLabel}</Typography>
              </Box>
              <Box>
                <Typography variant="subtitle2" color="text.secondary">
                  Resolución
                </Typography>
                <Typography>{planillaResolucion}</Typography>
              </Box>
              <Box>
                <Typography variant="subtitle2" color="text.secondary">
                  Código de mesa
                </Typography>
                <Typography>{codigoMesa}</Typography>
              </Box>
              <Box>
                <Typography variant="subtitle2" color="text.secondary">
                  Dictado
                </Typography>
                <Typography>{dictadoLabel}</Typography>
              </Box>
            </Stack>

            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Apellido y nombre</TableCell>
                    <TableCell>DNI</TableCell>
                    <TableCell>Condición</TableCell>
                    <TableCell>Nota</TableCell>
                    <TableCell>Folio</TableCell>
                    <TableCell>Libro</TableCell>
                    <TableCell>Fecha resultado</TableCell>
                    <TableCell>Observaciones</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>{sortedEstudiantes.map(renderEstudianteRow)}</TableBody>
              </Table>
            </TableContainer>
          </Stack>
        ) : (
          <Typography>No se pudo cargar la planilla seleccionada.</Typography>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={handlePrint} disabled={!planilla}>
          Imprimir
        </Button>
        <Button onClick={onClose}>Cerrar</Button>
      </DialogActions>
    </Dialog>
  );
}

export default function PlanillasFinalesPage() {
  const [anioFiltro, setAnioFiltro] = useState(CURRENT_YEAR);
  const [profesoradoId, setProfesoradoId] = useState("");
  const [planId, setPlanId] = useState("");
  const [materiaId, setMateriaId] = useState("");
  const [modalidad, setModalidad] = useState("");
  const [tipo, setTipo] = useState("");
  const [profesorados, setProfesorados] = useState<ProfesoradoDTO[]>([]);
  const [planes, setPlanes] = useState<PlanDTO[]>([]);
  const [materias, setMaterias] = useState<MateriaOptionDTO[]>([]);
  const [mesas, setMesas] = useState<
    {
      id: number;
      materia: string;
      fecha: string;
      modalidad: string;
      tipo: string;
      codigo?: string | null;
    }[]
  >([]);
  const [mesasLoading, setMesasLoading] = useState(false);
  const [planillaDialogOpen, setPlanillaDialogOpen] = useState(false);
  const [planillaLoading, setPlanillaLoading] = useState(false);
  const [planillaSeleccionada, setPlanillaSeleccionada] = useState<MesaPlanillaDTO | null>(null);

  useEffect(() => {
    listarProfesorados()
      .then(setProfesorados)
      .catch(() => setProfesorados([]));
  }, []);

  useEffect(() => {
    if (!profesoradoId) {
      setPlanes([]);
      setPlanId("");
      return;
    }
    listarPlanes(Number(profesoradoId))
      .then(setPlanes)
      .catch(() => setPlanes([]));
  }, [profesoradoId]);

  useEffect(() => {
    if (!planId) {
      setMaterias([]);
      return;
    }
    obtenerDatosCargaNotas({ plan_id: Number(planId) })
      .then((data) => setMaterias(data.materias))
      .catch(() => setMaterias([]));
  }, [planId]);

  useEffect(() => {
    if (!planId) {
      setMesas([]);
      return;
    }
    setMesasLoading(true);
    listarMesasFinales({
      plan_id: Number(planId),
      profesorado_id: profesoradoId ? Number(profesoradoId) : undefined,
      materia_id: materiaId ? Number(materiaId) : undefined,
      modalidad: (modalidad as "REG" | "LIB") || undefined,
      tipo: (tipo as "FIN" | "EXT" | "ESP") || undefined,
    })
      .then((data) => {
        const filtered = data
          .filter((mesa) =>
            anioFiltro ? new Date(mesa.fecha).getFullYear().toString() === anioFiltro : true,
          )
          .map((mesa) => ({
            id: mesa.id,
            materia: mesa.materia_nombre ?? "-",
            fecha: mesa.fecha,
            modalidad: mesa.modalidad,
            tipo: mesa.tipo,
            codigo: mesa.codigo,
          }));
        setMesas(filtered);
      })
      .catch(() => setMesas([]))
      .finally(() => setMesasLoading(false));
  }, [planId, profesoradoId, materiaId, modalidad, tipo, anioFiltro]);

  const handleVerPlanilla = async (mesaId: number) => {
    setPlanillaDialogOpen(true);
    setPlanillaLoading(true);
    try {
      const data = await obtenerMesaPlanilla(mesaId);
      setPlanillaSeleccionada(data);
    } catch {
      setPlanillaSeleccionada(null);
    } finally {
      setPlanillaLoading(false);
    }
  };

  return (
    <Stack spacing={4}>
      <PageHero
        title="Planillas de mesas finales"
        subtitle="Visualice las actas finales y resultados sin posibilidad de edición."
      />

      <Paper sx={{ p: 3 }}>
        <Grid container spacing={2}>
          <Grid item xs={12} md={2}>
            <TextField
              label="Año (fecha mesa)"
              value={anioFiltro}
              onChange={(event) => setAnioFiltro(event.target.value)}
              fullWidth
              inputMode="numeric"
            />
          </Grid>
          <Grid item xs={12} md={2}>
            <TextField
              select
              label="Profesorado"
              value={profesoradoId}
              onChange={(event) => {
                setProfesoradoId(event.target.value);
                setPlanId("");
              }}
              fullWidth
            >
              <MenuItem value="">
                <em>Seleccionar</em>
              </MenuItem>
              {profesorados.map((prof) => (
                <MenuItem key={prof.id} value={prof.id}>
                  {prof.nombre}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid item xs={12} md={2}>
            <TextField
              select
              label="Plan"
              value={planId}
              onChange={(event) => {
                setPlanId(event.target.value);
                setMateriaId("");
              }}
              fullWidth
              disabled={!profesoradoId}
            >
              <MenuItem value="">
                <em>Seleccionar</em>
              </MenuItem>
              {planes.map((plan) => (
                <MenuItem key={plan.id} value={plan.id}>
                  {plan.resolucion}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid item xs={12} md={3}>
            <TextField
              select
              label="Materia"
              value={materiaId}
              onChange={(event) => setMateriaId(event.target.value)}
              fullWidth
              disabled={!planId}
            >
              <MenuItem value="">
                <em>Todas</em>
              </MenuItem>
              {materias.map((materia) => (
                <MenuItem key={materia.id} value={materia.id}>
                  {materia.nombre}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid item xs={12} md={2}>
            <TextField
              select
              label="Modalidad"
              value={modalidad}
              onChange={(event) => setModalidad(event.target.value)}
              fullWidth
            >
              <MenuItem value="">
                <em>Todas</em>
              </MenuItem>
              <MenuItem value="REG">Regular</MenuItem>
              <MenuItem value="LIB">Libre</MenuItem>
            </TextField>
          </Grid>
          <Grid item xs={12} md={1}>
            <TextField
              select
              label="Tipo"
              value={tipo}
              onChange={(event) => setTipo(event.target.value)}
              fullWidth
            >
              <MenuItem value="">
                <em>Todos</em>
              </MenuItem>
              <MenuItem value="FIN">Ordinaria</MenuItem>
              <MenuItem value="EXT">Extraordinaria</MenuItem>
              <MenuItem value="ESP">Especial</MenuItem>
            </TextField>
          </Grid>
        </Grid>
      </Paper>

      <Paper>
        <Box px={3} py={2} display="flex" justifyContent="space-between" alignItems="center">
          <Typography variant="h6">Mesas encontradas</Typography>
          {mesasLoading && <CircularProgress size={24} />}
        </Box>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Materia</TableCell>
                <TableCell>Fecha</TableCell>
                <TableCell>Modalidad</TableCell>
                <TableCell>Tipo</TableCell>
                <TableCell>Código</TableCell>
                <TableCell>Acciones</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {mesas.map((mesa) => (
                <TableRow key={mesa.id}>
                  <TableCell>{mesa.materia}</TableCell>
                  <TableCell>{formatDate(mesa.fecha)}</TableCell>
                  <TableCell>{mesa.modalidad}</TableCell>
                  <TableCell>{mesa.tipo}</TableCell>
                  <TableCell>{mesa.codigo || "-"}</TableCell>
                  <TableCell>
                    <IconButton onClick={() => handleVerPlanilla(mesa.id)} size="small">
                      <VisibilityIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
              {!mesas.length && (
                <TableRow>
                  <TableCell colSpan={6}>
                    <Typography align="center" sx={{ py: 3 }}>
                      No se encontraron mesas con los filtros seleccionados.
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      <MesaPlanillaDialog
        open={planillaDialogOpen}
        planilla={planillaSeleccionada}
        loading={planillaLoading}
        onClose={() => setPlanillaDialogOpen(false)}
      />
    </Stack>
  );
}
