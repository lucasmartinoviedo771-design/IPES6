import React from 'react';
import { useNavigate } from 'react-router-dom';
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Grid from "@mui/material/Grid";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

import PersonAdd from '@mui/icons-material/PersonAdd';
import FileCopy from '@mui/icons-material/FileCopy';
import CompareArrows from '@mui/icons-material/CompareArrows';
import HistoryIcon from '@mui/icons-material/History';
import AssignmentLateIcon from '@mui/icons-material/AssignmentLate';

import {
  ICON_GRADIENT,
  INSTITUTIONAL_TERRACOTTA,
  INSTITUTIONAL_TERRACOTTA_DARK,
} from '@/styles/institutionalColors';

type Props = {
  onOpenStudentDialog: () => void;
  onOpenPlanillaDialog: () => void;
  onOpenMesaPandemiaDialog: () => void;
  onOpenDisposicionDialog: () => void;
};

const iconBoxStyles = {
  width: 64,
  height: 64,
  borderRadius: 14,
  background: ICON_GRADIENT,
  color: 'common.white',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  boxShadow: '0 18px 35px rgba(0,0,0,0.15)',
};

const cardStyles = {
  height: '100%',
  borderRadius: 14,
  border: '1px solid rgba(125,127,110,0.25)',
  boxShadow: '0 20px 40px rgba(15,23,42,0.08)',
  backgroundColor: '#fff',
};

const CargaCards: React.FC<Props> = ({
  onOpenStudentDialog,
  onOpenPlanillaDialog,
  onOpenMesaPandemiaDialog,
  onOpenDisposicionDialog,
}) => {
  const navigate = useNavigate();

  return (
    <Grid container spacing={3}>

      {/* ── Carga de Estudiantes ── */}
      <Grid item xs={12} md={6} lg={3}>
        <Card sx={cardStyles}>
          <CardContent sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <Stack spacing={3} sx={{ height: '100%' }}>
              <Box sx={iconBoxStyles}>
                <PersonAdd fontSize="large" />
              </Box>
              <Box>
                <Typography variant="h6" fontWeight={600}>
                  Carga de Estudiantes
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Registre estudiantes sin preinscripción previa completando los datos disponibles.
                </Typography>
              </Box>
              <Button
                variant="contained"
                fullWidth
                sx={{
                  mt: 'auto',
                  borderRadius: 999,
                  backgroundColor: INSTITUTIONAL_TERRACOTTA,
                  '&:hover': { backgroundColor: INSTITUTIONAL_TERRACOTTA_DARK },
                }}
                onClick={onOpenStudentDialog}
              >
                Registrar estudiante
              </Button>
            </Stack>
          </CardContent>
        </Card>
      </Grid>

      {/* ── Regularidades ── */}
      <Grid item xs={12} md={6} lg={3}>
        <Card sx={cardStyles}>
          <CardContent sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <Stack spacing={3} sx={{ height: '100%' }}>
              <Box sx={iconBoxStyles}>
                <FileCopy fontSize="large" />
              </Box>
              <Box>
                <Typography variant="h6" fontWeight={600}>
                  Regularidades
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Registrá regularidades mediante planillas para comisiones o cargas individuales.
                </Typography>
              </Box>
              <Stack spacing={1.5} sx={{ mt: 'auto' }}>
                <Button
                  variant="contained"
                  fullWidth
                  sx={{
                    borderRadius: 999,
                    backgroundColor: INSTITUTIONAL_TERRACOTTA,
                    '&:hover': { backgroundColor: INSTITUTIONAL_TERRACOTTA_DARK },
                  }}
                  onClick={onOpenPlanillaDialog}
                >
                  Registrar Planilla de Regularidad y Promoción Completa
                </Button>
                <Button
                  variant="outlined"
                  fullWidth
                  sx={{
                    borderRadius: 999,
                    borderColor: INSTITUTIONAL_TERRACOTTA,
                    color: INSTITUTIONAL_TERRACOTTA,
                    '&:hover': { borderColor: INSTITUTIONAL_TERRACOTTA_DARK },
                  }}
                  onClick={() => navigate('/admin/primera-carga/historico-regularidad')}
                >
                  Registrar Planilla de Regularidad y Promoción Individual
                </Button>
                <Button
                  variant="text"
                  fullWidth
                  sx={{ borderRadius: 999, color: INSTITUTIONAL_TERRACOTTA }}
                  onClick={() => navigate('/admin/primera-carga/historial-regularidades')}
                >
                  Ver Histórico
                </Button>
              </Stack>
            </Stack>
          </CardContent>
        </Card>
      </Grid>

      {/* ── Actas de Examen Final ── */}
      <Grid item xs={12} md={6} lg={3}>
        <Card sx={cardStyles}>
          <CardContent sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <Stack spacing={3} sx={{ height: '100%' }}>
              <Box sx={iconBoxStyles}>
                <HistoryIcon fontSize="large" />
              </Box>
              <Box>
                <Typography variant="h6" fontWeight={600}>
                  Actas de Examen Final
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Emití actas de exámenes finales y consultá su historial de carga masiva.
                </Typography>
              </Box>
              <Stack spacing={1.5} sx={{ mt: 'auto' }}>
                <Button
                  variant="contained"
                  fullWidth
                  sx={{
                    borderRadius: 999,
                    backgroundColor: INSTITUTIONAL_TERRACOTTA,
                    '&:hover': { backgroundColor: INSTITUTIONAL_TERRACOTTA_DARK },
                  }}
                  onClick={() => navigate('/admin/primera-carga/actas-examen')}
                >
                  Registrar Actas de Examen Final
                </Button>
                <Button
                  variant="text"
                  fullWidth
                  sx={{ borderRadius: 999, color: INSTITUTIONAL_TERRACOTTA }}
                  onClick={() => navigate('/admin/primera-carga/historial-actas')}
                >
                  Ver Historial.
                </Button>
              </Stack>
            </Stack>
          </CardContent>
        </Card>
      </Grid>

      {/* ── Notas de Mesa – Pandemia ── */}
      <Grid item xs={12} md={6} lg={3}>
        <Card sx={cardStyles}>
          <CardContent sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <Stack spacing={3} sx={{ height: '100%' }}>
              <Box
                sx={{
                  ...iconBoxStyles,
                  background: 'linear-gradient(135deg, #b06000 0%, #7a3b00 100%)',
                }}
              >
                <AssignmentLateIcon fontSize="large" />
              </Box>
              <Box>
                <Typography variant="h6" fontWeight={600}>
                  Notas de Mesa — Pandemia
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Cargá notas de mesas tomadas durante el período especial 2020.
                  Folio/Libro se marcan como <strong>PANDEMIA</strong>. Nota aprobatoria: ≥ 6.
                </Typography>
              </Box>
              <Stack spacing={1.5} sx={{ mt: 'auto' }}>
                <Button
                  variant="contained"
                  fullWidth
                  sx={{
                    borderRadius: 999,
                    backgroundColor: '#b06000',
                    '&:hover': { backgroundColor: '#7a3b00' },
                  }}
                  onClick={onOpenMesaPandemiaDialog}
                >
                  Registrar notas de mesa
                </Button>
                <Button
                  variant="text"
                  fullWidth
                  sx={{ borderRadius: 999, color: '#b06000' }}
                  onClick={() => navigate('/admin/primera-carga/historial-mesas-pandemia')}
                >
                  Ver Historial
                </Button>
              </Stack>
            </Stack>
          </CardContent>
        </Card>
      </Grid>

      {/* ── Equivalencias ── */}
      <Grid item xs={12} md={6} lg={3}>
        <Card sx={cardStyles}>
          <CardContent sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <Stack spacing={3} sx={{ height: '100%' }}>
              <Box sx={iconBoxStyles}>
                <CompareArrows fontSize="large" />
              </Box>
              <Box>
                <Typography variant="h6" fontWeight={600}>
                  Equivalencias
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Registrá disposiciones de equivalencia sin validación de correlativas.
                </Typography>
              </Box>
              <Stack spacing={1.5} sx={{ mt: 'auto' }}>
                <Button
                  variant="contained"
                  fullWidth
                  sx={{
                    borderRadius: 999,
                    backgroundColor: INSTITUTIONAL_TERRACOTTA,
                    '&:hover': { backgroundColor: INSTITUTIONAL_TERRACOTTA_DARK },
                  }}
                  onClick={onOpenDisposicionDialog}
                >
                  Registrar Equivalencia
                </Button>
                <Button
                  variant="text"
                  fullWidth
                  sx={{ borderRadius: 999, color: INSTITUTIONAL_TERRACOTTA }}
                  onClick={() => navigate('/admin/primera-carga/historial-equivalencias')}
                >
                  Ver Historial
                </Button>
              </Stack>
            </Stack>
          </CardContent>
        </Card>
      </Grid>

    </Grid>
  );
};

export default CargaCards;
