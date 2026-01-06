import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  TextField,
  InputAdornment,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Chip,
  Button,
  FormControlLabel,
  Checkbox,
  CircularProgress,
  Alert,
  Tooltip,
  MenuItem,
  Select,
  FormControl,
  InputLabel
} from '@mui/material';
import {
  Search as SearchIcon,
  Visibility as ViewIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

interface Preinscripcion {
  id: number;
  codigo: string;
  alumno: {
    dni: string;
    nombre_completo: string;
    user: {
      first_name: string;
      last_name: string;
    }
  };
  carrera: {
    nombre: string;
  };
  created_at: string;
  estado: string;
  activa: boolean;
}

interface Profesorado {
  id: number;
  nombre: string;
}

const FormalizarInscripcion: React.FC = () => {
  const navigate = useNavigate();
  const [preinscripciones, setPreinscripciones] = useState<Preinscripcion[]>([]);
  const [profesorados, setProfesorados] = useState<Profesorado[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [includeInactive, setIncludeInactive] = useState(false);
  const [selectedProfesorado, setSelectedProfesorado] = useState<string | number>('');

  const fetchProfesorados = async () => {
    try {
      const response = await axios.get('/api/profesorados');
      setProfesorados(response.data);
    } catch (err) {
      console.error("Error al cargar profesorados", err);
    }
  };

  const fetchPreinscripciones = async () => {
    setLoading(true);
    try {
      const response = await axios.get('/api/preinscriptions/', {
        params: {
          search: searchQuery || undefined,
          include_inactive: includeInactive,
          profesorado_id: selectedProfesorado || undefined
        },
      });
      setPreinscripciones(response.data);
      setError(null);
    } catch (err) {
      console.error('Error al cargar preinscripciones:', err);
      setError('No se pudieron cargar las preinscripciones. Por favor, intente de nuevo más tarde.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfesorados();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchPreinscripciones();
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery, includeInactive, selectedProfesorado]);

  const getEstadoColor = (estado: string) => {
    switch (estado) {
      case 'PEN': return 'warning';
      case 'APR': return 'success';
      case 'REJ': return 'error';
      default: return 'default';
    }
  };

  return (
    <Box sx={{ p: { xs: 2, md: 4 }, maxWidth: 1400, margin: '0 auto' }}>
      {/* Header Banner */}
      <Box sx={{ 
        background: 'linear-gradient(135deg, #a67c52 0%, #8b6b4d 100%)',
        borderRadius: 4,
        p: 4,
        mb: 4,
        boxShadow: '0 10px 30px rgba(166, 124, 82, 0.3)',
        position: 'relative',
        overflow: 'hidden'
      }}>
        <Box sx={{ position: 'relative', zIndex: 1 }}>
          <Typography variant="h4" sx={{ fontWeight: 800, color: 'white', mb: 1, textTransform: 'uppercase', letterSpacing: 1 }}>
            Gestión de Preinscripciones
          </Typography>
          <Typography variant="body1" sx={{ color: 'rgba(255, 255, 255, 0.8)', fontWeight: 500 }}>
            Seguimiento completo de solicitudes, documentación y estados
          </Typography>
        </Box>
        <Box sx={{ 
          position: 'absolute',
          right: -50,
          top: -50,
          width: 200,
          height: 200,
          background: 'rgba(255, 255, 255, 0.1)',
          borderRadius: '50%',
        }} />
      </Box>

      <Paper sx={{ p: 4, borderRadius: 4, boxShadow: '0 4px 20px rgba(0,0,0,0.05)', border: '1px solid rgba(0,0,0,0.05)' }}>
        {/* Toolbar */}
        <Box sx={{ 
          display: 'flex', 
          flexDirection: { xs: 'column', md: 'row' },
          gap: 3, 
          mb: 4,
          alignItems: { xs: 'stretch', md: 'center' }
        }}>
          <TextField
            placeholder="Buscar (DNI, Apellido/Nombre, Código)"
            variant="outlined"
            size="medium"
            fullWidth
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ color: 'text.secondary' }} />
                </InputAdornment>
              ),
              sx: { borderRadius: 3, bgcolor: 'grey.50' }
            }}
          />

          <FormControl sx={{ minWidth: 250 }}>
            <InputLabel>Filtrar por Profesorado</InputLabel>
            <Select
              value={selectedProfesorado}
              label="Filtrar por Profesorado"
              onChange={(e) => setSelectedProfesorado(e.target.value)}
              sx={{ borderRadius: 3, bgcolor: 'grey.50' }}
            >
              <MenuItem value="">Todos los profesorados</MenuItem>
              {profesorados.map((p) => (
                <MenuItem key={p.id} value={p.id}>{p.nombre}</MenuItem>
              ))}
            </Select>
          </FormControl>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, whiteSpace: 'nowrap' }}>
            <FormControlLabel
              control={
                <Checkbox 
                  checked={includeInactive} 
                  onChange={(e) => setIncludeInactive(e.target.checked)}
                  color="primary"
                />
              }
              label="Incluir inactivas"
            />
            
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => navigate('/preinscriptions/new')}
              sx={{ 
                borderRadius: 3,
                px: 3,
                py: 1.5,
                bgcolor: '#a67c52',
                '&:hover': { bgcolor: '#8b6b4d' },
                boxShadow: '0 4px 12px rgba(166, 124, 82, 0.2)',
                textTransform: 'none',
                fontWeight: 600
              }}
            >
              Nueva Preinscripción
            </Button>
          </Box>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>{error}</Alert>
        )}

        <TableContainer sx={{ overflowX: 'auto' }}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', fontSize: '0.75rem' }}>Código</TableCell>
                <TableCell sx={{ fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', fontSize: '0.75rem' }}>Nombre Completo</TableCell>
                <TableCell sx={{ fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', fontSize: '0.75rem' }}>Profesorado</TableCell>
                <TableCell sx={{ fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', fontSize: '0.75rem' }}>Fecha</TableCell>
                <TableCell sx={{ fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', fontSize: '0.75rem' }}>Estado</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', fontSize: '0.75rem' }}>Acciones</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 10 }}>
                    <CircularProgress sx={{ color: '#a67c52' }} />
                    <Typography sx={{ mt: 2, color: 'text.secondary', fontWeight: 500 }}>Cargando registros...</Typography>
                  </TableCell>
                </TableRow>
              ) : preinscripciones.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 10 }}>
                    <Typography color="text.secondary" variant="body1">No se encontraron preinscripciones.</Typography>
                  </TableCell>
                </TableRow>
              ) : (
                preinscripciones.map((pre) => (
                  <TableRow key={pre.id} hover sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
                    <TableCell sx={{ fontWeight: 600, color: 'text.primary' }}>{pre.codigo}</TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {pre.alumno.user.last_name.toUpperCase()}, {pre.alumno.user.first_name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          DNI: {pre.alumno.dni}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell sx={{ color: 'text.secondary' }}>{pre.carrera.nombre}</TableCell>
                    <TableCell sx={{ color: 'text.secondary' }}>
                      {new Date(pre.created_at).toLocaleString('es-AR', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </TableCell>
                    <TableCell>
                      <Chip 
                        label={pre.estado} 
                        size="small"
                        color={getEstadoColor(pre.estado) as any}
                        variant="outlined"
                        sx={{ fontWeight: 700, borderRadius: 1.5 }}
                      />
                    </TableCell>
                    <TableCell align="right">
                      <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
                        <Tooltip title="Ver / Editar">
                          <IconButton 
                            onClick={() => navigate(`/preinscriptions/${pre.id}`)}
                            sx={{ color: '#a67c52', '&:hover': { bgcolor: 'rgba(166, 124, 82, 0.1)' } }}
                          >
                            <ViewIcon  />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Eliminar">
                          <IconButton 
                            sx={{ color: 'error.main', '&:hover': { bgcolor: 'error.lighter' } }}
                          >
                            <DeleteIcon  />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </Box>
  );
};

export default FormalizarInscripcion;
