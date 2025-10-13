import React from 'react';
import { Box, Tabs, Tab, Typography, Stack, Paper, Grid, List, ListItem, ListItemIcon, ListItemText, Divider, Alert } from '@mui/material';
import HistoryEduIcon from '@mui/icons-material/HistoryEdu';
import AssignmentTurnedInIcon from '@mui/icons-material/AssignmentTurnedIn';
import InsightsIcon from '@mui/icons-material/Insights';

function a11yProps(index: number) {
  return {
    id: `trayectoria-tab-${index}`,
    'aria-controls': `trayectoria-panel-${index}`,
  };
}

function TabPanel({ children, value, index }: { children: React.ReactNode; value: number; index: number }) {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`trayectoria-panel-${index}`}
      aria-labelledby={`trayectoria-tab-${index}`}
    >
      {value === index && <Box sx={{ pt: 2 }}>{children}</Box>}
    </div>
  );
}

export default function TrayectoriaPage() {
  const [tab, setTab] = React.useState(0);

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h5" fontWeight={800}>Trayectoria del Estudiante</Typography>
      <Typography variant="body2" color="text.secondary">Panel dedicado: historial, mesas/notas y recomendaciones</Typography>

      <Paper elevation={0} sx={{ mt: 2, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="scrollable" scrollButtons allowScrollButtonsMobile>
          <Tab icon={<HistoryEduIcon />} iconPosition="start" label="Historial académico" {...a11yProps(0)} />
          <Tab icon={<AssignmentTurnedInIcon />} iconPosition="start" label="Mesas y notas (Cartón)" {...a11yProps(1)} />
          <Tab icon={<InsightsIcon />} iconPosition="start" label="Recomendaciones de inscripción" {...a11yProps(2)} />
        </Tabs>

        <Divider />

        <Box sx={{ p: 2 }}>
          {/* Historial académico */}
          <TabPanel value={tab} index={0}>
            <Stack gap={2}>
              <Alert severity="info">
                Carga inicial: Puede haber movimientos previos (2016–2024) ingresados con fecha reciente debido a migración. El historial los mostrará como parte de la trayectoria.
              </Alert>
              <Paper elevation={0} sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
                <Typography variant="subtitle1" fontWeight={700}>Actividad completa</Typography>
                <Typography variant="body2" color="text.secondary">Inscripciones, bajas, cambios, regularidades, mesas, notas y trámites desde el alta</Typography>
                <Divider sx={{ my: 2 }} />
                <Typography variant="body2" color="text.secondary">Placeholder: aquí irá una tabla cronológica filtrable y exportable.</Typography>
              </Paper>
            </Stack>
          </TabPanel>

          {/* Mesas y notas (Cartón) */}
          <TabPanel value={tab} index={1}>
            <Stack gap={2}>
              <Paper elevation={0} sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
                <Typography variant="subtitle1" fontWeight={700}>Datos del estudiante</Typography>
                <Typography variant="body2" color="text.secondary">Nombre, DNI, carrera/plan activo, cohorte, situación académica</Typography>
              </Paper>
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <Paper elevation={0} sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
                    <Typography variant="subtitle1" fontWeight={700}>Regularidades</Typography>
                    <List>
                      <ListItem>
                        <ListItemText primary="Placeholder" secondary="Listado de regularizaciones por materia y periodo" />
                      </ListItem>
                    </List>
                  </Paper>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Paper elevation={0} sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
                    <Typography variant="subtitle1" fontWeight={700}>Mesas de examen</Typography>
                    <List>
                      <ListItem>
                        <ListItemText primary="Placeholder" secondary="Inscripciones y resultados de mesas (parcial/final/libre)" />
                      </ListItem>
                    </List>
                  </Paper>
                </Grid>
                <Grid item xs={12}>
                  <Paper elevation={0} sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
                    <Typography variant="subtitle1" fontWeight={700}>Notas finales (Cartón)</Typography>
                    <Typography variant="body2" color="text.secondary">Resumen por materia: condición, fecha, nota, acta</Typography>
                    <Divider sx={{ my: 2 }} />
                    <Typography variant="body2" color="text.secondary">Placeholder: tabla con exportación a PDF/CSV.</Typography>
                  </Paper>
                </Grid>
              </Grid>
            </Stack>
          </TabPanel>

          {/* Recomendaciones de inscripción */}
          <TabPanel value={tab} index={2}>
            <Stack gap={2}>
              <Alert severity="warning">
                Placeholder de reglas: se validarán correlatividades, regularidades vigentes y superposiciones horarias.
              </Alert>
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <Paper elevation={0} sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
                    <Typography variant="subtitle1" fontWeight={700}>Materias sugeridas para cursar</Typography>
                    <Typography variant="body2" color="text.secondary">Según plan y correlatividades cumplidas</Typography>
                    <Divider sx={{ my: 2 }} />
                    <List>
                      <ListItem>
                        <ListItemText primary="Placeholder" secondary="Listado con advertencias por choque horario" />
                      </ListItem>
                    </List>
                  </Paper>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Paper elevation={0} sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
                    <Typography variant="subtitle1" fontWeight={700}>Finales habilitados</Typography>
                    <Typography variant="body2" color="text.secondary">Materias con condición de final vigente</Typography>
                    <Divider sx={{ my: 2 }} />
                    <List>
                      <ListItem>
                        <ListItemText primary="Placeholder" secondary="Listado con enlaces a mesas cuando existan" />
                      </ListItem>
                    </List>
                  </Paper>
                </Grid>
              </Grid>
            </Stack>
          </TabPanel>
        </Box>
      </Paper>
    </Box>
  );
}

