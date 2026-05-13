import React, { useEffect, useState } from 'react';
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Paper from "@mui/material/Paper";
import Chip from "@mui/material/Chip";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import RefreshIcon from '@mui/icons-material/Refresh';
import CircularProgress from "@mui/material/CircularProgress";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemText from "@mui/material/ListItemText";
import ListItemButton from "@mui/material/ListItemButton";
import Alert from "@mui/material/Alert";
import TextField from "@mui/material/TextField";
import Grid from "@mui/material/Grid";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import AddBoxIcon from '@mui/icons-material/AddBox';
import PrintIcon from '@mui/icons-material/Print';
import EditIcon from '@mui/icons-material/Edit';

import { listarSolicitudesMesas, procesarSolicitudMesa, listarMesas, crearMesaDesdeSolicitud, actualizarMesa } from '@/api/managementMesas';
import { listarDocentes, DocenteDTO } from '@/api/docentes';
import { SolicitudMesaAdminDTO } from '@/api/estudiantes/types';
import { obtenerMesaPlanilla, type MesaPlanillaDTO } from '@/api/estudiantes';
import { formatDate } from '@/utils/date';
import { getIpesHeaderHtml, IPES_HEADER_CSS } from "@/utils/printActaHtml";

export const SolicitudesList: React.FC = () => {
  const [solicitudes, setSolicitudes] = useState<SolicitudMesaAdminDTO[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedSolicitud, setSelectedSolicitud] = useState<SolicitudMesaAdminDTO | null>(null);
  const [mesasCompatibles, setMesasCompatibles] = useState<any[]>([]);
  const [loadingMesas, setLoadingMesas] = useState(false);
  const [openDialog, setOpenDialog] = useState(false);
  const [docentes, setDocentes] = useState<DocenteDTO[]>([]);
  const [openCreateMesaDialog, setOpenCreateMesaDialog] = useState(false);
  const [openEditMesaDialog, setOpenEditMesaDialog] = useState(false);
  const [editMesaData, setEditMesaData] = useState({
    fecha: '', hora_desde: '', docente_presidente_id: '', docente_vocal1_id: '',
    docente_vocal2_id: '', aula: '', cupo: 40, numero_mesa: ''
  });

  const handleEditMesaClick = (s: SolicitudMesaAdminDTO) => {
    setSelectedSolicitud(s);
    setEditMesaData({
      fecha: s.fecha_solicitud ? s.fecha_solicitud.substring(0, 10) : '',
      hora_desde: '', docente_presidente_id: '', docente_vocal1_id: '',
      docente_vocal2_id: '', aula: '', cupo: 40, numero_mesa: ''
    });
    setOpenEditMesaDialog(true);
  };

  const handleConfirmEditMesa = async () => {
    if (!selectedSolicitud?.mesa_asignada_id) return;
    try {
      await actualizarMesa(selectedSolicitud.mesa_asignada_id, {
        materia_id: selectedSolicitud.materia_id,
        tipo: 'EXT',
        modalidad: selectedSolicitud.modalidad || 'REG',
        fecha: editMesaData.fecha,
        hora_desde: editMesaData.hora_desde || null,
        aula: editMesaData.aula || null,
        cupo: editMesaData.cupo,
        docente_presidente_id: editMesaData.docente_presidente_id ? parseInt(editMesaData.docente_presidente_id) : null,
        docente_vocal1_id: editMesaData.docente_vocal1_id ? parseInt(editMesaData.docente_vocal1_id) : null,
        docente_vocal2_id: editMesaData.docente_vocal2_id ? parseInt(editMesaData.docente_vocal2_id) : null,
        numero_mesa: editMesaData.numero_mesa ? parseInt(editMesaData.numero_mesa) : null,
      });
      setOpenEditMesaDialog(false);
      setSelectedSolicitud(null);
      await load();
    } catch (e: any) {
      alert(e.response?.data?.message || "Error al actualizar la mesa");
    }
  };

  const [createMesaData, setCreateMesaData] = useState({
    fecha: '',
    hora_desde: '18:00',
    docente_presidente_id: '',
    docente_vocal1_id: '',
    docente_vocal2_id: '',
    aula: '',
    cupo: 40,
    numero_mesa: ''
  });

  const load = async () => {
    setLoading(true);
    try {
      const data = await listarSolicitudesMesas();
      setSolicitudes(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    listarDocentes().then(setDocentes).catch(console.error);
  }, []);

  const handleAprobarClick = async (s: SolicitudMesaAdminDTO) => {
    setSelectedSolicitud(s);
    setOpenDialog(true);
    setLoadingMesas(true);
    try {
      // Buscamos mesas extraordinarias de la misma materia
      const data = await listarMesas({ materia_id: s.materia_id });
      // Filtramos solo las EXT o las que correspondan al período
      setMesasCompatibles(data.filter(m => m.tipo === 'EXT'));
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingMesas(false);
    }
  };

  const handleCreateMesaClick = (s: SolicitudMesaAdminDTO) => {
    setSelectedSolicitud(s);
    setOpenCreateMesaDialog(true);
  };

  const handleConfirmCreateMesa = async () => {
    if (!selectedSolicitud) return;
    if (!createMesaData.fecha || !createMesaData.docente_presidente_id) {
      alert("Debe completar al menos la Fecha y el Presidente del Tribunal.");
      return;
    }

    try {
      await crearMesaDesdeSolicitud({
        solicitud_id: selectedSolicitud.id,
        fecha: createMesaData.fecha,
        hora_desde: createMesaData.hora_desde,
        aula: createMesaData.aula,
        cupo: createMesaData.cupo,
        docente_presidente_id: parseInt(createMesaData.docente_presidente_id),
        docente_vocal1_id: createMesaData.docente_vocal1_id ? parseInt(createMesaData.docente_vocal1_id) : null,
        docente_vocal2_id: createMesaData.docente_vocal2_id ? parseInt(createMesaData.docente_vocal2_id) : null,
        numero_mesa: createMesaData.numero_mesa ? parseInt(createMesaData.numero_mesa) : null,
      });
      
      setOpenCreateMesaDialog(false);
      setSelectedSolicitud(null);
      await load();
      alert("Mesa creada y alumnos vinculados correctamente.");
    } catch (e: any) {
      console.error(e);
      alert(e.response?.data?.message || "Error al crear la mesa");
    }
  };

  const confirmAprobar = async (mesaId: number) => {
    if (!selectedSolicitud) return;
    try {
      await procesarSolicitudMesa(selectedSolicitud.id, 'PRO', mesaId);
      setOpenDialog(false);
      setSelectedSolicitud(null);
      await load();
    } catch (e) {
      console.error(e);
      alert("Error al vincular la mesa");
    }
  };

  const handleImprimirActa = async (s: SolicitudMesaAdminDTO) => {
    if (!s.mesa_asignada_id) return;
    try {
      const planilla = await obtenerMesaPlanilla(s.mesa_asignada_id);
      imprimirPlanilla(planilla);
    } catch (e) {
      alert("No se pudo obtener la planilla de la mesa.");
    }
  };

  const handleRechazar = async (id: number) => {
    if (!window.confirm(`¿Estás seguro de RECHAZAR esta solicitud?`)) return;
    try {
      await procesarSolicitudMesa(id, 'REC');
      await load();
    } catch (e) {
      console.error(e);
      alert("Error al rechazar la solicitud");
    }
  };

  const imprimirPlanilla = async (planilla: MesaPlanillaDTO) => {
    const parseFecha = (s: string | null | undefined): string => {
      if (!s) return '-';
      const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
      return m ? `${m[3]}/${m[2]}/${m[1]}` : s;
    };
    const numToText = (n: number): string => {
      const u = ['CERO','UNO','DOS','TRES','CUATRO','CINCO','SEIS','SIETE','OCHO','NUEVE'];
      const esp: Record<number,string> = {10:'DIEZ',11:'ONCE',12:'DOCE',13:'TRECE',14:'CATORCE',15:'QUINCE'};
      const d = ['','','VEINTE','TREINTA','CUARENTA','CINCUENTA','SESENTA','SETENTA','OCHENTA','NOVENTA'];
      if (n < 10) return u[n];
      if (esp[n]) return esp[n];
      if (n < 20) return `DIECI${u[n-10]}`;
      if (n === 20) return 'VEINTE';
      if (n < 30) return `VEINTI${u[n-20]}`;
      const di = Math.floor(n/10), ui = n%10;
      return ui === 0 ? d[di] : `${d[di]} Y ${u[ui]}`;
    };

    const fecha = parseFecha(planilla.fecha);
    const hora = planilla.hora_desde || '08:00';
    const materiaAnio = planilla.materia_anio ? `${planilla.materia_anio}º AÑO` : '';
    const sorted = [...planilla.estudiantes]
      .map(e => ({ ...e, _display: (e.apellido_nombre || '').toUpperCase() }))
      .sort((a, b) => a._display.localeCompare(b._display, 'es'));

    const total = sorted.length;
    const ausentes = sorted.filter(e => e.condicion === 'AUS').length;
    const aprobados = sorted.filter(e => e.condicion === 'APR' || (e.nota !== null && e.nota !== undefined && Number(e.nota) >= 4)).length;
    const desaprobados = total - ausentes - aprobados;

    // Solo filas reales — sin relleno
    const estudiantesRows = sorted.map((e, i) => `
      <tr>
        <td class="tc">${i + 1}.</td>
        <td class="tc">${e.dni}</td>
        <td>${e._display}</td>
        <td class="tc"></td>
        <td class="tc"></td>
        <td class="tc">${e.nota !== null && e.nota !== undefined ? e.nota : ''}</td>
      </tr>`).join('');

    const vocales = [planilla.tribunal_vocal1, planilla.tribunal_vocal2].filter(Boolean).map(v => v!.toUpperCase()).join(' / ');

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Acta de Examen</title><style>
      @page { size: A4; margin: 12mm 14mm 18mm 14mm; }
      body { font-family: Arial, Helvetica, sans-serif; font-size: 9pt; color: #000; margin: 0; }
      ${IPES_HEADER_CSS}
      h1 { text-align: center; font-size: 12pt; font-weight: bold; letter-spacing: 1px; margin: 3mm 0 4mm 0; }
      .info { font-size: 9pt; margin-bottom: 1.5mm; }
      .info b { font-weight: bold; }
      .row-info { display: flex; gap: 6mm; margin-bottom: 1.5mm; font-size: 9pt; }
      table { width: 100%; border-collapse: collapse; margin-top: 3mm; font-size: 8.5pt; }
      th { border: 1px solid #000; padding: 3px 4px; text-align: center; font-weight: bold; font-size: 8pt; }
      td { border: 1px solid #000; padding: 3px 4px; min-height: 12px; }
      .tc { text-align: center; }
      .totales-table { width: 100%; margin-top: 4mm; font-size: 8.5pt; border: none; border-collapse: collapse; table-layout: fixed; }
      .totales-table td { border: none; padding: 1mm 2mm; white-space: nowrap; overflow: hidden; }
      .obs { margin-top: 3mm; font-size: 8.5pt; }
      .obs-line { border-bottom: 1px solid #000; height: 5mm; margin-top: 1mm; }
      .firmas { display: flex; justify-content: space-around; margin-top: 14mm; }
      .firma-box { flex: 1; text-align: center; }
      .linea-firma { border-top: 1px solid #000; margin: 0 8mm 2px; padding-top: 2px; font-size: 8pt; }
      .rol { font-weight: bold; font-size: 8pt; }
      .footer { position: fixed; bottom: 4mm; left: 0; right: 0; text-align: center; font-size: 7pt; font-style: italic; }
    </style></head><body>
      ${await getIpesHeaderHtml()}
      <h1>ACTA DE EXAMEN</h1>
      <div style="text-align:center; font-size:11pt; font-weight:bold; margin-bottom:2mm; letter-spacing:0.5px;">
        MODALIDAD: ${ planilla.modalidad === 'LIB' ? 'LIBRE' : 'REGULAR' }
      </div>
      <div class="info" style="text-align:center;"><b>PROFESORADO DE:</b> ${(planilla.profesorado_nombre || '').replace(/^profesorado de /i, '').toUpperCase()}</div>
      <div class="row-info">
        <span><b>ACTA N°:</b>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span>
        <span><b>FOLIO N°:</b>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span>
        <span><b>FECHA:</b> ${fecha}</span>
        <span><b>HORA:</b> ${hora}</span>
        <span><b>MESA N°:</b> ${planilla.numero_mesa ?? '-'}</span>
      </div>
      <div class="row-info">
        <span><b>UNIDAD CURRICULAR:</b> ${planilla.materia_nombre.toUpperCase()}</span>
        <span><b>${materiaAnio}</b></span>
        <span><b>PLAN:</b> ${planilla.plan_resolucion || '-'}</span>
      </div>
      <div class="info"><b>PROFESOR TITULAR:</b> ${(planilla.tribunal_presidente || '').toUpperCase()}</div>
      <div class="info"><b>PROFESORES/AS VOCALES:</b> ________________________________</div>

      <table>
        <thead><tr>
          <th style="width:22px">Nº</th>
          <th style="width:68px">D.N.I.</th>
          <th>APELLIDO Y NOMBRE DEL ALUMNO</th>
          <th style="width:65px">EXAMEN<br>ESCRITO</th>
          <th style="width:65px">EXAMEN<br>ORAL</th>
          <th style="width:65px">PROMEDIO</th>
        </tr></thead>
        <tbody>${estudiantesRows}</tbody>
      </table>

      <div style="margin-top:4mm; font-size:8.5pt; display:grid; grid-template-columns:1fr 1fr; gap:1mm 6mm;">
        <div>Total de alumnos inscriptos: <b>${total}</b> (<b>${numToText(total)}</b>)</div>
        <div>Total de alumnos ausentes: <span style="display:inline-block;width:8mm;border-bottom:1px solid #000;">&nbsp;</span> (<span style="display:inline-block;width:28mm;border-bottom:1px solid #000;">&nbsp;</span>)</div>
        <div>Total de alumnos aprobados: <span style="display:inline-block;width:8mm;border-bottom:1px solid #000;">&nbsp;</span> (<span style="display:inline-block;width:28mm;border-bottom:1px solid #000;">&nbsp;</span>)</div>
        <div>Total de alumnos desaprobados: <span style="display:inline-block;width:8mm;border-bottom:1px solid #000;">&nbsp;</span> (<span style="display:inline-block;width:28mm;border-bottom:1px solid #000;">&nbsp;</span>)</div>
      </div>

      <div class="obs"><b>OBSERVACIONES:</b><div class="obs-line"></div><div class="obs-line"></div></div>

      <div class="firmas">
        <div class="firma-box"><div class="linea-firma"></div><div class="rol">Vocal</div></div>
        <div class="firma-box"><div class="linea-firma">${(planilla.tribunal_presidente || '').toUpperCase()}</div><div class="rol">Presidente</div></div>
        <div class="firma-box"><div class="linea-firma"></div><div class="rol">Vocal</div></div>
      </div>
      <div class="footer">"Las Islas Malvinas, Georgia y Sándwich del Sur, son y serán Argentinas"</div>
    </body></html>`;
    const w = window.open('', '_blank');
    if (w) {
      w.document.write(html);
      w.document.close();
      w.focus();
      w.onload = () => w.print();
    }
  };

  if (loading && solicitudes.length === 0) return <CircularProgress />;

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h6" fontWeight={700}>Gestión de Solicitudes Extraordinarias</Typography>
        <IconButton onClick={load} disabled={loading} color="primary">
          <RefreshIcon />
        </IconButton>
      </Stack>

      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead sx={{ bgcolor: 'grey.50' }}>
            <TableRow>
              <TableCell sx={{ fontWeight: 700 }}>Fecha</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Estudiante</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>DNI</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Materia</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Condición</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Profesorado</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Estado</TableCell>
              <TableCell align="center" sx={{ fontWeight: 700 }}>Acciones</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {solicitudes.map((s) => (
              <TableRow key={s.id} hover>
                <TableCell>{formatDate(s.fecha_solicitud)}</TableCell>
                <TableCell>{s.estudiante_nombre}</TableCell>
                <TableCell>{s.estudiante_dni}</TableCell>
                <TableCell>{s.materia_nombre}</TableCell>
                <TableCell>
                  <Chip 
                    label={s.modalidad_display || (s.modalidad === 'REG' ? 'Regular' : 'Libre')} 
                    variant="outlined" 
                    size="small" 
                    color={s.modalidad === 'LIB' ? 'secondary' : 'default'}
                  />
                </TableCell>
                <TableCell>{s.profesorado_nombre}</TableCell>
                <TableCell>
                  <Chip 
                    label={s.estado_display} 
                    color={s.estado === 'PRO' ? 'success' : s.estado === 'REC' ? 'error' : 'warning'} 
                    size="small" 
                  />
                </TableCell>
                <TableCell align="center">
                  {s.estado === 'PEN' && (
                    <Stack direction="row" spacing={1} justifyContent="center">
                      <Tooltip title="Vincular a Mesa Existente">
                        <IconButton size="small" color="success" onClick={() => handleAprobarClick(s)}>
                          <CheckCircleIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Crear Mesa Nueva (Agrupa similares)">
                        <IconButton size="small" color="primary" onClick={() => handleCreateMesaClick(s)}>
                          <AddBoxIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Rechazar">
                        <IconButton size="small" color="error" onClick={() => handleRechazar(s.id)}>
                          <CancelIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Stack>
                  )}
                  {s.estado !== 'PEN' && (
                    <Stack direction="row" spacing={0.5} justifyContent="center">
                      {s.estado === 'PRO' && s.mesa_asignada_id && (
                        <>
                          <Tooltip title="Editar Mesa">
                            <IconButton size="small" color="warning" onClick={() => handleEditMesaClick(s)}>
                              <EditIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Imprimir Acta de Examen">
                            <IconButton size="small" color="primary" onClick={() => handleImprimirActa(s)}>
                              <PrintIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </>
                      )}
                      {s.estado === 'REC' && (
                        <Typography variant="caption" color="error">Rechazada</Typography>
                      )}
                    </Stack>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {solicitudes.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                  No hay solicitudes registradas.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Vincular a Mesa de Examen</DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
            Seleccioná la mesa extraordinaria a la cual querés incorporar a <b>{selectedSolicitud?.estudiante_nombre}</b> para la materia <b>{selectedSolicitud?.materia_nombre}</b>.
            <br />
            <i>Al aprobar, el alumno quedará inscripto automáticamente y no podrá darse de baja.</i>
          </Typography>

          {loadingMesas ? <CircularProgress size={24} /> : (
            <List sx={{ pt: 0 }}>
              {mesasCompatibles.length === 0 ? (
                <Alert severity="warning">No hay mesas extraordinarias creadas para esta materia. Debes crear la mesa primero en la pestaña de Mesas.</Alert>
              ) : (
                mesasCompatibles.map((m) => (
                  <ListItem disableGutters key={m.id}>
                    <ListItemButton onClick={() => confirmAprobar(m.id)} sx={{ border: '1px solid #eee', borderRadius: 1, mb: 1 }}>
                      <ListItemText 
                        primary={`${formatDate(m.fecha)} - ${m.hora_desde || ''}`} 
                        secondary={`Aula: ${m.aula || 'N/A'} | Modalidad: ${m.modalidad === 'REG' ? 'Regular' : 'Libre'}`} 
                      />
                    </ListItemButton>
                  </ListItem>
                ))
              )}
            </List>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(false)}>Cancelar</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={openCreateMesaDialog} onClose={() => setOpenCreateMesaDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Crear Nueva Mesa y Agrupar Alumnos</DialogTitle>
        <DialogContent dividers>
          <Alert severity="info" sx={{ mb: 3 }}>
            Se creará una mesa extraordinaria para <b>{selectedSolicitud?.materia_nombre}</b> ({selectedSolicitud?.modalidad === 'REG' ? 'Regular' : 'Libre'}) y se vincularán <b>automáticamente</b> todos los alumnos con pedidos pendientes para esta misma materia y condición.
          </Alert>
          
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth label="Fecha" type="date" InputLabelProps={{ shrink: true }}
                value={createMesaData.fecha}
                onChange={(e) => setCreateMesaData({...createMesaData, fecha: e.target.value})}
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth label="Hora" type="time" InputLabelProps={{ shrink: true }}
                value={createMesaData.hora_desde}
                onChange={(e) => setCreateMesaData({...createMesaData, hora_desde: e.target.value})}
              />
            </Grid>
            <Grid item xs={12} sm={2}>
              <TextField
                fullWidth label="N° Mesa" type="number" size="small" InputLabelProps={{ shrink: true }}
                value={createMesaData.numero_mesa}
                onChange={(e) => setCreateMesaData({...createMesaData, numero_mesa: e.target.value})}
              />
            </Grid>

            <Grid item xs={12}>
              <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 700 }}>Tribunal Evaluador</Typography>
            </Grid>
            
            <Grid item xs={12} sm={4}>
              <FormControl fullWidth size="small">
                <InputLabel>Presidente</InputLabel>
                <Select
                  label="Presidente"
                  value={createMesaData.docente_presidente_id}
                  onChange={(e) => setCreateMesaData({...createMesaData, docente_presidente_id: e.target.value})}
                >
                  {docentes.map(d => (
                    <MenuItem key={d.id} value={d.id}>{d.apellido}, {d.nombre}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            
            <Grid item xs={12} sm={4}>
              <FormControl fullWidth size="small">
                <InputLabel>Vocal 1</InputLabel>
                <Select
                  label="Vocal 1"
                  value={createMesaData.docente_vocal1_id}
                  onChange={(e) => setCreateMesaData({...createMesaData, docente_vocal1_id: e.target.value})}
                >
                  <MenuItem value=""><em>Ninguno</em></MenuItem>
                  {docentes.map(d => (
                    <MenuItem key={d.id} value={d.id}>{d.apellido}, {d.nombre}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            
            <Grid item xs={12} sm={4}>
              <FormControl fullWidth size="small">
                <InputLabel>Vocal 2</InputLabel>
                <Select
                  label="Vocal 2"
                  value={createMesaData.docente_vocal2_id}
                  onChange={(e) => setCreateMesaData({...createMesaData, docente_vocal2_id: e.target.value})}
                >
                  <MenuItem value=""><em>Ninguno</em></MenuItem>
                  {docentes.map(d => (
                    <MenuItem key={d.id} value={d.id}>{d.apellido}, {d.nombre}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            
            <Grid item xs={12} sm={8}>
              <TextField 
                fullWidth label="Aula / Espacio" size="small"
                value={createMesaData.aula}
                onChange={(e) => setCreateMesaData({...createMesaData, aula: e.target.value})}
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField 
                fullWidth label="Cupo" type="number" size="small"
                value={createMesaData.cupo}
                onChange={(e) => setCreateMesaData({...createMesaData, cupo: parseInt(e.target.value)})}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenCreateMesaDialog(false)}>Cancelar</Button>
          <Button onClick={handleConfirmCreateMesa} variant="contained" color="primary">Crear Mesa y Vincular Alumnos</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={openEditMesaDialog} onClose={() => setOpenEditMesaDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Editar Mesa Aprobada</DialogTitle>
        <DialogContent dividers>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth label="Fecha" type="date" InputLabelProps={{ shrink: true }}
                value={editMesaData.fecha}
                onChange={(e) => setEditMesaData({...editMesaData, fecha: e.target.value})}
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField fullWidth label="Hora" type="time" InputLabelProps={{ shrink: true }}
                value={editMesaData.hora_desde}
                onChange={(e) => setEditMesaData({...editMesaData, hora_desde: e.target.value})}
              />
            </Grid>
            <Grid item xs={12} sm={2}>
              <TextField fullWidth label="N° Mesa" type="number" size="small" InputLabelProps={{ shrink: true }}
                value={editMesaData.numero_mesa}
                onChange={(e) => setEditMesaData({...editMesaData, numero_mesa: e.target.value})}
              />
            </Grid>
            <Grid item xs={12}>
              <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 700 }}>Tribunal Evaluador</Typography>
            </Grid>
            <Grid item xs={12} sm={4}>
              <FormControl fullWidth size="small">
                <InputLabel>Presidente</InputLabel>
                <Select label="Presidente" value={editMesaData.docente_presidente_id}
                  onChange={(e) => setEditMesaData({...editMesaData, docente_presidente_id: e.target.value})}>
                  <MenuItem value=""><em>Ninguno</em></MenuItem>
                  {docentes.map(d => <MenuItem key={d.id} value={d.id}>{d.apellido}, {d.nombre}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={4}>
              <FormControl fullWidth size="small">
                <InputLabel>Vocal 1</InputLabel>
                <Select label="Vocal 1" value={editMesaData.docente_vocal1_id}
                  onChange={(e) => setEditMesaData({...editMesaData, docente_vocal1_id: e.target.value})}>
                  <MenuItem value=""><em>Ninguno</em></MenuItem>
                  {docentes.map(d => <MenuItem key={d.id} value={d.id}>{d.apellido}, {d.nombre}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={4}>
              <FormControl fullWidth size="small">
                <InputLabel>Vocal 2</InputLabel>
                <Select label="Vocal 2" value={editMesaData.docente_vocal2_id}
                  onChange={(e) => setEditMesaData({...editMesaData, docente_vocal2_id: e.target.value})}>
                  <MenuItem value=""><em>Ninguno</em></MenuItem>
                  {docentes.map(d => <MenuItem key={d.id} value={d.id}>{d.apellido}, {d.nombre}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={8}>
              <TextField fullWidth label="Aula / Espacio" size="small"
                value={editMesaData.aula}
                onChange={(e) => setEditMesaData({...editMesaData, aula: e.target.value})}
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField fullWidth label="Cupo" type="number" size="small"
                value={editMesaData.cupo}
                onChange={(e) => setEditMesaData({...editMesaData, cupo: parseInt(e.target.value)})}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenEditMesaDialog(false)}>Cancelar</Button>
          <Button onClick={handleConfirmEditMesa} variant="contained" color="warning">Guardar Cambios</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
