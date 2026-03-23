import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";

import { TrayectoriaMesaDTO, RegularidadResumenDTO } from '@/api/estudiantes';
import { formatDate, notaToString } from './utils';

type Props = {
  regularidades: RegularidadResumenDTO[];
  mesas: TrayectoriaMesaDTO[];
};

const TabMesasYRegularidades = ({ regularidades, mesas }: Props) => (
  <Stack spacing={3}>
    <Box>
      <Typography variant="subtitle1" fontWeight={700} gutterBottom>Regularidades recientes</Typography>
      {regularidades.length === 0 ? (
        <Alert severity="info">Sin registros de regularidad.</Alert>
      ) : (
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Materia</TableCell>
              <TableCell>Situacion</TableCell>
              <TableCell>Fecha cierre</TableCell>
              <TableCell>Vigencia</TableCell>
              <TableCell>Nota</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {regularidades.map((reg) => (
              <TableRow key={`reg-${reg.id}`}>
                <TableCell>{reg.materia_nombre}</TableCell>
                <TableCell>{reg.situacion_display}</TableCell>
                <TableCell>{formatDate(reg.fecha_cierre)}</TableCell>
                <TableCell>
                  {reg.vigencia_hasta ? (
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Typography variant="body2">{formatDate(reg.vigencia_hasta)}</Typography>
                      {typeof reg.dias_restantes === 'number' && (
                        <Chip label={`${reg.dias_restantes} días`} size="small" color={reg.dias_restantes >= 0 ? 'success' : 'error'} />
                      )}
                    </Stack>
                  ) : '-'}
                </TableCell>
                <TableCell>
                  {reg.nota_final !== undefined && reg.nota_final !== null
                    ? notaToString(reg.nota_final)
                    : (reg.nota_tp !== undefined && reg.nota_tp !== null ? notaToString(reg.nota_tp) : '-')}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Box>

    <Box>
      <Typography variant="subtitle1" fontWeight={700} gutterBottom>Mesas de examen</Typography>
      {mesas.length === 0 ? (
        <Alert severity="info">Sin inscripciones a mesas registradas.</Alert>
      ) : (
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Fecha</TableCell>
              <TableCell>Materia</TableCell>
              <TableCell>Tipo</TableCell>
              <TableCell>Estado</TableCell>
              <TableCell>Aula</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {mesas.map((mesa) => (
              <TableRow key={`mesa-${mesa.id}`}>
                <TableCell>{formatDate(mesa.fecha)}</TableCell>
                <TableCell>{mesa.materia_nombre}</TableCell>
                <TableCell>{mesa.tipo_display}</TableCell>
                <TableCell>{mesa.estado_display}</TableCell>
                <TableCell>{mesa.aula || '-'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Box>
  </Stack>
);

export default TabMesasYRegularidades;
