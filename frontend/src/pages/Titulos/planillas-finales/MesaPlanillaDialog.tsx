import { useMemo } from "react";
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

import { type MesaPlanillaDTO, type MesaPlanillaEstudianteDTO } from "@/api/estudiantes";
import logoMinisterio from "@/assets/escudo_ministerio_tdf.png";
import logoIpes from "@/assets/logo_ipes.png";

import {
  formatDate,
  formatHora,
  formatModalidad,
  formatMesaTipo,
  formatDictado,
} from "./utils";

type Props = {
  open: boolean;
  planilla: MesaPlanillaDTO | null;
  loading: boolean;
  onClose: () => void;
};

function MesaPlanillaDialog({ open, planilla, loading, onClose }: Props) {
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

export default MesaPlanillaDialog;
