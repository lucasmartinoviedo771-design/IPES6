import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import dayjs from "dayjs";

import {
  type ComisionOptionDTO,
  type MateriaOptionDTO,
  type RegularidadPlanillaDTO,
} from "@/api/cargaNotas";
import logoMinisterio from "@/assets/escudo_ministerio_tdf.png";
import logoIpes from "@/assets/logo_ipes.png";
import {
  formatNumber,
  formatPercentage,
  formatFormato,
  formatDictado,
} from "./utils";

type Props = {
  open: boolean;
  planilla: RegularidadPlanillaDTO | null;
  loading: boolean;
  onClose: () => void;
  comisionInfo: ComisionOptionDTO | null;
  materiaInfo: MateriaOptionDTO | null;
};

function RegularidadDialog({ open, planilla, loading, onClose, comisionInfo, materiaInfo }: Props) {
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
    const estudiantesRows = planilla.estudiantes
      .map(
        (estudiante) => `
        <tr>
          <td>${estudiante.orden ?? "-"}</td>
          <td>${estudiante.apellido_nombre}</td>
          <td>${estudiante.dni}</td>
          <td>${formatNumber(estudiante.nota_tp)}</td>
          <td>${formatNumber(estudiante.nota_final)}</td>
          <td>${formatPercentage(estudiante.asistencia)}</td>
          <td>${estudiante.excepcion ? "Sí" : "No"}</td>
          <td>${estudiante.situacion || "-"}</td>
          <td>${estudiante.observaciones || "-"}</td>
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
                <th>Estudiante</th>
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
              ${estudiantesRows}
            </tbody>
          </table>
          <div class="observaciones">
            <strong>Observaciones generales:</strong>
          </div>
          <div class="firmas">
            <div><span>Firma docente</span></div>
            <div><span>Firma Bedelía / Secretaría</span></div>
          </div>
          ${situacionRefs
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
                  Año lectivo
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
                    ? ` · ${planilla.materia_anio}º año`
                    : materiaInfo?.anio
                      ? ` · ${materiaInfo.anio}º año`
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
                  Resolución
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
                  {planilla.estudiantes.map((estudiante: any) => (
                    <TableRow key={estudiante.inscripcion_id}>
                      <TableCell>{estudiante.orden ?? "-"}</TableCell>
                      <TableCell>{estudiante.dni}</TableCell>
                      <TableCell>{estudiante.apellido_nombre}</TableCell>
                      <TableCell align="right">{formatNumber(estudiante.nota_tp)}</TableCell>
                      <TableCell align="right">{formatNumber(estudiante.nota_final)}</TableCell>
                      <TableCell align="right">{formatPercentage(estudiante.asistencia)}</TableCell>
                      <TableCell>{estudiante.situacion || "-"}</TableCell>
                      <TableCell>{estudiante.observaciones || "-"}</TableCell>
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

export default RegularidadDialog;
