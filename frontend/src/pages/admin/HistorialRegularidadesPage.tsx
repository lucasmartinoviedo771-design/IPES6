
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
    Tooltip,
    Autocomplete,
    TextField,
    TableSortLabel
} from '@mui/material';
import KeyboardReturnIcon from '@mui/icons-material/KeyboardReturn';
import PrintIcon from '@mui/icons-material/Print';
import EditIcon from '@mui/icons-material/Edit';
import VisibilityIcon from '@mui/icons-material/Visibility';
import { useNavigate } from 'react-router-dom';

import { listarHistorialRegularidades, PlanillaRegularidadListItem } from '@/api/primeraCarga';
import PlanillaRegularidadDialog from './PlanillaRegularidadDialog';

const HistorialRegularidadesPage: React.FC = () => {
    const navigate = useNavigate();
    const [dialogOpen, setDialogOpen] = React.useState(false);
    const [selectedId, setSelectedId] = React.useState<number | null>(null);
    const [dialogMode, setDialogMode] = React.useState<'create' | 'edit' | 'view'>('create');

    // Filter states
    const [filterYear, setFilterYear] = React.useState<string | null>(null);
    const [filterMateria, setFilterMateria] = React.useState<string | null>(null);
    const [filterDictado, setFilterDictado] = React.useState<string | null>(null);
    const [filterAnioCursada, setFilterAnioCursada] = React.useState<string | null>(null);

    // Sort states
    const [orderBy, setOrderBy] = React.useState<keyof PlanillaRegularidadListItem | 'fecha'>('fecha');
    const [orderDirection, setOrderDirection] = React.useState<'asc' | 'desc'>('desc');

    const { data: planillas, isLoading, isError, refetch } = useQuery({
        queryKey: ['regularidades-historial'],
        queryFn: listarHistorialRegularidades,
    });

    const handleRequestSort = (property: keyof PlanillaRegularidadListItem) => {
        const isAsc = orderBy === property && orderDirection === 'asc';
        setOrderDirection(isAsc ? 'desc' : 'asc');
        setOrderBy(property);
    };

    const filteredPlanillas = React.useMemo(() => {
        if (!planillas) return [];
        const filtered = planillas.filter(p => {
            const year = p.anio_academico.toString();
            if (filterYear && year !== filterYear) return false;
            if (filterMateria && p.materia_nombre !== filterMateria) return false;
            if (filterDictado) {
                if (!p.dictado || p.dictado !== filterDictado) return false;
            }
            if (filterAnioCursada && p.anio_cursada !== filterAnioCursada) return false;
            return true;
        });

        return filtered.sort((a, b) => {
            let valueA: any = a[orderBy];
            let valueB: any = b[orderBy];

            // Special handling for dates
            if (orderBy === 'fecha') {
                valueA = new Date(a.fecha).getTime();
                valueB = new Date(b.fecha).getTime();
            }
            // Special handling for strings to ignore case
            else if (typeof valueA === 'string') {
                valueA = valueA.toLowerCase();
                valueB = valueB?.toLowerCase();
            }

            if (valueB < valueA) {
                return orderDirection === 'asc' ? 1 : -1;
            }
            if (valueB > valueA) {
                return orderDirection === 'asc' ? -1 : 1;
            }
            return 0;
        });
    }, [planillas, filterYear, filterMateria, filterDictado, filterAnioCursada, orderBy, orderDirection]);

    const getOptions = (key: keyof PlanillaRegularidadListItem | 'year'): string[] => {
        if (!planillas) return [];
        const values = planillas.filter(p => {
            const pYear = p.anio_academico.toString();
            if (key !== 'year' && filterYear && pYear !== filterYear) return false;
            if (key !== 'materia_nombre' && filterMateria && p.materia_nombre !== filterMateria) return false;
            if (key !== 'dictado' && filterDictado && (!p.dictado || p.dictado !== filterDictado)) return false;
            if (key !== 'anio_cursada' && filterAnioCursada && p.anio_cursada !== filterAnioCursada) return false;
            return true;
        }).map(p => {
            if (key === 'year') return p.anio_academico.toString();
            if (key === 'dictado') return p.dictado || '';
            // @ts-ignore
            const val = p[key];
            return val ? String(val) : '';
        });

        return Array.from(new Set(values)).filter(Boolean).sort();
    };

    const years = React.useMemo(() => getOptions('year'), [planillas, filterMateria, filterDictado, filterAnioCursada]);
    const materiasOptions = React.useMemo(() => getOptions('materia_nombre'), [planillas, filterYear, filterDictado, filterAnioCursada]);
    const dictadosOptions = React.useMemo(() => getOptions('dictado'), [planillas, filterYear, filterMateria, filterAnioCursada]);
    const aniosCursadaOptions = React.useMemo(() => getOptions('anio_cursada'), [planillas, filterYear, filterMateria, filterDictado]);

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
                <>
                    {/* Filters Section */}
                    <Box component={Paper} elevation={1} sx={{ p: 2, mb: 3, bgcolor: 'background.paper' }}>
                        <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 2 }}>
                            Filtros de Búsqueda
                        </Typography>
                        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                            {/* Año Lectivo Filter */}
                            <Box sx={{ minWidth: 120 }}>
                                <Autocomplete
                                    options={years}
                                    value={filterYear}
                                    onChange={(_, newValue) => setFilterYear(newValue)}
                                    renderInput={(params) => <TextField {...params} label="Año Lectivo" size="small" />}
                                    isOptionEqualToValue={(option, value) => option === value}
                                    sx={{ width: 150 }}
                                />
                            </Box>
                            {/* Año Cursada Filter (1°, 2°, etc.) */}
                            <Box sx={{ minWidth: 120 }}>
                                <Autocomplete
                                    options={aniosCursadaOptions}
                                    value={filterAnioCursada}
                                    onChange={(_, newValue) => setFilterAnioCursada(newValue)}
                                    renderInput={(params) => <TextField {...params} label="Año Cursada" size="small" />}
                                    sx={{ width: 150 }}
                                />
                            </Box>
                            {/* Cuatrimestre / Dictado Filter */}
                            <Box sx={{ minWidth: 150 }}>
                                <Autocomplete
                                    options={dictadosOptions}
                                    value={filterDictado}
                                    onChange={(_, newValue) => setFilterDictado(newValue)}
                                    renderInput={(params) => <TextField {...params} label="Cuatrimestre" size="small" />}
                                    sx={{ width: 180 }}
                                />
                            </Box>
                            {/* Materia Filter */}
                            <Box sx={{ flexGrow: 1 }}>
                                <Autocomplete
                                    options={materiasOptions}
                                    value={filterMateria}
                                    onChange={(_, newValue) => setFilterMateria(newValue)}
                                    renderInput={(params) => <TextField {...params} label="Materia" size="small" />}
                                    fullWidth
                                />
                            </Box>

                            {(filterYear || filterMateria || filterDictado || filterAnioCursada) && (
                                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                    <IconButton onClick={() => {
                                        setFilterYear(null);
                                        setFilterMateria(null);
                                        setFilterDictado(null);
                                        setFilterAnioCursada(null);
                                    }} color="error" size="small">
                                        <Box component="span" sx={{ fontSize: '0.875rem', mr: 0.5 }}>Limpiar</Box>
                                        <EditIcon sx={{ display: 'none' }} /> {/* Dummy */}
                                    </IconButton>
                                </Box>
                            )}
                        </Stack>
                    </Box>

                    <TableContainer component={Paper} elevation={2} sx={{ borderRadius: 2 }}>
                        <Table>
                            <TableHead sx={{ bgcolor: 'grey.100' }}>
                                <TableRow>
                                    <TableCell><b>ID</b></TableCell>
                                    <TableCell>
                                        <TableSortLabel
                                            active={orderBy === 'fecha'}
                                            direction={orderBy === 'fecha' ? orderDirection : 'asc'}
                                            onClick={() => handleRequestSort('fecha')}
                                        >
                                            <b>Fecha</b>
                                        </TableSortLabel>
                                    </TableCell>
                                    <TableCell>
                                        <TableSortLabel
                                            active={orderBy === 'dictado'}
                                            direction={orderBy === 'dictado' ? orderDirection : 'asc'}
                                            onClick={() => handleRequestSort('dictado')}
                                        >
                                            <b>Dictado</b>
                                        </TableSortLabel>
                                    </TableCell>
                                    <TableCell>
                                        <TableSortLabel
                                            active={orderBy === 'codigo'}
                                            direction={orderBy === 'codigo' ? orderDirection : 'asc'}
                                            onClick={() => handleRequestSort('codigo')}
                                        >
                                            <b>Código</b>
                                        </TableSortLabel>
                                    </TableCell>
                                    <TableCell>
                                        <TableSortLabel
                                            active={orderBy === 'profesorado_nombre'}
                                            direction={orderBy === 'profesorado_nombre' ? orderDirection : 'asc'}
                                            onClick={() => handleRequestSort('profesorado_nombre')}
                                        >
                                            <b>Profesorado</b>
                                        </TableSortLabel>
                                    </TableCell>
                                    <TableCell>
                                        <TableSortLabel
                                            active={orderBy === 'materia_nombre'}
                                            direction={orderBy === 'materia_nombre' ? orderDirection : 'asc'}
                                            onClick={() => handleRequestSort('materia_nombre')}
                                        >
                                            <b>Materia</b>
                                        </TableSortLabel>
                                    </TableCell>
                                    <TableCell align="center">
                                        <TableSortLabel
                                            active={orderBy === 'anio_cursada'}
                                            direction={orderBy === 'anio_cursada' ? orderDirection : 'asc'}
                                            onClick={() => handleRequestSort('anio_cursada')}
                                        >
                                            <b>Año</b>
                                        </TableSortLabel>
                                    </TableCell>
                                    <TableCell align="center"><b>Estudiantes</b></TableCell>
                                    <TableCell align="center"><b>Estado</b></TableCell>
                                    <TableCell align="right"><b>Acciones</b></TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {filteredPlanillas?.map((planilla) => {
                                    // Evitar el desfase de zona horaria de JS al parsear YYYY-MM-DD
                                    const [year, month, day] = planilla.fecha.toString().split('-');
                                    const fechaFormateada = `${day}/${month}/${year}`;

                                    return (
                                        <TableRow key={planilla.id} hover>
                                            <TableCell>{planilla.id}</TableCell>
                                            <TableCell>{fechaFormateada}</TableCell>
                                            <TableCell>
                                                {planilla.dictado && (
                                                    <Chip label={planilla.dictado} size="small" color='info' variant="outlined" />
                                                )}
                                            </TableCell>
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
                                {filteredPlanillas?.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={10} align="center" sx={{ py: 3 }}>
                                            No se encontraron planillas con los filtros seleccionados.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </TableContainer>
                </>
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
