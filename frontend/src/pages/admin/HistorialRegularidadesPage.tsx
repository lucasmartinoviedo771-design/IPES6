
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Paper from "@mui/material/Paper";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import CircularProgress from "@mui/material/CircularProgress";
import Chip from "@mui/material/Chip";
import Alert from "@mui/material/Alert";
import Tooltip from "@mui/material/Tooltip";
import Autocomplete from "@mui/material/Autocomplete";
import TextField from "@mui/material/TextField";
import TableSortLabel from "@mui/material/TableSortLabel";
import TablePagination from "@mui/material/TablePagination";
import KeyboardReturnIcon from '@mui/icons-material/KeyboardReturn';
import PrintIcon from '@mui/icons-material/Print';
import EditIcon from '@mui/icons-material/Edit';
import VisibilityIcon from '@mui/icons-material/Visibility';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { hasRole } from '@/utils/roles';
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
    const [filterProfesorado, setFilterProfesorado] = React.useState<string | null>(null);
    const [filterID, setFilterID] = React.useState<string>('');

    const { user } = useAuth();
    const isAdminOrSecretaria = React.useMemo(() => 
        hasRole(user, 'admin') || hasRole(user, 'secretaria'), 
    [user]);

    // Sort states
    const [orderBy, setOrderBy] = React.useState<keyof PlanillaRegularidadListItem | 'fecha'>('fecha');
    const [orderDirection, setOrderDirection] = React.useState<'asc' | 'desc'>('desc');

    // Pagination state
    const [page, setPage] = React.useState(0);
    const [rowsPerPage, setRowsPerPage] = React.useState(25);

    const { data: planillas, isLoading, isError, refetch } = useQuery({
        queryKey: ['regularidades-historial'],
        queryFn: () => listarHistorialRegularidades(),
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
            if (filterID && p.id.toString() !== filterID.trim()) return false;
            if (filterYear && year !== filterYear) return false;
            if (filterMateria && p.materia_nombre !== filterMateria) return false;
            if (filterDictado) {
                if (!p.dictado || p.dictado !== filterDictado) return false;
            }
            if (filterAnioCursada && p.anio_cursada !== filterAnioCursada) return false;
            if (filterProfesorado && p.profesorado_nombre !== filterProfesorado) return false;
            return true;
        });

        return filtered.sort((a, b) => {
            let valueA: any = a[orderBy];
            let valueB: any = b[orderBy];

            // Special handling for dates
            if (orderBy === 'fecha') {
                const dateA = a.fecha.includes('/') ? 
                    new Date(a.fecha.split('/').reverse().join('-')) : 
                    new Date(a.fecha);
                const dateB = b.fecha.includes('/') ? 
                    new Date(b.fecha.split('/').reverse().join('-')) : 
                    new Date(b.fecha);
                valueA = dateA.getTime();
                valueB = dateB.getTime();
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
    }, [planillas, filterID, filterYear, filterMateria, filterDictado, filterAnioCursada, filterProfesorado, orderBy, orderDirection]);

    const paginatedPlanillas = React.useMemo(() => {
        return filteredPlanillas.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);
    }, [filteredPlanillas, page, rowsPerPage]);

    const getOptions = (key: keyof PlanillaRegularidadListItem | 'year'): string[] => {
        if (!planillas) return [];
        const values = planillas.filter(p => {
            const pYear = p.anio_academico.toString();
            if (key !== 'year' && filterYear && pYear !== filterYear) return false;
            if (key !== 'materia_nombre' && filterMateria && p.materia_nombre?.trim() !== filterMateria) return false;
            if (key !== 'dictado' && filterDictado && (!p.dictado || p.dictado !== filterDictado)) return false;
            if (key !== 'anio_cursada' && filterAnioCursada && p.anio_cursada !== filterAnioCursada) return false;
            if (key !== 'profesorado_nombre' && filterProfesorado && p.profesorado_nombre !== filterProfesorado) return false;
            return true;
        }).map(p => {
            if (key === 'year') return p.anio_academico.toString();
            if (key === 'dictado') return p.dictado || '';
            // @ts-ignore
            const val = p[key];
            return val ? String(val) : '';
        });

        return Array.from(new Set(values.map(v => v.trim()))).filter(Boolean).sort();
    };

    const years = React.useMemo(() => getOptions('year'), [planillas, filterMateria, filterDictado, filterAnioCursada]);
    const materiasOptions = React.useMemo(() => getOptions('materia_nombre'), [planillas, filterYear, filterDictado, filterAnioCursada, filterProfesorado]);
    const dictadosOptions = React.useMemo(() => getOptions('dictado'), [planillas, filterYear, filterMateria, filterAnioCursada, filterProfesorado]);
    const aniosCursadaOptions = React.useMemo(() => getOptions('anio_cursada'), [planillas, filterYear, filterMateria, filterDictado, filterProfesorado]);
    const profesoradosOptions = React.useMemo(() => getOptions('profesorado_nombre'), [planillas, filterYear, filterMateria, filterDictado, filterAnioCursada]);

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
                            {/* ID Filter */}
                            <Box sx={{ minWidth: 90 }}>
                                <TextField
                                    label="ID"
                                    size="small"
                                    value={filterID}
                                    onChange={(e) => { setFilterID(e.target.value); setPage(0); }}
                                    inputProps={{ inputMode: 'numeric' }}
                                    sx={{ width: 90 }}
                                />
                            </Box>
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

                            {/* Profesorado Filter: visible para admin/secretaria o cuando hay múltiples profesorados */}
                            {(isAdminOrSecretaria || profesoradosOptions.length > 1) && (
                                <Box sx={{ flexGrow: 1, minWidth: 200 }}>
                                    <Autocomplete
                                        options={profesoradosOptions}
                                        value={filterProfesorado}
                                        onChange={(_, newValue) => { setFilterProfesorado(newValue); setFilterMateria(null); }}
                                        renderInput={(params) => <TextField {...params} label="Profesorado" size="small" />}
                                        fullWidth
                                    />
                                </Box>
                            )}

                            {(filterID || filterYear || filterMateria || filterDictado || filterAnioCursada || filterProfesorado) && (
                                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                    <IconButton onClick={() => {
                                        setFilterID('');
                                        setFilterYear(null);
                                        setFilterMateria(null);
                                        setFilterDictado(null);
                                        setFilterAnioCursada(null);
                                        setFilterProfesorado(null);
                                        setPage(0);
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
                                {paginatedPlanillas?.map((planilla) => {
                                    // If already DD/MM/YYYY just use it, otherwise try to reformat
                                    const fechaFormateada = planilla.fecha.includes('/') ? 
                                        planilla.fecha : 
                                        (() => {
                                            const [year, month, day] = planilla.fecha.toString().split('-');
                                            return day && month && year ? `${day}/${month}/${year}` : planilla.fecha;
                                        })();

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
                    <TablePagination
                        component="div"
                        count={filteredPlanillas.length}
                        rowsPerPage={rowsPerPage}
                        page={page}
                        onPageChange={(_, newPage) => setPage(newPage)}
                        onRowsPerPageChange={(event) => {
                            setRowsPerPage(parseInt(event.target.value, 10));
                            setPage(0);
                        }}
                        labelRowsPerPage="Filas por página"
                    />
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
