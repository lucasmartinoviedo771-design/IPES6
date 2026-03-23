import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Divider from "@mui/material/Divider";
import Grid from "@mui/material/Grid";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import Typography from "@mui/material/Typography";
import HistoryEduIcon from '@mui/icons-material/HistoryEdu';
import AssignmentTurnedInIcon from '@mui/icons-material/AssignmentTurnedIn';
import InsightsIcon from '@mui/icons-material/Insights';
import EventAvailableIcon from '@mui/icons-material/EventAvailable';
import TableChartIcon from '@mui/icons-material/TableChart';
import RefreshIcon from '@mui/icons-material/Refresh';
import { useQuery } from '@tanstack/react-query';

import {
  obtenerTrayectoriaEstudiante,
  TrayectoriaDTO,
  RegularidadVigenciaDTO,
} from '@/api/estudiantes';
import { CartonTabPanel } from "@/features/estudiantes/carton/CartonTabPanel";
import { PageHero } from "@/components/ui/GradientTitles";
import BackButton from "@/components/ui/BackButton";
import { useAuth } from '@/context/AuthContext';
import { hasAnyRole } from '@/utils/roles';

import { TabPanel } from './trayectoria/TabPanel';
import { a11yProps, formatDate } from './trayectoria/utils';
import EstudianteBuscador from './trayectoria/EstudianteBuscador';
import TabHistorial from './trayectoria/TabHistorial';
import TabMesasYRegularidades from './trayectoria/TabMesasYRegularidades';
import TabRecomendaciones from './trayectoria/TabRecomendaciones';
import TabVigencias from './trayectoria/TabVigencias';

const TrayectoriaPage: React.FC = () => {
  const { user } = (useAuth?.() ?? { user: null }) as any;
  const canGestionar = hasAnyRole(user, ['admin', 'secretaria', 'bedel']);
  const [searchParams] = useSearchParams();
  const dniParam = searchParams.get('dni');
  const [tab, setTab] = useState(0);
  const [dniInput, setDniInput] = useState(dniParam || '');
  const [dniQuery, setDniQuery] = useState(dniParam || '');
  const [selectedPlanId, setSelectedPlanId] = useState<string>('');

  const queryKey = useMemo(() => ['trayectoria', canGestionar ? (dniQuery || '').trim() : 'self'], [canGestionar, dniQuery]);
  const trayectoriaQ = useQuery<TrayectoriaDTO>({
    queryKey,
    queryFn: () => obtenerTrayectoriaEstudiante(canGestionar ? ((dniQuery || '').trim() ? { dni: (dniQuery || '').trim() } : undefined) : undefined),
    enabled: canGestionar ? !!dniQuery : true,
    retry: false,
  });

  const trayectoria = trayectoriaQ.data;
  const eventos = trayectoria?.historial ?? [];
  const regularidades = trayectoria?.regularidades ?? [];
  const planesCarton = trayectoria?.carton ?? [];
  const mesas = trayectoria?.mesas ?? [];

  const vigencias = useMemo<RegularidadVigenciaDTO[]>(() => {
    const list = [...(trayectoria?.regularidades_vigencia ?? [])];
    return list.sort((a, b) => a.vigencia_hasta.localeCompare(b.vigencia_hasta));
  }, [trayectoria?.regularidades_vigencia]);

  const recomendaciones = trayectoria?.recomendaciones;

  useEffect(() => {
    if (!planesCarton.length) {
      setSelectedPlanId('');
      return;
    }
    setSelectedPlanId((prev) => {
      if (prev && planesCarton.some((plan: any) => String(plan.plan_id) === prev)) {
        return prev;
      }
      return String(planesCarton[0].plan_id);
    });
  }, [planesCarton]);

  const carreraChips = useMemo(() => {
    const chips: Array<{ id: string; label: string; detalle: string | null; disabled?: boolean }> = [];
    const usedNombres = new Set<string>();

    planesCarton.forEach((plan: any) => {
      chips.push({
        id: String(plan.plan_id),
        label: plan.profesorado_nombre,
        detalle: plan.plan_resolucion,
      });
      usedNombres.add(plan.profesorado_nombre);
    });

    const nombres = trayectoria?.estudiante?.carreras ?? [];
    nombres.forEach((nombre: string, index: number) => {
      if (usedNombres.has(nombre)) return;
      chips.push({ id: `carrera-${index}`, label: nombre, detalle: null, disabled: true });
    });

    return chips;
  }, [planesCarton, trayectoria?.estudiante?.carreras]);

  const handleBuscar = () => setDniQuery(dniInput.trim());

  const estudiante = trayectoria?.estudiante;

  return (
    <Box sx={{ p: 2 }}>
      <BackButton fallbackPath="/estudiantes" />
      <PageHero
        title="Trayectoria del estudiante"
        subtitle="Historial consolidado de inscripciones, cursadas, mesas y sugerencias de acción."
        actions={
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
        }
      />

      {canGestionar && (
        <EstudianteBuscador
          dniInput={dniInput}
          setDniInput={setDniInput}
          onBuscar={handleBuscar}
          onSelectEstudiante={(dni) => { setDniInput(dni); setDniQuery(dni); }}
        />
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
                {carreraChips.length > 0 ? carreraChips.map((chip) => {
                  const isPlan = !chip.disabled;
                  const isSelected = isPlan && chip.id === selectedPlanId;
                  return (
                    <Chip
                      key={chip.id}
                      label={chip.detalle ? `${chip.label} · Plan ${chip.detalle}` : chip.label}
                      size="small"
                      clickable={isPlan}
                      color={isSelected ? 'primary' : 'default'}
                      variant={isSelected ? 'filled' : 'outlined'}
                      onClick={isPlan ? () => setSelectedPlanId(chip.id) : undefined}
                    />
                  );
                }) : <Typography variant="body2" color="text.secondary">Sin carreras asociadas</Typography>}
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
            <Tab icon={<HistoryEduIcon />} iconPosition="start" label="Historial académico" {...a11yProps(0)} />
            <Tab icon={<TableChartIcon />} iconPosition="start" label="Cartón" {...a11yProps(1)} />
            <Tab icon={<AssignmentTurnedInIcon />} iconPosition="start" label="Mesas y notas" {...a11yProps(2)} />
            <Tab icon={<InsightsIcon />} iconPosition="start" label="Recomendaciones" {...a11yProps(3)} />
            <Tab icon={<EventAvailableIcon />} iconPosition="start" label="Caducidad regularidades" {...a11yProps(4)} />
          </Tabs>
          <Divider />
          <Box sx={{ p: 2 }}>
            <TabPanel value={tab} index={0}>
              <TabHistorial eventos={eventos} />
            </TabPanel>
            <TabPanel value={tab} index={1}>
              {trayectoria && (
                <CartonTabPanel
                  trayectoria={trayectoria}
                  selectedPlanId={selectedPlanId || undefined}
                  onSelectPlan={(value: string) => setSelectedPlanId(value)}
                />
              )}
            </TabPanel>
            <TabPanel value={tab} index={2}>
              <TabMesasYRegularidades regularidades={regularidades} mesas={mesas} />
            </TabPanel>
            <TabPanel value={tab} index={3}>
              <TabRecomendaciones recomendaciones={recomendaciones!} />
            </TabPanel>
            <TabPanel value={tab} index={4}>
              <TabVigencias vigencias={vigencias} />
            </TabPanel>
          </Box>
        </Paper>
      )}

      {trayectoria?.updated_at && (
        <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block' }}>
          Última actualización: {formatDate(trayectoria.updated_at)}
        </Typography>
      )}
    </Box>
  );
};

export default TrayectoriaPage;
