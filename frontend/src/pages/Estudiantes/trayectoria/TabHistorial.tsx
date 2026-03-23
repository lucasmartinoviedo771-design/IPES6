import { useMemo, useState } from 'react';
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";

import { TrayectoriaEventoDTO } from '@/api/estudiantes';
import { EVENT_TYPE_LABEL } from './types';
import { formatDate } from './utils';

type Props = {
  eventos: TrayectoriaEventoDTO[];
};

const TabHistorial = ({ eventos }: Props) => {
  const [filtroTipo, setFiltroTipo] = useState('');
  const [filtroFecha, setFiltroFecha] = useState('');
  const [filtroDetalle, setFiltroDetalle] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('');
  const [filtroMetadata, setFiltroMetadata] = useState('');

  const tiposEventos = useMemo<TrayectoriaEventoDTO['tipo'][]>(() => {
    const unique = new Set<TrayectoriaEventoDTO['tipo']>();
    eventos.forEach((ev) => unique.add(ev.tipo));
    return Array.from(unique);
  }, [eventos]);

  const eventosFiltrados = useMemo(() => {
    const fechaFilter = filtroFecha.trim().toLowerCase();
    const detalleFilter = filtroDetalle.trim().toLowerCase();
    const estadoFilter = filtroEstado.trim().toLowerCase();
    const metadataFilter = filtroMetadata.trim().toLowerCase();

    return eventos.filter((evento) => {
      if (filtroTipo && evento.tipo !== filtroTipo) return false;

      if (fechaFilter) {
        const fechaRaw = (evento.fecha || '').toLowerCase();
        const fechaFormateada = formatDate(evento.fecha).toLowerCase();
        if (!fechaRaw.includes(fechaFilter) && !fechaFormateada.includes(fechaFilter)) return false;
      }

      if (detalleFilter) {
        const textoDetalle = [evento.titulo, evento.subtitulo, evento.detalle]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!textoDetalle.includes(detalleFilter)) return false;
      }

      if (estadoFilter) {
        const estadoTexto = (evento.estado || '').toLowerCase();
        if (!estadoTexto.includes(estadoFilter)) return false;
      }

      if (metadataFilter) {
        const metadataTexto = Object.entries(evento.metadata || {})
          .map(([key, value]) => `${key}: ${value}`)
          .join(' ')
          .toLowerCase();
        if (!metadataTexto.includes(metadataFilter)) return false;
      }

      return true;
    });
  }, [eventos, filtroTipo, filtroFecha, filtroDetalle, filtroEstado, filtroMetadata]);

  if (eventos.length === 0) {
    return <Alert severity="info">Sin eventos registrados en la trayectoria.</Alert>;
  }

  return (
    <Stack spacing={2}>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} flexWrap="wrap">
        <TextField
          select
          size="small"
          label="Tipo"
          value={filtroTipo}
          onChange={(e) => setFiltroTipo(e.target.value)}
          sx={{ minWidth: 180 }}
        >
          <MenuItem value="">Todos</MenuItem>
          {tiposEventos.map((tipo) => (
            <MenuItem key={tipo} value={tipo}>{EVENT_TYPE_LABEL[tipo]}</MenuItem>
          ))}
        </TextField>
        <TextField
          size="small"
          label="Fecha (texto)"
          value={filtroFecha}
          onChange={(e) => setFiltroFecha(e.target.value)}
          sx={{ minWidth: 180 }}
          placeholder="Ej: 2025-10 o 10/2025"
        />
        <TextField
          size="small"
          label="Detalle"
          value={filtroDetalle}
          onChange={(e) => setFiltroDetalle(e.target.value)}
          sx={{ minWidth: 220 }}
        />
        <TextField
          size="small"
          label="Estado"
          value={filtroEstado}
          onChange={(e) => setFiltroEstado(e.target.value)}
          sx={{ minWidth: 180 }}
        />
        <TextField
          size="small"
          label="Datos extra"
          value={filtroMetadata}
          onChange={(e) => setFiltroMetadata(e.target.value)}
          sx={{ minWidth: 220 }}
        />
        {(filtroTipo || filtroFecha || filtroDetalle || filtroEstado || filtroMetadata) && (
          <Button variant="text" size="small" onClick={() => {
            setFiltroTipo('');
            setFiltroFecha('');
            setFiltroDetalle('');
            setFiltroEstado('');
            setFiltroMetadata('');
          }}>
            Limpiar filtros
          </Button>
        )}
      </Stack>

      {eventosFiltrados.length === 0 ? (
        <Alert severity="info">No se encontraron eventos con los filtros aplicados.</Alert>
      ) : (
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ width: 120 }}>Tipo</TableCell>
                <TableCell sx={{ width: 170 }}>Fecha</TableCell>
                <TableCell sx={{ width: 320 }}>Detalle</TableCell>
                <TableCell sx={{ width: 90 }}>Estado</TableCell>
                <TableCell sx={{ width: 420 }}>Datos extra</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {eventosFiltrados.map((evento) => {
                const metadata = Object.entries(evento.metadata || {}).filter(([, value]) => value !== undefined && value !== null && value !== '');
                const fechaLegible = formatDate(evento.fecha);
                return (
                  <TableRow key={evento.id}>
                    <TableCell sx={{ width: 120 }}>
                      <Chip label={EVENT_TYPE_LABEL[evento.tipo]} size="small" color="primary" />
                    </TableCell>
                    <TableCell sx={{ width: 170 }}>{fechaLegible}</TableCell>
                    <TableCell sx={{ width: 320 }}>
                      <Typography variant="subtitle2" fontWeight={600}>{evento.titulo}</Typography>
                      {evento.subtitulo && (
                        <Typography variant="body2" color="text.secondary">{evento.subtitulo}</Typography>
                      )}
                      {evento.detalle && (
                        <Typography variant="body2" color="text.secondary">{evento.detalle}</Typography>
                      )}
                    </TableCell>
                    <TableCell sx={{ width: 90 }}>
                      {evento.estado ? (
                        <Chip label={evento.estado} size="small" variant="outlined" sx={{ fontSize: '0.75rem', height: 22 }} />
                      ) : (
                        <Typography variant="body2" color="text.secondary">-</Typography>
                      )}
                    </TableCell>
                    <TableCell sx={{ width: 420 }}>
                      {metadata.length ? (
                        <Stack direction="row" spacing={0.75} flexWrap="wrap">
                          {metadata.map(([key, value]) => (
                            <Chip
                              key={`${evento.id}-${key}`}
                              label={`${key}: ${value}`}
                              size="small"
                              variant="outlined"
                              sx={{ fontSize: '0.75rem', height: 22 }}
                            />
                          ))}
                        </Stack>
                      ) : (
                        <Typography variant="body2" color="text.secondary">-</Typography>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Stack>
  );
};

export default TabHistorial;
