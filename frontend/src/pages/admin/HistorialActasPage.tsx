import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
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
import Tooltip from "@mui/material/Tooltip";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import CircularProgress from "@mui/material/CircularProgress";
import Chip from "@mui/material/Chip";
import Alert from "@mui/material/Alert";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import Select from "@mui/material/Select";
import TableSortLabel from "@mui/material/TableSortLabel";
import VisibilityIcon from '@mui/icons-material/Visibility';
import KeyboardReturnIcon from '@mui/icons-material/KeyboardReturn';
import SearchIcon from '@mui/icons-material/Search';
import EditIcon from '@mui/icons-material/Edit';
import SaveIcon from '@mui/icons-material/Save';
import CloseIcon from '@mui/icons-material/Close';
import PrintIcon from '@mui/icons-material/Print';
import { useNavigate } from 'react-router-dom';
import { enqueueSnackbar } from 'notistack';
import { useAuth } from '@/context/AuthContext';
import { hasRole } from '@/utils/roles';

import { 
    listarActas, 
    obtenerActa, 
    actualizarCabeceraActa, 
    actualizarDocentesActa, 
    fetchActaMetadata, 
    ActaDocentePayload,
    descargarActaPdf,
    descargarActaComisionadosPdf
} from '@/api/cargaNotas';
import { gestionarMesaPlanillaCierre } from '@/api/estudiantes';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import GroupsIcon from '@mui/icons-material/Groups';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import Switch from '@mui/material/Switch';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import FormControlLabel from '@mui/material/FormControlLabel';
import { INSTITUTIONAL_GREEN } from "@/styles/institutionalColors";
import ActaExamenReadOnly from '@/components/secretaria/ActaExamenReadOnly';

dayjs.extend(utc);
dayjs.extend(timezone);

const HistorialActasPage: React.FC = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const canEditActa = React.useMemo(() => hasRole(user, 'admin') || hasRole(user, 'secretaria') || hasRole(user, 'bedel'), [user]);
    const [selectedActaId, setSelectedActaId] = useState<number | null>(null);

    // Filtros
    const [filters, setFilters] = useState({
        anio: '',
        materia: '',
        libro: '',
        folio: '',
        ordering: '-id',
        anio_cursada_materia: '',
        sin_tribunal: false,
        profesorado_id: '',
    });
    const [activeFilters, setActiveFilters] = useState({});
    const [tribunalActaId, setTribunalActaId] = useState<number | null>(null);

    const { data: actas, isLoading, isError } = useQuery({
        queryKey: ['actas-historial', activeFilters],
        queryFn: () => listarActas(activeFilters),
    });

    const { data: metadata } = useQuery({
        queryKey: ['acta-metadata-filtros'],
        queryFn: fetchActaMetadata,
    });

    const handleSearch = () => {
        setActiveFilters(filters);
    };

    const handleClear = () => {
        const empty = { anio: '', materia: '', libro: '', folio: '', ordering: '-id', anio_cursada_materia: '', sin_tribunal: false, profesorado_id: '' };
        setFilters(empty);
        setActiveFilters({});
    };

    const handleRequestSort = (property: string) => {
        const isAsc = filters.ordering === property;
        const newOrdering = isAsc ? `-${property}` : property;
        const newFilters = { ...filters, ordering: newOrdering };
        setFilters(newFilters);
        setActiveFilters(newFilters); // Aplicar inmediatamente al hacer click en cabecera
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
                            sx={{ width: 80 }}
                        />
                        <TextField
                            label="Folio"
                            size="small"
                            value={filters.folio}
                            onChange={(e) => setFilters({ ...filters, folio: e.target.value })}
                            sx={{ width: 80 }}
                        />
                        <FormControl size="small" sx={{ width: 80 }}>
                            <InputLabel>Año</InputLabel>
                            <Select
                                value={filters.anio_cursada_materia}
                                label="Año"
                                onChange={(e) => setFilters({ ...filters, anio_cursada_materia: e.target.value })}
                            >
                                <MenuItem value=""><em>-</em></MenuItem>
                                <MenuItem value={1}>1°</MenuItem>
                                <MenuItem value={2}>2°</MenuItem>
                                <MenuItem value={3}>3°</MenuItem>
                                <MenuItem value={4}>4°</MenuItem>
                            </Select>
                        </FormControl>
                    </Stack>

                    <FormControl size="small" sx={{ width: { xs: '100%', md: 220 } }}>
                        <InputLabel>Profesorado</InputLabel>
                        <Select
                            label="Profesorado"
                            value={filters.profesorado_id}
                            onChange={(e) => setFilters({ ...filters, profesorado_id: e.target.value })}
                        >
                            <MenuItem value=""><em>Todos</em></MenuItem>
                            {metadata?.profesorados.map((p) => (
                                <MenuItem key={p.id} value={p.id}>{p.nombre}</MenuItem>
                            ))}
                        </Select>
                    </FormControl>

                    <FormControl size="small" sx={{ width: { xs: '100%', md: 220 } }}>
                        <InputLabel>Ordenar por</InputLabel>
                        <Select
                            label="Ordenar por"
                            value={filters.ordering}
                            onChange={(e) => setFilters({ ...filters, ordering: e.target.value })}
                        >
                            <MenuItem value="-id">Más recientes (ID)</MenuItem>
                            <MenuItem value="id">Más antiguos (ID)</MenuItem>
                            <MenuItem value="-fecha">Fecha (Recientes primero)</MenuItem>
                            <MenuItem value="fecha">Fecha (Antiguos primero)</MenuItem>
                            <MenuItem value="materia__nombre">Materia (A-Z)</MenuItem>
                            <MenuItem value="-materia__nombre">Materia (Z-A)</MenuItem>
                            <MenuItem value="-total_alumnos">Más estudiantes</MenuItem>
                            <MenuItem value="total_alumnos">Menos estudiantes</MenuItem>
                        </Select>
                    </FormControl>

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
                                <TableCell>
                                    <TableSortLabel
                                        active={filters.ordering === 'id' || filters.ordering === '-id'}
                                        direction={filters.ordering === 'id' ? 'asc' : 'desc'}
                                        onClick={() => handleRequestSort('id')}
                                    >
                                        <b>ID</b>
                                    </TableSortLabel>
                                </TableCell>
                                <TableCell>
                                    <TableSortLabel
                                        active={filters.ordering === 'fecha' || filters.ordering === '-fecha'}
                                        direction={filters.ordering === 'fecha' ? 'asc' : 'desc'}
                                        onClick={() => handleRequestSort('fecha')}
                                    >
                                        <b>Fecha</b>
                                    </TableSortLabel>
                                </TableCell>
                                <TableCell><b>Código Interino</b></TableCell>
                                <TableCell>
                                    <TableSortLabel
                                        active={filters.ordering === 'materia__nombre' || filters.ordering === '-materia__nombre'}
                                        direction={filters.ordering === 'materia__nombre' ? 'asc' : 'desc'}
                                        onClick={() => handleRequestSort('materia__nombre')}
                                    >
                                        <b>Materia</b>
                                    </TableSortLabel>
                                </TableCell>
                                <TableCell><b>Libro/Folio</b></TableCell>
                                <TableCell align="center">
                                    <TableSortLabel
                                        active={filters.ordering === 'total_alumnos' || filters.ordering === '-total_alumnos'}
                                        direction={filters.ordering === 'total_alumnos' ? 'asc' : 'desc'}
                                        onClick={() => handleRequestSort('total_alumnos')}
                                    >
                                        <b>Estudiantes</b>
                                    </TableSortLabel>
                                </TableCell>
                                <TableCell align="right"><b>Acciones</b></TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {actas?.map((acta) => (
                                <TableRow key={acta.id} hover>
                                    <TableCell sx={{ fontWeight: 500 }}>{acta.id}</TableCell>
                                    <TableCell>
                                        {acta.fecha && dayjs.utc(acta.fecha).isValid() 
                                            ? dayjs.utc(acta.fecha).format('DD/MM/YYYY') 
                                            : '--/--/----'}
                                    </TableCell>
                                    <TableCell>
                                        <Chip label={acta.codigo} size="small" variant="outlined" />
                                    </TableCell>
                                    <TableCell>
                                        <Stack direction="row" spacing={1} alignItems="center">
                                            <span>{acta.materia}</span>
                                            {acta.tiene_vocales === false && (
                                                <Tooltip title="Sin vocales en el tribunal">
                                                    <WarningAmberIcon fontSize="small" color="warning" />
                                                </Tooltip>
                                            )}
                                        </Stack>
                                    </TableCell>
                                    <TableCell>
                                        {acta.libro || '-'}/{acta.folio || '-'}
                                    </TableCell>
                                    <TableCell align="center">{acta.total_estudiantes}</TableCell>
                                    <TableCell align="right">
                                        <Tooltip title="Imprimir Acta Principal">
                                            <IconButton onClick={() => descargarActaPdf(acta.id, acta.codigo)}>
                                                <PrintIcon />
                                            </IconButton>
                                        </Tooltip>
                                        {canEditActa && acta.tiene_vocales === false && (
                                            <Tooltip title="Completar tribunal (vocales faltantes)">
                                                <IconButton
                                                    color="warning"
                                                    onClick={() => setTribunalActaId(acta.id)}
                                                >
                                                    <GroupsIcon />
                                                </IconButton>
                                            </Tooltip>
                                        )}
                                        {canEditActa && !acta.esta_cerrada && (
                                            <Tooltip title="Editar Acta de Examen">
                                                <IconButton
                                                    color="primary"
                                                    onClick={() => navigate(`/admin/primera-carga/actas-examen?editId=${acta.id}`)}
                                                >
                                                    <EditIcon />
                                                </IconButton>
                                            </Tooltip>
                                        )}
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
            {tribunalActaId && (
                <TribunalDialog
                    open={!!tribunalActaId}
                    actaId={tribunalActaId}
                    onClose={() => setTribunalActaId(null)}
                    onSaved={() => {
                        setTribunalActaId(null);
                        setActiveFilters({ ...activeFilters });
                    }}
                />
            )}
        </Box>
    );
};

// Componente Local para el detalle
const DetalleActaDialog: React.FC<{ open: boolean; actaId: number; onClose: () => void }> = ({ open, actaId, onClose }) => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const isAdminOrSecretaria = React.useMemo(() => hasRole(user, 'admin') || hasRole(user, 'secretaria'), [user]);
    const canEditActa = React.useMemo(() => hasRole(user, 'admin') || hasRole(user, 'secretaria') || hasRole(user, 'bedel'), [user]);

    const { data: acta, isLoading } = useQuery({
        queryKey: ['acta-detalle', actaId],
        queryFn: () => obtenerActa(actaId),
        enabled: open,
    });

    const [isEditingHeader, setIsEditingHeader] = useState(false);
    const [editValues, setEditValues] = useState({ fecha: '', libro: '', folio: '' });
    const [tribunalOpen, setTribunalOpen] = useState(false);

    const sinVocales = acta ? !acta.docentes.some(d => d.rol === 'VOC1' || d.rol === 'VOC2') : false;

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
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        onError: (err: any) => {
            const msg = err.response?.data.message || 'Error al reabrir la planilla.';
            enqueueSnackbar(msg, { variant: 'error' });
        }
    });

    const closeMutation = useMutation({
        mutationFn: (mesaId: number) => gestionarMesaPlanillaCierre(mesaId, 'cerrar'),
        onSuccess: () => {
            enqueueSnackbar('Planilla cerrada correctamente.', { variant: 'success' });
            queryClient.invalidateQueries({ queryKey: ['acta-detalle', actaId] });
            queryClient.invalidateQueries({ queryKey: ['actas-historial'] });
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        onError: (err: any) => {
            const msg = err.response?.data.message || 'Error al cerrar la planilla.';
            enqueueSnackbar(msg, { variant: 'error' });
        }
    });

    const handleClose = () => {
        if (!acta?.mesa_id) return;
        if (window.confirm('¿Cerrar esta planilla? Una vez cerrada no podrá editarse hasta que la reabrás.')) {
            closeMutation.mutate(acta.mesa_id);
        }
    };

    const updateHeaderMutation = useMutation({
        mutationFn: (payload: { fecha: string; libro: string; folio: string }) =>
            actualizarCabeceraActa(actaId, payload),
        onSuccess: () => {
            enqueueSnackbar('Encabezado actualizado correctamente.', { variant: 'success' });
            queryClient.invalidateQueries({ queryKey: ['acta-detalle', actaId] });
            queryClient.invalidateQueries({ queryKey: ['actas-historial'] });
            setIsEditingHeader(false);
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
        <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth scroll="paper">
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
                    <>
                        {isEditingHeader && (
                            <Stack spacing={2} sx={{ mb: 3, p: 2, bgcolor: 'grey.50', borderRadius: 1, border: '1px dashed grey' }}>
                                <Typography variant="subtitle2" color="primary" sx={{ fontWeight: 600 }}>Editando Encabezado del Acta</Typography>
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
                                        Guardar cambios
                                    </Button>
                                </Stack>
                            </Stack>
                        )}
                                <ActaExamenReadOnly acta={acta} />
                    </>
                ) : (
                    <Alert severity="error">No se pudo cargar el detalle.</Alert>
                )}
            </DialogContent>
            {tribunalOpen && (
                <TribunalDialog
                    open={tribunalOpen}
                    actaId={actaId}
                    onClose={() => setTribunalOpen(false)}
                    onSaved={() => {
                        setTribunalOpen(false);
                        queryClient.invalidateQueries({ queryKey: ['acta-detalle', actaId] });
                        queryClient.invalidateQueries({ queryKey: ['actas-historial'] });
                    }}
                />
            )}
            <DialogActions>
                {canEditActa && sinVocales && !isLoading && (
                    <Button
                        startIcon={<GroupsIcon />}
                        color="warning"
                        variant="outlined"
                        onClick={() => setTribunalOpen(true)}
                    >
                        Completar tribunal
                    </Button>
                )}
                {acta?.esta_cerrada && acta.mesa_id && isAdminOrSecretaria && (
                    <Button
                        onClick={handleReopen}
                        color="warning"
                        disabled={reopenMutation.isPending || isEditingHeader}
                    >
                        {reopenMutation.isPending ? "Reabriendo..." : "Reabrir Planilla"}
                    </Button>
                )}
                {!acta?.esta_cerrada && acta?.mesa_id && isAdminOrSecretaria && (
                    <Button
                        onClick={handleClose}
                        color="error"
                        variant="outlined"
                        disabled={closeMutation.isPending || isEditingHeader}
                    >
                        {closeMutation.isPending ? "Cerrando..." : "Cerrar Planilla"}
                    </Button>
                )}
                {!acta?.esta_cerrada && canEditActa && (
                    <Button
                        startIcon={<EditIcon />}
                        onClick={() => navigate(`/admin/primera-carga/actas-examen?editId=${actaId}`)}
                        color="primary"
                    >
                        Editar Planilla
                    </Button>
                )}
                <Button 
                    startIcon={<PrintIcon />} 
                    onClick={() => descargarActaPdf(actaId, acta?.codigo || '')}
                    disabled={!acta}
                >
                    Imprimir Acta
                </Button>
                <Button 
                    startIcon={<PrintIcon />} 
                    onClick={() => descargarActaComisionadosPdf(actaId, acta?.codigo || '')}
                    disabled={!acta}
                    color="secondary"
                >
                    Comisionados
                </Button>
                <Button onClick={onClose} disabled={reopenMutation.isPending || closeMutation.isPending}>Cerrar</Button>
            </DialogActions>
        </Dialog>
    );
};

const ROLES_LABEL: Record<string, string> = { PRES: 'Presidente', VOC1: 'Vocal 1', VOC2: 'Vocal 2' };

const TribunalDialog: React.FC<{
    open: boolean;
    actaId: number;
    onClose: () => void;
    onSaved: () => void;
}> = ({ open, actaId, onClose, onSaved }) => {
    const queryClient = useQueryClient();

    const { data: acta, isLoading } = useQuery({
        queryKey: ['acta-detalle', actaId],
        queryFn: () => obtenerActa(actaId),
        enabled: open,
    });

    const { data: metadata } = useQuery({
        queryKey: ['acta-examen-metadata'],
        queryFn: fetchActaMetadata,
        enabled: open,
    });

    const [docentes, setDocentes] = React.useState<Record<string, ActaDocentePayload>>({
        PRES: { rol: 'PRES', nombre: '', dni: null, docente_id: null },
        VOC1: { rol: 'VOC1', nombre: '', dni: null, docente_id: null },
        VOC2: { rol: 'VOC2', nombre: '', dni: null, docente_id: null },
    });

    React.useEffect(() => {
        if (acta) {
            const base: Record<string, ActaDocentePayload> = {
                PRES: { rol: 'PRES', nombre: '', dni: null, docente_id: null },
                VOC1: { rol: 'VOC1', nombre: '', dni: null, docente_id: null },
                VOC2: { rol: 'VOC2', nombre: '', dni: null, docente_id: null },
            };
            acta.docentes.forEach(d => { base[d.rol] = { ...d }; });
            setDocentes(base);
        }
    }, [acta]);

    const docentesDisponibles = metadata?.docentes ?? [];

    const saveMutation = useMutation({
        mutationFn: () => actualizarDocentesActa(actaId, Object.values(docentes).filter(d => d.nombre.trim())),
        onSuccess: () => {
            enqueueSnackbar('Tribunal actualizado correctamente.', { variant: 'success' });
            queryClient.invalidateQueries({ queryKey: ['actas-historial'] });
            queryClient.invalidateQueries({ queryKey: ['acta-detalle', actaId] });
            onSaved();
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        onError: (err: any) => {
            enqueueSnackbar(err?.response?.data?.message || 'Error al guardar el tribunal.', { variant: 'error' });
        },
    });

    const handleSelectDocente = (rol: string, value: string) => {
        const found = docentesDisponibles.find(d => {
            const label = d.dni ? `${d.dni} - ${d.nombre}` : d.nombre;
            return label === value || d.nombre === value;
        });
        if (found) {
            setDocentes(prev => ({ ...prev, [rol]: { rol, nombre: found.nombre, dni: found.dni ?? null, docente_id: found.id } }));
        } else {
            setDocentes(prev => ({ ...prev, [rol]: { rol, nombre: value, dni: null, docente_id: null } }));
        }
    };

    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
            <DialogTitle sx={{ bgcolor: INSTITUTIONAL_GREEN, color: 'white' }}>
                Completar Tribunal — Acta #{actaId}
            </DialogTitle>
            <DialogContent dividers>
                {isLoading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}><CircularProgress /></Box>
                ) : (
                    <Stack spacing={3} sx={{ pt: 1 }}>
                        <Alert severity="info" icon={false}>
                            Completá los vocales faltantes. El acta permanece cerrada — solo se actualizan los docentes.
                        </Alert>
                        {(['PRES', 'VOC1', 'VOC2'] as const).map(rol => (
                            <TextField
                                key={rol}
                                label={ROLES_LABEL[rol]}
                                size="small"
                                fullWidth
                                value={docentes[rol]?.nombre || ''}
                                onChange={e => handleSelectDocente(rol, e.target.value)}
                                inputProps={{ list: `docentes-list-${rol}` }}
                                placeholder="Escribí el nombre o seleccioná de la lista"
                                helperText={docentes[rol]?.dni ? `DNI: ${docentes[rol].dni}` : undefined}
                            />
                        ))}
                        <datalist id="docentes-list-PRES">
                            {docentesDisponibles.map(d => <option key={d.id} value={d.dni ? `${d.dni} - ${d.nombre}` : d.nombre} />)}
                        </datalist>
                        <datalist id="docentes-list-VOC1">
                            {docentesDisponibles.map(d => <option key={d.id} value={d.dni ? `${d.dni} - ${d.nombre}` : d.nombre} />)}
                        </datalist>
                        <datalist id="docentes-list-VOC2">
                            {docentesDisponibles.map(d => <option key={d.id} value={d.dni ? `${d.dni} - ${d.nombre}` : d.nombre} />)}
                        </datalist>
                    </Stack>
                )}
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose} color="inherit">Cancelar</Button>
                <Button
                    variant="contained"
                    startIcon={<SaveIcon />}
                    onClick={() => saveMutation.mutate()}
                    disabled={saveMutation.isPending}
                >
                    {saveMutation.isPending ? 'Guardando...' : 'Guardar tribunal'}
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default HistorialActasPage;
