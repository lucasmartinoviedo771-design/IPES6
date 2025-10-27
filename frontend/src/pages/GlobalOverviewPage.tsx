import { useMemo } from 'react';
import { Box, CircularProgress, Grid, Paper, Stack, Typography, Chip, Divider, List, ListItem, ListItemText } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { fetchGlobalOverview } from '@/api/overview';

function SectionPaper({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 2, height: '100%' }}>
      <Typography variant="h6" fontWeight={700} gutterBottom>
        {title}
      </Typography>
      {children}
    </Paper>
  );
}

export default function GlobalOverviewPage() {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['global-overview'],
    queryFn: fetchGlobalOverview,
  });

  const estadoChips = useMemo(() => {
    if (!data) return [];
    return data.preinscripciones.por_estado.map((row) => (
      <Chip key={row.estado} label={`${row.estado}: ${row.total}`} size="small" sx={{ mr: 1, mb: 1 }} />
    ));
  }, [data]);

  if (isLoading) {
    return (
      <Box display="flex" alignItems="center" justifyContent="center" minHeight="60vh">
        <CircularProgress />
      </Box>
    );
  }

  if (isError || !data) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography variant="h6" color="error">
          No se pudo cargar la vista global.
        </Typography>
        {error instanceof Error && (
          <Typography variant="body2" color="text.secondary">{error.message}</Typography>
        )}
      </Box>
    );
  }

  return (
    <Stack gap={3} sx={{ p: 2 }}>
      <Box>
        <Typography variant="h4" fontWeight={800} gutterBottom>
          Visión global del instituto
        </Typography>
        <Typography color="text.secondary">
          Resumen consolidado para roles administrativos. Incluye docentes, estructura académica, preinscripciones y actividad reciente.
        </Typography>
      </Box>

      <Grid container spacing={2}>
        <Grid item xs={12} md={6} lg={4}>
          <SectionPaper title="Docentes activos">
            <Stack gap={1.5}>
              {data.docentes.map((docente) => (
                <Box key={docente.id}>
                  <Typography fontWeight={600}>{docente.nombre}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    DNI {docente.documento} · {docente.total_catedras} cátedras
                  </Typography>
                  <List dense>
                    {docente.catedras.map((catedra) => (
                      <ListItem key={catedra.id} disableGutters sx={{ py: 0 }}>
                        <ListItemText
                          primary={`${catedra.materia} (${catedra.anio_lectivo})`}
                          secondary={`${catedra.profesorado}${catedra.turno ? ` · ${catedra.turno}` : ''}`}
                        />
                      </ListItem>
                    ))}
                  </List>
                </Box>
              ))}
              {data.docentes.length === 0 && (
                <Typography variant="body2" color="text.secondary">Sin cátedras asignadas.</Typography>
              )}
            </Stack>
          </SectionPaper>
        </Grid>

        <Grid item xs={12} md={6} lg={4}>
          <SectionPaper title="Preinscripciones">
            <Typography variant="h3" fontWeight={800} gutterBottom>
              {data.preinscripciones.total}
            </Typography>
            <Box display="flex" flexWrap="wrap">{estadoChips}</Box>
            <Divider sx={{ my: 2 }} />
            <Typography variant="subtitle2" gutterBottom>
              Confirmadas recientes
            </Typography>
            <List dense>
              {data.preinscripciones.recientes.map((item) => (
                <ListItem key={item.id} disableGutters sx={{ py: 0 }}>
                  <ListItemText
                    primary={item.alumno}
                    secondary={`${item.codigo}${item.carrera ? ` · ${item.carrera}` : ''}${item.fecha ? ` · ${item.fecha.slice(0, 10)}` : ''}`}
                  />
                </ListItem>
              ))}
              {data.preinscripciones.recientes.length === 0 && (
                <Typography variant="body2" color="text.secondary">Sin confirmaciones registradas.</Typography>
              )}
            </List>
          </SectionPaper>
        </Grid>

        <Grid item xs={12} lg={4}>
          <SectionPaper title="Ventanas y periodos">
            <Stack gap={1}>
              {data.ventanas.map((ventana) => (
                <Box key={ventana.id}>
                  <Typography fontWeight={600}>{ventana.tipo}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {ventana.desde} → {ventana.hasta}
                  </Typography>
                  <Chip
                    label={ventana.estado}
                    size="small"
                    color={ventana.estado === 'Activa' ? 'success' : ventana.estado == 'Pendiente' ? 'info' : 'default'}
                    sx={{ mt: 0.5 }}
                  />
                </Box>
              ))}
              {data.ventanas.length === 0 && (
                <Typography variant="body2" color="text.secondary">Sin ventanas registradas.</Typography>
              )}
            </Stack>
          </SectionPaper>
        </Grid>
      </Grid>

      <Grid container spacing={2}>
        <Grid item xs={12} md={6}>
          <SectionPaper title="Estructura académica">
            <List dense>
              {data.profesorados.map((p) => (
                <ListItem key={p.id} sx={{ py: 0.5 }}>
                  <ListItemText
                    primary={p.nombre}
                    secondary={`Planes: ${p.planes} · Materias: ${p.materias} · Correlativas: ${p.correlativas}`}
                  />
                </ListItem>
              ))}
            </List>
          </SectionPaper>
        </Grid>
        <Grid item xs={12} md={6}>
          <SectionPaper title="Horarios por profesorado">
            <List dense>
              {data.horarios.map((h, idx) => (
                <ListItem key={`${h.profesorado_id}-${idx}`} sx={{ py: 0.5 }}>
                  <ListItemText
                    primary={h.profesorado}
                    secondary={`Año ${h.anio_cursada} · ${h.cantidad} horarios`}
                  />
                </ListItem>
              ))}
              {data.horarios.length === 0 && (
                <Typography variant="body2" color="text.secondary">Sin horarios registrados.</Typography>
              )}
            </List>
          </SectionPaper>
        </Grid>
      </Grid>

      <Grid container spacing={2}>
        <Grid item xs={12} md={6}>
          <SectionPaper title="Pedidos de comisión (pendientes/recientes)">
            <List dense>
              {data.pedidos_comision.map((cambio) => (
                <ListItem key={cambio.id} sx={{ py: 0.5 }}>
                  <ListItemText
                    primary={`${cambio.estudiante} · ${cambio.materia}`}
                    secondary={`Estado: ${cambio.estado}${cambio.comision_solicitada ? ` · Solicitada: ${cambio.comision_solicitada}` : ''}`}
                  />
                </ListItem>
              ))}
              {data.pedidos_comision.length === 0 && (
                <Typography variant="body2" color="text.secondary">No hay cambios de comisión registrados.</Typography>
              )}
            </List>
          </SectionPaper>
        </Grid>
        <Grid item xs={12} md={6}>
          <SectionPaper title="Pedidos de analítico">
            <List dense>
              {data.pedidos_analiticos.map((pedido) => (
                <ListItem key={pedido.id} sx={{ py: 0.5 }}>
                  <ListItemText
                    primary={`${pedido.estudiante} · ${pedido.motivo}`}
                    secondary={`${pedido.fecha.slice(0, 10)}${pedido.profesorado ? ` · ${pedido.profesorado}` : ''}`}
                  />
                </ListItem>
              ))}
              {data.pedidos_analiticos.length === 0 && (
                <Typography variant="body2" color="text.secondary">Sin pedidos registrados.</Typography>
              )}
            </List>
          </SectionPaper>
        </Grid>
      </Grid>

      <Grid container spacing={2}>
        <Grid item xs={12} md={6}>
          <SectionPaper title="Mesas de examen (inscripciones)">
            <Typography variant="h3" fontWeight={800} gutterBottom>
              {data.mesas.total}
            </Typography>
            <Stack direction="row" flexWrap="wrap" gap={1}>
              {data.mesas.por_tipo.map((t) => (
                <Chip key={t.tipo} label={`${t.tipo}: ${t.total}`} size="small" />
              ))}
              {data.mesas.por_tipo.length === 0 && (
                <Typography variant="body2" color="text.secondary">Sin inscripciones activas.</Typography>
              )}
            </Stack>
          </SectionPaper>
        </Grid>
        <Grid item xs={12} md={6}>
          <SectionPaper title="Notas y regularidades recientes">
            <List dense>
              {data.regularidades.map((reg) => (
                <ListItem key={reg.id} sx={{ py: 0.5 }}>
                  <ListItemText
                    primary={`${reg.estudiante} · ${reg.materia}`}
                    secondary={`Situación: ${reg.situacion}${reg.nota ? ` · Nota: ${reg.nota}` : ''} · ${reg.fecha}`}
                  />
                </ListItem>
              ))}
              {data.regularidades.length === 0 && (
                <Typography variant="body2" color="text.secondary">Sin registros recientes.</Typography>
              )}
            </List>
          </SectionPaper>
        </Grid>
      </Grid>
    </Stack>
  );
}
