import Card from "@mui/material/Card";
import CardHeader from "@mui/material/CardHeader";
import CardContent from "@mui/material/CardContent";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import Alert from "@mui/material/Alert";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import { getCorrelativasCaidas, CorrelativaCaidaItem } from "@/api/reportes";
import { useQuery } from "@tanstack/react-query";

export default function AdminCorrelativasWidget() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, isLoading, isError, error } = useQuery({
        queryKey: ["correlativas-caidas"],
        queryFn: () => getCorrelativasCaidas(), // Arrow function para evitar inyección de argumentos incorrectos
        staleTime: 1000 * 60 * 5, // 5 minutos de caché (comparte con DashboardPage)
    });

    const items = (data as CorrelativaCaidaItem[]) || [];

    if (isLoading) {
        return (
            <Box sx={{ display: "flex", justifyContent: "center", p: 4 }}>
                <CircularProgress size={24} />
            </Box>
        );
    }

    if (isError) {
        return <Alert severity="error">No se pudo cargar el reporte de correlativas.</Alert>;
    }

    if (items.length === 0) {
        return (
            <Card variant="outlined" sx={{ p: 3, textAlign: "center", color: "text.secondary" }}>
                <Typography variant="body2">No hay alertas de correlatividades activas.</Typography>
            </Card>
        );
    }

    return (
        <Card variant="outlined" sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
            <CardHeader
                title={
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                        <WarningAmberIcon color="warning" />
                        <Typography variant="h6">Alertas de Correlatividad</Typography>
                        <Chip label={items.length} size="small" color="warning" variant="filled" />
                    </Box>
                }
                subheader="Estudiantes cursando materias sin cumplir requisitos"
            />
            <CardContent sx={{ flexGrow: 1, overflow: "auto", p: 0 }}>
                <TableContainer sx={{ maxHeight: 400 }}>
                    <Table stickyHeader size="small">
                        <TableHead>
                            <TableRow>
                                <TableCell>Estudiante</TableCell>
                                <TableCell>Materia Actual</TableCell>
                                <TableCell>Debe</TableCell>
                                <TableCell>Motivo</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {items.map((item, index) => (
                                <TableRow key={`${item.estudiante_id}-${index}`} hover>
                                    <TableCell>
                                        <Typography variant="body2" fontWeight={500}>
                                            {item.apellido_nombre}
                                        </Typography>
                                        <Typography variant="caption" color="text.secondary">
                                            {item.dni}
                                        </Typography>
                                    </TableCell>
                                    <TableCell>{item.materia_actual}</TableCell>
                                    <TableCell sx={{ color: "error.main", fontWeight: 500 }}>
                                        {item.materia_correlativa}
                                    </TableCell>
                                    <TableCell>
                                        <Chip
                                            label={item.motivo}
                                            size="small"
                                            color="error"
                                            variant="outlined"
                                            sx={{ fontSize: "0.7rem" }}
                                        />
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>
            </CardContent>
        </Card>
    );
}
