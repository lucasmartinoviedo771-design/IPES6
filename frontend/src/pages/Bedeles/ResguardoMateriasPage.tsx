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
import Button from "@mui/material/Button";
import ClearIcon from "@mui/icons-material/Clear";
import SyncIcon from "@mui/icons-material/Sync";
import SearchIcon from "@mui/icons-material/Search";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSnackbar } from "notistack";

import BackButton from "@/components/ui/BackButton";
import { PageHero } from "@/components/ui/GradientTitles";
import { fetchResguardoMaterias, recalcularResguardo, ResguardoMateriaItemDTO } from "@/api/estudiantes/admin";
import { fetchCarreras } from "@/api/carreras";

const LS_KEY = "resguardo_ultima_actualizacion";

export default function ResguardoMateriasPage() {
    const [profesoradoId, setProfesoradoId] = useState<number | "">("");
    const [profesoradoIdCargado, setProfesoradoIdCargado] = useState<number | null>(null);
    const [dniSearch, setDniSearch] = useState("");
    const [nombreSearch, setNombreSearch] = useState("");
    const [recalculando, setRecalculando] = useState(false);
    const [ultimaActualizacion, setUltimaActualizacion] = useState<string | null>(
        () => localStorage.getItem(LS_KEY)
    );
    const queryClient = useQueryClient();
    const { enqueueSnackbar } = useSnackbar();

    const { data: carreras } = useQuery({
        queryKey: ["carreras-vigentes"],
        queryFn: fetchCarreras,
        staleTime: 1000 * 60 * 10,
    });

    const { data, isLoading, isError } = useQuery({
        queryKey: ["resguardo-materias", profesoradoIdCargado],
        queryFn: () => fetchResguardoMaterias({
            profesorado_id: profesoradoIdCargado ?? undefined,
        }),
        enabled: profesoradoIdCargado !== null,
        staleTime: 1000 * 60 * 5,
    });

    const handleCargar = () => {
        if (!profesoradoId) return;
        setDniSearch("");
        setNombreSearch("");
        setProfesoradoIdCargado(profesoradoId as number);
    };

    const handleRecalcular = async () => {
        setRecalculando(true);
        try {
            await recalcularResguardo({
                profesorado_id: profesoradoIdCargado ?? undefined,
                solo_activos: true,
            });
            const ahora = new Date().toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" });
            localStorage.setItem(LS_KEY, ahora);
            setUltimaActualizacion(ahora);
            enqueueSnackbar("Resguardo actualizado correctamente.", { variant: "success" });
            setTimeout(() => {
                queryClient.invalidateQueries({ queryKey: ["resguardo-materias"] });
            }, 3000);
        } catch {
            enqueueSnackbar("Error al recalcular el resguardo.", { variant: "error" });
        } finally {
            setRecalculando(false);
        }
    };

    const items: ResguardoMateriaItemDTO[] = (data || []).filter((item) => {
        if (dniSearch && !item.dni?.includes(dniSearch)) return false;
        if (nombreSearch && !item.nombre.toLowerCase().includes(nombreSearch.toLowerCase())) return false;
        return true;
    });

    const estudiantesUnicos = new Set(items.map((i) => i.dni)).size;

    return (
        <Box sx={{ p: 3 }}>
            <BackButton />
            <PageHero
                title="Resguardo de Materias"
                subtitle="Regularidades y equivalencias en resguardo por correlativas no satisfechas — solo estudiantes activos"
            />

            {/* Filtros */}
            <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems="center" flexWrap="wrap">
                    {/* Selector de profesorado + botón Cargar */}
                    <FormControl size="small" sx={{ minWidth: 280 }}>
                        <InputLabel>Profesorado *</InputLabel>
                        <Select
                            value={profesoradoId}
                            label="Profesorado *"
                            onChange={(e) => setProfesoradoId(e.target.value as number | "")}
                        >
                            <MenuItem value="" disabled>Seleccionar profesorado</MenuItem>
                            {(carreras || []).map((c) => (
                                <MenuItem key={c.id} value={c.id}>{c.nombre}</MenuItem>
                            ))}
                        </Select>
                    </FormControl>

                    <Button
                        variant="outlined"
                        size="small"
                        startIcon={<SearchIcon />}
                        onClick={handleCargar}
                        disabled={!profesoradoId}
                        sx={{ whiteSpace: "nowrap" }}
                    >
                        Cargar
                    </Button>

                    {/* Búsquedas — solo visibles si hay datos cargados */}
                    {profesoradoIdCargado !== null && (
                        <>
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
                                sx={{ width: 220 }}
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
                        </>
                    )}

                    {/* Contador + última actualización + botón actualizar */}
                    {profesoradoIdCargado !== null && (
                        <Box sx={{ ml: "auto !important", display: "flex", alignItems: "center", gap: 2 }}>
                            <Box sx={{ textAlign: "right" }}>
                                {data && (
                                    <Typography variant="body2" color="text.secondary">
                                        {items.length} registro{items.length !== 1 ? "s" : ""} · {estudiantesUnicos} estudiante{estudiantesUnicos !== 1 ? "s" : ""}
                                    </Typography>
                                )}
                                {ultimaActualizacion && (
                                    <Typography variant="caption" color="text.disabled">
                                        Última actualización: {ultimaActualizacion}
                                    </Typography>
                                )}
                            </Box>
                            <Button
                                variant="contained"
                                size="small"
                                startIcon={recalculando ? <CircularProgress size={16} color="inherit" /> : <SyncIcon />}
                                onClick={handleRecalcular}
                                disabled={recalculando}
                                sx={{ bgcolor: "#b45309", "&:hover": { bgcolor: "#92400e" }, whiteSpace: "nowrap" }}
                            >
                                {recalculando ? "Actualizando..." : "Actualizar resguardo"}
                            </Button>
                        </Box>
                    )}
                </Stack>
            </Paper>

            {/* Estado inicial: pedir que seleccione profesorado */}
            {profesoradoIdCargado === null && (
                <Alert severity="info">
                    Seleccioná un profesorado y hacé clic en <strong>Cargar</strong> para ver las materias en resguardo.
                </Alert>
            )}

            {isLoading && (
                <Box display="flex" justifyContent="center" py={6}>
                    <CircularProgress />
                </Box>
            )}

            {isError && (
                <Alert severity="error">No se pudo cargar la información de resguardo.</Alert>
            )}

            {profesoradoIdCargado !== null && !isLoading && !isError && items.length === 0 && (
                <Alert severity="success">No hay materias en resguardo para el profesorado seleccionado.</Alert>
            )}

            {!isLoading && !isError && items.length > 0 && (
                <TableContainer component={Paper} variant="outlined">
                    <Table size="small">
                        <TableHead>
                            <TableRow sx={{ "& th": { fontWeight: 700, bgcolor: "#fafafa" } }}>
                                <TableCell>Estudiante</TableCell>
                                <TableCell>DNI</TableCell>
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
