import React from "react";
import Autocomplete from "@mui/material/Autocomplete";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import { EstudianteState } from './types';

interface NotaOption {
  value: string;
  label: string;
}

interface EstudianteOption {
  dni: string;
  apellido_nombre: string;
}

interface Summary {
  total: number;
  aprobados: number;
  desaprobados: number;
  ausentes: number;
}

interface ResultadosTableProps {
  estudiantes: EstudianteState[];
  notaOptions: NotaOption[];
  loadingEstudianteDni: string | null;
  initialEstudiantes: EstudianteOption[];
  estudiantesMetadata: EstudianteOption[];
  strict: boolean;
  summary: Summary;
  onAgregar: () => void;
  onEliminar: (internoId: string) => void;
  onDniChange: (internoId: string, dni: string) => void;
  onUpdateEstudiante: (internoId: string, patch: Partial<EstudianteState>) => void;
  onOpenOralActa: (estudiante: EstudianteState) => void;
}

export function ResultadosTable({
  estudiantes,
  notaOptions,
  loadingEstudianteDni,
  initialEstudiantes,
  estudiantesMetadata,
  strict,
  summary,
  onAgregar,
  onEliminar,
  onDniChange,
  onUpdateEstudiante,
  onOpenOralActa,
}: ResultadosTableProps) {
  return (
    <Paper variant="outlined" sx={{ p: 3 }}>
      <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" alignItems={{ xs: "stretch", md: "center" }} sx={{ mb: 2 }} spacing={2}>
        <Typography variant="h6" fontWeight={600}>
          Resultados del examen
        </Typography>
        <Button startIcon={<AddIcon />} variant="outlined" onClick={onAgregar}>
          Agregar fila
        </Button>
      </Stack>
      <Box sx={{ overflowX: "auto" }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell align="center" sx={{ width: 50 }}>N°</TableCell>
              <TableCell align="center" sx={{ width: 115, px: 1 }}>Permiso examen</TableCell>
              <TableCell sx={{ width: 125, px: 1 }}>DNI</TableCell>
              <TableCell sx={{ minWidth: 450 }}>
                <Box>
                  <Typography variant="subtitle2" component="span" sx={{ fontWeight: "bold" }}>
                    Apellido y nombre
                  </Typography>
                  {!strict && (
                    <Typography variant="caption" display="block" color="text.secondary" sx={{ fontStyle: "italic", mt: -0.5 }}>
                      (Formato: Apellido, Nombre)
                    </Typography>
                  )}
                </Box>
              </TableCell>
              <TableCell sx={{ width: 160 }}>Examen escrito</TableCell>
              <TableCell sx={{ width: 160 }}>Examen oral</TableCell>
              <TableCell sx={{ width: 160 }}>Calificación definitiva</TableCell>
              <TableCell sx={{ width: 140 }}>Observaciones</TableCell>
              <TableCell align="center" sx={{ width: 80, px: 1 }}>Acta oral</TableCell>
              <TableCell align="center" sx={{ width: 60, px: 1 }}>Acciones</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {estudiantes.map((estudiante) => (
              <TableRow key={estudiante.internoId}>
                <TableCell align="center">{estudiante.numero_orden}</TableCell>
                <TableCell align="center" sx={{ p: 1 }}>
                  <TextField
                    size="small"
                    fullWidth
                    inputProps={{ maxLength: 10 }}
                    value={estudiante.permiso_examen ?? ""}
                    onChange={(event) =>
                      onUpdateEstudiante(estudiante.internoId, { permiso_examen: event.target.value })
                    }
                    sx={{
                      "& .MuiInputBase-input": {
                        py: 0.5,
                        px: 1,
                        textAlign: "center"
                      }
                    }}
                  />
                </TableCell>
                <TableCell sx={{ p: 1 }}>
                  <TextField
                    size="small"
                    fullWidth
                    inputProps={{ maxLength: 8 }}
                    value={estudiante.dni}
                    onChange={(event) => onDniChange(estudiante.internoId, event.target.value)}
                  />
                </TableCell>
                <TableCell>
                  {loadingEstudianteDni === estudiante.internoId ? (
                    <CircularProgress size={20} />
                  ) : estudiantes && estudiantes.length > 0 ? (
                    <Autocomplete
                      freeSolo
                      options={initialEstudiantes.length > 0 ? initialEstudiantes : estudiantesMetadata}
                      getOptionLabel={(option) => {
                        if (typeof option === "string") return option;
                        return `${option.apellido_nombre} (${option.dni})`;
                      }}
                      value={estudiante.apellido_nombre || ""}
                      onChange={(_, value) => {
                        if (typeof value === "string") {
                          const match = value.match(/(.*) \((\d+)\)$/);
                          if (match) {
                            onUpdateEstudiante(estudiante.internoId, {
                              apellido_nombre: match[1].trim(),
                              dni: match[2],
                            });
                          } else {
                            onUpdateEstudiante(estudiante.internoId, { apellido_nombre: value });
                          }
                        } else if (value) {
                          onUpdateEstudiante(estudiante.internoId, {
                            apellido_nombre: value.apellido_nombre,
                            dni: value.dni,
                          });
                        } else {
                          onUpdateEstudiante(estudiante.internoId, { apellido_nombre: "" });
                        }
                      }}
                      onInputChange={(_, newInputValue) => {
                        onUpdateEstudiante(estudiante.internoId, {
                          apellido_nombre: newInputValue,
                        });
                      }}
                      forcePopupIcon={false}
                      renderOption={(props, option) => {
                        const { key, ...restProps } = props as any;
                        return (
                          <li key={key} {...restProps}>
                            <Box>
                              <Typography variant="body2">{option.apellido_nombre}</Typography>
                              <Typography variant="caption" display="block" color="text.secondary">
                                DNI: {option.dni}
                              </Typography>
                            </Box>
                          </li>
                        );
                      }}
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          size="small"
                          fullWidth
                          placeholder={!strict ? "Apellido, Nombre" : ""}
                        />
                      )}
                    />
                  ) : (
                    <TextField
                      size="small"
                      fullWidth
                      value={estudiante.apellido_nombre}
                      onChange={(event) =>
                        onUpdateEstudiante(estudiante.internoId, { apellido_nombre: event.target.value })
                      }
                      disabled={strict}
                      placeholder={!strict ? "Apellido, Nombre" : ""}
                    />
                  )}
                </TableCell>
                <TableCell>
                  <Autocomplete
                    options={notaOptions}
                    getOptionLabel={(option) => option.label}
                    value={notaOptions.find((opt) => opt.value === estudiante.examen_escrito) || null}
                    onChange={(_, newValue) =>
                      onUpdateEstudiante(estudiante.internoId, { examen_escrito: newValue?.value || "" })
                    }
                    autoHighlight
                    autoSelect
                    selectOnFocus
                    forcePopupIcon={false}
                    renderInput={(params) => <TextField {...params} size="small" />}
                  />
                </TableCell>
                <TableCell>
                  <Autocomplete
                    options={notaOptions}
                    getOptionLabel={(option) => option.label}
                    value={notaOptions.find((opt) => opt.value === estudiante.examen_oral) || null}
                    onChange={(_, newValue) =>
                      onUpdateEstudiante(estudiante.internoId, { examen_oral: newValue?.value || "" })
                    }
                    autoHighlight
                    autoSelect
                    selectOnFocus
                    forcePopupIcon={false}
                    renderInput={(params) => <TextField {...params} size="small" />}
                  />
                </TableCell>
                <TableCell>
                  <Autocomplete
                    options={notaOptions}
                    getOptionLabel={(option) => option.label}
                    value={notaOptions.find((opt) => opt.value === estudiante.calificacion_definitiva) || null}
                    onChange={(_, newValue) =>
                      onUpdateEstudiante(estudiante.internoId, { calificacion_definitiva: newValue?.value || "" })
                    }
                    autoHighlight
                    autoSelect
                    selectOnFocus
                    forcePopupIcon={false}
                    disableClearable={false}
                    renderInput={(params) => (
                      <TextField {...params} size="small" fullWidth required />
                    )}
                  />
                </TableCell>
                <TableCell>
                  <TextField
                    size="small"
                    value={estudiante.observaciones ?? ""}
                    onChange={(event) =>
                      onUpdateEstudiante(estudiante.internoId, { observaciones: event.target.value })
                    }
                  />
                </TableCell>
                <TableCell align="center">
                  <Button variant="outlined" size="small" onClick={() => onOpenOralActa(estudiante)}>
                    Abrir
                  </Button>
                </TableCell>
                <TableCell align="center">
                  <IconButton
                    color="error"
                    size="small"
                    onClick={() => onEliminar(estudiante.internoId)}
                    disabled={estudiantes.length === 1}
                  >
                    <DeleteIcon />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Box>

      <Divider sx={{ my: 2 }} />
      <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
        <Alert severity="info" sx={{ flex: 1 }}>
          <Typography variant="subtitle2">Resumen automático</Typography>
          <Typography variant="body2">
            Total de estudiantes: <strong>{summary.total}</strong> — Aprobados: <strong>{summary.aprobados}</strong> — Desaprobados: <strong>{summary.desaprobados}</strong> — Ausentes: <strong>{summary.ausentes}</strong>
          </Typography>
        </Alert>
      </Stack>
    </Paper>
  );
}
