import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
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
    IconButton,
    Tooltip,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    Stack,
    CircularProgress,
    Chip,
    Alert,
    TextField
} from '@mui/material';
import VisibilityIcon from '@mui/icons-material/Visibility';
import KeyboardReturnIcon from '@mui/icons-material/KeyboardReturn';
import SearchIcon from '@mui/icons-material/Search';
import EditIcon from '@mui/icons-material/Edit';
import SaveIcon from '@mui/icons-material/Save';
import CloseIcon from '@mui/icons-material/Close';
import PrintIcon from '@mui/icons-material/Print';
import { useNavigate } from 'react-router-dom';
import { enqueueSnackbar } from 'notistack';

import { listarActas, obtenerActa, actualizarCabeceraActa, ActaFilter } from '@/api/cargaNotas';
import { gestionarMesaPlanillaCierre } from '@/api/alumnos';
import { INSTITUTIONAL_GREEN } from "@/styles/institutionalColors";

dayjs.extend(utc);
dayjs.extend(timezone);

const HistorialActasPage: React.FC = () => {
    const navigate = useNavigate();
    const [selectedActaId, setSelectedActaId] = useState<number | null>(null);

    // Filtros
    const [filters, setFilters] = useState({
        anio: '',
        materia: '',
        libro: '',
        folio: ''
    });
    const [activeFilters, setActiveFilters] = useState({});

    const { data: actas, isLoading, isError } = useQuery({
        queryKey: ['actas-historial', activeFilters],
        queryFn: () => listarActas(activeFilters),
    });

    const handleSearch = () => {
        setActiveFilters(filters);
    };

    const handleClear = () => {
        const empty = { anio: '', materia: '', libro: '', folio: '' };
        setFilters(empty);
        setActiveFilters({});
    };

    return (
        <Box sx={{ p: 3 }}>
            <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 3 }}>
                <IconButton onClick={() => navigate(-1)}>
                    <KeyboardReturnIcon />
                </IconButton>
                <Typography variant="h5" fontWeight={600} color="primary">
                    Historial de Actas Cargadas
                </Typography>
            </Stack>

            {/* Filtros de Busqueda */}
            <Paper variant="outlined" sx={{ p: 2, mb: 3, bgcolor: 'grey.50' }}>
                <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems="center">
                    <TextField
                        label="Año (Fecha)"
                        size="small"
                        type="number"
                        placeholder="Ej: 2024"
                        value={filters.anio}
                        onChange={(e) => setFilters({ ...filters, anio: e.target.value })}
                        sx={{ width: { xs: '100%', md: 150 } }}
                    />
                    <TextField
                        label="Materia"
                        size="small"
                        placeholder="Buscar por nombre..."
                        value={filters.materia}
                        onChange={(e) => setFilters({ ...filters, materia: e.target.value })}
                        sx={{ flex: 1 }}
                    />
                    <Stack direction="row" spacing={2} sx={{ width: { xs: '100%', md: 'auto' } }}>
                        <TextField
                            label="Libro"
                            size="small"
                            value={filters.libro}
                            onChange={(e) => setFilters({ ...filters, libro: e.target.value })}
                            sx={{ width: 100 }}
                        />
                        <TextField
                            label="Folio"
                            size="small"
                            value={filters.folio}
                            onChange={(e) => setFilters({ ...filters, folio: e.target.value })}
                            sx={{ width: 100 }}
                        />
                    </Stack>
                    <Button
                        variant="contained"
                        onClick={handleSearch}
                        startIcon={<SearchIcon />}
                    >
                        Buscar
                    </Button>
                    {(Object.values(activeFilters).some(v => v)) && (
                        <Button
                            color="inherit"
                            onClick={handleClear}
                        >
                            Limpiar
                        </Button>
                    )}
                </Stack>
            </Paper>

            {isLoading && (
                <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                    <CircularProgress />
                </Box>
            )}

            {isError && (
                <Alert severity="error" sx={{ mb: 3 }}>
                    No se pudo cargar el historial de actas.
                </Alert>
            )}

            {!isLoading && !isError && (
                <TableContainer component={Paper} elevation={2} sx={{ borderRadius: 2 }}>
                    <Table>
                        <TableHead sx={{ bgcolor: 'grey.100' }}>
                            <TableRow>
                                <TableCell><b>ID</b></TableCell>
                                <TableCell><b>Fecha</b></TableCell>
                                <TableCell><b>Código Interino</b></TableCell>
                                <TableCell><b>Materia</b></TableCell>
                                <TableCell><b>Libro/Folio</b></TableCell>
                                <TableCell align="center"><b>Alumnos</b></TableCell>
                                <TableCell align="right"><b>Acciones</b></TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {actas?.map((acta) => (
                                <TableRow key={acta.id} hover>
                                    <TableCell>{acta.id}</TableCell>
                                    <TableCell>{dayjs.utc(acta.fecha).format('DD/MM/YYYY')}</TableCell>
                                    <TableCell>
                                        <Chip label={acta.codigo} size="small" variant="outlined" />
                                    </TableCell>
                                    <TableCell>{acta.materia}</TableCell>
                                    <TableCell>
                                        {acta.libro || '-'}/{acta.folio || '-'}
                                    </TableCell>
                                    <TableCell align="center">{acta.total_alumnos}</TableCell>
                                    <TableCell align="right">
                                        <Tooltip title="Imprimir">
                                            <IconButton onClick={() => window.open(`/admin/actas/${acta.id}/print`, '_blank')}>
                                                <PrintIcon />
                                            </IconButton>
                                        </Tooltip>
                                        <Tooltip title="Ver detalle">
                                            <IconButton color="primary" onClick={() => setSelectedActaId(acta.id)}>
                                                <VisibilityIcon />
                                            </IconButton>
                                        </Tooltip>
                                    </TableCell>
                                </TableRow>
                            ))}
                            {actas?.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={7} align="center" sx={{ py: 3 }}>
                                        No hay actas registradas que coincidan con la búsqueda.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </TableContainer>
            )}

            {selectedActaId && (
                <DetalleActaDialog
                    open={!!selectedActaId}
                    actaId={selectedActaId}
                    onClose={() => setSelectedActaId(null)}
                />
            )}
        </Box>
    );
};

// Componente Local para el detalle
const DetalleActaDialog: React.FC<{ open: boolean; actaId: number; onClose: () => void }> = ({ open, actaId, onClose }) => {
    const { data: acta, isLoading } = useQuery({
        queryKey: ['acta-detalle', actaId],
        queryFn: () => obtenerActa(actaId),
        enabled: open,
    });

    const [isEditingHeader, setIsEditingHeader] = useState(false);
    const [editValues, setEditValues] = useState({ fecha: '', libro: '', folio: '' });

    // Inicializar valores al cargar
    React.useEffect(() => {
        if (acta) {
            setEditValues({
                fecha: acta.fecha, // Asumimos YYYY-MM-DD
                libro: acta.libro || '',
                folio: acta.folio || ''
            });
        }
    }, [acta]);

    const queryClient = useQueryClient();

    const reopenMutation = useMutation({
        mutationFn: (mesaId: number) => gestionarMesaPlanillaCierre(mesaId, 'reabrir'),
        onSuccess: () => {
            enqueueSnackbar('Planilla reabierta correctamente.', { variant: 'success' });
            queryClient.invalidateQueries({ queryKey: ['acta-detalle', actaId] });
            queryClient.invalidateQueries({ queryKey: ['actas-historial'] });
            // No cerramos el dialog, permitiendo ver el cambio de estado
        },
        onError: (err: any) => {
            const msg = err.response?.data.message || 'Error al reabrir la planilla.';
            enqueueSnackbar(msg, { variant: 'error' });
        }
    });

    const updateHeaderMutation = useMutation({
        mutationFn: (payload: { fecha: string; libro: string; folio: string }) =>
            actualizarCabeceraActa(actaId, payload),
        onSuccess: () => {
            enqueueSnackbar('Encabezado actualizado correctamente.', { variant: 'success' });
            queryClient.invalidateQueries({ queryKey: ['acta-detalle', actaId] });
            queryClient.invalidateQueries({ queryKey: ['actas-historial'] });
            setIsEditingHeader(false);
        },
        onError: (err: any) => {
            const msg = err.response?.data.message || 'Error al actualizar encabezado.';
            enqueueSnackbar(msg, { variant: 'error' });
        }
    });

    const handleReopen = () => {
        if (!acta?.mesa_id) return;
        if (window.confirm('¿Estás seguro de querer reabrir esta planilla? Esto permitirá editar las notas nuevamente.')) {
            reopenMutation.mutate(acta.mesa_id);
        }
    };

    const handleSaveHeader = () => {
        updateHeaderMutation.mutate(editValues);
    };

    const handleCancelEdit = () => {
        setIsEditingHeader(false);
        if (acta) {
            setEditValues({
                fecha: acta.fecha,
                libro: acta.libro || '',
                folio: acta.folio || ''
            });
        }
    };

    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
            <DialogTitle sx={{ bgcolor: INSTITUTIONAL_GREEN, color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Detalle de Acta #{actaId}</span>
                {!isEditingHeader && !isLoading && acta && (
                    <Tooltip title="Editar Encabezado (Fecha/Libro/Folio)">
                        <IconButton size="small" onClick={() => setIsEditingHeader(true)} sx={{ color: 'white' }}>
                            <EditIcon />
                        </IconButton>
                    </Tooltip>
                )}
            </DialogTitle>
            <DialogContent dividers>
                {isLoading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                        <CircularProgress />
                    </Box>
                ) : acta ? (
                    <Stack spacing={2} sx={{ mt: 1 }}>
                        <Box>
                            <Typography variant="subtitle2" color="text.secondary">Código</Typography>
                            <Typography variant="body1">{acta.codigo}</Typography>
                        </Box>

                        {isEditingHeader ? (
                            <Stack spacing={2} sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 1, border: '1px dashed grey' }}>
                                <Typography variant="subtitle2" color="primary">Editando Encabezado</Typography>
                                <TextField
                                    label="Fecha"
                                    type="date"
                                    value={editValues.fecha}
                                    onChange={(e) => setEditValues({ ...editValues, fecha: e.target.value })}
                                    size="small"
                                    fullWidth
                                    InputLabelProps={{ shrink: true }}
                                />
                                <Stack direction="row" spacing={2}>
                                    <TextField
                                        label="Libro"
                                        value={editValues.libro}
                                        onChange={(e) => setEditValues({ ...editValues, libro: e.target.value })}
                                        size="small"
                                        fullWidth
                                    />
                                    <TextField
                                        label="Folio"
                                        value={editValues.folio}
                                        onChange={(e) => setEditValues({ ...editValues, folio: e.target.value })}
                                        size="small"
                                        fullWidth
                                    />
                                </Stack>
                                <Stack direction="row" justifyContent="flex-end" spacing={1}>
                                    <Button
                                        size="small"
                                        startIcon={<CloseIcon />}
                                        onClick={handleCancelEdit}
                                        color="inherit"
                                    >
                                        Cancelar
                                    </Button>
                                    <Button
                                        size="small"
                                        variant="contained"
                                        startIcon={<SaveIcon />}
                                        onClick={handleSaveHeader}
                                        disabled={updateHeaderMutation.isPending}
                                    >
                                        Guardar
                                    </Button>
                                </Stack>
                            </Stack>
                        ) : (
                            <Stack direction="row" spacing={2}>
                                <Box flex={1}>
                                    <Typography variant="subtitle2" color="text.secondary">Fecha</Typography>
                                    <Typography variant="body1">{dayjs.utc(acta.fecha).format('DD/MM/YYYY')}</Typography>
                                </Box>
                                <Box flex={1}>
                                    <Typography variant="subtitle2" color="text.secondary">Libro / Folio</Typography>
                                    <Typography variant="body1">{acta.libro || '-'} / {acta.folio || '-'}</Typography>
                                </Box>
                            </Stack>
                        )}

                        <Box>
                            <Typography variant="subtitle2" color="text.secondary">Materiá</Typography>
                            <Typography variant="body1" fontWeight={500}>{acta.materia}</Typography>
                        </Box>
                        <Box>
                            <Typography variant="subtitle2" color="text.secondary">Profesorado</Typography>
                            <Typography variant="body2">{acta.profesorado}</Typography>
                        </Box>

                        <Paper variant="outlined" sx={{ p: 2, bgcolor: 'grey.50' }}>
                            <Typography variant="subtitle2" gutterBottom>Resumen de Resultados</Typography>
                            <Stack direction="row" justifyContent="space-around">
                                <Box textAlign="center">
                                    <Typography variant="h6" color="success.main">{acta.total_aprobados}</Typography>
                                    <Typography variant="caption">Aprobados</Typography>
                                </Box>
                                <Box textAlign="center">
                                    <Typography variant="h6" color="error.main">{acta.total_desaprobados}</Typography>
                                    <Typography variant="caption">Desaprobados</Typography>
                                </Box>
                                <Box textAlign="center">
                                    <Typography variant="h6" color="text.secondary">{acta.total_ausentes}</Typography>
                                    <Typography variant="caption">Ausentes</Typography>
                                </Box>
                            </Stack>
                        </Paper>

                        {acta.observaciones && (
                            <Box>
                                <Typography variant="subtitle2" color="text.secondary">Observaciones</Typography>
                                <Typography variant="body2" sx={{ fontStyle: 'italic' }}>{acta.observaciones}</Typography>
                            </Box>
                        )}

                        <Box mt={2}>
                            <Typography variant="caption" color="text.disabled">
                                Creado por: {acta.created_by || 'Sistema'} el {new Date(acta.created_at || '').toLocaleString()}
                            </Typography>
                        </Box>
                    </Stack>
                ) : (
                    <Alert severity="error">No se pudo cargar el detalle.</Alert>
                )}
            </DialogContent>
            <DialogActions>
                {acta?.esta_cerrada && acta.mesa_id && (
                    <Button
                        onClick={handleReopen}
                        color="warning"
                        disabled={reopenMutation.isPending || isEditingHeader}
                    >
                        {reopenMutation.isPending ? "Reabriendo..." : "Reabrir Planilla"}
                    </Button>
                )}
                <Button startIcon={<PrintIcon />} onClick={() => window.open(`/admin/actas/${actaId}/print`, '_blank')}>
                    Imprimir
                </Button>
                <Button onClick={onClose} disabled={reopenMutation.isPending}>Cerrar</Button>
            </DialogActions>
        </Dialog>
    );
};

export default HistorialActasPage;
