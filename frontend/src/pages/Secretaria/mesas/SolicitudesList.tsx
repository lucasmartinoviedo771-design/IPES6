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

import { listarSolicitudesMesas, procesarSolicitudMesa, listarMesas, crearMesaDesdeSolicitud } from '@/api/managementMesas';
import { listarDocentes, DocenteDTO } from '@/api/docentes';
import { SolicitudMesaAdminDTO } from '@/api/estudiantes/types';
import { formatDate } from '@/utils/date';

export const SolicitudesList: React.FC = () => {
  const [solicitudes, setSolicitudes] = useState<SolicitudMesaAdminDTO[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedSolicitud, setSelectedSolicitud] = useState<SolicitudMesaAdminDTO | null>(null);
  const [mesasCompatibles, setMesasCompatibles] = useState<any[]>([]);
  const [loadingMesas, setLoadingMesas] = useState(false);
  const [openDialog, setOpenDialog] = useState(false);
  const [docentes, setDocentes] = useState<DocenteDTO[]>([]);
  const [openCreateMesaDialog, setOpenCreateMesaDialog] = useState(false);
  const [createMesaData, setCreateMesaData] = useState({
    fecha: '',
    hora_desde: '18:00',
    docente_presidente_id: '',
    docente_vocal1_id: '',
    docente_vocal2_id: '',
    aula: '',
    cupo: 40
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
                    <Typography variant="caption" color="textSecondary">Mesa Aprobada</Typography>
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
            <Grid item xs={12} sm={6}>
              <TextField 
                fullWidth label="Hora" type="time" InputLabelProps={{ shrink: true }}
                value={createMesaData.hora_desde}
                onChange={(e) => setCreateMesaData({...createMesaData, hora_desde: e.target.value})}
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
    </Box>
  );
};
