import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Button,
  TextField,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  Alert,
  CircularProgress,
} from '@mui/material';
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  CheckCircle as CheckCircleIcon,
  Search as SearchIcon,
  FilterList as FilterIcon,
} from '@mui/icons-material';
import axios from 'axios';

interface Preinscripcion {
  id: number;
  dni: string;
  nombre: string;
  apellido: string;
  email: string | null;
  telefono: string | null;
  carrera_nombre: string;
  carrera_id: number;
  anio: number;
  estado: string;
  estado_display: string;
}

const PreInscritos: React.FC = () => {
  const [data, setData] = useState<Preinscripcion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // States para filtros
  const [search, setSearch] = useState('');
  const [filterAnio, setFilterAnio] = useState<string>('');
  const [filterCarrera, setFilterCarrera] = useState<string>('');
  
  // State para carreras (para el filtro y edición)
  const [carreras, setCarreras] = useState<{id: number, nombre: string}[]>([]);

  // States para modales
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [selectedPre, setSelectedPre] = useState<Preinscripcion | null>(null);
  const [editForm, setEditForm] = useState({
    nombre: '',
    apellido: '',
    email: '',
    telefono: '',
    carrera_id: 0,
    anio: 2026
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (search) params.search = search;
      if (filterAnio) params.anio = filterAnio;
      if (filterCarrera) params.carrera_id = filterCarrera;

      const response = await axios.get('/api/preinscriptions/admin/list', { params });
      setData(response.data);
      setError(null);
    } catch (err) {
      console.error(err);
      setError('Error al cargar los datos');
    } finally {
      setLoading(false);
    }
  };

  const fetchCarreras = async () => {
    try {
      // Asumiendo que existe un endpoint de carreras
      const response = await axios.get('/api/profesorados');
      setCarreras(response.data);
    } catch (err) {
      console.error("Error cargando carreras");
    }
  };

  useEffect(() => {
    fetchData();
    fetchCarreras();
  }, []);

  const handleSearch = () => {
    fetchData();
  };

  const handleEditClick = (pre: Preinscripcion) => {
    setSelectedPre(pre);
    setEditForm({
      nombre: pre.nombre,
      apellido: pre.apellido,
      email: pre.email || '',
      telefono: pre.telefono || '',
      carrera_id: pre.carrera_id,
      anio: pre.anio
    });
    setEditModalOpen(true);
  };

  const handleConfirmClick = (pre: Preinscripcion) => {
    setSelectedPre(pre);
    setConfirmModalOpen(true);
  };

  const handleDeleteClick = async (id: number) => {
    if (window.confirm('¿Está seguro de eliminar esta preinscripción?')) {
      try {
        await axios.delete(`/api/preinscriptions/admin/${id}`);
        fetchData();
      } catch (err) {
        alert('Error al eliminar');
      }
    }
  };

  const handleSaveEdit = async () => {
    if (!selectedPre) return;
    try {
      await axios.patch(`/api/preinscriptions/admin/${selectedPre.id}`, editForm);
      setEditModalOpen(false);
      fetchData();
    } catch (err) {
      alert('Error al guardar cambios');
    }
  };

  const handleConfirmAlta = async () => {
    if (!selectedPre) return;
    try {
      await axios.post(`/api/preinscriptions/admin/${selectedPre.id}/confirmar`);
      setConfirmModalOpen(false);
      fetchData();
    } catch (err) {
      alert('Error al confirmar alta');
    }
  };

  return (
    <Box sx={{ p: 4 }}>
      <Typography variant="h4" sx={{ mb: 4, fontWeight: 'bold', color: 'primary.main' }}>
        Listado de Pre-Inscritos
      </Typography>

      <Paper sx={{ p: 3, mb: 4, borderRadius: 2, display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
        <TextField
          label="Buscar por DNI o Nombre"
          variant="outlined"
          size="small"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{ minWidth: 250 }}
          onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
        />
        
        <FormControl size="small" sx={{ minWidth: 150 }}>
          <InputLabel>Año</InputLabel>
          <Select
            value={filterAnio}
            label="Año"
            onChange={(e) => setFilterAnio(e.target.value)}
          >
            <MenuItem value="">Todos</MenuItem>
            <MenuItem value="2025">2025</MenuItem>
            <MenuItem value="2026">2026</MenuItem>
          </Select>
        </FormControl>

        <FormControl size="small" sx={{ minWidth: 200 }}>
          <InputLabel>Carrera</InputLabel>
          <Select
            value={filterCarrera}
            label="Carrera"
            onChange={(e) => setFilterCarrera(e.target.value)}
          >
            <MenuItem value="">Todas</MenuItem>
            {carreras.map(c => (
              <MenuItem key={c.id} value={c.id.toString()}>{c.nombre}</MenuItem>
            ))}
          </Select>
        </FormControl>

        <Button
          variant="contained"
          startIcon={<SearchIcon />}
          onClick={handleSearch}
          sx={{ height: 40 }}
        >
          Filtrar
        </Button>
      </Paper>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <TableContainer component={Paper} sx={{ borderRadius: 2, boxShadow: 3 }}>
        <Table>
          <TableHead sx={{ bgcolor: 'grey.100' }}>
            <TableRow>
              <TableCell sx={{ fontWeight: 'bold' }}>DNI</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }}>Apellido y Nombre</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }}>Carrera</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }}>Año</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }}>Estado</TableCell>
              <TableCell sx={{ fontWeight: 'bold', textAlign: 'center' }}>Acciones</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} align="center" sx={{ py: 3 }}>
                  <CircularProgress size={30} />
                </TableCell>
              </TableRow>
            ) : data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} align="center" sx={{ py: 3 }}>
                  No se encontraron preinscripciones.
                </TableCell>
              </TableRow>
            ) : (
              data.map((row) => (
                <TableRow key={row.id} hover>
                  <TableCell>{row.dni}</TableCell>
                  <TableCell>{row.apellido}, {row.nombre}</TableCell>
                  <TableCell>{row.carrera_nombre}</TableCell>
                  <TableCell>{row.anio}</TableCell>
                  <TableCell>
                    <Typography variant="body2" sx={{
                      bgcolor: row.estado === 'APR' ? 'success.light' : 'warning.light',
                      color: row.estado === 'APR' ? 'success.dark' : 'warning.dark',
                      px: 1, py: 0.5, borderRadius: 1, display: 'inline-block'
                    }}>
                      {row.estado_display}
                    </Typography>
                  </TableCell>
                  <TableCell align="center">
                    <Tooltip title="Confirmar Alta (Formalizar)">
                      <IconButton color="success" onClick={() => handleConfirmClick(row)}>
                        <CheckCircleIcon />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Editar Datos">
                      <IconButton color="primary" onClick={() => handleEditClick(row)}>
                        <EditIcon />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Eliminar">
                      <IconButton color="error" onClick={() => handleDeleteClick(row.id)}>
                        <DeleteIcon />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Modal Edición */}
      <Dialog open={editModalOpen} onClose={() => setEditModalOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Editar Pre-Inscripción</DialogTitle>
        <DialogContent sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Box sx={{ display: 'flex', gap: 2, mt: 1 }}>
            <TextField label="Nombre" fullWidth value={editForm.nombre} onChange={(e)=>setEditForm({...editForm, nombre: e.target.value})} />
            <TextField label="Apellido" fullWidth value={editForm.apellido} onChange={(e)=>setEditForm({...editForm, apellido: e.target.value})} />
          </Box>
          <TextField label="Email" fullWidth value={editForm.email} onChange={(e)=>setEditForm({...editForm, email: e.target.value})} />
          <TextField label="Teléfono" fullWidth value={editForm.telefono} onChange={(e)=>setEditForm({...editForm, telefono: e.target.value})} />
          <FormControl fullWidth>
            <InputLabel>Carrera</InputLabel>
            <Select
              value={editForm.carrera_id}
              label="Carrera"
              onChange={(e) => setEditForm({...editForm, carrera_id: e.target.value as number})}
            >
              {carreras.map(c => (
                <MenuItem key={c.id} value={c.id}>{c.nombre}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField label="Año Lectivo" type="number" fullWidth value={editForm.anio} onChange={(e)=>setEditForm({...editForm, anio: parseInt(e.target.value)})} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditModalOpen(false)}>Cancelar</Button>
          <Button variant="contained" onClick={handleSaveEdit}>Guardar Cambios</Button>
        </DialogActions>
      </Dialog>

      {/* Modal Confirmación Alta */}
      <Dialog open={confirmModalOpen} onClose={() => setConfirmModalOpen(false)}>
        <DialogTitle>Confirmar Alta de Estudiante</DialogTitle>
        <DialogContent>
          <Typography>
            ¿Desea formalizar la inscripción de <strong>{selectedPre?.apellido}, {selectedPre?.nombre}</strong>?
          </Typography>
          <Typography variant="body2" sx={{ mt: 1, color: 'text.secondary' }}>
            Esto aceptará la preinscripción y marcará al estudiante como confirmado en el sistema.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmModalOpen(false)}>Cancelar</Button>
          <Button variant="contained" color="success" onClick={handleConfirmAlta}>Confirmar Alta</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default PreInscritos;
