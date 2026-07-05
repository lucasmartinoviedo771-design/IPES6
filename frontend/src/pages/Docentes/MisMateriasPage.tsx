/* eslint-disable react-doctor/js-combine-iterations */
import { useMemo, useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { listarComisiones, ComisionDTO } from "@/api/comisiones";
import { PageHero } from "@/components/ui/GradientTitles";
import BackButton from "@/components/ui/BackButton";
import { useAuth } from "@/context/AuthContext";

const currentYear = new Date().getFullYear();

export default function DocentesMisMateriasPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [filterProfesora, setFilterProfesorado] = useState("");
  const [filterMateria, setFilterMateria] = useState("");

  const { data: comisiones, isLoading, isError } = useQuery<ComisionDTO[]>({
    queryKey: ["docente", "comisiones", currentYear],
    queryFn: () =>
      listarComisiones({
        anio_lectivo: currentYear,
      }),
  });

  const profesorados = useMemo(() => {
    if (!comisiones) return [];
    const seen = new Set<number>();
    return comisiones
      .filter(c => { if (seen.has(c.profesorado_id)) return false; seen.add(c.profesorado_id); return true; })
      .map(c => ({ id: c.profesorado_id, nombre: c.profesorado_nombre }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [comisiones]);

  const rows = useMemo(() => {
    let result = comisiones ?? [];
    if (filterProfesora) result = result.filter(c => c.profesorado_id === Number(filterProfesora));
    if (filterMateria.trim()) {
      const term = filterMateria.trim().toLowerCase();
      result = result.filter(c => c.materia_nombre.toLowerCase().includes(term));
    }
    return result;
  }, [comisiones, filterProfesora, filterMateria]);

  return (
    <Box sx={{ p: 3 }}>
      <Stack spacing={3}>
        <BackButton fallbackPath="/docentes" />
        <PageHero
          title="Mis comisiones"
          subtitle="Consulta las materias en las que sos docente y accede al listado de inscriptos."
        />

        {isLoading && (
          <Stack direction="row" spacing={1} alignItems="center">
            <CircularProgress size={18} />
            <Typography variant="body2" color="text.secondary">
              Cargando tus comisiones...
            </Typography>
          </Stack>
        )}

        {isError && (
          <Alert severity="error">
            No pudimos cargar tus comisiones. Intentá nuevamente o verifica tus permisos.
          </Alert>
        )}

        {!isLoading && !isError && (comisiones ?? []).length === 0 && (
          <Alert severity="info">No encontramos comisiones asignadas para este año.</Alert>
        )}

        {!isLoading && !isError && (comisiones ?? []).length > 0 && (
          <Stack spacing={2}>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <FormControl size="small" sx={{ minWidth: 260 }}>
                <InputLabel>Profesorado</InputLabel>
                <Select
                  value={filterProfesora}
                  label="Profesorado"
                  onChange={e => setFilterProfesorado(e.target.value)}
                >
                  <MenuItem value="">Todos</MenuItem>
                  {profesorados.map(p => (
                    <MenuItem key={p.id} value={String(p.id)}>{p.nombre}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <TextField
                size="small"
                label="Materia"
                placeholder="Buscar por nombre..."
                value={filterMateria}
                onChange={e => setFilterMateria(e.target.value)}
                sx={{ minWidth: 240 }}
              />
            </Stack>

            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Materia</TableCell>
                    <TableCell>Plan</TableCell>
                    <TableCell>Profesorado</TableCell>
                    <TableCell>Código comisión</TableCell>
                    <TableCell>Año lectivo</TableCell>
                    <TableCell>Turno</TableCell>
                    <TableCell align="right">Inscriptos</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7}>
                        <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: "center" }}>
                          Sin resultados para los filtros aplicados.
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : rows.map((comision) => (
                    <TableRow key={comision.id} hover>
                      <TableCell>{comision.materia_nombre}</TableCell>
                      <TableCell>{comision.plan_resolucion}</TableCell>
                      <TableCell>{comision.profesorado_nombre}</TableCell>
                      <TableCell>
                        <Chip label={comision.codigo || "Sin código"} size="small" />
                      </TableCell>
                      <TableCell>{comision.anio_lectivo}</TableCell>
                      <TableCell>{comision.turno_nombre || "-"}</TableCell>
                      <TableCell align="right">
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() =>
                            navigate(
                              `/carreras/${comision.profesorado_id}/planes/${comision.plan_id}/materias/${comision.materia_id}/inscriptos`,
                              {
                                state: {
                                  materiaNombre: comision.materia_nombre,
                                  planResolucion: comision.plan_resolucion,
                                  profesoradoNombre: comision.profesorado_nombre,
                                },
                              },
                            )
                          }
                        >
                          Ver inscriptos
                        </Button>
                        <Button
                          size="small"
                          variant="contained"
                          color="primary"
                          sx={{ ml: 1 }}
                          onClick={async () => {
                            if (!user?.dni) return;
                            try {
                              const d = new Date();
                              const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                              const { fetchDocenteClases } = await import("@/api/asistencia");
                              const data = await fetchDocenteClases(user.dni, { fecha: today });
                              const claseHoy = data.clases.find(c => c.comision_id === comision.id);

                              if (claseHoy) {
                                navigate(`/docentes/clases/${claseHoy.id}/asistencia`);
                              } else {
                                alert("No tenés clases programadas para hoy en esta comisión.");
                              }
                            } catch (_e) {
                              void 0;
                              alert("Error al buscar la clase de hoy.");
                            }
                          }}
                        >
                          Tomar Asistencia
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Stack>
        )}

      </Stack>
    </Box>
  );
}
