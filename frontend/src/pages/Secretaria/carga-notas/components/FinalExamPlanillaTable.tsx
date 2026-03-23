import React from "react";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import FormControl from "@mui/material/FormControl";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Select from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TextField from "@mui/material/TextField";
import CloseIcon from "@mui/icons-material/Close";
import SearchIcon from "@mui/icons-material/Search";
import { MesaPlanillaCondicionDTO } from "@/api/estudiantes";
import { FinalRowState } from "../types";

type Props = {
  filteredFinalRows: FinalRowState[];
  finalCondiciones: MesaPlanillaCondicionDTO[];
  finalReadOnly: boolean;
  finalSearch: string;
  setFinalSearch: (value: string) => void;
  onRowChange: (inscripcionId: number, patch: Partial<FinalRowState>) => void;
  onOpenOralActa: (row: FinalRowState) => void;
};

const FinalExamPlanillaTable: React.FC<Props> = ({
  filteredFinalRows,
  finalCondiciones,
  finalReadOnly,
  finalSearch,
  setFinalSearch,
  onRowChange,
  onOpenOralActa,
}) => {
  return (
    <>
      <Stack direction="row" alignItems="center" gap={1} justifyContent="flex-end">
        <TextField
          size="small"
          placeholder="Buscar por apellido o DNI"
          value={finalSearch}
          onChange={(event) => setFinalSearch(event.target.value)}
          sx={{ minWidth: { xs: "100%", sm: 260 } }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
            endAdornment: finalSearch ? (
              <InputAdornment position="end">
                <IconButton
                  size="small"
                  edge="end"
                  onClick={() => setFinalSearch("")}
                  aria-label="Limpiar busqueda"
                >
                  <CloseIcon fontSize="small" />
                </IconButton>
              </InputAdornment>
            ) : undefined,
          }}
        />
      </Stack>
      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>DNI</TableCell>
              <TableCell>Apellido y nombre</TableCell>
              <TableCell>Condicion</TableCell>
              <TableCell>Nota</TableCell>
              <TableCell>Fecha</TableCell>
              <TableCell>Cuenta intentos</TableCell>
              <TableCell>Folio</TableCell>
              <TableCell>Libro</TableCell>
              <TableCell>Observaciones</TableCell>
              <TableCell align="center">Acta oral</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredFinalRows.map((row) => (
              <TableRow
                key={row.inscripcionId}
                hover
                sx={{
                  backgroundColor: row.condicion ? "inherit" : "rgba(255, 213, 79, 0.12)",
                }}
              >
                <TableCell>{row.dni}</TableCell>
                <TableCell>{row.apellidoNombre}</TableCell>
                <TableCell sx={{ minWidth: 180 }}>
                  <FormControl fullWidth size="small">
                    <Select
                      value={row.condicion ?? ""}
                      displayEmpty
                      disabled={finalReadOnly}
                      onChange={(event) =>
                        onRowChange(row.inscripcionId, {
                          condicion: event.target.value ? String(event.target.value) : null,
                        })
                      }
                    >
                      <MenuItem value="">
                        <em>Seleccionar</em>
                      </MenuItem>
                      {finalCondiciones.map((condicion) => (
                        <MenuItem key={condicion.value} value={condicion.value}>
                          {condicion.label}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </TableCell>
                <TableCell sx={{ minWidth: 120 }}>
                  <TextField
                    size="small"
                    type="number"
                    value={row.nota}
                    disabled={finalReadOnly}
                    onChange={(event) =>
                      onRowChange(row.inscripcionId, { nota: event.target.value })
                    }
                    inputProps={{ step: 0.5, min: 0, max: 10 }}
                  />
                </TableCell>
                <TableCell sx={{ minWidth: 150 }}>
                  <TextField
                    size="small"
                    type="date"
                    value={row.fechaResultado}
                    disabled={finalReadOnly}
                    onChange={(event) =>
                      onRowChange(row.inscripcionId, { fechaResultado: event.target.value })
                    }
                    InputLabelProps={{ shrink: true }}
                  />
                </TableCell>
                <TableCell align="center">
                  <Checkbox
                    checked={row.cuentaParaIntentos}
                    disabled={finalReadOnly}
                    onChange={(event) =>
                      onRowChange(row.inscripcionId, {
                        cuentaParaIntentos: event.target.checked,
                      })
                    }
                  />
                </TableCell>
                <TableCell sx={{ minWidth: 120 }}>
                  <TextField
                    size="small"
                    value={row.folio}
                    disabled={finalReadOnly}
                    onChange={(event) =>
                      onRowChange(row.inscripcionId, { folio: event.target.value })
                    }
                  />
                </TableCell>
                <TableCell sx={{ minWidth: 120 }}>
                  <TextField
                    size="small"
                    value={row.libro}
                    disabled={finalReadOnly}
                    onChange={(event) =>
                      onRowChange(row.inscripcionId, { libro: event.target.value })
                    }
                  />
                </TableCell>
                <TableCell sx={{ minWidth: 220 }}>
                  <TextField
                    size="small"
                    value={row.observaciones}
                    disabled={finalReadOnly}
                    onChange={(event) =>
                      onRowChange(row.inscripcionId, { observaciones: event.target.value })
                    }
                    multiline
                    maxRows={3}
                  />
                </TableCell>
                <TableCell align="center">
                  <Button
                    size="small"
                    variant="outlined"
                    disabled={finalReadOnly}
                    onClick={() => onOpenOralActa(row)}
                  >
                    Acta oral
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </>
  );
};

export default FinalExamPlanillaTable;
