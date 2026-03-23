import React, { useState } from 'react';
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import Container from "@mui/material/Container";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import Breadcrumbs from "@mui/material/Breadcrumbs";
import Link from "@mui/material/Link";
import CircularProgress from "@mui/material/CircularProgress";
import Alert from "@mui/material/Alert";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import TableSortLabel from "@mui/material/TableSortLabel";
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import AssignmentLateIcon from '@mui/icons-material/AssignmentLate';
import VisibilityIcon from '@mui/icons-material/Visibility';
import EditIcon from '@mui/icons-material/Edit';
import { listarHistoricoMesasPandemia } from '@/api/primeraCarga';
import { actualizarMesaPlanilla, obtenerMesaPlanilla } from '@/api/estudiantes';
import { INSTITUTIONAL_TERRACOTTA } from '@/styles/institutionalColors';

const HistorialMesasPandemiaPage: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selectedMesa, setSelectedMesa] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editData, setEditData] = useState<any[]>([]);
  const [condiciones, setCondiciones] = useState<any[]>([]);
  const [loadingPlanilla, setLoadingPlanilla] = useState(false);
  const [ordering, setOrdering] = useState<string>('-fecha');

  const handleRequestSort = (property: string) => {
    const isAsc = ordering === property;
    const newOrdering = isAsc ? `-${property}` : property;
    setOrdering(newOrdering);
  };

  const query = useQuery({
    queryKey: ['historial-mesas-pandemia', ordering],
    queryFn: () => listarHistoricoMesasPandemia({ ordering }),
  });

  const mutation = useMutation({
    mutationFn: (data: { id: number; payload: any }) => actualizarMesaPlanilla(data.id, data.payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['historial-mesas-pandemia'] });
      setIsModalOpen(false);
      alert('Cambios guardados correctamente.');
    },
    onError: () => {
      alert('Error al guardar los cambios.');
    }
  });

  const handleOpenPlanilla = async (mesa: any) => {
    setSelectedMesa(mesa);
    setIsModalOpen(true);
    setLoadingPlanilla(true);
    try {
      const data = await obtenerMesaPlanilla(mesa.id);
      setEditData(data.estudiantes);
      setCondiciones(data.condiciones);
    } catch (error) {
      console.error(error);
      setEditData(mesa.estudiantes_detalle || []);
    } finally {
      setLoadingPlanilla(false);
    }
  };

  const handleUpdateGrade = (inscripcionId: number, field: string, value: any) => {
    setEditData(prev => prev.map(item => 
      item.inscripcion_id === inscripcionId ? { ...item, [field]: value } : item
    ));
  };

  const handleSave = () => {
    if (!selectedMesa) return;
    const payload = {
      estudiantes: editData.map(est => ({
        inscripcion_id: est.inscripcion_id,
        condicion: est.condicion,
        nota: est.nota,
        folio: est.folio,
        libro: est.libro,
        observaciones: est.observaciones,
        fecha_resultado: est.fecha_resultado || selectedMesa.fecha,
      }))
    };
    mutation.mutate({ id: selectedMesa.id, payload });
  };

  return (
    <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
      <Stack spacing={3}>
        {/* ENCABEZADO Y BREADCRUMBS */}
        <Box>
          <Breadcrumbs aria-label="breadcrumb" sx={{ mb: 1 }}>
            <Link color="inherit" underline="hover" onClick={() => navigate('/admin/dashboard')} sx={{ cursor: 'pointer' }}>
              Dashboard
            </Link>
            <Link color="inherit" underline="hover" onClick={() => navigate('/admin/primera-carga')} sx={{ cursor: 'pointer' }}>
              Primera Carga
            </Link>
            <Typography color="text.primary">Historial Pandemia</Typography>
          </Breadcrumbs>
          <Stack direction="row" alignItems="center" spacing={2}>
            <Box
              sx={{
                width: 48,
                height: 48,
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'linear-gradient(135deg, #b06000 0%, #7a3b00 100%)',
                color: 'white',
              }}
            >
              <AssignmentLateIcon />
            </Box>
            <Box>
              <Typography variant="h5" fontWeight={700}>
                Histórico de Mesas de Pandemia
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Listado de todas las mesas de examen registradas bajo el protocolo de la pandemia.
              </Typography>
            </Box>
          </Stack>
        </Box>

        {/* FILTROS DE ORDENAMIENTO */}
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 1 }}>
          <TextField
            select
            label="Ordenar por"
            size="small"
            value={ordering}
            onChange={(e) => setOrdering(e.target.value)}
            sx={{ width: 250 }}
          >
             <MenuItem value="-fecha">Fecha (Más recientes primero)</MenuItem>
             <MenuItem value="fecha">Fecha (Más antiguas primero)</MenuItem>
             <MenuItem value="-id">ID Mesa (Mayor a menor)</MenuItem>
             <MenuItem value="id">ID Mesa (Menor a mayor)</MenuItem>
             <MenuItem value="materia__nombre">Materia (A-Z)</MenuItem>
             <MenuItem value="-materia__nombre">Materia (Z-A)</MenuItem>
             <MenuItem value="-cantidad_estudiantes">Más estudiantes</MenuItem>
             <MenuItem value="cantidad_estudiantes">Menos estudiantes</MenuItem>
          </TextField>
        </Box>

        {/* CONTENIDO (TABLA) */}
        <Card variant="outlined">
          {query.isLoading ? (
            <Box sx={{ p: 4, display: 'flex', justifyContent: 'center' }}>
              <CircularProgress />
            </Box>
          ) : query.isError ? (
            <Box sx={{ p: 2 }}>
              <Alert severity="error">Error al cargar el histórico de mesas de pandemia.</Alert>
            </Box>
          ) : !query.data?.length ? (
            <Box sx={{ p: 4, textAlign: 'center' }}>
              <Typography color="text.secondary">No hay historiales de actas de pandemia registrados.</Typography>
            </Box>
          ) : (
            <TableContainer component={Paper} elevation={0}>
              <Table size="medium">
                <TableHead>
                  <TableRow sx={{ bgcolor: 'grey.50' }}>
                    <TableCell>
                      <TableSortLabel
                        active={ordering === 'id' || ordering === '-id'}
                        direction={ordering === 'id' ? 'asc' : 'desc'}
                        onClick={() => handleRequestSort('id')}
                      >
                        ID Mesa
                      </TableSortLabel>
                    </TableCell>
                    <TableCell>
                      <TableSortLabel
                        active={ordering === 'fecha' || ordering === '-fecha'}
                        direction={ordering === 'fecha' ? 'asc' : 'desc'}
                        onClick={() => handleRequestSort('fecha')}
                      >
                        Fecha
                      </TableSortLabel>
                    </TableCell>
                    <TableCell>Profesorado</TableCell>
                    <TableCell>
                      <TableSortLabel
                        active={ordering === 'materia__nombre' || ordering === '-materia__nombre'}
                        direction={ordering === 'materia__nombre' ? 'asc' : 'desc'}
                        onClick={() => handleRequestSort('materia__nombre')}
                      >
                        Materia
                      </TableSortLabel>
                    </TableCell>
                    <TableCell>Docente a cargo</TableCell>
                    <TableCell align="center">
                      <TableSortLabel
                        active={ordering === 'cantidad_estudiantes' || ordering === '-cantidad_estudiantes'}
                        direction={ordering === 'cantidad_estudiantes' ? 'asc' : 'desc'}
                        onClick={() => handleRequestSort('cantidad_estudiantes')}
                      >
                        Estudiantes
                      </TableSortLabel>
                    </TableCell>
                    <TableCell align="center">Acciones</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {query.data.map((row) => (
                    <TableRow key={row.id} hover>
                      <TableCell>
                        <Typography variant="body2" fontWeight={600} color={INSTITUTIONAL_TERRACOTTA}>
                          M-{row.id}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        {new Date(row.fecha + 'T12:00:00Z').toLocaleDateString()}
                      </TableCell>
                      <TableCell>{row.profesorado_nombre}</TableCell>
                      <TableCell>{row.materia_nombre}</TableCell>
                      <TableCell>{row.docente_presidente}</TableCell>
                      <TableCell align="center">
                        <Box sx={{ 
                          bgcolor: 'grey.100', 
                          borderRadius: 2, 
                          py: 0.5, 
                          px: 1.5, 
                          display: 'inline-block',
                          fontWeight: 600,
                          fontSize: '0.875rem'
                        }}>
                          {row.cantidad_estudiantes}
                        </Box>
                      </TableCell>
                      <TableCell align="center">
                        <Tooltip title="Ver / Editar Notas">
                          <IconButton size="small" onClick={() => handleOpenPlanilla(row)} color="primary">
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Card>
      </Stack>

      {/* DIALOGO DE PLANILLA */}
      <Dialog open={isModalOpen} onClose={() => setIsModalOpen(false)} maxWidth="lg" fullWidth>
        <DialogTitle>
          Resultados de Mesa: {selectedMesa?.materia_nombre}
          <Typography variant="body2" color="text.secondary">
            M-{selectedMesa?.id} | {selectedMesa?.fecha} | {selectedMesa?.profesorado_nombre}
          </Typography>
        </DialogTitle>
        <DialogContent dividers>
          {loadingPlanilla ? (
            <Box sx={{ p: 4, textAlign: 'center' }}><CircularProgress /></Box>
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>DNI</TableCell>
                    <TableCell>Estudiante</TableCell>
                    <TableCell>Condición</TableCell>
                    <TableCell>Nota</TableCell>
                    <TableCell>Folio</TableCell>
                    <TableCell>Observaciones</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {editData.map((est: any) => (
                    <TableRow key={est.inscripcion_id}>
                      <TableCell>{est.dni}</TableCell>
                      <TableCell>{est.apellido_nombre || est.nombre}</TableCell>
                      <TableCell>
                        <TextField
                          select
                          size="small"
                          value={est.condicion || ''}
                          onChange={(e) => handleUpdateGrade(est.inscripcion_id, 'condicion', e.target.value)}
                          sx={{ minWidth: 120 }}
                        >
                          {condiciones.map(c => <MenuItem key={c.value} value={c.value}>{c.label}</MenuItem>)}
                        </TextField>
                      </TableCell>
                      <TableCell>
                        <TextField
                          type="number"
                          size="small"
                          value={est.nota ?? ''}
                          onChange={(e) => handleUpdateGrade(est.inscripcion_id, 'nota', e.target.value)}
                          inputProps={{ step: 0.5, min: 0, max: 10 }}
                          sx={{ width: 80 }}
                        />
                      </TableCell>
                      <TableCell>
                        <TextField
                          size="small"
                          value={est.folio || ''}
                          onChange={(e) => handleUpdateGrade(est.inscripcion_id, 'folio', e.target.value)}
                          sx={{ width: 100 }}
                        />
                      </TableCell>
                      <TableCell>
                        <TextField
                          size="small"
                          value={est.observaciones || ''}
                          onChange={(e) => handleUpdateGrade(est.inscripcion_id, 'observaciones', e.target.value)}
                          fullWidth
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsModalOpen(false)}>Cancelar</Button>
          <Button 
            variant="contained" 
            onClick={handleSave} 
            disabled={mutation.isPending}
            startIcon={mutation.isPending ? <CircularProgress size={20} /> : null}
          >
            Guardar Cambios
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default HistorialMesasPandemiaPage;

