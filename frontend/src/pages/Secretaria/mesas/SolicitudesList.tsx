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

import { listarSolicitudesMesas, procesarSolicitudMesa } from '@/api/managementMesas';
import { SolicitudMesaAdminDTO } from '@/api/estudiantes/types';
import { formatDate } from '@/utils/date';

export const SolicitudesList: React.FC = () => {
  const [solicitudes, setSolicitudes] = useState<SolicitudMesaAdminDTO[]>([]);
  const [loading, setLoading] = useState(false);

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
  }, []);

  const handleProcesar = async (id: number, estado: string) => {
    if (!window.confirm(`¿Estás seguro de marcar esta solicitud como ${estado === 'PRO' ? 'PROCESADA' : 'RECHAZADA'}?`)) return;
    try {
      await procesarSolicitudMesa(id, estado);
      await load();
    } catch (e) {
      console.error(e);
      alert("Error al procesar la solicitud");
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
                      <Tooltip title="Procesar / Aprobar">
                        <IconButton size="small" color="success" onClick={() => handleProcesar(s.id, 'PRO')}>
                          <CheckCircleIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Rechazar">
                        <IconButton size="small" color="error" onClick={() => handleProcesar(s.id, 'REC')}>
                          <CancelIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Stack>
                  )}
                  {s.estado !== 'PEN' && (
                    <Typography variant="caption" color="textSecondary">Procesada</Typography>
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
    </Box>
  );
};
