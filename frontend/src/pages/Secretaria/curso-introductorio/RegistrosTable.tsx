import React from "react";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import Grid from "@mui/material/Grid";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import NotesIcon from "@mui/icons-material/Notes";

import { ProfesoradoDTO } from "@/api/cargaNotas";
import { TurnoDTO } from "@/api/comisiones";
import { CursoIntroRegistroDTO } from "@/api/cursoIntro";
import { RESULTADO_OPTIONS } from "./types";

type RegistroFiltros = {
  cohorteId: string;
  profesoradoId: string;
  turnoId: string;
  resultado: string;
  anio: string;
};

type CohorteOption = { value: number; label: string };

type Props = {
  profesorados: ProfesoradoDTO[];
  turnos: TurnoDTO[];
  registros: CursoIntroRegistroDTO[];
  registrosLoading: boolean;
  registroFiltros: RegistroFiltros;
  cohorteOptions: CohorteOption[];
  anioOptions: number[];
  puedeGestionarRegistros: boolean;
  onChangeFiltros: (filtros: RegistroFiltros) => void;
  onActualizar: () => void;
  onAsistencia: (registro: CursoIntroRegistroDTO) => void;
  onCierre: (registro: CursoIntroRegistroDTO) => void;
};

const RegistrosTable: React.FC<Props> = ({
  profesorados,
  turnos,
  registros,
  registrosLoading,
  registroFiltros,
  cohorteOptions,
  anioOptions,
  puedeGestionarRegistros,
  onChangeFiltros,
  onActualizar,
  onAsistencia,
  onCierre,
}) => {
  return (
    <>
      <Typography variant="h6" mb={2} mt={3}>
        Registros y asistencias
      </Typography>
      <Card variant="outlined">
        <CardContent>
          <Grid container spacing={2} sx={{ mb: 2 }}>
            <Grid item xs={12} md={3}>
              <TextField
                select
                label="Cohorte"
                size="small"
                fullWidth
                value={registroFiltros.cohorteId}
                onChange={(event) => onChangeFiltros({ ...registroFiltros, cohorteId: event.target.value })}
              >
                <MenuItem value="">Todas</MenuItem>
                {cohorteOptions.map((option) => (
                  <MenuItem key={option.value} value={String(option.value)}>
                    {option.label}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12} md={3}>
              <TextField
                select
                label="Profesorado"
                size="small"
                fullWidth
                value={registroFiltros.profesoradoId}
                onChange={(event) => onChangeFiltros({ ...registroFiltros, profesoradoId: event.target.value })}
              >
                <MenuItem value="">Todos</MenuItem>
                {profesorados.map((prof) => (
                  <MenuItem key={prof.id} value={String(prof.id)}>
                    {prof.nombre}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12} md={2}>
              <TextField
                select
                label="Turno"
                size="small"
                fullWidth
                value={registroFiltros.turnoId}
                onChange={(event) => onChangeFiltros({ ...registroFiltros, turnoId: event.target.value })}
              >
                <MenuItem value="">Todos</MenuItem>
                {turnos.map((turno) => (
                  <MenuItem key={turno.id} value={String(turno.id)}>
                    {turno.nombre}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12} md={2}>
              <TextField
                select
                label="Resultado"
                size="small"
                fullWidth
                value={registroFiltros.resultado}
                onChange={(event) => onChangeFiltros({ ...registroFiltros, resultado: event.target.value })}
              >
                <MenuItem value="">Todos</MenuItem>
                {RESULTADO_OPTIONS.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12} md={2}>
              <TextField
                select
                label="Año"
                size="small"
                fullWidth
                value={registroFiltros.anio}
                onChange={(event) => onChangeFiltros({ ...registroFiltros, anio: event.target.value })}
              >
                <MenuItem value="">Todos</MenuItem>
                {anioOptions.map((anio) => (
                  <MenuItem key={anio} value={String(anio)}>
                    {anio}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
          </Grid>
          <Stack direction="row" justifyContent="flex-end" sx={{ mb: 2 }}>
            <Button variant="outlined" onClick={onActualizar}>
              Actualizar listado
            </Button>
          </Stack>
          {registrosLoading ? (
            <Typography variant="body2" color="text.secondary">
              Cargando registros...
            </Typography>
          ) : registros.length === 0 ? (
            <Alert severity="info">No hay registros para los filtros seleccionados.</Alert>
          ) : (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Estudiante</TableCell>
                  <TableCell>Profesorado</TableCell>
                  <TableCell>Cohorte</TableCell>
                  <TableCell>Resultado</TableCell>
                  <TableCell>Nota</TableCell>
                  <TableCell>Asistencias</TableCell>
                  <TableCell align="right">Acciones</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {registros.map((registro) => (
                  <TableRow key={registro.id} hover>
                    <TableCell>
                      <Typography variant="body2" fontWeight={600}>
                        {registro.estudiante_nombre || "Sin nombre"}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        DNI {registro.estudiante_dni}
                      </Typography>
                    </TableCell>
                    <TableCell>{registro.profesorado_nombre ?? "-"}</TableCell>
                    <TableCell>{registro.cohorte_nombre ?? "-"}</TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={registro.resultado_display}
                        color={
                          registro.resultado === "APR"
                            ? "success"
                            : registro.resultado === "DES"
                              ? "default"
                              : registro.resultado === "AUS"
                                ? "warning"
                                : "info"
                        }
                      />
                    </TableCell>
                    <TableCell>{registro.nota_final ?? "-"}</TableCell>
                    <TableCell>{registro.asistencias_totales ?? "-"}</TableCell>
                    <TableCell align="right">
                      <Stack direction="row" spacing={1} justifyContent="flex-end">
                        <Button
                          size="small"
                          variant="outlined"
                          startIcon={<NotesIcon fontSize="small" />}
                          disabled={!puedeGestionarRegistros || registro.es_historico}
                          onClick={() => onAsistencia(registro)}
                        >
                          Asistencia
                        </Button>
                        <Button
                          size="small"
                          variant="contained"
                          disabled={!puedeGestionarRegistros}
                          onClick={() => onCierre(registro)}
                        >
                          Resultado
                        </Button>
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </>
  );
};

export default RegistrosTable;
