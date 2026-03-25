import { useState } from 'react';
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import Typography from "@mui/material/Typography";
import Paper from "@mui/material/Paper";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Chip from "@mui/material/Chip";
import TextField from "@mui/material/TextField";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import Checkbox from "@mui/material/Checkbox";
import FormControlLabel from "@mui/material/FormControlLabel";
import Grid from "@mui/material/Grid";
import Alert from "@mui/material/Alert";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import DownloadIcon from "@mui/icons-material/Download";
import SearchIcon from "@mui/icons-material/Search";
import ClearIcon from "@mui/icons-material/Clear";
import InputAdornment from "@mui/material/InputAdornment";
import IconButton from "@mui/material/IconButton";
import Autocomplete from "@mui/material/Autocomplete";
import ManageAccountsIcon from '@mui/icons-material/ManageAccounts';
import { useQuery } from '@tanstack/react-query';

import BackButton from '@/components/ui/BackButton';
import { PageHero } from "@/components/ui/GradientTitles";
import { getAuditoriaInconsistencias, AuditoriaInconsistenciaItem, downloadAuditoriaInconsistencias, AuditoriaFilters } from "@/api/reportes";
import { fetchCarreras, fetchMaterias } from '@/api/carreras';

export default function AuditoriaInconsistenciasPage() {
    const [filters, setFilters] = useState<AuditoriaFilters>({
        search: '',
        profesorado_id: undefined,
        materia_id: undefined,
        solo_activos: true,
    });
    
    const [hasSearched, setHasSearched] = useState(false);

    const { data: carreras } = useQuery({
        queryKey: ['carreras-vigentes'],
        queryFn: fetchCarreras,
    });

    const { data: materias } = useQuery({
        queryKey: ['materias-filtro', filters.profesorado_id],
        queryFn: () => fetchMaterias(undefined, filters.profesorado_id),
    });

    const { data, isLoading, isError, error, refetch } = useQuery<AuditoriaInconsistenciaItem[]>({
        queryKey: ['auditoria-inconsistencias', filters],
        queryFn: () => getAuditoriaInconsistencias(filters),
        enabled: hasSearched,
    });

    const handleDownload = async () => {
        try {
            await downloadAuditoriaInconsistencias(filters);
        } catch (err) {
            console.error("Error downloading report", err);
        }
    };

    const handleFilterChange = (field: keyof AuditoriaFilters, value: any) => {
        setFilters(prev => ({ ...prev, [field]: value }));
    };

    const handleClearSearch = () => {
        handleFilterChange('search', '');
    };

    const handleGenerate = () => {
        setHasSearched(true);
        refetch();
    };

    const handleReset = () => {
        setFilters({ search: '', profesorado_id: undefined, materia_id: undefined, solo_activos: true });
        setHasSearched(false);
    };

    const rows = Array.isArray(data) ? data : [];

    return (
        <Box sx={{ flexGrow: 1 }}>
            <BackButton sx={{ mb: 2 }} />
            <PageHero
                title="Auditoría de Inconsistencias"
                subtitle="Detección de irregularidades en correlatividades y estados académicos."
            />
            
            <Paper sx={{ p: 3, mb: 3 }}>
                <Typography variant="subtitle2" gutterBottom sx={{ opacity: 0.7, mb: 2 }}>
                    Filtros de Búsqueda
                </Typography>
                <Grid container spacing={2} alignItems="center">
                    <Grid item xs={12} md={3}>
                        <TextField
                            fullWidth
                            size="small"
                            label="Buscar Estudiante"
                            placeholder="Nombre, Apellido o DNI"
                            value={filters.search}
                            onChange={(e) => handleFilterChange('search', e.target.value)}
                            InputProps={{
                                startAdornment: (
                                    <InputAdornment position="start">
                                        <SearchIcon fontSize="small" />
                                    </InputAdornment>
                                ),
                                endAdornment: filters.search && (
                                    <InputAdornment position="end">
                                        <IconButton size="small" onClick={handleClearSearch}>
                                            <ClearIcon fontSize="small" />
                                        </IconButton>
                                    </InputAdornment>
                                )
                            }}
                        />
                    </Grid>
                    <Grid item xs={12} md={3}>
                        <FormControl fullWidth size="small">
                            <InputLabel>Profesorado</InputLabel>
                            <Select
                                label="Profesorado"
                                value={filters.profesorado_id || ''}
                                onChange={(e) => {
                                    handleFilterChange('profesorado_id', e.target.value || undefined);
                                    handleFilterChange('materia_id', undefined);
                                }}
                            >
                                <MenuItem value="">Todos los profesorados</MenuItem>
                                {carreras?.map(c => (
                                    <MenuItem key={c.id} value={c.id}>{c.nombre}</MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    </Grid>
                    <Grid item xs={12} md={4}>
                        <Autocomplete
                            size="small"
                            options={materias || []}
                            getOptionLabel={(option) => `${option.anio_cursada}° - ${option.nombre}`}
                            value={materias?.find(m => m.id === filters.materia_id) || null}
                            onChange={(_, newValue) => handleFilterChange('materia_id', newValue?.id)}
                            renderInput={(params) => <TextField {...params} label="Filtrar por Materia" placeholder="Seleccioná una materia" />}
                            noOptionsText="No se encontraron materias"
                            renderOption={(props, option) => (
                                <Box component="li" {...props} key={option.id}>
                                    <Typography variant="body2">
                                        <Box component="span" sx={{ color: 'primary.main', fontWeight: 'bold', mr: 1 }}>
                                            {option.anio_cursada}°
                                        </Box>
                                        {option.nombre}
                                    </Typography>
                                </Box>
                            )}
                        />
                    </Grid>
                    <Grid item xs={12} md={2}>
                        <FormControlLabel
                            control={
                                <Checkbox 
                                    checked={!!filters.solo_activos} 
                                    onChange={(e) => handleFilterChange('solo_activos', e.target.checked)}
                                />
                            }
                            label="Solo activos"
                        />
                    </Grid>
                    <Grid item xs={12} sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mt: 1 }}>
                        <Button 
                            variant="outlined" 
                            onClick={handleReset}
                        >
                            Limpiar Filtros
                        </Button>
                        <Button 
                            variant="contained" 
                            onClick={handleGenerate}
                            disabled={isLoading}
                        >
                            {isLoading ? 'Generando...' : 'Generar Reporte'}
                        </Button>
                    </Grid>
                </Grid>
            </Paper>

            <Paper sx={{ p: 4, display: 'flex', flexDirection: 'column', minHeight: '300px' }}>
                {!hasSearched ? (
                    <Box sx={{ py: 8, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                        <ManageAccountsIcon sx={{ fontSize: 60, color: 'divider', mb: 2 }} />
                        <Typography variant="h6" color="text.secondary" gutterBottom>
                            Lista de Auditoría Vacía
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 400 }}>
                            Por favor, aplica los filtros necesarios y presiona el botón <b>"Generar Reporte"</b> para iniciar el análisis del sistema académico.
                        </Typography>
                    </Box>
                ) : (
                    <>
                        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                                <WarningAmberIcon color="warning" fontSize="large" />
                                <Box>
                                    <Typography variant="h6" component="h2">
                                        Inconsistencias Detectadas
                                    </Typography>
                                    {!isLoading && !isError && (
                                        <Typography variant="body2" color="text.secondary">
                                            Se han encontrado {rows.length} registros que requieren revisión.
                                        </Typography>
                                    )}
                                </Box>
                            </Box>
                            <Button 
                                variant="contained" 
                                startIcon={<DownloadIcon />} 
                                onClick={handleDownload}
                                disabled={isLoading || isError || rows.length === 0}
                            >
                                Exportar a CSV
                            </Button>
                        </Stack>

                        {isLoading && (
                            <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
                                <Stack alignItems="center" spacing={2}>
                                    <CircularProgress />
                                    <Typography color="text.secondary">Analizando base de datos académicos...</Typography>
                                </Stack>
                            </Box>
                        )}

                        {isError && (
                            <Alert severity="error" sx={{ mb: 2 }}>
                                Error al cargar la auditoría: {(error as any)?.message || "Error desconocido"}
                            </Alert>
                        )}

                        {!isLoading && !isError && rows.length === 0 ? (
                            <Box sx={{ py: 6, textAlign: 'center' }}>
                                <Typography color="text.secondary">
                                    No se detectaron inconsistencias con los filtros aplicados.
                                </Typography>
                            </Box>
                        ) : !isLoading && !isError && (
                            <TableContainer sx={{ maxHeight: '60vh' }}>
                                <Table size="small" stickyHeader>
                                    <TableHead>
                                        <TableRow>
                                            <TableCell>Estudiante</TableCell>
                                            <TableCell>DNI</TableCell>
                                            <TableCell>Profesorado</TableCell>
                                            <TableCell>Materia</TableCell>
                                            <TableCell>Evento</TableCell>
                                            <TableCell>Fecha</TableCell>
                                            <TableCell>Prerrequisito Faltante</TableCell>
                                            <TableCell>Motivo</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {rows.map((row, index) => (
                                            <TableRow key={index} hover>
                                                <TableCell sx={{ fontWeight: 500 }}>{row.estudiante}</TableCell>
                                                <TableCell>{row.dni}</TableCell>
                                                <TableCell sx={{ fontSize: '0.75rem' }}>{row.carrera}</TableCell>
                                                <TableCell>{row.materia}</TableCell>
                                                <TableCell>
                                                    <Chip label={row.evento} size="small" variant="outlined" />
                                                </TableCell>
                                                <TableCell>{row.fecha}</TableCell>
                                                <TableCell sx={{ color: 'error.main', fontWeight: 'bold' }}>
                                                    {row.prerrequisito} <Typography component="span" variant="caption" display="block">({row.tipo_corr})</Typography>
                                                </TableCell>
                                                <TableCell sx={{ fontSize: '0.8125rem' }}>{row.motivo}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                        )}
                    </>
                )}
            </Paper>
        </Box>
    );
}
