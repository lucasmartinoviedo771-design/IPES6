import React from 'react';
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Divider from "@mui/material/Divider";
import Grid from "@mui/material/Grid";
import Chip from "@mui/material/Chip";
import Alert from "@mui/material/Alert";
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);
import { ActaDetailDTO } from '@/api/cargaNotas';
import { INSTITUTIONAL_GREEN } from "@/styles/institutionalColors";

interface ActaExamenReadOnlyProps {
    acta: ActaDetailDTO;
}

const DOCENTE_ROLES_MAP: Record<string, string> = {
    'PRES': 'Presidente',
    'VOC1': 'Vocal 1',
    'VOC2': 'Vocal 2',
};

const ActaExamenReadOnly: React.FC<ActaExamenReadOnlyProps> = ({ acta }) => {
    return (
        <Stack spacing={3}>
            {/* Encabezado Principal */}
            <Paper variant="outlined" sx={{ p: 2, bgcolor: 'grey.50' }}>
                <Grid container spacing={2}>
                    <Grid item xs={12} md={4}>
                        <Typography variant="subtitle2" color="text.secondary">Materia</Typography>
                        <Typography variant="body1" fontWeight={600}>{acta.materia}</Typography>
                    </Grid>
                    <Grid item xs={12} md={4}>
                        <Typography variant="subtitle2" color="text.secondary">Profesorado</Typography>
                        <Typography variant="body2">{acta.profesorado}</Typography>
                    </Grid>
                    <Grid item xs={12} md={4}>
                        <Typography variant="subtitle2" color="text.secondary">Plan / Año</Typography>
                        <Typography variant="body2">{acta.plan_resolucion || '-'} / {acta.materia_anio ? `${acta.materia_anio}° Año` : '-'}</Typography>
                    </Grid>
                </Grid>
            </Paper>

            {/* Datos del Acta */}
            <Grid container spacing={2}>
                <Grid item xs={12} md={3}>
                    <Typography variant="subtitle2" color="text.secondary">Fecha</Typography>
                    <Typography variant="body1" fontWeight={500}>
                        {acta.fecha || '-'}
                    </Typography>
                </Grid>
                <Grid item xs={12} md={3}>
                    <Typography variant="subtitle2" color="text.secondary">Libro / Folio</Typography>
                    <Typography variant="body1" fontWeight={500}>{acta.libro || '-'} / {acta.folio || '-'}</Typography>
                </Grid>
                <Grid item xs={12} md={6}>
                    <Typography variant="subtitle2" color="text.secondary">Código Interino</Typography>
                    <Chip label={acta.codigo} size="small" color="primary" variant="outlined" />
                </Grid>
            </Grid>

            {/* Tribunal */}
            <Box>
                <Typography variant="h6" fontWeight={600} gutterBottom sx={{ color: INSTITUTIONAL_GREEN }}>
                    Tribunal Examinador
                </Typography>
                <Paper variant="outlined">
                    <Table size="small">
                        <TableBody>
                            {acta.docentes.map((d, idx) => (
                                <TableRow key={idx}>
                                    <TableCell sx={{ width: 200, fontWeight: 600, bgcolor: 'grey.50' }}>
                                        {DOCENTE_ROLES_MAP[d.rol] || d.rol}
                                    </TableCell>
                                    <TableCell>
                                        {d.nombre} {d.dni ? `(DNI: ${d.dni})` : ''}
                                    </TableCell>
                                </TableRow>
                            ))}
                            {acta.docentes.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={2} align="center">No hay docentes registrados</TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </Paper>
            </Box>

            {/* Estudiantes */}
            <Box>
                <Typography variant="h6" fontWeight={600} gutterBottom sx={{ color: INSTITUTIONAL_GREEN }}>
                    Estudiantes y Calificaciones
                </Typography>
                <TableContainer component={Paper} variant="outlined">
                    <Table size="small">
                        <TableHead sx={{ bgcolor: 'grey.100' }}>
                            <TableRow>
                                <TableCell align="center">N°</TableCell>
                                <TableCell>DNI</TableCell>
                                <TableCell>Estudiante</TableCell>
                                <TableCell align="center">Permiso</TableCell>
                                <TableCell align="center">Escrito</TableCell>
                                <TableCell align="center">Oral</TableCell>
                                <TableCell align="center">Definitiva</TableCell>
                                <TableCell>Observaciones</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {acta.estudiantes.map((e) => (
                                <TableRow key={e.numero_orden} hover>
                                    <TableCell align="center">{e.numero_orden}</TableCell>
                                    <TableCell>{e.dni}</TableCell>
                                    <TableCell sx={{ fontWeight: 500 }}>{e.apellido_nombre}</TableCell>
                                    <TableCell align="center">{e.permiso_examen || '-'}</TableCell>
                                    <TableCell align="center">{e.examen_escrito || '-'}</TableCell>
                                    <TableCell align="center">{e.examen_oral || '-'}</TableCell>
                                    <TableCell align="center" sx={{ fontWeight: 700 }}>
                                        {e.calificacion_definitiva}
                                    </TableCell>
                                    <TableCell sx={{ fontSize: '0.75rem', color: 'text.secondary', fontStyle: 'italic' }}>
                                        {e.observaciones || '-'}
                                    </TableCell>
                                </TableRow>
                            ))}
                            {acta.estudiantes.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={8} align="center" sx={{ py: 2 }}>
                                        No hay estudiantes registrados en esta acta.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </TableContainer>
            </Box>

            {/* Resumen de Resultados */}
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <Alert severity="info" sx={{ flex: 1 }} icon={false}>
                    <Stack direction="row" spacing={3} justifyContent="space-around">
                        <Box textAlign="center">
                            <Typography variant="subtitle2" color="text.secondary">Total</Typography>
                            <Typography variant="h6">{acta.total_estudiantes}</Typography>
                        </Box>
                        <Box textAlign="center">
                            <Typography variant="subtitle2" color="success.main">Aprobados</Typography>
                            <Typography variant="h6" color="success.main">{acta.total_aprobados}</Typography>
                        </Box>
                        <Box textAlign="center">
                            <Typography variant="subtitle2" color="error.main">Desaprobados</Typography>
                            <Typography variant="h6" color="error.main">{acta.total_desaprobados}</Typography>
                        </Box>
                        <Box textAlign="center">
                            <Typography variant="subtitle2" color="text.secondary">Ausentes</Typography>
                            <Typography variant="h6">{acta.total_ausentes}</Typography>
                        </Box>
                    </Stack>
                </Alert>
            </Stack>

            {acta.observaciones && (
                <Box>
                    <Typography variant="subtitle2" color="text.secondary">Observaciones Generales</Typography>
                    <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', p: 1, bgcolor: 'grey.50', borderRadius: 1 }}>
                        {acta.observaciones}
                    </Typography>
                </Box>
            )}

            <Divider />
            
            <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                 <Typography variant="caption" color="text.disabled">
                     Creado por {acta.created_by || 'Sistema'} el {acta.created_at && dayjs.utc(acta.created_at).isValid() ? dayjs.utc(acta.created_at).format('DD/MM/YYYY HH:mm') : '--/--/----'}
                </Typography>
            </Box>
        </Stack>
    );
};

export default ActaExamenReadOnly;
