import React, { useMemo, useState } from 'react';
import {
  Box,
  Tabs,
  Tab,
  Typography,
  Stack,
  Paper,
  Alert,
  Grid,
  Chip,
  CircularProgress,
  TextField,
  Button,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
} from '@mui/material';
import HistoryEduIcon from '@mui/icons-material/HistoryEdu';
import AssignmentTurnedInIcon from '@mui/icons-material/AssignmentTurnedIn';
import InsightsIcon from '@mui/icons-material/Insights';
import EventAvailableIcon from '@mui/icons-material/EventAvailable';
import RefreshIcon from '@mui/icons-material/Refresh';
import { useQuery } from '@tanstack/react-query';

import {
  obtenerTrayectoriaAlumno,
  TrayectoriaDTO,
  TrayectoriaEventoDTO,
  TrayectoriaMesaDTO,
  RegularidadVigenciaDTO,
} from '@/api/alumnos';
import { useAuth } from '@/context/AuthContext';

function a11yProps(index: number) {
  return {
    id: `trayectoria-tab-${index}`,
    'aria-controls': `trayectoria-panel-${index}`,
  };
}

function TabPanel({ children, value, index }: { children: React.ReactNode; value: number; index: number }) {
  return (
    <div role="tabpanel" hidden={value !== index} id={`trayectoria-panel-${index}`} aria-labelledby={`trayectoria-tab-${index}`}>
      {value === index && <Box sx={{ pt: 2 }}>{children}</Box>}
    </div>
  );
}

const EVENT_TYPE_LABEL: Record<TrayectoriaEventoDTO['tipo'], string> = {
  preinscripcion: 'Preinscripcion',
  inscripcion_materia: 'Inscripcion',
  regularidad: 'Regularidad',
  mesa: 'Mesa',
  tramite: 'Tramite',
  nota: 'Nota',
};

const formatDate = (value?: string | null) => {
  if (!value) return '-';
  if (/^\\d{4}-\\d{2}-\\d{2}$/.test(value)) {
    const [y, m, d] = value.split('-').map(Number);
    const date = new Date(Date.UTC(y, (m || 1) - 1, d || 1));
    return date.toLocaleDateString();
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
};

const notaToString = (nota?: number | null) => {
  if (nota === null || nota === undefined) return '-';
  if (Number.isInteger(nota)) return String(nota);
  return nota.toFixed(1).replace(/\\.?0+$/, '');
};

const TrayectoriaPage: React.FC = () => {
  const { user } = (useAuth?.() ?? { user: null }) as any;
  const canGestionar = !!user && (user.is_staff || (user.roles || []).some((r: string) => ['admin', 'secretaria', 'bedel'].includes((r || '').toLowerCase())));
  const [tab, setTab] = useState(0);
  const [dniInput, setDniInput] = useState('');
  const [dniQuery, setDniQuery] = useState('');

  const queryKey = useMemo(() => ['trayectoria', canGestionar ? (dniQuery || '').trim() : 'self'], [canGestionar, dniQuery]);
  const trayectoriaQ = useQuery<TrayectoriaDTO>({
    queryKey,
    queryFn: () => obtenerTrayectoriaAlumno(canGestionar ? ((dniQuery || '').trim() ? { dni: (dniQuery || '').trim() } : undefined) : undefined),
  });

  const trayectoria = trayectoriaQ.data;
  const eventos = trayectoria?.historial ?? [];
  const regularidades = trayectoria?.regularidades ?? [];
  const mesas = trayectoria?.mesas ?? [];
  const vigencias = useMemo<RegularidadVigenciaDTO[]>(() => {
    const list = [...(trayectoria?.regularidades_vigencia ?? [])];
    return list.sort((a, b) => a.vigencia_hasta.localeCompare(b.vigencia_hasta));
  }, [trayectoria?.regularidades_vigencia]);
  const recomendaciones = trayectoria?.recomendaciones;

  const handleBuscar = () => {
    setDniQuery(dniInput.trim());
  };

  const handleEnter = (evt: React.KeyboardEvent<HTMLInputElement>) => {
    if (evt.key === 'Enter') {
      evt.preventDefault();
      handleBuscar();
    }
  };

  const estudiante = trayectoria?.estudiante;

  return (
    <Box sx={{ p: 2 }}>
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', md: 'center' }} spacing={2} sx={{ mb: 2 }}>
        <Box>
          <Typography variant="h5" fontWeight={800}>Trayectoria del estudiante</Typography>
          <Typography variant="body2" color="text.secondary">
            Historial consolidado de inscripciones, cursadas, mesas y sugerencias de accion.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} alignItems="center">
          <Button
            size="small"
            variant="outlined"
            startIcon={<RefreshIcon fontSize="small" />}
            onClick={() => trayectoriaQ.refetch()}
            disabled={trayectoriaQ.isFetching}
          >
            Actualizar
          </Button>
        </Stack>
      </Stack>

      {canGestionar && (
        <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ xs: 'stretch', sm: 'center' }}>
            <TextField
              label="DNI estudiante"
              value={dniInput}
              size="small"
              onChange={(e) => setDniInput(e.target.value)}
              onKeyDown={handleEnter}
              sx={{ minWidth: 200 }}
            />
            <Button variant="contained" size="small" onClick={handleBuscar}>
              Consultar
            </Button>
          </Stack>
        </Paper>
      )}

      {estudiante && (
        <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle1" fontWeight={700}>Datos del estudiante</Typography>
              <Typography variant="body2">{estudiante.apellido_nombre}</Typography>
              <Typography variant="body2" color="text.secondary">DNI: {estudiante.dni}</Typography>
              {estudiante.legajo && (
                <Typography variant="body2" color="text.secondary">Legajo: {estudiante.legajo}</Typography>
              )}
            </Grid>
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle1" fontWeight={700}>Carreras activas</Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap">
                {(estudiante.carreras && estudiante.carreras.length > 0) ? estudiante.carreras.map((carrera) => (
                  <Chip key={carrera} label={carrera} size="small" />
                )) : <Typography variant="body2" color="text.secondary">Sin carreras asociadas</Typography>}
              </Stack>
            </Grid>
          </Grid>
        </Paper>
      )}

      {trayectoriaQ.isLoading && (
        <Stack alignItems="center" sx={{ py: 4 }}>
          <CircularProgress size={32} />
        </Stack>
      )}

      {trayectoriaQ.isError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          No se pudo obtener la trayectoria. Intenta nuevamente.
        </Alert>
      )}

      {trayectoria && (
        <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
          <Tabs value={tab} onChange={(_, value) => setTab(value)} variant="scrollable" scrollButtons allowScrollButtonsMobile>
            <Tab icon={<HistoryEduIcon />} iconPosition="start" label="Historial academico" {...a11yProps(0)} />
            <Tab icon={<AssignmentTurnedInIcon />} iconPosition="start" label="Mesas y notas" {...a11yProps(1)} />
            <Tab icon={<InsightsIcon />} iconPosition="start" label="Recomendaciones" {...a11yProps(2)} />
            <Tab icon={<EventAvailableIcon />} iconPosition="start" label="Caducidad regularidades" {...a11yProps(3)} />
          </Tabs>
          <Divider />
          <Box sx={{ p: 2 }}>
            <TabPanel value={tab} index={0}>
              {eventos.length === 0 ? (
                <Alert severity="info">Sin eventos registrados en la trayectoria.</Alert>
              ) : (
                <Stack spacing={2}>
                  {eventos.map((evento) => {
                    const chips = Object.entries(evento.metadata || {}).filter(([, value]) => value).map(([key, value]) => (
                      <Chip key={key} label={`${key}: ${value}`} size="small" variant="outlined" />
                    ));
                    return (
                      <Paper key={evento.id} variant="outlined" sx={{ p: 2 }}>
                        <Stack spacing={1}>
                          <Stack direction="row" spacing={1} alignItems="center">
                            <Chip label={EVENT_TYPE_LABEL[evento.tipo]} size="small" color="primary" />
                            <Typography variant="subtitle1" fontWeight={700}>{evento.titulo}</Typography>
                          </Stack>
                          <Typography variant="body2" color="text.secondary">{formatDate(evento.fecha)}</Typography>
                          {evento.subtitulo && (
                            <Typography variant="body2">{evento.subtitulo}</Typography>
                          )}
                          {evento.detalle && (
                            <Typography variant="body2" color="text.secondary">{evento.detalle}</Typography>
                          )}
                          {chips.length > 0 && (
                            <Stack direction="row" spacing={1} flexWrap="wrap">{chips}</Stack>
                          )}
                        </Stack>
                      </Paper>
                    );
                  })}
                </Stack>
              )}
            </TabPanel>

            <TabPanel value={tab} index={1}>
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
                        {regularidades.map((reg: RegularidadResumenDTO) => (
                          <TableRow key={`reg-${reg.id}`}>
                            <TableCell>{reg.materia_nombre}</TableCell>
                            <TableCell>{reg.situacion_display}</TableCell>
                            <TableCell>{formatDate(reg.fecha_cierre)}</TableCell>
                            <TableCell>
                              {reg.vigencia_hasta ? (
                                <Stack direction="row" spacing={1} alignItems="center">
                                  <Typography variant="body2">{formatDate(reg.vigencia_hasta)}</Typography>
                                  {typeof reg.dias_restantes === 'number' && (
                                    <Chip label={`${reg.dias_restantes} dias`} size="small" color={reg.dias_restantes >= 0 ? 'success' : 'error'} />
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
                        {mesas.map((mesa: TrayectoriaMesaDTO) => (
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
            </TabPanel>

            <TabPanel value={tab} index={2}>
              <Stack spacing={2}>
                {(recomendaciones?.alertas ?? []).map((alerta, idx) => (
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
                                <Chip label={`Ano ${mat.anio}`} size="small" color="primary" />
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
                                  label={`${item.dias_restantes} dias`}
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
                            </Stack>
                          </Paper>
                        </Grid>
                      ))}
                    </Grid>
                  )}
                </Box>
              </Stack>
            </TabPanel>

            <TabPanel value={tab} index={3}>
              {vigencias.length === 0 ? (
                <Alert severity="info">No se registran regularidades vigentes.</Alert>
              ) : (
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
                    {vigencias.map((vig: RegularidadVigenciaDTO) => (
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
                              label={`${vig.dias_restantes} dias`}
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
              )}
            </TabPanel>
          </Box>
        </Paper>
      )}

      {trayectoria?.updated_at && (
        <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block' }}>
          Ultima actualizacion: {formatDate(trayectoria.updated_at)}
        </Typography>
      )}
    </Box>
  );
};

export default TrayectoriaPage;
