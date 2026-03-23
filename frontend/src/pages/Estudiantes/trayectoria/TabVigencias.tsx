import Alert from "@mui/material/Alert";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";

import { RegularidadVigenciaDTO } from '@/api/estudiantes';
import { formatDate } from './utils';

type Props = {
  vigencias: RegularidadVigenciaDTO[];
};

const TabVigencias = ({ vigencias }: Props) => {
  if (vigencias.length === 0) {
    return <Alert severity="info">No se registran regularidades vigentes.</Alert>;
  }

  return (
    <Table size="small">
      <TableHead>
        <TableRow>
          <TableCell>Materia</TableCell>
          <TableCell>Situacion</TableCell>
          <TableCell>Fecha cierre</TableCell>
          <TableCell>Vigencia hasta</TableCell>
          <TableCell>Intentos</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {vigencias.map((vig) => (
          <TableRow key={`vig-${vig.materia_id}`}>
            <TableCell>{vig.materia_nombre}</TableCell>
            <TableCell>{vig.situacion_display}</TableCell>
            <TableCell>{formatDate(vig.fecha_cierre)}</TableCell>
            <TableCell>
              <Stack direction="row" spacing={1} alignItems="center">
                <Typography variant="body2">{formatDate(vig.vigencia_hasta)}</Typography>
                <Chip
                  label={vig.vigente ? 'Vigente' : 'Vencida'}
                  size="small"
                  color={vig.vigente ? 'success' : 'error'}
                />
                <Chip
                  label={`${vig.dias_restantes} días`}
                  size="small"
                  color={vig.dias_restantes >= 0 ? 'primary' : 'error'}
                />
              </Stack>
            </TableCell>
            <TableCell>{vig.intentos_usados} / {vig.intentos_max}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
};

export default TabVigencias;
