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
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import { listarResidenciasCondicionales, ResidenciaCondicionalItemDTO } from "@/api/estudiantes/inscripcion";
import { useQuery } from "@tanstack/react-query";

type GrupoCondicional = {
    dni: string;
    nombre: string;
    materia_pendiente: string;
    fecha_limite: string;
    estado: ResidenciaCondicionalItemDTO["estado"];
    residencias: string[];
};

function agrupar(items: ResidenciaCondicionalItemDTO[]): GrupoCondicional[] {
    const map = new Map<string, GrupoCondicional>();
    for (const item of items) {
        const key = `${item.dni}|${item.materia_pendiente}`;
        if (!map.has(key)) {
            map.set(key, {
                dni: item.dni,
                nombre: item.nombre,
                materia_pendiente: item.materia_pendiente,
                fecha_limite: item.fecha_limite,
                estado: item.estado,
                residencias: [],
            });
        }
        map.get(key)!.residencias.push(item.materia_residencia);
    }
    return Array.from(map.values());
}

export default function ResidenciasCondicionalesWidget() {
    const { data, isLoading, isError } = useQuery({
        queryKey: ["residencias-condicionales-admin"],
        queryFn: () => listarResidenciasCondicionales({ solo_pendientes: true }),
        staleTime: 1000 * 60 * 5,
    });

    const items = data || [];
    const grupos = agrupar(items);

    if (isLoading) {
        return (
            <Box display="flex" justifyContent="center" py={4}>
                <CircularProgress size={28} />
            </Box>
        );
    }

    if (isError) {
        return <Alert severity="error">No se pudieron cargar las residencias condicionales.</Alert>;
    }

    if (grupos.length === 0) {
        return (
            <Card variant="outlined" sx={{ borderColor: "rgba(34,197,94,0.3)", bgcolor: "#f0fdf4" }}>
                <CardHeader
                    avatar={<CheckCircleIcon sx={{ color: "#16a34a" }} />}
                    title={<Typography fontWeight={700} color="#15803d">Residencias condicionales</Typography>}
                    subheader="Sin inscripciones condicionales pendientes"
                />
            </Card>
        );
    }

    const formatDate = (dateStr: string) => {
        if (!dateStr) return "-";
        const parts = dateStr.split("-");
        if (parts.length !== 3) return dateStr;
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
    };

    return (
        <Card variant="outlined" sx={{ borderColor: "rgba(230,168,23,0.4)", bgcolor: "#fffbf0" }}>
            <CardHeader
                avatar={<WarningAmberIcon sx={{ color: "#b45309" }} />}
                title={
                    <Box display="flex" alignItems="center" gap={1}>
                        <Typography fontWeight={700} color="#b45309">
                            Residencias condicionales
                        </Typography>
                        <Chip
                            label={`${grupos.length} estudiante${grupos.length !== 1 ? "s" : ""}`}
                            size="small"
                            sx={{ bgcolor: "#e6a817", color: "#fff", fontWeight: 700 }}
                        />
                    </Box>
                }
                subheader="Estudiantes que deben aprobar una materia antes del 01/06 para mantener su cursada"
            />
            <CardContent sx={{ pt: 0 }}>
                <TableContainer>
                    <Table size="small">
                        <TableHead>
                            <TableRow sx={{ "& th": { fontWeight: 700, color: "#92400e", bgcolor: "#fef3c7" } }}>
                                <TableCell>Estudiante</TableCell>
                                <TableCell>DNI</TableCell>
                                <TableCell>Materias de Residencia inscriptas</TableCell>
                                <TableCell>Materia pendiente</TableCell>
                                <TableCell>Fecha límite</TableCell>
                                <TableCell>Estado</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {grupos.map((g) => (
                                <TableRow key={`${g.dni}-${g.materia_pendiente}`} hover>
                                    <TableCell>{g.nombre}</TableCell>
                                    <TableCell>{g.dni}</TableCell>
                                    <TableCell>
                                        <Box component="ul" sx={{ m: 0, pl: 2 }}>
                                            {g.residencias.map((r) => (
                                                <li key={r}>
                                                    <Typography variant="body2">{r}</Typography>
                                                </li>
                                            ))}
                                        </Box>
                                    </TableCell>
                                    <TableCell>
                                        <Typography variant="body2" color="error.main" fontWeight={600}>
                                            {g.materia_pendiente}
                                        </Typography>
                                    </TableCell>
                                    <TableCell>
                                        <Typography variant="body2" fontWeight={600}>
                                            {formatDate(g.fecha_limite)}
                                        </Typography>
                                    </TableCell>
                                    <TableCell>
                                        {g.estado === "RESUELTA" ? (
                                            <Chip label="Resuelta" size="small" color="success" />
                                        ) : g.estado === "CAÍDA" ? (
                                            <Chip label="Caída" size="small" color="error" />
                                        ) : (
                                            <Chip label="Pendiente" size="small" sx={{ bgcolor: "#e6a817", color: "#fff" }} />
                                        )}
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
