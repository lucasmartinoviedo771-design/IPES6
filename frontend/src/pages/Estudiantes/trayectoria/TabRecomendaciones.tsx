import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Grid from "@mui/material/Grid";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

import { TrayectoriaDTO } from '@/api/estudiantes';
import { formatDate } from './utils';

type Props = {
  recomendaciones: TrayectoriaDTO['recomendaciones'];
};

const TabRecomendaciones = ({ recomendaciones }: Props) => (
  <Stack spacing={2}>
    {(recomendaciones?.alertas ?? []).map((alerta: string, idx: number) => (
      <Alert key={`alerta-${idx}`} severity="warning">{alerta}</Alert>
    ))}

    <Box>
      <Typography variant="subtitle1" fontWeight={700} gutterBottom>Materias sugeridas</Typography>
      {(recomendaciones?.materias_sugeridas ?? []).length === 0 ? (
        <Alert severity="info">No hay materias sugeridas en este momento.</Alert>
      ) : (
        <Grid container spacing={2}>
          {(recomendaciones?.materias_sugeridas ?? []).map((mat) => (
            <Grid item xs={12} md={6} key={`sug-${mat.materia_id}`}>
              <Paper variant="outlined" sx={{ p: 2, height: '100%' }}>
                <Stack spacing={1}>
                  <Typography variant="subtitle1" fontWeight={700}>{mat.materia_nombre}</Typography>
                  <Stack direction="row" spacing={1}>
                    <Chip label={`Año ${mat.anio}`} size="small" color="primary" />
                    <Chip label={mat.cuatrimestre} size="small" />
                  </Stack>
                  <Stack spacing={0.5}>
                    {mat.motivos.map((motivo, idx) => (
                      <Typography key={idx} variant="body2" color="text.secondary">• {motivo}</Typography>
                    ))}
                  </Stack>
                  {mat.alertas.length > 0 && (
                    <Alert severity="warning" variant="outlined">
                      {mat.alertas.join(' / ')}
                    </Alert>
                  )}
                </Stack>
              </Paper>
            </Grid>
          ))}
        </Grid>
      )}
    </Box>

    <Box>
      <Typography variant="subtitle1" fontWeight={700} gutterBottom>Finales habilitados</Typography>
      {(recomendaciones?.finales_habilitados ?? []).length === 0 ? (
        <Alert severity="info">No hay finales habilitados pendientes.</Alert>
      ) : (
        <Grid container spacing={2}>
          {(recomendaciones?.finales_habilitados ?? []).map((item) => (
            <Grid item xs={12} md={6} key={`final-${item.materia_id}`}>
              <Paper variant="outlined" sx={{ p: 2, height: '100%' }}>
                <Stack spacing={1}>
                  <Typography variant="subtitle1" fontWeight={700}>{item.materia_nombre}</Typography>
                  <Typography variant="body2">Regularidad: {formatDate(item.regularidad_fecha)}</Typography>
                  <Typography variant="body2">Vigencia hasta: {item.vigencia_hasta ? formatDate(item.vigencia_hasta) : '-'}</Typography>
                  {typeof item.dias_restantes === 'number' && (
                    <Chip
                      label={`${item.dias_restantes} días`}
                      size="small"
                      color={item.dias_restantes >= 0 ? 'success' : 'error'}
                    />
                  )}
                  {item.comentarios.length > 0 && (
                    <Stack spacing={0.5}>
                      {item.comentarios.map((comentario, idx) => (
                        <Typography key={idx} variant="body2" color="text.secondary">• {comentario}</Typography>
                      ))}
                    </Stack>
                  )}
                  {item.correlativas_aprobadas && item.correlativas_aprobadas.length > 0 && (
                    <Box sx={{ mt: 1, pt: 1, borderTop: '1px dashed', borderColor: 'divider' }}>
                      <Typography variant="caption" fontWeight={700} color="text.secondary" gutterBottom>
                        Habilitado por:
                      </Typography>
                      <Stack spacing={0}>
                        {item.correlativas_aprobadas.map((c, i) => (
                          <Typography key={i} variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                            • {c}
                          </Typography>
                        ))}
                      </Stack>
                    </Box>
                  )}
                </Stack>
              </Paper>
            </Grid>
          ))}
        </Grid>
      )}
    </Box>
  </Stack>
);

export default TabRecomendaciones;
