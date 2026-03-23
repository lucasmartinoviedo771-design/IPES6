import Chip from "@mui/material/Chip";
import IconButton from "@mui/material/IconButton";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import EditIcon from "@mui/icons-material/Edit";
import PauseCircleIcon from "@mui/icons-material/PauseCircle";

import { CalendarioEvento } from "@/api/asistencia";
import { formatFecha, scopeSummary } from "./utils";

type Props = {
  evento: CalendarioEvento;
  canManage: boolean;
  onEdit: (evento: CalendarioEvento) => void;
  onDeactivate: (evento: CalendarioEvento) => void;
};

const EventoCard = ({ evento, canManage, onEdit, onDeactivate }: Props) => (
  <Paper key={evento.id} variant="outlined" sx={{ p: 1.5 }}>
    <Stack spacing={0.5}>
      <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
        <Box>
          <Typography variant="subtitle2" fontWeight={600}>
            {evento.nombre} - {evento.tipo}
          </Typography>
          {!evento.activo && (
            <Chip label="Inactivo" size="small" color="default" sx={{ mt: 0.5 }} />
          )}
        </Box>
        {canManage && (
          <Stack direction="row" spacing={1}>
            <Tooltip title="Editar evento">
              <IconButton size="small" onClick={() => onEdit(evento)}>
                <EditIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            {evento.activo && (
              <Tooltip title="Desactivar evento">
                <IconButton
                  size="small"
                  color="warning"
                  onClick={() => onDeactivate(evento)}
                >
                  <PauseCircleIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
          </Stack>
        )}
      </Stack>
      <Typography variant="body2" color="text.secondary">
        {formatFecha(evento.fecha_desde)} - {formatFecha(evento.fecha_hasta)}
      </Typography>
      <Stack direction="row" spacing={0.5} flexWrap="wrap">
        {scopeSummary(evento).map((scope) => (
          <Chip key={`${evento.id}-${scope}`} label={scope} size="small" />
        ))}
        <Chip
          label={evento.aplica_docentes ? "Docentes incluidos" : "Sin docentes"}
          size="small"
          color={evento.aplica_docentes ? "primary" : "default"}
        />
        <Chip
          label={evento.aplica_estudiantes ? "Estudiantes incluidos" : "Sin estudiantes"}
          size="small"
          color={evento.aplica_estudiantes ? "primary" : "default"}
        />
      </Stack>
      {evento.motivo && (
        <Typography variant="caption" color="text.secondary">
          {evento.motivo}
        </Typography>
      )}
    </Stack>
  </Paper>
);

export default EventoCard;
