import React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  Chip,
  CircularProgress,
  Stack,
  TextField,
  IconButton,
  Checkbox,
  FormControlLabel,
  Grid,
  Divider,
  Alert,
  FormGroup,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from "@mui/material";
import { listarPreinscripciones, PreinscripcionDTO, eliminarPreinscripcion, activarPreinscripcion, apiConfirmarPreinscripcion } from "@/api/preinscripciones";
import PreConfirmEditor from "@/components/preinscripcion/PreConfirmEditor";
import DeleteIcon from '@mui/icons-material/DeleteOutline';
import AddIcon from '@mui/icons-material/Add';
import dayjs from "dayjs";
import { PageHero } from "@/components/ui/GradientTitles";

import { client as axios } from "@/api/client";

function EstadoChip({ estado, activa }: { estado: string; activa?: boolean }) {
  const norm = (estado || '').toLowerCase();
  const map: Record<string, "default" | "success" | "warning" | "error"> = {
    enviada: "default",
    observada: "warning",
    confirmada: "success",
    rechazada: "error",
    borrador: "default",
  };
  const label = activa === false ? 'Borrada' : estado;
  const color = (activa === false ? 'error' : (map[norm] ?? 'default')) as any;
  return <Chip label={label} color={color} size="small" sx={{ borderRadius: 2, textTransform: "capitalize" }} />;
}

export default function PreinscripcionesPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [search, setSearch] = React.useState("");
  const [inclInactivas, setInclInactivas] = React.useState(false);
  const [profesoradoId, setProfesoradoId] = React.useState<number | "">("");
  const [anio, setAnio] = React.useState<number | "">("");

  const { data: profesorados } = useQuery<{ id: number, nombre: string }[]>({
    queryKey: ["profesorados-list"],
    queryFn: () => axios.get("profesorados").then(r => r.data)
  });

  const { data, isLoading, isError, refetch } = useQuery<{ results: PreinscripcionDTO[] }>({
    queryKey: ["preinscripciones", search, inclInactivas, profesoradoId, anio],
    queryFn: () => listarPreinscripciones({
      search: search || undefined,
      include_inactivas: inclInactivas,
      profesorado_id: profesoradoId || undefined,
      anio: anio || undefined
    }),
  });

  // Unificación: formalizar en esta misma vista
  const [codigoSel, setCodigoSel] = React.useState<string | null>(null);
  const [docs, setDocs] = React.useState<{ [k: string]: boolean }>({
    dni: false,
    titulo_secundario: false,
    partida_nacimiento: false,
    certificado_salud: false,
    fotos: false,
  });
  const allDocs = Object.values(docs).every(Boolean);
  const [msgOk, setMsgOk] = React.useState<string | null>(null);
  const [msgErr, setMsgErr] = React.useState<string | null>(null);

  async function confirmarFormalizacion() {
    if (!codigoSel) return;
    try {
      await apiConfirmarPreinscripcion(codigoSel, { documentos: docs, estado: allDocs ? "regular" : "condicional" });
      setMsgOk("Preinscripción confirmada");
      setMsgErr(null);
      await refetch();
    } catch (e: any) {
      setMsgErr(e?.response?.data?.message || "No se pudo confirmar");
      setMsgOk(null);
    }
  }

  const onDelete = async (id: number) => {
    if (!confirm("¿Eliminar la Preinscripción seleccionada?")) return;
    try {
      await eliminarPreinscripcion(id);
      await qc.invalidateQueries({ queryKey: ["preinscripciones"] });
      refetch();
    } catch (e) {
      alert("No se pudo eliminar");
    }
  };

  return (
    <Stack gap={3}>
      <PageHero
        title="Gestión de Preinscripciones"
        subtitle="Seguimiento completo de solicitudes, documentación y estados"
      />

      <Paper sx={{ p: 2, borderRadius: 10 }}>
        <Grid container spacing={2} alignItems="center" sx={{ mb: 3 }}>
          <Grid item xs={12} md={4}>
            <TextField
              label="Buscar (DNI, Apellido/Nombre, Código)"
              size="small"
              fullWidth
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              InputProps={{
                sx: { borderRadius: 3 },
              }}
            />
          </Grid>
          <Grid item xs={12} md={3}>
            <FormControl fullWidth size="small">
              <InputLabel>Profesorado</InputLabel>
              <Select
                value={profesoradoId}
                label="Profesorado"
                onChange={(e) => setProfesoradoId(e.target.value as number)}
                sx={{ borderRadius: 3 }}
              >
                <MenuItem value="">Todos</MenuItem>
                {profesorados?.map((p) => (
                  <MenuItem key={p.id} value={p.id}>
                    {p.nombre}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={6} md={2}>
            <FormControl fullWidth size="small">
              <InputLabel>Año</InputLabel>
              <Select
                value={anio}
                label="Año"
                onChange={(e) => setAnio(e.target.value as number)}
                sx={{ borderRadius: 3 }}
              >
                <MenuItem value="">Todos</MenuItem>
                {[2022, 2023, 2024, 2025, 2026].map((y) => (
                  <MenuItem key={y} value={y}>
                    {y}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={6} md={3}>
            <Stack direction="row" spacing={1} alignItems="center" justifyContent="flex-end">
              <FormControlLabel
                control={
                  <Checkbox
                    size="small"
                    checked={inclInactivas}
                    onChange={(e) => setInclInactivas(e.target.checked)}
                  />
                }
                label="Inactivas"
              />
              <Button
                startIcon={<AddIcon />}
                variant="contained"
                sx={{ borderRadius: 3, whiteSpace: "nowrap" }}
                onClick={() => navigate("/preinscripcion")}
              >
                Nueva
              </Button>
            </Stack>
          </Grid>
        </Grid>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Código</TableCell>
                <TableCell>Nombre Completo</TableCell>
                <TableCell>Profesorado</TableCell>
                <TableCell>Fecha</TableCell>
                <TableCell>Estado</TableCell>
                <TableCell align="right">Acciones</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                    <CircularProgress />
                  </TableCell>
                </TableRow>
              )}
              {isError && (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                    <Typography color="error">Error al cargar las preinscripciones.</Typography>
                  </TableCell>
                </TableRow>
              )}
              {data?.results && data.results.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                    <Typography color="text.secondary">No se encontraron preinscripciones.</Typography>
                  </TableCell>
                </TableRow>
              )}
              {data?.results && data.results.map((p) => (
                <TableRow key={p.id} hover>
                  <TableCell>{p.codigo}</TableCell>
                  <TableCell>
                    {[
                      p.estudiante.apellido,
                      p.estudiante.nombres ?? p.estudiante.nombre ?? ""
                    ].filter(Boolean).join(", ")}
                  </TableCell>
                  <TableCell>{p.carrera.nombre}</TableCell>
                  <TableCell>{dayjs(p.fecha).format("DD/MM/YYYY HH:mm")}</TableCell>
                  <TableCell>
                    <EstadoChip estado={p.estado as any} activa={(p as any).activa as any} />
                  </TableCell>
                  <TableCell align="right">
                    <Stack direction="row" spacing={1} justifyContent="flex-end">
                      <Button
                        size="small"
                        onClick={() => setCodigoSel(p.codigo)}
                      >
                        Ver / Editar
                      </Button>
                      {(p as any).activa === false ? (
                        <Button size="small" variant="outlined" onClick={async () => { await activarPreinscripcion(p.id); await qc.invalidateQueries({ queryKey: ["preinscripciones"] }); refetch(); }}>Activar</Button>
                      ) : (
                        <IconButton size="small" onClick={() => onDelete(p.id)} color="error" title="Eliminar">
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      )}
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Panel inline para Formalizar inscripción */}
      {codigoSel && (
        <Paper sx={{ p: 2, borderRadius: 10 }}>
          <Stack gap={2}>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Typography variant="h6" fontWeight={700}>Formalizar inscripción — {codigoSel}</Typography>
              <Button size="small" onClick={() => setCodigoSel(null)}>Cerrar</Button>
            </Stack>
            {msgOk && <Alert severity="success">{msgOk}</Alert>}
            {msgErr && <Alert severity="error">{msgErr}</Alert>}
            <Grid container spacing={2}>
              <Grid item xs={12} md={12}>
                <PreConfirmEditor codigo={codigoSel} />
              </Grid>
            </Grid>
          </Stack>
        </Paper>
      )}
    </Stack>
  );
}
