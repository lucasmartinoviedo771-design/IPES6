import { useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Paper from "@mui/material/Paper";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Stack from "@mui/material/Stack";
import Chip from "@mui/material/Chip";
import TextField from "@mui/material/TextField";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import Alert from "@mui/material/Alert";
import CircularProgress from "@mui/material/CircularProgress";
import InputAdornment from "@mui/material/InputAdornment";
import IconButton from "@mui/material/IconButton";
import ClearIcon from "@mui/icons-material/Clear";
import { useQuery } from "@tanstack/react-query";

import BackButton from "@/components/ui/BackButton";
import { PageHero } from "@/components/ui/GradientTitles";
import { fetchResguardoMaterias, ResguardoMateriaItemDTO } from "@/api/estudiantes/admin";
import { fetchCarreras } from "@/api/carreras";

export default function ResguardoMateriasPage() {
    const [profesoradoId, setProfesoradoId] = useState<number | "">("");
    const [dniSearch, setDniSearch] = useState("");
    const [nombreSearch, setNombreSearch] = useState("");

    const { data: carreras } = useQuery({
        queryKey: ["carreras-vigentes"],
        queryFn: fetchCarreras,
        staleTime: 1000 * 60 * 10,
    });

    const { data, isLoading, isError } = useQuery({
        queryKey: ["resguardo-materias", profesoradoId],
        queryFn: () => fetchResguardoMaterias({
            profesorado_id: profesoradoId || undefined,
        }),
        staleTime: 1000 * 60 * 5,
    });

    const items: ResguardoMateriaItemDTO[] = (data || []).filter((item) => {
        if (dniSearch && !item.dni?.includes(dniSearch)) return false;
        if (nombreSearch && !item.nombre.toLowerCase().includes(nombreSearch.toLowerCase())) return false;
        return true;
    });

    // Agrupar por estudiante para el conteo
    const estudiantesUnicos = new Set(items.map((i) => i.dni)).size;

    return (
        <Box sx={{ p: 3 }}>
            <BackButton />
            <PageHero
                title="Resguardo de Materias"
                subtitle="Regularidades y equivalencias en resguardo por correlativas no satisfechas"
            />

            {/* Filtros */}
            <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems="center">
                    <FormControl size="small" sx={{ minWidth: 260 }}>
                        <InputLabel>Profesorado</InputLabel>
                        <Select
                            value={profesoradoId}
                            label="Profesorado"
                            onChange={(e) => setProfesoradoId(e.target.value as number | "")}
                        >
                            <MenuItem value="">Todos los profesorados</MenuItem>
                            {(carreras || []).map((c) => (
                                <MenuItem key={c.id} value={c.id}>{c.nombre}</MenuItem>
                            ))}
                        </Select>
                    </FormControl>

                    <TextField
                        size="small"
                        label="Buscar por DNI"
                        value={dniSearch}
                        onChange={(e) => setDniSearch(e.target.value)}
                        sx={{ width: 160 }}
                        InputProps={{
                            endAdornment: dniSearch ? (
                                <InputAdornment position="end">
                                    <IconButton size="small" onClick={() => setDniSearch("")}>
                                        <ClearIcon fontSize="small" />
                                    </IconButton>
                                </InputAdornment>
                            ) : null,
                        }}
                    />

                    <TextField
                        size="small"
                        label="Buscar por nombre"
                        value={nombreSearch}
                        onChange={(e) => setNombreSearch(e.target.value)}
                        sx={{ width: 240 }}
                        InputProps={{
                            endAdornment: nombreSearch ? (
                                <InputAdornment position="end">
                                    <IconButton size="small" onClick={() => setNombreSearch("")}>
                                        <ClearIcon fontSize="small" />
                                    </IconButton>
                                </InputAdornment>
                            ) : null,
                        }}
                    />

                    {data && (
                        <Typography variant="body2" color="text.secondary" sx={{ ml: "auto !important" }}>
                            {items.length} registro{items.length !== 1 ? "s" : ""} · {estudiantesUnicos} estudiante{estudiantesUnicos !== 1 ? "s" : ""}
                        </Typography>
                    )}
                </Stack>
            </Paper>

            {isLoading && (
                <Box display="flex" justifyContent="center" py={6}>
                    <CircularProgress />
                </Box>
            )}

            {isError && (
                <Alert severity="error">No se pudo cargar la información de resguardo.</Alert>
            )}

            {!isLoading && !isError && items.length === 0 && (
                <Alert severity="success">No hay materias en resguardo con los filtros seleccionados.</Alert>
            )}

            {!isLoading && !isError && items.length > 0 && (
                <TableContainer component={Paper} variant="outlined">
                    <Table size="small">
                        <TableHead>
                            <TableRow sx={{ "& th": { fontWeight: 700, bgcolor: "#fafafa" } }}>
                                <TableCell>Estudiante</TableCell>
                                <TableCell>DNI</TableCell>
                                <TableCell>Profesorado</TableCell>
                                <TableCell>Materia en resguardo</TableCell>
                                <TableCell>Situación</TableCell>
                                <TableCell>Tipo</TableCell>
                                <TableCell>Motivo</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {items.map((item, idx) => (
                                <TableRow key={idx} hover>
                                    <TableCell sx={{ fontWeight: 600 }}>{item.nombre}</TableCell>
                                    <TableCell>{item.dni}</TableCell>
                                    <TableCell>
                                        <Typography variant="body2" color="text.secondary">
                                            {item.profesorado || "—"}
                                        </Typography>
                                    </TableCell>
                                    <TableCell>{item.materia}</TableCell>
                                    <TableCell>
                                        <Chip
                                            label={item.situacion}
                                            size="small"
                                            sx={{
                                                bgcolor: item.situacion === "Promocionado"
                                                    ? "#dbeafe"
                                                    : item.situacion === "Aprobado (sin final)"
                                                    ? "#ede9fe"
                                                    : item.situacion === "Equivalencia"
                                                    ? "#fef9c3"
                                                    : "#f1f5f9",
                                                color: item.situacion === "Promocionado"
                                                    ? "#1d4ed8"
                                                    : item.situacion === "Aprobado (sin final)"
                                                    ? "#6d28d9"
                                                    : item.situacion === "Equivalencia"
                                                    ? "#854d0e"
                                                    : "#334155",
                                                fontWeight: 600,
                                            }}
                                        />
                                    </TableCell>
                                    <TableCell>
                                        <Chip
                                            label={item.tipo}
                                            size="small"
                                            variant="outlined"
                                            color={item.tipo === "EQUIV" ? "warning" : "default"}
                                        />
                                    </TableCell>
                                    <TableCell>
                                        <Box component="ul" sx={{ m: 0, pl: 2 }}>
                                            {item.motivos.length > 0
                                                ? item.motivos.map((m, i) => (
                                                    <li key={i}>
                                                        <Typography
                                                            variant="caption"
                                                            color={
                                                                m.includes("VENCIDA") || m.includes("AGOTADA")
                                                                    ? "error.main"
                                                                    : "text.primary"
                                                            }
                                                        >
                                                            {m}
                                                        </Typography>
                                                    </li>
                                                ))
                                                : <Typography variant="caption" color="text.secondary">Sin detalle</Typography>
                                            }
                                        </Box>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>
            )}
        </Box>
    );
}
