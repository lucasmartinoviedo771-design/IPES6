import { useState, useMemo, useEffect } from "react";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import InputAdornment from "@mui/material/InputAdornment";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import Table from "@mui/material/Table";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TableCell from "@mui/material/TableCell";
import TableBody from "@mui/material/TableBody";
import TableContainer from "@mui/material/TableContainer";
import CircularProgress from "@mui/material/CircularProgress";
import Chip from "@mui/material/Chip";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import Alert from "@mui/material/Alert";
import Divider from "@mui/material/Divider";
import TablePagination from "@mui/material/TablePagination";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import SearchIcon from "@mui/icons-material/Search";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import RefreshIcon from "@mui/icons-material/Refresh";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CancelIcon from "@mui/icons-material/Cancel";
import SaveIcon from "@mui/icons-material/Save";
import DeleteSweepIcon from "@mui/icons-material/DeleteSweep";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchEstudiantesDocumentacion,
  EstudianteDocumentacionListItemDTO,
  updateEstudianteDocumentacion,
  bulkUpdateEstudianteDocumentacion,
  EstudianteDocumentacionUpdatePayload,
  getExportDocumentacionExcelUrl,
  getExportDocumentacionPdfUrl
} from "@/api/estudiantes";
import { fetchCarreras } from "@/api/carreras";
import BackButton from "@/components/ui/BackButton";

function useDebouncedValue<T>(value: T, delay = 400) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

const EditableCheckCell = ({ 
  value, 
  onChange, 
  loading = false,
  tooltip,
  modified = false
}: { 
  value: boolean; 
  onChange: (val: boolean) => void;
  loading?: boolean;
  tooltip?: string;
  modified?: boolean;
}) => (
  <TableCell align="center">
    <Tooltip title={tooltip || "Haga clic para cambiar"}>
      <Box display="inline-flex" position="relative" alignItems="center" justifyContent="center">
        <Chip
          label={value ? "SI" : "NO"}
          size="small"
          color={value ? "success" : "error"}
          variant={value ? "filled" : "outlined"}
          onClick={() => !loading && onChange(!value)}
          sx={{
            fontWeight: 900,
            fontSize: "10px",
            minWidth: 42,
            height: 20,
            cursor: loading ? "default" : "pointer",
            transition: "all 0.2s",
            border: modified ? "2px solid #3d5afe" : undefined,
            boxShadow: modified ? "0 0 8px rgba(61, 90, 254, 0.4)" : "none",
            backgroundColor: modified ? (value ? "#e8f5e9" : "#ffebee") : undefined,
            color: modified ? (value ? "#2e7d32" : "#c62828") : undefined,
            "&:hover": { 
              transform: loading ? "none" : "scale(1.1)",
              opacity: 0.8 
            }
          }}
        />
        {loading && (
          <CircularProgress 
            size={20} 
            sx={{ 
              position: 'absolute',
              color: 'primary.main',
              zIndex: 1,
            }} 
          />
        )}
      </Box>
    </Tooltip>
  </TableCell>
);

const condicionColorMap: Record<string, "success" | "warning" | "default" | "error"> = {
  Regular: "success",
  Condicional: "warning",
  Pendiente: "default",
  Incompleto: "error",
};

type SortKey = keyof EstudianteDocumentacionListItemDTO;

export default function DocumentacionEstudiantesPage() {
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search);
  const [carreraId, setCarreraId] = useState<number | "">("");
  const [estadoAcademico, setEstadoAcademico] = useState<string>("ACT");
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: "asc" | "desc" }>({
    key: "apellido",
    direction: "asc",
  });
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(50);

  const queryClient = useQueryClient();
  const [updating, setUpdating] = useState<Record<string, boolean>>({});
  const [isSavingBulk, setIsSavingBulk] = useState(false);
  const [pendingChanges, setPendingChanges] = useState<Record<string, Partial<EstudianteDocumentacionUpdatePayload>>>({});

  const { data: carreras } = useQuery({
    queryKey: ["carreras", "admin"],
    queryFn: () => fetchCarreras(),
  });

  // Resetear página al cambiar filtros
  useEffect(() => {
    setPage(0);
  }, [debouncedSearch, carreraId]);

  // Auto-selección de profesorado para Bedeles con una sola carrera
  useEffect(() => {
    if (carreras && carreras.length === 1 && carreraId === "") {
      setCarreraId(carreras[0].id);
    }
  }, [carreras, carreraId]);

  const filters = useMemo(
    () => ({
      q: debouncedSearch || undefined,
      carrera_id: typeof carreraId === "number" ? carreraId : undefined,
      estado_academico: estadoAcademico || undefined,
      limit: 2000,
    }),
    [debouncedSearch, carreraId, estadoAcademico]
  );

  const { data, isLoading, isFetching, isError, error } = useQuery({
    queryKey: ["admin-estudiantes-documentacion", filters],
    queryFn: () => fetchEstudiantesDocumentacion(filters),
  });

  const total = data?.total ?? 0;

  const sortedStudents = useMemo(() => {
    const items = [...(data?.items ?? [])];
    items.sort((a, b) => {
      const aVal = a[sortConfig.key];
      const bVal = b[sortConfig.key];
      if (aVal === bVal) return 0;
      const result = aVal < bVal ? -1 : 1;
      return sortConfig.direction === "asc" ? result : -result;
    });
    return items;
  }, [data?.items, sortConfig]);

  const paginatedStudents = useMemo(() => {
    return sortedStudents.slice(page * rowsPerPage, (page + 1) * rowsPerPage);
  }, [sortedStudents, page, rowsPerPage]);

  const handleSort = (key: SortKey) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc",
    }));
  };

  const handleUpdate = (dni: string, field: string, value: any) => {
    setPendingChanges(prev => {
      const studentChanges = prev[dni] || {};
      return {
        ...prev,
        [dni]: {
          ...studentChanges,
          [field]: value
        }
      };
    });
  };

  const handleBulkSave = async () => {
    const updates = Object.entries(pendingChanges).map(([dni, changes]) => ({
      dni,
      changes
    }));

    if (updates.length === 0) return;

    setIsSavingBulk(true);
    try {
      await bulkUpdateEstudianteDocumentacion({ updates });
      await queryClient.invalidateQueries({ queryKey: ["admin-estudiantes-documentacion"] });
      setPendingChanges({});
      alert("Cambios guardados correctamente");
    } catch (err) {
      console.error("Error saving documentation", err);
      alert("Error al guardar los cambios");
    } finally {
      setIsSavingBulk(false);
    }
  };

  const discardChanges = () => {
    if (Object.keys(pendingChanges).length > 0) {
      if (confirm("¿Está seguro de que desea descartar los cambios pendientes?")) {
        setPendingChanges({});
      }
    }
  };

  const isUpdating = (dni: string, field: string) => !!updating[`${dni}-${field}`] || isSavingBulk;

  const getFieldValue = (est: EstudianteDocumentacionListItemDTO, field: keyof EstudianteDocumentacionUpdatePayload) => {
    if (pendingChanges[est.dni] && pendingChanges[est.dni][field] !== undefined) {
      return pendingChanges[est.dni][field];
    }
    return est[field as keyof EstudianteDocumentacionListItemDTO];
  };

  const isFieldModified = (dni: string, field: string) => {
    return pendingChanges[dni] && pendingChanges[dni][field as keyof EstudianteDocumentacionUpdatePayload] !== undefined;
  };

  const SortLabel = ({ label, sortKey }: { label: string; sortKey: SortKey }) => (
    <TableCell 
      align={sortKey === "apellido" || sortKey === "dni" ? "left" : "center"}
      sx={{ 
        fontWeight: 700, 
        bgcolor: "#f1f3f5", 
        cursor: "pointer",
        "&:hover": { bgcolor: "#e9ecef" }
      }}
      onClick={() => handleSort(sortKey)}
    >
      <Box display="flex" alignItems="center" justifyContent={sortKey === "apellido" || sortKey === "dni" ? "flex-start" : "center"} gap={0.5}>
        {label}
        {sortConfig.key === sortKey && (
          <Typography variant="caption" sx={{ fontSize: 10 }}>
            {sortConfig.direction === "asc" ? "▲" : "▼"}
          </Typography>
        )}
      </Box>
    </TableCell>
  );

  return (
    <Box p={3} sx={{ minHeight: "100vh", bgcolor: "#f8f9fa" }}>
      <BackButton fallbackPath="/secretaria" />
      
      <Stack spacing={3} mt={2}>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Box>
            <Typography variant="h4" fontWeight={800} color="primary.main" gutterBottom>
              Control de Documentación
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Seguimiento de estudiantes regulares, condicionales y estado de legajos.
            </Typography>
          </Box>
          <Stack direction="row" spacing={1} alignItems="center">
            {Object.keys(pendingChanges).length > 0 && (
              <>
                <Button
                  variant="contained"
                  color="success"
                  startIcon={isSavingBulk ? <CircularProgress size={18} color="inherit" /> : <SaveIcon />}
                  onClick={handleBulkSave}
                  disabled={isSavingBulk}
                  sx={{ borderRadius: 2, fontWeight: 700, px: 2 }}
                >
                  Guardar ({Object.keys(pendingChanges).length})
                </Button>
                <Button
                  variant="outlined"
                  color="error"
                  startIcon={<DeleteSweepIcon />}
                  onClick={discardChanges}
                  disabled={isSavingBulk}
                  sx={{ borderRadius: 2, px: 2 }}
                >
                  Descartar
                </Button>
              </>
            )}
            <Tooltip title="Actualizar lista">
              <IconButton 
                onClick={() => queryClient.invalidateQueries({ queryKey: ["admin-estudiantes-documentacion"] })}
                sx={{ bgcolor: "white", boxShadow: 1 }}
                disabled={isSavingBulk || Object.keys(pendingChanges).length > 0}
              >
                <RefreshIcon />
              </IconButton>
            </Tooltip>
          </Stack>
        </Box>

        <Paper 
          elevation={0} 
          sx={{ 
            p: 2, 
            borderRadius: 3, 
            border: "1px solid", 
            borderColor: "divider",
            display: "flex",
            gap: 2,
            alignItems: "center",
            flexWrap: "wrap"
          }}
        >
          <TextField
            placeholder="Buscar por DNI, Nombre o Apellido..."
            size="small"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            sx={{ flexGrow: 1, minWidth: 300 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon color="action" />
                </InputAdornment>
              ),
            }}
          />
          
          <FormControl size="small" sx={{ minWidth: 180 }}>
            <InputLabel>Estado</InputLabel>
            <Select
              value={estadoAcademico}
              label="Estado"
              onChange={(e) => setEstadoAcademico(e.target.value)}
            >
              <MenuItem value="ACT">Activos</MenuItem>
              <MenuItem value="INA">Inactivos</MenuItem>
              <MenuItem value="EGR">Egresados</MenuItem>
              <MenuItem value="">Todos</MenuItem>
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 250 }}>
            <InputLabel>Filtrar por Profesorado</InputLabel>
            <Select
              value={carreraId}
              label="Filtrar por Profesorado"
              onChange={(e) => setCarreraId(e.target.value as number | "")}
            >
              <MenuItem value="">Todos los profesorados</MenuItem>
              {carreras?.map((c) => (
                <MenuItem key={c.id} value={c.id}>
                  {c.nombre}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Paper>

        <Paper elevation={0} sx={{ borderRadius: 3, border: "1px solid", borderColor: "divider", overflow: "hidden" }}>
          <Box p={2} display="flex" justifyContent="space-between" alignItems="center" bgcolor="white">
            <Typography variant="subtitle1" fontWeight={700}>
              Listado de Estudiantes ({total})
            </Typography>
            <Box display="flex" gap={1} alignItems="center">
              {(isLoading || isFetching) && <CircularProgress size={20} />}
              <Button
                size="small"
                variant="outlined"
                startIcon={<FileDownloadIcon />}
                href={getExportDocumentacionExcelUrl(filters)}
                target="_blank"
                sx={{ borderRadius: 2 }}
              >
                Excel
              </Button>
              <Button
                size="small"
                variant="outlined"
                color="secondary"
                startIcon={<FileDownloadIcon />}
                href={getExportDocumentacionPdfUrl(filters)}
                target="_blank"
                sx={{ borderRadius: 2 }}
              >
                PDF
              </Button>
            </Box>
          </Box>
          <Divider />
          
          <TableContainer sx={{ maxHeight: "calc(100vh - 350px)" }}>
            <Table stickyHeader size="small">
              <TableHead>
                <TableRow>
                  <SortLabel label="DNI" sortKey="dni" />
                  <SortLabel label="Apellido y Nombre" sortKey="apellido" />
                  <SortLabel label="Condición Admin." sortKey="condicion_administrativa" />
                  <SortLabel label="CI" sortKey="curso_introductorio_aprobado" />
                  <SortLabel label="Libreta" sortKey="libreta_entregada" />
                  <SortLabel label="DNI (F.)" sortKey="dni_legalizado" />
                  <SortLabel label="Fotos" sortKey="fotos_4x4" />
                  <SortLabel label="Cert. Salud" sortKey="certificado_salud" />
                  <SortLabel label="Folios" sortKey="folios_oficio" />
                  <SortLabel label="Título Sec." sortKey="titulo_secundario_ok" />
                  <SortLabel label="Art. 7mo" sortKey="articulo_7" />
                </TableRow>
              </TableHead>
              <TableBody>
                {isError && (
                  <TableRow>
                    <TableCell colSpan={11}>
                      <Alert severity="error">Error al cargar datos: {(error as Error).message}</Alert>
                    </TableCell>
                  </TableRow>
                )}
                {sortedStudents.length === 0 && !isLoading && (
                  <TableRow>
                    <TableCell colSpan={11} align="center" sx={{ py: 8 }}>
                      <Typography color="text.secondary">No se encontraron estudiantes.</Typography>
                    </TableCell>
                  </TableRow>
                )}
                {paginatedStudents.map((est: EstudianteDocumentacionListItemDTO) => {
                  const hasChanges = Object.keys(pendingChanges[est.dni] || {}).length > 0;
                  return (
                    <TableRow 
                      key={est.dni} 
                      hover 
                      sx={{ 
                        "&:nth-of-type(odd)": { bgcolor: hasChanges ? "rgba(61, 90, 254, 0.08)" : "#fafbfc" },
                        bgcolor: hasChanges ? "rgba(61, 90, 254, 0.05)" : "inherit"
                      }}
                    >
                      <TableCell sx={{ fontWeight: 500 }}>
                        <Box display="flex" alignItems="center" gap={1}>
                          {est.dni}
                          <Tooltip title="Ver ficha completa">
                            <IconButton 
                              size="small" 
                              href={`/secretaria/estudiantes/${est.dni}`}
                              target="_blank"
                              sx={{ color: "primary.main", p: 0.5 }}
                            >
                              <OpenInNewIcon sx={{ fontSize: 16 }} />
                            </IconButton>
                          </Tooltip>
                        </Box>
                      </TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>{`${est.apellido.toUpperCase()}, ${est.nombre}`}</TableCell>
                      <TableCell align="center">
                        <Chip 
                          label={est.condicion_administrativa} 
                          size="small" 
                          color={condicionColorMap[est.condicion_administrativa] || "default"}
                          sx={{ fontWeight: 700, minWidth: 90 }}
                        />
                      </TableCell>
                      <TableCell align="center">
                        <Box display="inline-flex" position="relative" alignItems="center">
                          <Tooltip title="Haga clic para cambiar el estado del curso introductorio">
                            <Chip 
                              label={getFieldValue(est, "curso_introductorio_aprobado") ? "APROBADO" : "DESAPROBADO"} 
                              size="small" 
                              color={getFieldValue(est, "curso_introductorio_aprobado") ? "success" : "error"} 
                              variant={getFieldValue(est, "curso_introductorio_aprobado") ? "filled" : "outlined"}
                              onClick={() => handleUpdate(est.dni, "curso_introductorio_aprobado", !getFieldValue(est, "curso_introductorio_aprobado"))}
                              disabled={isUpdating(est.dni, "curso_introductorio_aprobado")}
                              sx={{ 
                                fontSize: "0.65rem", 
                                fontWeight: 800, 
                                cursor: "pointer",
                                border: isFieldModified(est.dni, "curso_introductorio_aprobado") ? "2px solid #3d5afe" : undefined,
                                boxShadow: isFieldModified(est.dni, "curso_introductorio_aprobado") ? "0 0 8px rgba(61, 90, 254, 0.4)" : "none",
                                "&:hover": { opacity: 0.8 }
                              }} 
                            />
                          </Tooltip>
                        </Box>
                      </TableCell>
                      <TableCell align="center">
                        <EditableCheckCell 
                          value={getFieldValue(est, "libreta_entregada") as boolean} 
                          onChange={(val) => handleUpdate(est.dni, "libreta_entregada", val)}
                          loading={isUpdating(est.dni, "libreta_entregada")}
                          modified={isFieldModified(est.dni, "libreta_entregada")}
                        />
                      </TableCell>
                      <TableCell align="center">
                        <EditableCheckCell 
                          value={getFieldValue(est, "dni_legalizado") as boolean} 
                          onChange={(val) => handleUpdate(est.dni, "dni_legalizado", val)}
                          loading={isUpdating(est.dni, "dni_legalizado")}
                          modified={isFieldModified(est.dni, "dni_legalizado")}
                        />
                      </TableCell>
                      <TableCell align="center">
                        <EditableCheckCell 
                          value={getFieldValue(est, "fotos_4x4") as boolean} 
                          onChange={(val) => handleUpdate(est.dni, "fotos_4x4", val)}
                          loading={isUpdating(est.dni, "fotos_4x4")}
                          modified={isFieldModified(est.dni, "fotos_4x4")}
                        />
                      </TableCell>
                      <TableCell align="center">
                        <EditableCheckCell 
                          value={getFieldValue(est, "certificado_salud") as boolean} 
                          onChange={(val) => handleUpdate(est.dni, "certificado_salud", val)}
                          loading={isUpdating(est.dni, "certificado_salud")}
                          modified={isFieldModified(est.dni, "certificado_salud")}
                        />
                      </TableCell>
                      <TableCell align="center">
                        <EditableCheckCell 
                          value={(getFieldValue(est, "folios_oficio") as number) >= 3} 
                          onChange={(val) => handleUpdate(est.dni, "folios_oficio", val ? 3 : 0)}
                          loading={isUpdating(est.dni, "folios_oficio")}
                          modified={isFieldModified(est.dni, "folios_oficio")}
                          tooltip={((getFieldValue(est, "folios_oficio") as number) || 0) >= 3 ? `Tiene ${getFieldValue(est, "folios_oficio")} folios` : "No tiene los folios suficientes"}
                        />
                      </TableCell>
                      <TableCell align="center">
                        <EditableCheckCell 
                          value={getFieldValue(est, "titulo_secundario_ok") as boolean} 
                          onChange={(val) => handleUpdate(est.dni, "titulo_secundario_ok", val)}
                          loading={isUpdating(est.dni, "titulo_secundario_ok")}
                          modified={isFieldModified(est.dni, "titulo_secundario_ok")}
                        />
                      </TableCell>
                      <TableCell align="center">
                        <EditableCheckCell 
                          value={getFieldValue(est, "articulo_7") as boolean} 
                          onChange={(val) => handleUpdate(est.dni, "articulo_7", val)}
                          loading={isUpdating(est.dni, "articulo_7")}
                          modified={isFieldModified(est.dni, "articulo_7")}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
          <TablePagination
            component="div"
            count={total}
            page={page}
            onPageChange={(_, newPage) => setPage(newPage)}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={(e) => {
              setRowsPerPage(parseInt(e.target.value, 10));
              setPage(0);
            }}
            rowsPerPageOptions={[25, 50, 100, 200]}
            labelRowsPerPage="Filas por página"
            labelDisplayedRows={({ from, to, count }) => `${from}-${to} de ${count}`}
            sx={{ borderTop: "1px solid", borderColor: "divider" }}
          />
        </Paper>
      </Stack>
    </Box>
  );
}
