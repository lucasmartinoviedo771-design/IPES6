import React from "react";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
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
import AssignmentIndIcon from "@mui/icons-material/AssignmentInd";

import { ProfesoradoDTO } from "@/api/cargaNotas";
import { CursoIntroPendienteDTO } from "@/api/cursoIntro";

type Props = {
  profesorados: ProfesoradoDTO[];
  pendientes: CursoIntroPendienteDTO[];
  pendientesLoading: boolean;
  pendientesProfesoradoId: string;
  puedeGestionarRegistros: boolean;
  cohortesDisponibles: boolean;
  onChangePendientesProfesorado: (value: string) => void;
  onInscribir: (pendiente: CursoIntroPendienteDTO) => void;
};

const PendientesTable: React.FC<Props> = ({
  profesorados,
  pendientes,
  pendientesLoading,
  pendientesProfesoradoId,
  puedeGestionarRegistros,
  cohortesDisponibles,
  onChangePendientesProfesorado,
  onInscribir,
}) => {
  return (
    <>
      <Typography variant="h6" mb={2} mt={3}>
        Estudiantes pendientes
      </Typography>
      <Card variant="outlined" sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={2} sx={{ mb: 2 }}>
            <Grid item xs={12} md={4}>
              <TextField
                select
                label="Profesorado"
                size="small"
                fullWidth
                value={pendientesProfesoradoId}
                onChange={(event) => onChangePendientesProfesorado(event.target.value)}
              >
                <MenuItem value="">Todos</MenuItem>
                {profesorados.map((prof) => (
                  <MenuItem key={prof.id} value={String(prof.id)}>
                    {prof.nombre}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
          </Grid>
          {pendientesLoading ? (
            <Typography variant="body2" color="text.secondary">
              Buscando estudiantes...
            </Typography>
          ) : pendientes.length === 0 ? (
            <Alert severity="success">No hay estudiantes pendientes con los filtros aplicados.</Alert>
          ) : (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Estudiante</TableCell>
                  <TableCell>Profesorados</TableCell>
                  <TableCell width={160}>Acciones</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {pendientes.map((pendiente) => (
                  <TableRow key={pendiente.estudiante_id} hover>
                    <TableCell>
                      <Typography variant="body2" fontWeight={600}>
                        {pendiente.estudiante_apellido ? `${pendiente.estudiante_apellido}, ` : ""}{pendiente.estudiante_nombre || "Sin nombre"}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        DNI {pendiente.estudiante_dni}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Stack spacing={0.5}>
                        {pendiente.profesorados.map((prof, idx) => (
                          <Typography key={`${prof.id || "none"}-${idx}`} variant="caption">
                            {prof.nombre} {prof.anio_ingreso ? `- Ingreso ${prof.anio_ingreso}` : ""}
                          </Typography>
                        ))}
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<AssignmentIndIcon fontSize="small" />}
                        onClick={() => onInscribir(pendiente)}
                        disabled={!puedeGestionarRegistros || !cohortesDisponibles}
                      >
                        Inscribir
                      </Button>
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

export default PendientesTable;
