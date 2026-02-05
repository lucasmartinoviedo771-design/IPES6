
import { useEffect } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Box, Typography, Table, TableBody, TableCell, TableHead, TableRow, CircularProgress, Alert } from "@mui/material";
import { obtenerActa } from "@/api/cargaNotas";
import ipesLogoFull from "@/assets/ipes-logo.png";

export default function ActaPrintPage() {
    const { actaId } = useParams<{ actaId: string }>();

    const { data: acta, isLoading, isError } = useQuery({
        queryKey: ["acta-detalle", actaId],
        queryFn: () => obtenerActa(Number(actaId)),
        enabled: Boolean(actaId),
    });

    useEffect(() => {
        if (acta && !isLoading) {
            document.title = `Acta_${acta.libro || 'S_L'}_${acta.folio || 'S_F'}_${acta.materia}`;
            const timer = setTimeout(() => {
                window.print();
            }, 500);
            return () => clearTimeout(timer);
        }
    }, [acta, isLoading]);

    if (isLoading) return <Box p={4} textAlign="center"><CircularProgress /></Box>;
    if (isError || !acta) return <Box p={4}><Alert severity="error">Error al cargar el acta.</Alert></Box>;

    return (
        <Box sx={{ p: 4, bgcolor: "white", minHeight: "100vh", color: "black" }} id="printable-area">
            {/* Encabezado Institucional */}
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                <img src={ipesLogoFull} alt="IPES Logo" style={{ height: 60 }} />
                {/* <Box textAlign="right">
                    <Typography variant="body2">Instituto Provincial de Educación Superior</Typography>
                    <Typography variant="body2">"Paulo Freire"</Typography>
                </Box> */}
            </Box>

            <Typography variant="h5" align="center" sx={{ textTransform: "uppercase", fontWeight: "bold", mb: 3 }}>
                Acta de Examen
            </Typography>

            {/* Metadatos */}
            <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2, mb: 3, border: "1px solid black", p: 2 }}>
                <Box>
                    <Typography variant="body1"><b>Carrera:</b> {acta.profesorado}</Typography>
                    <Typography variant="body1"><b>Plan:</b> {acta.plan_resolucion || "-"}</Typography>
                    <Typography variant="body1"><b>Materia:</b> {acta.materia} {acta.materia_anio ? `(${acta.materia_anio}° Año)` : ""}</Typography>
                    <Typography variant="body1"><b>Fecha:</b> {new Date(acta.fecha).toLocaleDateString()}</Typography>
                </Box>
                <Box>
                    <Typography variant="body1"><b>Libro:</b> {acta.libro || "---"}</Typography>
                    <Typography variant="body1"><b>Folio:</b> {acta.folio || "---"}</Typography>
                    <Typography variant="body1"><b>Código:</b> {acta.codigo}</Typography>
                </Box>
            </Box>

            {/* Tabla de Estudiantes */}
            <Table size="small" sx={{ border: "1px solid black", mb: 4 }}>
                <TableHead>
                    <TableRow>
                        <TableCell sx={{ border: "1px solid black", fontWeight: "bold" }}>Orden</TableCell>
                        <TableCell sx={{ border: "1px solid black", fontWeight: "bold" }}>Permiso</TableCell>
                        <TableCell sx={{ border: "1px solid black", fontWeight: "bold" }}>DNI</TableCell>
                        <TableCell sx={{ border: "1px solid black", fontWeight: "bold" }}>Estudiante</TableCell>
                        <TableCell sx={{ border: "1px solid black", fontWeight: "bold" }}>Escrito</TableCell>
                        <TableCell sx={{ border: "1px solid black", fontWeight: "bold" }}>Oral</TableCell>
                        <TableCell sx={{ border: "1px solid black", fontWeight: "bold", textAlign: "center" }}>Nota Final</TableCell>
                    </TableRow>
                </TableHead>
                <TableBody>
                    {acta.estudiantes?.map((estudiante: any) => (
                        <TableRow key={estudiante.dni}>
                            <TableCell sx={{ border: "1px solid black", textAlign: "center" }}>{estudiante.numero_orden}</TableCell>
                            <TableCell sx={{ border: "1px solid black" }}>{estudiante.permiso_examen || ""}</TableCell>
                            <TableCell sx={{ border: "1px solid black" }}>{estudiante.dni}</TableCell>
                            <TableCell sx={{ border: "1px solid black" }}>{estudiante.apellido_nombre}</TableCell>
                            <TableCell sx={{ border: "1px solid black" }}>{estudiante.examen_escrito || "-"}</TableCell>
                            <TableCell sx={{ border: "1px solid black" }}>{estudiante.examen_oral || "-"}</TableCell>
                            <TableCell sx={{ border: "1px solid black", textAlign: "center", fontWeight: "bold" }}>{estudiante.calificacion_definitiva}</TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>

            {/* Firmas */}
            <Box sx={{ display: "flex", justifyContent: "space-around", mt: 10 }}>
                {acta.docentes?.map((docente) => (
                    <Box key={docente.docente_id || docente.nombre} sx={{ textAlign: "center", borderTop: "1px solid black", pt: 1, minWidth: 200 }}>
                        <Typography variant="body2">{docente.nombre}</Typography>
                        <Typography variant="caption">DNI: {docente.dni || "__________"}</Typography>
                        <Typography variant="caption" display="block">({docente.rol})</Typography>
                    </Box>
                ))}
            </Box>

            {/* Footer */}
            <Box mt={4}>
                <Typography variant="caption">Impreso el {new Date().toLocaleString()}</Typography>
            </Box>
        </Box>
    );
}
