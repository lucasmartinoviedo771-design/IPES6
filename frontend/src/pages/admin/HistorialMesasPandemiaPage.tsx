import React from 'react';
import {
  Box,
  Card,
  Container,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  Breadcrumbs,
  Link,
  CircularProgress,
  Alert,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import AssignmentLateIcon from '@mui/icons-material/AssignmentLate';
import { listarHistoricoMesasPandemia } from '@/api/primeraCarga';
import { INSTITUTIONAL_TERRACOTTA } from '@/styles/institutionalColors';

const HistorialMesasPandemiaPage: React.FC = () => {
  const navigate = useNavigate();

  const query = useQuery({
    queryKey: ['historial-mesas-pandemia'],
    queryFn: listarHistoricoMesasPandemia,
  });

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
                    <TableCell>ID Mesa</TableCell>
                    <TableCell>Fecha</TableCell>
                    <TableCell>Profesorado</TableCell>
                    <TableCell>Materia</TableCell>
                    <TableCell>Docente a cargo</TableCell>
                    <TableCell align="center">Estudiantes</TableCell>
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
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Card>
      </Stack>
    </Container>
  );
};

export default HistorialMesasPandemiaPage;
