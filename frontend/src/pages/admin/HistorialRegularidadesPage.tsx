
import React from 'react';
import { useQuery } from '@tanstack/react-query';
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
    Stack,
    CircularProgress,
    Chip,
    Alert,
    Tooltip
} from '@mui/material';
import KeyboardReturnIcon from '@mui/icons-material/KeyboardReturn';
import PrintIcon from '@mui/icons-material/Print';
import EditIcon from '@mui/icons-material/Edit';
import VisibilityIcon from '@mui/icons-material/Visibility';
import { useNavigate } from 'react-router-dom';

import { listarHistorialRegularidades } from '@/api/primeraCarga';
import PlanillaRegularidadDialog from './PlanillaRegularidadDialog';

const HistorialRegularidadesPage: React.FC = () => {
    const navigate = useNavigate();
    const [dialogOpen, setDialogOpen] = React.useState(false);
    const [selectedId, setSelectedId] = React.useState<number | null>(null);
    const [dialogMode, setDialogMode] = React.useState<'create' | 'edit' | 'view'>('create');

    const { data: planillas, isLoading, isError, refetch } = useQuery({
        queryKey: ['regularidades-historial'],
        queryFn: listarHistorialRegularidades,
    });

    const handleOpenDialog = (id: number, mode: 'edit' | 'view') => {
        setSelectedId(id);
        setDialogMode(mode);
        setDialogOpen(true);
    };

    return (
        <Box sx={{ p: 3 }}>
            <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 3 }}>
                <IconButton onClick={() => navigate(-1)}>
                    <KeyboardReturnIcon />
                </IconButton>
                <Typography variant="h5" fontWeight={600} color="primary">
                    Historial de Planillas de Regularidad
                </Typography>
            </Stack>

            {isLoading && (
                <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                    <CircularProgress />
                </Box>
            )}

            {isError && (
                <Alert severity="error" sx={{ mb: 3 }}>
                    No se pudo cargar el historial de regularidades.
                </Alert>
            )}

            {!isLoading && !isError && (
                <TableContainer component={Paper} elevation={2} sx={{ borderRadius: 2 }}>
                    <Table>
                        <TableHead sx={{ bgcolor: 'grey.100' }}>
                            <TableRow>
                                <TableCell><b>ID</b></TableCell>
                                <TableCell><b>Fecha</b></TableCell>
                                <TableCell><b>Código</b></TableCell>
                                <TableCell><b>Profesorado</b></TableCell>
                                <TableCell><b>Materia</b></TableCell>
                                <TableCell align="center"><b>Año</b></TableCell>
                                <TableCell align="center"><b>Alumnos</b></TableCell>
                                <TableCell align="center"><b>Estado</b></TableCell>
                                <TableCell align="right"><b>Acciones</b></TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {planillas?.map((planilla) => {
                                // Evitar el desfase de zona horaria de JS al parsear YYYY-MM-DD
                                const [year, month, day] = planilla.fecha.toString().split('-');
                                const fechaFormateada = `${day}/${month}/${year}`;

                                return (
                                    <TableRow key={planilla.id} hover>
                                        <TableCell>{planilla.id}</TableCell>
                                        <TableCell>{fechaFormateada}</TableCell>
                                        <TableCell>
                                            <Chip label={planilla.codigo} size="small" variant="outlined" />
                                        </TableCell>
                                        <TableCell>{planilla.profesorado_nombre}</TableCell>
                                        <TableCell>{planilla.materia_nombre}</TableCell>
                                        <TableCell align="center">{planilla.anio_cursada}</TableCell>
                                        <TableCell align="center">{planilla.cantidad_estudiantes}</TableCell>
                                        <TableCell align="center">
                                            <Chip
                                                label={planilla.estado}
                                                color={planilla.estado === 'final' ? 'success' : 'default'}
                                                size="small"
                                            />
                                        </TableCell>
                                        <TableCell align="right">
                                            <Stack direction="row" justifyContent="flex-end" spacing={1}>
                                                <Tooltip title="Ver detalles">
                                                    <IconButton
                                                        onClick={() => handleOpenDialog(planilla.id, 'view')}
                                                        color="info" size="small"
                                                    >
                                                        <VisibilityIcon fontSize="small" />
                                                    </IconButton>
                                                </Tooltip>
                                                <Tooltip title="Editar">
                                                    <IconButton
                                                        onClick={() => handleOpenDialog(planilla.id, 'edit')}
                                                        color="primary" size="small"
                                                    >
                                                        <EditIcon fontSize="small" />
                                                    </IconButton>
                                                </Tooltip>
                                                <Tooltip title="Imprimir PDF">
                                                    <IconButton
                                                        onClick={() => window.open(`/api/admin/primera-carga/regularidades/planillas/${planilla.id}/pdf`, '_blank')}
                                                        color="secondary" size="small"
                                                    >
                                                        <PrintIcon fontSize="small" />
                                                    </IconButton>
                                                </Tooltip>
                                            </Stack>
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                            {planillas?.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={9} align="center" sx={{ py: 3 }}>
                                        No hay planillas registradas.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </TableContainer>
            )}

            <PlanillaRegularidadDialog
                open={dialogOpen}
                onClose={() => setDialogOpen(false)}
                planillaId={selectedId}
                mode={dialogMode}
                onCreated={() => refetch()}
            />
        </Box>
    );
};

export default HistorialRegularidadesPage;
