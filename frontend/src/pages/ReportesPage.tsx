import { useQuery } from '@tanstack/react-query';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Box, CircularProgress, Typography, Paper, Grid, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Button } from '@mui/material';
import BackButton from '@/components/ui/BackButton';
import { PageHero } from "@/components/ui/GradientTitles";
import { obtenerResumenInscripciones, obtenerResumenAcademico, obtenerResumenAsistencia } from '@/api/metrics';
import { getCorrelativasCaidas, CorrelativaCaidaItem } from "@/api/reportes";

function ResumenInscripcionesChart() {
    const { data, isLoading, isError, error } = useQuery({
        queryKey: ['resumenInscripciones'],
        queryFn: obtenerResumenInscripciones,
    });

    if (isLoading) return <CircularProgress />;
    if (isError) return <Typography color="error">Error: {error.message}</Typography>;

    return (
        <Paper sx={{ p: 2, display: 'flex', flexDirection: 'column', height: 400 }}>
            <Typography variant="h6" component="h2" gutterBottom>
                Resumen de Preinscripciones por Profesorado
            </Typography>
            <ResponsiveContainer width="100%" height={320}>
                <BarChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="profesorado" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="total_preinscripciones" fill="#8884d8" name="Preinscripciones" />
                    <Bar dataKey="total_confirmadas" fill="#82ca9d" name="Confirmadas" />
                </BarChart>
            </ResponsiveContainer>
        </Paper>
    );
}

function ResumenAcademicoChart() {
    const { data, isLoading, isError, error } = useQuery({
        queryKey: ['resumenAcademico'],
        queryFn: obtenerResumenAcademico,
    });

    if (isLoading) return <CircularProgress />;
    if (isError) return <Typography color="error">Error: {error.message}</Typography>;

    return (
        <Paper sx={{ p: 2, display: 'flex', flexDirection: 'column', height: 400 }}>
            <Typography variant="h6" component="h2" gutterBottom>
                Resumen Académico por Profesorado
            </Typography>
            <ResponsiveContainer width="100%" height={320}>
                <BarChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="profesorado" />
                    <YAxis yAxisId="left" orientation="left" stroke="#8884d8" />
                    <YAxis yAxisId="right" orientation="right" stroke="#82ca9d" />
                    <Tooltip />
                    <Legend />
                    <Bar yAxisId="left" dataKey="tasa_aprobacion" fill="#8884d8" name="Tasa de Aprobación (%)" />
                    <Bar yAxisId="right" dataKey="nota_promedio" fill="#82ca9d" name="Nota Promedio" />
                </BarChart>
            </ResponsiveContainer>
        </Paper>
    );
}

function ResumenAsistenciaChart() {
    const { data, isLoading, isError, error } = useQuery({
        queryKey: ['resumenAsistencia'],
        queryFn: obtenerResumenAsistencia,
    });

    if (isLoading) return <CircularProgress />;
    if (isError) return <Typography color="error">Error: {error.message}</Typography>;

    return (
        <Paper sx={{ p: 2, display: 'flex', flexDirection: 'column', height: 400 }}>
            <Typography variant="h6" component="h2" gutterBottom>
                Resumen de Asistencia por Profesorado
            </Typography>
            <ResponsiveContainer width="100%" height={320}>
                <BarChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="profesorado" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="tasa_asistencia" fill="#ffc658" name="Tasa de Asistencia (%)" />
                </BarChart>
            </ResponsiveContainer>
        </Paper>
    );
}

function ReporteCorrelativasCaidas() {
    const { data, isLoading, isError, error } = useQuery<CorrelativaCaidaItem[]>({
        queryKey: ['correlativas-caidas'],
        queryFn: () => getCorrelativasCaidas(),
    });

    if (isLoading) return <CircularProgress />;
    if (isError) return <Typography color="error">Error: {error.message}</Typography>;
    if (!data || data.length === 0) return (
        <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>Alumnos con Correlativas Caídas</Typography>
            <Typography>No se encontraron alumnos con problemas de correlatividad.</Typography>
        </Paper>
    );

    return (
        <Paper sx={{ p: 2, display: 'flex', flexDirection: 'column' }}>
            <Typography variant="h6" component="h2" gutterBottom color="error">
                Alumnos con Correlativas Caídas ({data.length})
            </Typography>
            <TableContainer sx={{ maxHeight: 400 }}>
                <Table size="small" stickyHeader>
                    <TableHead>
                        <TableRow>
                            <TableCell>DNI</TableCell>
                            <TableCell>Apellido y Nombre</TableCell>
                            <TableCell>Materia Actual</TableCell>
                            <TableCell>Correlativa Caída</TableCell>
                            <TableCell>Motivo</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {data.map((row: CorrelativaCaidaItem, index: number) => (
                            <TableRow key={index} hover>
                                <TableCell>{row.dni}</TableCell>
                                <TableCell>{row.apellido_nombre}</TableCell>
                                <TableCell>{row.materia_actual}</TableCell>
                                <TableCell sx={{ color: 'error.main', fontWeight: 'bold' }}>{row.materia_correlativa}</TableCell>
                                <TableCell>{row.motivo}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>
        </Paper>
    );
}

export default function ReportesPage() {
    return (
        <Box sx={{ flexGrow: 1 }}>
            <BackButton sx={{ mb: 2 }} />
            <PageHero
                title="Reportes y estadísticas"
                subtitle="Visualizá indicadores institucionales en tiempo real"
            />
            <Grid container spacing={3}>
                <Grid item xs={12}>
                    <ReporteCorrelativasCaidas />
                </Grid>
                <Grid item xs={12}>
                    <ResumenInscripcionesChart />
                </Grid>
                <Grid item xs={12}>
                    <ResumenAcademicoChart />
                </Grid>
                <Grid item xs={12}>
                    <ResumenAsistenciaChart />
                </Grid>
            </Grid>
        </Box>
    );
}
