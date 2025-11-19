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
  obtenerDatosCargaNotas,
  obtenerPlanillaRegularidad,
  type ComisionOptionDTO,
  type MateriaOptionDTO,
  type PlanDTO,
  type ProfesoradoDTO,
  type RegularidadPlanillaDTO,
} from "@/api/cargaNotas";
import { PageHero } from "@/components/ui/GradientTitles";
import logoMinisterio from "@/assets/escudo_ministerio_tdf.png";
import logoIpes from "@/assets/logo_ipes.png";

const CURRENT_YEAR = new Date().getFullYear().toString();

const formatNumber = (value?: number | null) => {
  if (value === null || value === undefined) return "-";
  return `${value}`.replace(".", ",");
};

const formatPercentage = (value?: number | null) => {
  if (value === null || value === undefined) return "-";
  return `${value}%`;
};

const FORMATO_LABELS: Record<string, string> = {
  TAL: "Taller",
  TEO: "Teórico",
  PRA: "Práctica",
  SEM: "Seminario",
  CUR: "Curso",
};

const CUATRIMESTRE_LABELS: Record<string, string> = {
  PCU: "1º cuatrimestre",
  SCU: "2º cuatrimestre",
  ANU: "Ciclo anual",
};

const formatFormato = (value?: string | null) => {
  if (!value) return "-";
  const key = value.toUpperCase();
  return FORMATO_LABELS[key] ?? value;
};

const formatDictado = (value?: string | null) => {
  if (!value) return "-";
  const key = value.toUpperCase();
  return CUATRIMESTRE_LABELS[key] ?? value;
};

function RegularidadDialog({
  open,
  planilla,
  loading,
  onClose,
  comisionInfo,
  materiaInfo,
}: {
  open: boolean;
  planilla: RegularidadPlanillaDTO | null;
  loading: boolean;
  onClose: () => void;
  comisionInfo: ComisionOptionDTO | null;
  materiaInfo: MateriaOptionDTO | null;
}) {
  const handlePrint = () => {
    if (!planilla) return;
    const materiaAnio = planilla.materia_anio ?? materiaInfo?.anio ?? null;
    const headerMateria = materiaAnio ? `${planilla.materia_nombre} · ${materiaAnio}º año` : planilla.materia_nombre;
    const formatoTexto = formatFormato(planilla.formato);
    const dictadoTexto = formatDictado(planilla.regimen || materiaInfo?.cuatrimestre || comisionInfo?.cuatrimestre || null);
    const fechaTexto = planilla.fecha_cierre ? dayjs(planilla.fecha_cierre).format("DD/MM/YYYY") : "-";
    const resolucion = planilla.plan_resolucion || comisionInfo?.plan_resolucion || "-";
    const folioCodigo =
      planilla.comision_codigo && planilla.comision_codigo !== "Sin comision" ? planilla.comision_codigo : "";
    const docentesTexto = planilla.docentes?.length ? planilla.docentes.join(" / ") : "Sin docente";
    const profesoradoNombre = planilla.profesorado_nombre || comisionInfo?.profesorado_nombre || "-";
    const metaLeft = [
      { label: "UNIDAD CURRICULAR", value: headerMateria },
      { label: "FORMATO", value: formatoTexto },
      { label: "FOLIO Nº", value: folioCodigo || "................................" },
      { label: "PROFESOR/A", value: docentesTexto },
    ];
    const metaRight = [
      { label: "AÑO", value: materiaAnio ? `${materiaAnio}º` : "-" },
      { label: "RESOLUCIÓN Nº", value: resolucion || "-" },
      { label: "DICTADO", value: dictadoTexto || "-" },
      { label: "FECHA", value: fechaTexto },
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
    const situacionRefs =
      planilla.situaciones.length > 0
        ? planilla.situaciones
            .map(
              (ref) => `
                <tr>
                  <td>${ref.alias}</td>
                  <td>${ref.descripcion || "-"}</td>
                </tr>
              `,
            )
            .join("")
        : "";
    const alumnosRows = planilla.alumnos
      .map(
        (alumno) => `
        <tr>
          <td>${alumno.orden ?? "-"}</td>
          <td>${alumno.apellido_nombre}</td>
          <td>${alumno.dni}</td>
          <td>${formatNumber(alumno.nota_tp)}</td>
          <td>${formatNumber(alumno.nota_final)}</td>
          <td>${formatPercentage(alumno.asistencia)}</td>
          <td>${alumno.excepcion ? "Sí" : "No"}</td>
          <td>${alumno.situacion || "-"}</td>
          <td>${alumno.observaciones || "-"}</td>
        </tr>
      `,
      )
      .join("");
    const html = `
    <html>
      <head>
        <title>Planilla de regularidad</title>
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
            background: #58705b;
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
          .observaciones {
            margin-top: 6mm;
            border: 1px solid #777;
            min-height: 25mm;
            padding: 6px;
          }
          .firmas {
            display: flex;
            justify-content: space-between;
            margin-top: 12mm;
          }
          .firmas div {
            text-align: center;
            width: 45%;
          }
          .firmas span {
            display: block;
            margin-top: 40px;
            border-top: 1px solid #000;
          }
          .refs-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 10mm;
            font-size: 10px;
          }
          .refs-table th,
          .refs-table td {
            border: 1px solid #777;
            padding: 4px 6px;
          }
          .refs-table th {
            background: #f2f2f2;
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
          <div class="titulo">PLANILLA DE REGULARIDAD Y PROMOCIÓN</div>
          <div class="subtitulo">${profesoradoNombre}</div>
          <table class="meta-table">
            ${metaRows}
          </table>
          <table class="planilla-table">
            <thead>
              <tr>
                <th>Orden</th>
                <th>Alumno</th>
                <th>DNI</th>
                <th>Nota TP</th>
                <th>Nota final</th>
                <th>Asistencia</th>
                <th>Excepción</th>
                <th>Situación</th>
                <th>Observaciones</th>
              </tr>
            </thead>
            <tbody>
              ${alumnosRows}
            </tbody>
          </table>
          <div class="observaciones">
            <strong>Observaciones generales:</strong>
          </div>
          <div class="firmas">
            <div><span>Firma docente</span></div>
            <div><span>Firma Bedelía / Secretaría</span></div>
          </div>
          ${
            situacionRefs
              ? `<table class="refs-table">
                  <thead>
                    <tr>
                      <th colspan="2">Referencias - Situación Académica</th>
                    </tr>
                    <tr>
                      <th>Alias</th>
                      <th>Descripción</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${situacionRefs}
                  </tbody>
                </table>`
              : ""
          }
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
      <DialogTitle>Planilla de regularidad</DialogTitle>
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
                <Typography>{planilla.profesorado_nombre ?? comisionInfo?.profesorado_nombre ?? "-"}</Typography>
              </Box>
              <Box>
                <Typography variant="subtitle2" color="text.secondary">
                  A�o lectivo
                </Typography>
                <Typography>{planilla.anio}</Typography>
              </Box>
              <Box>
                <Typography variant="subtitle2" color="text.secondary">
                  Materia
                </Typography>
                <Typography>
                  {planilla.materia_nombre}
                  {planilla.materia_anio
                    ? ` · ${planilla.materia_anio}º a�o`
                    : materiaInfo?.anio
                      ? ` · ${materiaInfo.anio}º a�o`
                      : ""}
                </Typography>
              </Box>
              <Box>
                <Typography variant="subtitle2" color="text.secondary">
                  Docente/s
                </Typography>
                <Typography>{planilla.docentes?.length ? planilla.docentes.join(" / ") : "Sin docente"}</Typography>
              </Box>
              <Box>
                <Typography variant="subtitle2" color="text.secondary">
                  Resoluci�n
                </Typography>
                <Typography>{planilla.plan_resolucion || comisionInfo?.plan_resolucion || "-"}</Typography>
              </Box>
              <Box>
                <Typography variant="subtitle2" color="text.secondary">
                  Fecha de cierre
                </Typography>
                <Typography>
                  {planilla.fecha_cierre ? dayjs(planilla.fecha_cierre).format("DD/MM/YYYY") : "Sin registrar"}
                </Typography>
              </Box>
            </Stack>

            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Orden</TableCell>
                    <TableCell>DNI</TableCell>
                    <TableCell>Apellido y nombre</TableCell>
                    <TableCell align="right">Nota TP</TableCell>
                    <TableCell align="right">Nota final</TableCell>
                    <TableCell align="right">Asistencia</TableCell>
                    <TableCell>Situación</TableCell>
                    <TableCell>Observaciones</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {planilla.alumnos.map((alumno) => (
                    <TableRow key={alumno.inscripcion_id}>
                      <TableCell>{alumno.orden ?? "-"}</TableCell>
                      <TableCell>{alumno.dni}</TableCell>
                      <TableCell>{alumno.apellido_nombre}</TableCell>
                      <TableCell align="right">{formatNumber(alumno.nota_tp)}</TableCell>
                      <TableCell align="right">{formatNumber(alumno.nota_final)}</TableCell>
                      <TableCell align="right">{formatPercentage(alumno.asistencia)}</TableCell>
                      <TableCell>{alumno.situacion || "-"}</TableCell>
                      <TableCell>{alumno.observaciones || "-"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Stack>
        ) : (
          <Typography>No se pudo cargar la planilla.</Typography>
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

export default function PlanillasRegularidadPage() {
  const [anioLectivo, setAnioLectivo] = useState(CURRENT_YEAR);
  const [profesoradoId, setProfesoradoId] = useState("");
  const [planId, setPlanId] = useState("");
  const [materiaId, setMateriaId] = useState("");
  const [profesorados, setProfesorados] = useState<ProfesoradoDTO[]>([]);
  const [planes, setPlanes] = useState<PlanDTO[]>([]);
  const [materias, setMaterias] = useState<MateriaOptionDTO[]>([]);
  const [comisiones, setComisiones] = useState<ComisionOptionDTO[]>([]);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [planillaDialogOpen, setPlanillaDialogOpen] = useState(false);
  const [planillaLoading, setPlanillaLoading] = useState(false);
  const [planillaSeleccionada, setPlanillaSeleccionada] = useState<RegularidadPlanillaDTO | null>(null);
  const [comisionSeleccionada, setComisionSeleccionada] = useState<ComisionOptionDTO | null>(null);
  const [materiaSeleccionada, setMateriaSeleccionada] = useState<MateriaOptionDTO | null>(null);

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
      setComisiones([]);
      return;
    }
    setLookupLoading(true);
    const anioNumber = Number(anioLectivo);
    obtenerDatosCargaNotas({
      plan_id: Number(planId),
      anio: Number.isNaN(anioNumber) ? undefined : anioNumber,
    })
      .then((data) => {
        setMaterias(data.materias);
        setComisiones(data.comisiones);
      })
      .catch(() => {
        setMaterias([]);
        setComisiones([]);
      })
      .finally(() => setLookupLoading(false));
  }, [planId, anioLectivo]);

  const filteredComisiones = useMemo(() => {
    return comisiones.filter((comision) => {
      if (materiaId && comision.materia_id !== Number(materiaId)) return false;
      if (profesoradoId && comision.profesorado_id !== Number(profesoradoId)) return false;
      if (planId && comision.plan_id !== Number(planId)) return false;
      return true;
    });
  }, [comisiones, materiaId, profesoradoId, planId]);

  const materiaLookup = useMemo(() => {
    const map = new Map<number, MateriaOptionDTO>();
    materias.forEach((materia) => map.set(materia.id, materia));
    return map;
  }, [materias]);

  const handleVerPlanilla = async (comision: ComisionOptionDTO) => {
    setComisionSeleccionada(comision);
    setMateriaSeleccionada(materiaLookup.get(comision.materia_id) ?? null);
    setPlanillaDialogOpen(true);
    setPlanillaLoading(true);
    try {
      const data = await obtenerPlanillaRegularidad(comision.id);
      setPlanillaSeleccionada(data);
    } catch {
      setPlanillaSeleccionada(null);
    } finally {
      setPlanillaLoading(false);
    }
  };

  const disableFilters = lookupLoading;

  return (
    <Stack spacing={4}>
      <PageHero
        title="Planillas de regularidad"
        subtitle="Consulte las planillas de cursada informadas por cada comisión."
      />

      <Paper sx={{ p: 3 }}>
        <Grid container spacing={2}>
          <Grid item xs={12} md={3}>
            <TextField
              label="Año lectivo"
              value={anioLectivo}
              onChange={(event) => setAnioLectivo(event.target.value)}
              fullWidth
              inputMode="numeric"
              disabled={disableFilters}
            />
          </Grid>
          <Grid item xs={12} md={3}>
            <TextField
              select
              label="Profesorado"
              value={profesoradoId}
              onChange={(event) => {
                setProfesoradoId(event.target.value);
                setPlanId("");
                setMateriaId("");
              }}
              fullWidth
              disabled={disableFilters}
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
          <Grid item xs={12} md={3}>
            <TextField
              select
              label="Plan"
              value={planId}
              onChange={(event) => {
                setPlanId(event.target.value);
                setMateriaId("");
              }}
              fullWidth
              disabled={!profesoradoId || disableFilters}
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
              disabled={!planId || disableFilters}
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
        </Grid>
      </Paper>

      <Paper>
        <Box px={3} py={2} display="flex" justifyContent="space-between" alignItems="center">
          <Typography variant="h6">Resultados</Typography>
          {lookupLoading && <CircularProgress size={24} />}
        </Box>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Materia</TableCell>
                <TableCell>Comisión</TableCell>
                <TableCell>Año lectivo</TableCell>
                <TableCell>Turno</TableCell>
                <TableCell>Plan</TableCell>
                <TableCell>Acciones</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredComisiones.map((comision) => (
                <TableRow key={comision.id}>
                  <TableCell>{comision.materia_nombre}</TableCell>
                  <TableCell>{comision.codigo || "-"}</TableCell>
                  <TableCell>{comision.anio}</TableCell>
                  <TableCell>{comision.turno || "-"}</TableCell>
                  <TableCell>{comision.plan_resolucion}</TableCell>
                  <TableCell>
                    <IconButton onClick={() => handleVerPlanilla(comision)} size="small">
                      <VisibilityIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
              {!filteredComisiones.length && (
                <TableRow>
                  <TableCell colSpan={6}>
                    <Typography align="center" sx={{ py: 3 }}>
                      No se encontraron planillas para los filtros seleccionados.
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      <RegularidadDialog
        open={planillaDialogOpen}
        loading={planillaLoading}
        planilla={planillaSeleccionada}
        comisionInfo={comisionSeleccionada}
        materiaInfo={materiaSeleccionada}
        onClose={() => setPlanillaDialogOpen(false)}
      />
    </Stack>
  );
}

