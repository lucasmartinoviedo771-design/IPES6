import React from 'react';
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TableCell from "@mui/material/TableCell";
import TableBody from "@mui/material/TableBody";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { MesaPlanillaCondicionDTO, MesaPlanillaEstudianteDTO } from '@/api/estudiantes';
import { Mesa } from './types';
import { getTipoLabel, getModalidadLabel } from './utils';

interface PlanillaModalProps {
  open: boolean;
  planillaMesa: Mesa | null;
  planillaCondiciones: MesaPlanillaCondicionDTO[];
  planillaEstudiantes: MesaPlanillaEstudianteDTO[];
  planillaLoading: boolean;
  planillaSaving: boolean;
  planillaError: string | null;
  planillaSuccess: string | null;
  onCerrar: () => void;
  onGuardar: () => void;
  onCondicionChange: (inscripcionId: number, value: string) => void;
  onNotaChange: (inscripcionId: number, value: string) => void;
  onFechaChange: (inscripcionId: number, value: string) => void;
  onCuentaIntentosChange: (inscripcionId: number, checked: boolean) => void;
  onTextoChange: (inscripcionId: number, field: 'folio' | 'libro' | 'observaciones', value: string) => void;
}

export function PlanillaModal({
  open,
  planillaMesa,
  planillaCondiciones,
  planillaEstudiantes,
  planillaLoading,
  planillaSaving,
  planillaError,
  planillaSuccess,
  onCerrar,
  onGuardar,
  onCondicionChange,
  onNotaChange,
  onFechaChange,
  onCuentaIntentosChange,
  onTextoChange,
}: PlanillaModalProps) {
  return (
    <Dialog open={open} onClose={onCerrar} fullWidth maxWidth="lg">
      <DialogTitle>Planilla de mesa #{planillaMesa?.id}</DialogTitle>
      <DialogContent dividers>
        {planillaMesa && (
          <Stack spacing={0.5} sx={{ mb: 2 }}>
            <Typography variant="subtitle2">{planillaMesa.materia_nombre}</Typography>
            <Typography variant="body2" color="text.secondary">
              {getTipoLabel(planillaMesa.tipo)} ({getModalidadLabel(planillaMesa.modalidad)}) | {planillaMesa.fecha ? new Date(planillaMesa.fecha).toLocaleDateString() : '-'}
            </Typography>
          </Stack>
        )}
        {planillaError && <Alert severity="error" sx={{ mb: 2 }}>{planillaError}</Alert>}
        {planillaSuccess && <Alert severity="success" sx={{ mb: 2 }}>{planillaSuccess}</Alert>}
        {planillaLoading ? (
          <Stack alignItems="center" justifyContent="center" sx={{ py: 4 }}>
            <CircularProgress />
          </Stack>
        ) : planillaEstudiantes.length === 0 ? (
          <Alert severity="info">No hay inscripciones registradas para esta mesa.</Alert>
        ) : (
          <Box sx={{ overflowX: 'auto' }}>
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
                </TableRow>
              </TableHead>
              <TableBody>
                {planillaEstudiantes.map((estudiante) => (
                  <TableRow key={estudiante.inscripcion_id}>
                    <TableCell>{estudiante.dni}</TableCell>
                    <TableCell>{estudiante.apellido_nombre}</TableCell>
                    <TableCell sx={{ minWidth: 180 }}>
                      <TextField
                        select
                        size="small"
                        fullWidth
                        value={estudiante.condicion ?? ''}
                        onChange={(e) => onCondicionChange(estudiante.inscripcion_id, e.target.value)}
                        disabled={planillaSaving}
                      >
                        <MenuItem value="">Sin asignar</MenuItem>
                        {planillaCondiciones.map((cond) => (
                          <MenuItem key={cond.value} value={cond.value}>{cond.label}</MenuItem>
                        ))}
                      </TextField>
                    </TableCell>
                    <TableCell sx={{ minWidth: 100 }}>
                      <TextField
                        size="small"
                        type="number"
                        value={estudiante.nota ?? ''}
                        onChange={(e) => onNotaChange(estudiante.inscripcion_id, e.target.value)}
                        disabled={planillaSaving}
                        inputProps={{ step: 0.5, min: 0, max: 10 }}
                      />
                    </TableCell>
                    <TableCell sx={{ minWidth: 140 }}>
                      <TextField
                        size="small"
                        type="date"
                        value={estudiante.fecha_resultado ?? ''}
                        onChange={(e) => onFechaChange(estudiante.inscripcion_id, e.target.value)}
                        disabled={planillaSaving}
                        InputLabelProps={{ shrink: true }}
                      />
                    </TableCell>
                    <TableCell align="center">
                      <Checkbox
                        checked={Boolean(estudiante.cuenta_para_intentos)}
                        onChange={(e) => onCuentaIntentosChange(estudiante.inscripcion_id, e.target.checked)}
                        disabled={planillaSaving}
                      />
                    </TableCell>
                    <TableCell sx={{ minWidth: 120 }}>
                      <TextField
                        size="small"
                        value={estudiante.folio ?? ''}
                        onChange={(e) => onTextoChange(estudiante.inscripcion_id, 'folio', e.target.value)}
                        disabled={planillaSaving}
                      />
                    </TableCell>
                    <TableCell sx={{ minWidth: 120 }}>
                      <TextField
                        size="small"
                        value={estudiante.libro ?? ''}
                        onChange={(e) => onTextoChange(estudiante.inscripcion_id, 'libro', e.target.value)}
                        disabled={planillaSaving}
                      />
                    </TableCell>
                    <TableCell sx={{ minWidth: 220 }}>
                      <TextField
                        size="small"
                        value={estudiante.observaciones ?? ''}
                        onChange={(e) => onTextoChange(estudiante.inscripcion_id, 'observaciones', e.target.value)}
                        disabled={planillaSaving}
                        multiline
                        maxRows={3}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onCerrar} disabled={planillaSaving}>Cerrar</Button>
        <Button
          onClick={onGuardar}
          disabled={planillaSaving || planillaLoading || planillaEstudiantes.length === 0}
          startIcon={planillaSaving ? <CircularProgress size={16} color="inherit" /> : undefined}
        >
          Guardar
        </Button>
      </DialogActions>
    </Dialog>
  );
}
