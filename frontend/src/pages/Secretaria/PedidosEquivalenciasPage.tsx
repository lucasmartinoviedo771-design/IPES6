import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import DownloadIcon from "@mui/icons-material/Download";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import { isAxiosError } from "axios";
import { useSnackbar } from "notistack";

import { PageHero, SectionTitlePill } from "@/components/ui/GradientTitles";
import { useCarreras as useCatalogoCarreras } from "@/hooks/useCarreras";
import { fetchVentanas, VentanaDto } from "@/api/ventanas";
import {
  listarPedidosEquivalencia,
  descargarNotaPedidoEquivalencia,
  exportarPedidosEquivalencia,
  PedidoEquivalenciaDTO,
} from "@/api/alumnos";

const ESTADOS = [
  { value: "draft", label: "Borrador" },
  { value: "final", label: "Finalizado" },
];

const PedidosEquivalenciasPage: React.FC = () => {
  const { enqueueSnackbar } = useSnackbar();
  const { data: profesorados = [] } = useCatalogoCarreras();

  const [ventanas, setVentanas] = useState<VentanaDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [pedidos, setPedidos] = useState<PedidoEquivalenciaDTO[]>([]);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);
  const [filters, setFilters] = useState({ profesoradoId: "", ventanaId: "", estado: "", dni: "" });

  useEffect(() => {
    fetchVentanas({ tipo: "EQUIVALENCIAS" })
      .then((data) => setVentanas(data || []))
      .catch(() => setVentanas([]));
  }, []);

  useEffect(() => {
    let cancelado = false;
    const load = async () => {
      if (filters.dni && filters.dni.length < 7) {
        setPedidos([]);
        return;
      }
      setLoading(true);
      try {
        const data = await listarPedidosEquivalencia({
          profesorado_id: filters.profesoradoId ? Number(filters.profesoradoId) : undefined,
          ventana_id: filters.ventanaId ? Number(filters.ventanaId) : undefined,
          estado: filters.estado || undefined,
          dni: filters.dni || undefined,
        });
        if (!cancelado) {
          setPedidos(data);
        }
      } catch (error) {
        if (!cancelado) {
          setPedidos([]);
          const mensaje = isAxiosError(error)
            ? error.response?.data?.message || error.response?.data?.detail || error.message
            : "No se pudieron cargar los pedidos.";
          enqueueSnackbar(mensaje, { variant: "error" });
        }
      } finally {
        if (!cancelado) {
          setLoading(false);
        }
      }
    };
    load();
    return () => {
      cancelado = true;
    };
  }, [filters, enqueueSnackbar]);

  const handleDescargarPDF = async (pedido: PedidoEquivalenciaDTO) => {
    setDownloadingId(pedido.id);
    try {
      const blob = await descargarNotaPedidoEquivalencia(pedido.id);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `pedido_equivalencias_${pedido.estudiante_dni}.pdf`;
      link.click();
      window.URL.revokeObjectURL(url);
      enqueueSnackbar("Nota descargada.", { variant: "success" });
    } catch (error) {
      const mensaje = isAxiosError(error)
        ? error.response?.data?.message || error.response?.data?.detail || error.message
        : "No se pudo descargar la nota.";
      enqueueSnackbar(mensaje, { variant: "error" });
    } finally {
      setDownloadingId(null);
    }
  };

  const handleExport = async () => {
    try {
      const blob = await exportarPedidosEquivalencia({
        profesorado_id: filters.profesoradoId ? Number(filters.profesoradoId) : undefined,
        ventana_id: filters.ventanaId ? Number(filters.ventanaId) : undefined,
        estado: filters.estado || undefined,
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "pedidos_equivalencias.csv";
      link.click();
      window.URL.revokeObjectURL(url);
      enqueueSnackbar("Listado exportado.", { variant: "success" });
    } catch (error) {
      const mensaje = isAxiosError(error)
        ? error.response?.data?.message || error.response?.data?.detail || error.message
        : "No se pudo exportar el listado.";
      enqueueSnackbar(mensaje, { variant: "error" });
    }
  };

  const ventanaOptions = useMemo(() => ventanas.map((v) => ({
    id: v.id,
    label: `${v.tipo} ${v.desde ? `(${v.desde})` : ""}`,
  })), [ventanas]);

  return (
    <Box sx={{ p: 3 }}>
      <PageHero
        title="Pedidos de equivalencias"
        subtitle="Consulta, descarga y exporta las notas solicitadas por los estudiantes."
      />

      <Card variant="outlined" sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={2}>
            <Grid item xs={12} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel>Profesorado destino</InputLabel>
                <Select
                  label="Profesorado destino"
                  value={filters.profesoradoId}
                  onChange={(event) => setFilters((prev) => ({ ...prev, profesoradoId: String(event.target.value) }))}
                >
                  <MenuItem value="">Todos</MenuItem>
                  {profesorados.map((prof) => (
                    <MenuItem key={prof.id} value={String(prof.id)}>
                      {prof.nombre}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel>Ventana</InputLabel>
                <Select
                  label="Ventana"
                  value={filters.ventanaId}
                  onChange={(event) => setFilters((prev) => ({ ...prev, ventanaId: String(event.target.value) }))}
                >
                  <MenuItem value="">Todas</MenuItem>
                  {ventanaOptions.map((item) => (
                    <MenuItem key={item.id} value={String(item.id)}>
                      {item.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={2}>
              <FormControl fullWidth size="small">
                <InputLabel>Estado</InputLabel>
                <Select
                  label="Estado"
                  value={filters.estado}
                  onChange={(event) => setFilters((prev) => ({ ...prev, estado: String(event.target.value) }))}
                >
                  <MenuItem value="">Todos</MenuItem>
                  {ESTADOS.map((estado) => (
                    <MenuItem key={estado.value} value={estado.value}>
                      {estado.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                label="DNI del estudiante"
                value={filters.dni}
                onChange={(event) => setFilters((prev) => ({ ...prev, dni: event.target.value }))}
                fullWidth
                size="small"
                helperText="Opcional: filtra por un estudiante puntual."
              />
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      <Stack direction="row" justifyContent="flex-end" sx={{ mb: 2 }}>
        <Button
          variant="outlined"
          startIcon={<FileDownloadIcon />}
          onClick={handleExport}
          disabled={!pedidos.length}
        >
          Exportar listado (CSV)
        </Button>
      </Stack>

      <SectionTitlePill title="Resultados" />
      {loading ? (
        <Typography variant="body2" color="text.secondary">
          Cargando pedidos...
        </Typography>
      ) : pedidos.length === 0 ? (
        <Alert severity="info">No se encontraron pedidos con los filtros aplicados.</Alert>
      ) : (
        <Card variant="outlined">
          <CardContent sx={{ p: 0 }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Estudiante</TableCell>
                  <TableCell>Profesorado destino</TableCell>
                  <TableCell>Tipo</TableCell>
                  <TableCell>Estado</TableCell>
                  <TableCell>Actualizado</TableCell>
                  <TableCell align="right">Acciones</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {pedidos.map((pedido) => (
                  <TableRow key={pedido.id} hover>
                    <TableCell>
                      <Typography variant="body2" fontWeight={600}>
                        {pedido.estudiante_nombre || "Sin nombre"}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        DNI {pedido.estudiante_dni}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{pedido.profesorado_destino_nombre}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {pedido.plan_destino_resolucion}
                      </Typography>
                    </TableCell>
                    <TableCell>{pedido.tipo === "ANEXO_A" ? "Anexo A" : "Anexo B"}</TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={pedido.estado_display}
                        color={pedido.estado === "final" ? "success" : "default"}
                      />
                    </TableCell>
                    <TableCell>{new Date(pedido.updated_at).toLocaleString()}</TableCell>
                    <TableCell align="right">
                      <Button
                        size="small"
                        startIcon={<DownloadIcon fontSize="small" />}
                        onClick={() => handleDescargarPDF(pedido)}
                        disabled={downloadingId === pedido.id}
                      >
                        Descargar PDF
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </Box>
  );
};

export default PedidosEquivalenciasPage;
