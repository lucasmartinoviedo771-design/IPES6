/* eslint-disable react-doctor/no-giant-component, react-doctor/no-array-index-as-key */
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
import Checkbox from "@mui/material/Checkbox";
import Tooltip from "@mui/material/Tooltip";
import ClearIcon from "@mui/icons-material/Clear";
import SyncIcon from "@mui/icons-material/Sync";
import SearchIcon from "@mui/icons-material/Search";
import PrintIcon from "@mui/icons-material/Print";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSnackbar } from "notistack";
import { jsPDF } from "jspdf";

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
    const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
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
        setSelectedRows(new Set());
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

    // Selección de filas
    const allSelected = items.length > 0 && selectedRows.size === items.length;
    const someSelected = selectedRows.size > 0 && selectedRows.size < items.length;

    const toggleAll = () => {
        if (allSelected) {
            setSelectedRows(new Set());
        } else {
            setSelectedRows(new Set(items.map((_, i) => i)));
        }
    };

    const toggleRow = (idx: number) => {
        setSelectedRows((prev) => {
            const next = new Set(prev);
            if (next.has(idx)) next.delete(idx);
            else next.add(idx);
            return next;
        });
    };

    // Items a exportar: los seleccionados, o todos si no hay selección
    const exportItems = selectedRows.size > 0
        ? items.filter((_, i) => selectedRows.has(i))
        : items;

    const carreraName = carreras?.find((c) => c.id === profesoradoIdCargado)?.nombre ?? "";

    const handlePrint = () => {
        const fecha = new Date().toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" });
        const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="color-scheme" content="light">
  <title>Resguardo de Materias</title>
  <style>
    html, body { background: #fff; color: #111; font-family: Arial, sans-serif; font-size: 10.5px; margin: 0; padding: 18px; }
    h2 { font-size: 13px; margin: 0 0 3px; }
    .sub { color: #555; font-size: 10px; margin: 0 0 14px; }
    table { border-collapse: collapse; width: 100%; }
    th { background: #e0e0e0; color: #111; border: 1px solid #999; padding: 5px 8px; text-align: left; font-weight: bold; font-size: 10px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    td { background: #fff; color: #111; border: 1px solid #999; padding: 4px 8px; text-align: left; vertical-align: top; font-size: 10px; }
    .err { color: #cc0000; }
    @media print { @page { size: A4 landscape; margin: 15mm 12mm 12mm 12mm; } }
  </style>
</head>
<body>
  <h2>Resguardo de Materias — ${carreraName}</h2>
  <p class="sub">${exportItems.length} registro${exportItems.length !== 1 ? "s" : ""} · Generado: ${fecha}</p>
  <table>
    <thead><tr>
      <th>Estudiante</th><th>DNI</th><th>Materia en resguardo</th><th>Situación</th><th>Tipo</th><th>Motivo</th>
    </tr></thead>
    <tbody>
      ${exportItems.map((item) => `<tr>
        <td>${item.nombre}</td>
        <td>${item.dni ?? ""}</td>
        <td>${item.materia}</td>
        <td>${item.situacion}</td>
        <td>${item.tipo}</td>
        <td>${item.motivos.map((m) => `<span class="${m.includes("VENCIDA") || m.includes("AGOTADA") ? "err" : ""}">${m}</span>`).join("<br>")}</td>
      </tr>`).join("")}
    </tbody>
  </table>
  <script>window.addEventListener("load", function(){ setTimeout(function(){ window.print(); }, 400); });</script>
</body>
</html>`;
        const blob = new Blob([html], { type: "text/html;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const win = window.open(url, "_blank");
        if (win) {
            win.addEventListener("unload", () => URL.revokeObjectURL(url));
        }
    };

    const handleExportPDF = () => {
        const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
        const pageW = doc.internal.pageSize.getWidth();
        const pageH = doc.internal.pageSize.getHeight();
        const margin = 10;
        const usableW = pageW - margin * 2;
        let y = 18;

        const cols = [
            { header: "Estudiante",          w: 52 },
            { header: "DNI",                  w: 22 },
            { header: "Materia en resguardo", w: 58 },
            { header: "Situación",            w: 30 },
            { header: "Tipo",                 w: 14 },
            { header: "Motivo",               w: usableW - 52 - 22 - 58 - 30 - 14 },
        ];
        const totalW = cols.reduce((s, c) => s + c.w, 0);
        const headerH = 7;
        const borderColor: [number, number, number] = [153, 153, 153];

        // Título
        doc.setFontSize(13);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(17, 17, 17);
        doc.text("Resguardo de Materias", margin, y);
        y += 5;
        doc.setFontSize(8.5);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(100, 100, 100);
        const fecha = new Date().toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" });
        doc.text(`${carreraName} · ${exportItems.length} registros · ${fecha}`, margin, y);
        y += 8;

        const drawHeaderRow = (startY: number) => {
            // Fondo gris del header: un solo rect para toda la fila
            doc.setFillColor(220, 220, 220);
            doc.setDrawColor(...borderColor);
            doc.rect(margin, startY, totalW, headerH, "F");

            // Bordes y texto de cada columna
            doc.setFontSize(8);
            doc.setFont("helvetica", "bold");
            doc.setTextColor(17, 17, 17);
            let x = margin;
            cols.forEach((col) => {
                doc.setDrawColor(...borderColor);
                doc.rect(x, startY, col.w, headerH, "S");
                doc.text(col.header, x + 1.5, startY + 5);
                x += col.w;
            });
            return startY + headerH;
        };

        y = drawHeaderRow(y);

        doc.setFontSize(7.5);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(17, 17, 17);

        exportItems.forEach((item) => {
            const row = [
                item.nombre,
                item.dni ?? "",
                item.materia,
                item.situacion,
                item.tipo,
                item.motivos.join(" | "),
            ];

            const lineHeights = row.map((cell, i) =>
                doc.splitTextToSize(cell, cols[i].w - 3).length
            );
            const rH = Math.max(Math.max(...lineHeights) * 3.8 + 2.5, 7);

            if (y + rH > pageH - margin) {
                doc.addPage();
                y = 15;
                y = drawHeaderRow(y);
                doc.setFontSize(7.5);
                doc.setFont("helvetica", "normal");
                doc.setTextColor(17, 17, 17);
            }

            // Fondo blanco de la fila
            doc.setFillColor(255, 255, 255);
            doc.setDrawColor(...borderColor);
            doc.rect(margin, y, totalW, rH, "F");

            // Bordes y texto de cada celda
            let x = margin;
            row.forEach((cell, i) => {
                doc.setDrawColor(...borderColor);
                doc.rect(x, y, cols[i].w, rH, "S");
                const lines = doc.splitTextToSize(cell, cols[i].w - 3);
                doc.text(lines, x + 1.5, y + 4.5);
                x += cols[i].w;
            });
            y += rH;
        });

        const safeName = carreraName.replace(/\s+/g, "-").toLowerCase().slice(0, 40);
        doc.save(`resguardo-${safeName}.pdf`);
    };

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

                    {/* Búsquedas */}
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

                    {/* Contador + botones de acción */}
                    {profesoradoIdCargado !== null && (
                        <Box sx={{ ml: "auto !important", display: "flex", alignItems: "center", gap: 1 }}>
                            <Box sx={{ textAlign: "right", mr: 1 }}>
                                {data && (
                                    <Typography variant="body2" color="text.secondary">
                                        {items.length} registro{items.length !== 1 ? "s" : ""} · {estudiantesUnicos} estudiante{estudiantesUnicos !== 1 ? "s" : ""}
                                        {selectedRows.size > 0 && (
                                            <Typography component="span" variant="body2" color="primary.main" sx={{ ml: 1 }}>
                                                ({selectedRows.size} seleccionado{selectedRows.size !== 1 ? "s" : ""})
                                            </Typography>
                                        )}
                                    </Typography>
                                )}
                                {ultimaActualizacion && (
                                    <Typography variant="caption" color="text.disabled">
                                        Última actualización: {ultimaActualizacion}
                                    </Typography>
                                )}
                            </Box>

                            {items.length > 0 && (
                                <>
                                    <Tooltip title={selectedRows.size > 0 ? `Imprimir ${selectedRows.size} seleccionados` : "Imprimir todos"}>
                                        <Button
                                            variant="outlined"
                                            size="small"
                                            startIcon={<PrintIcon />}
                                            onClick={handlePrint}
                                            sx={{ whiteSpace: "nowrap" }}
                                        >
                                            Imprimir
                                        </Button>
                                    </Tooltip>

                                    <Tooltip title={selectedRows.size > 0 ? `Exportar ${selectedRows.size} seleccionados a PDF` : "Exportar todos a PDF"}>
                                        <Button
                                            variant="outlined"
                                            size="small"
                                            color="error"
                                            startIcon={<PictureAsPdfIcon />}
                                            onClick={handleExportPDF}
                                            sx={{ whiteSpace: "nowrap" }}
                                        >
                                            PDF
                                        </Button>
                                    </Tooltip>
                                </>
                            )}

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

            {/* Estado inicial */}
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
                                <TableCell padding="checkbox">
                                    <Checkbox
                                        size="small"
                                        checked={allSelected}
                                        indeterminate={someSelected}
                                        onChange={toggleAll}
                                    />
                                </TableCell>
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
                                <TableRow
                                    key={idx}
                                    hover
                                    selected={selectedRows.has(idx)}
                                    onClick={() => toggleRow(idx)}
                                    sx={{ cursor: "pointer" }}
                                >
                                    <TableCell padding="checkbox">
                                        <Checkbox
                                            size="small"
                                            checked={selectedRows.has(idx)}
                                            onChange={() => toggleRow(idx)}
                                            onClick={(e) => e.stopPropagation()}
                                        />
                                    </TableCell>
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
