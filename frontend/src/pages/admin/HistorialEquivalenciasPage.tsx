import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
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
    Alert,
    TextField,
    Chip,
    Divider,
    List,
    ListItem,
    ListItemText
} from '@mui/material';
import VisibilityIcon from '@mui/icons-material/Visibility';
import KeyboardReturnIcon from '@mui/icons-material/KeyboardReturn';
import SearchIcon from '@mui/icons-material/Search';
import { useNavigate } from 'react-router-dom';

import { listarDisposicionesEquivalencia, EquivalenciaDisposicionDTO } from '@/api/estudiantes';
import { INSTITUTIONAL_GREEN } from "@/styles/institutionalColors";

dayjs.extend(utc);

const HistorialEquivalenciasPage: React.FC = () => {
    const navigate = useNavigate();
    const [selectedDispo, setSelectedDispo] = useState<EquivalenciaDisposicionDTO | null>(null);

    // Filtros
    const [dniFilter, setDniFilter] = useState('');
    const [activeDni, setActiveDni] = useState<string | undefined>(undefined);

    const { data: disposiciones, isLoading, isError } = useQuery({
        queryKey: ['equivalencias-historial', activeDni],
        queryFn: () => listarDisposicionesEquivalencia(activeDni ? { dni: activeDni } : {}),
    });

    const handleSearch = () => {
        setActiveDni(dniFilter.trim() || undefined);
    };

    const handleClear = () => {
        setDniFilter('');
        setActiveDni(undefined);
    };

    return (
        <Box sx={{ p: 3 }}>
            <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 3 }}>
                <IconButton onClick={() => navigate(-1)}>
                    <KeyboardReturnIcon />
                </IconButton>
                <Typography variant="h5" fontWeight={600} color="primary">
                    Historial de Equivalencias por Disposición
                </Typography>
            </Stack>

            {/* Filtros de Busqueda */}
            <Paper variant="outlined" sx={{ p: 2, mb: 3, bgcolor: 'grey.50' }}>
                <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems="center">
                    <TextField
                        label="DNI del estudiante"
                        size="small"
                        placeholder="Buscar por DNI..."
                        value={dniFilter}
                        onChange={(e) => setDniFilter(e.target.value.replace(/\D/g, ""))}
                        sx={{ width: { xs: '100%', md: 250 } }}
                    />
                    <Button
                        variant="contained"
                        onClick={handleSearch}
                        startIcon={<SearchIcon />}
                    >
                        Buscar
                    </Button>
                    {activeDni && (
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
                    No se pudo cargar el historial de equivalencias.
                </Alert>
            )}

            {!isLoading && !isError && (
                <TableContainer component={Paper} elevation={2} sx={{ borderRadius: 2 }}>
                    <Table>
                        <TableHead sx={{ bgcolor: 'grey.100' }}>
                            <TableRow>
                                <TableCell><b>ID</b></TableCell>
                                <TableCell><b>Fecha Dispo.</b></TableCell>
                                <TableCell><b>Nº Disposición</b></TableCell>
                                <TableCell><b>Estudiante</b></TableCell>
                                <TableCell><b>Profesorado</b></TableCell>
                                <TableCell align="center"><b>Materias</b></TableCell>
                                <TableCell align="right"><b>Acciones</b></TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {disposiciones?.map((dispo) => (
                                <TableRow key={dispo.id} hover>
                                    <TableCell>{dispo.id}</TableCell>
                                    <TableCell>{dayjs.utc(dispo.fecha_disposicion).format('DD/MM/YYYY')}</TableCell>
                                    <TableCell>
                                        <Typography variant="body2" fontWeight={600}>{dispo.numero_disposicion}</Typography>
                                    </TableCell>
                                    <TableCell>
                                        <Typography variant="body2">{dispo.estudiante_nombre}</Typography>
                                        <Typography variant="caption" color="text.secondary">DNI: {dispo.estudiante_dni}</Typography>
                                    </TableCell>
                                    <TableCell>
                                        <Typography variant="caption" sx={{ display: 'block', lineHeight: 1.2 }}>
                                            {dispo.profesorado_nombre}
                                        </Typography>
                                        <Typography variant="caption" color="text.secondary">
                                            Plan: {dispo.plan_resolucion}
                                        </Typography>
                                    </TableCell>
                                    <TableCell align="center">
                                        <Chip label={dispo.detalles.length} size="small" color="primary" variant="outlined" />
                                    </TableCell>
                                    <TableCell align="right">
                                        <Tooltip title="Ver detalle">
                                            <IconButton color="primary" onClick={() => setSelectedDispo(dispo)}>
                                                <VisibilityIcon />
                                            </IconButton>
                                        </Tooltip>
                                    </TableCell>
                                </TableRow>
                            ))}
                            {disposiciones?.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={7} align="center" sx={{ py: 3 }}>
                                        No hay equivalencias registradas que coincidan con la búsqueda.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </TableContainer>
            )}

            {selectedDispo && (
                <DetalleEquivalenciaDialog
                    open={!!selectedDispo}
                    dispo={selectedDispo}
                    onClose={() => setSelectedDispo(null)}
                />
            )}
        </Box>
    );
};

interface DetalleProps {
    open: boolean;
    dispo: EquivalenciaDisposicionDTO;
    onClose: () => void;
}

const DetalleEquivalenciaDialog: React.FC<DetalleProps> = ({ open, dispo, onClose }) => {
    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
            <DialogTitle sx={{ bgcolor: INSTITUTIONAL_GREEN, color: 'white' }}>
                Detalle de Disposición #{dispo.numero_disposicion}
            </DialogTitle>
            <DialogContent dividers>
                <Stack spacing={2} sx={{ mt: 1 }}>
                    <Grid container spacing={2}>
                        <Grid item xs={12}>
                            <Typography variant="subtitle2" color="text.secondary">Estudiante</Typography>
                            <Typography variant="body1" fontWeight={500}>{dispo.estudiante_nombre}</Typography>
                            <Typography variant="body2">DNI: {dispo.estudiante_dni}</Typography>
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <Typography variant="subtitle2" color="text.secondary">Fecha de Disposición</Typography>
                            <Typography variant="body1">{dayjs.utc(dispo.fecha_disposicion).format('DD/MM/YYYY')}</Typography>
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <Typography variant="subtitle2" color="text.secondary">Creado el</Typography>
                            <Typography variant="body1">{dayjs(dispo.creado_en).format('DD/MM/YYYY HH:mm')}</Typography>
                        </Grid>
                        <Grid item xs={12}>
                            <Typography variant="subtitle2" color="text.secondary">Profesorado</Typography>
                            <Typography variant="body2">{dispo.profesorado_nombre}</Typography>
                            <Typography variant="caption" color="text.secondary">Plan: {dispo.plan_resolucion}</Typography>
                        </Grid>
                    </Grid>

                    <Divider />

                    <Box>
                        <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                            Materias Acreditadas
                        </Typography>
                        <List dense disablePadding>
                            {dispo.detalles.map((det) => (
                                <ListItem key={det.id} divider>
                                    <ListItemText
                                        primary={det.materia_nombre}
                                        secondary={`Nota: ${det.nota}`}
                                    />
                                </ListItem>
                            ))}
                        </List>
                    </Box>

                    {dispo.observaciones && (
                        <Box sx={{ mt: 1, p: 1.5, bgcolor: 'grey.50', borderRadius: 1 }}>
                            <Typography variant="subtitle2" color="text.secondary">Observaciones</Typography>
                            <Typography variant="body2">{dispo.observaciones}</Typography>
                        </Box>
                    )}

                    <Box sx={{ pt: 1 }}>
                        <Typography variant="caption" color="text.disabled">
                            Registrado por: {dispo.creado_por || 'Sistema'}
                        </Typography>
                    </Box>
                </Stack>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose} variant="contained">Cerrar</Button>
            </DialogActions>
        </Dialog>
    );
};

// Necesario importar Grid para que funcione el layout de 12
import { Grid } from '@mui/material';

export default HistorialEquivalenciasPage;
