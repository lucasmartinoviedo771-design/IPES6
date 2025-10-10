import React, { forwardRef } from 'react';
import {
  Box, Paper, Typography, Divider, Grid, Stack, Avatar
} from '@mui/material';

type Valores = {
  // PERSONALES
  nombres: string; apellido: string; dni: string; cuil: string;
  fecha_nacimiento: string; nacionalidad: string; estado_civil: string;
  localidad_nacimiento?: string; provincia_nacimiento?: string; pais_nacimiento?: string;
  domicilio: string;

  // CONTACTO
  email: string; tel_movil?: string; tel_fijo?: string;

  // SECUNDARIOS
  sec_titulo?: string; sec_establecimiento?: string; sec_fecha_egreso?: string;

  // SUPERIORES
  sup_titulo?: string; sup_establecimiento?: string; sup_fecha_egreso?: string;

  // LABORALES
  trabaja?: boolean; empleador?: string; horario_trabajo?: string; domicilio_trabajo?: string;

  // INSCRIPCIÓN
  carrera_id?: number;
};

type Carrera = { id: number; nombre: string };

type Props = {
  values: Valores;
  carreras?: Carrera[];
  fotoPreviewUrl?: string | null;   // preview de la foto que ya mostraste en el paso anterior
  logoUrl?: string;                  // opcional: para poner el escudo arriba a la izquierda
};

const Row = ({ label, value }: { label: string; value?: React.ReactNode }) => (
  <Grid container sx={{ py: 0.5 }} columnSpacing={2}>
    <Grid item xs={5} md={4}>
      <Typography variant="body2" sx={{ color: 'text.secondary' }}>{label}</Typography>
    </Grid>
    <Grid item xs={7} md={8}>
      <Typography variant="body2">{value || '—'}</Typography>
    </Grid>
  </Grid>
);

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <Box sx={{ mb: 2, breakInside: 'avoid' as any }}>
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
      <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>{title}</Typography>
      <Divider sx={{ flex: 1 }} />
    </Box>
    {children}
  </Box>
);

const ConfirmacionDoc = forwardRef<HTMLDivElement, Props>(function ConfirmacionDoc(
  { values, carreras, fotoPreviewUrl, logoUrl }, ref
) {
  const carreraNombre = carreras?.find(c => c.id === values.carrera_id)?.nombre ?? '—';

  return (
    <Box ref={ref} sx={{
      p: 2,
      '@media print': {
        p: 0,
      }
    }}>
      <Paper elevation={0} sx={{ p: 3 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
          <Stack direction="row" alignItems="center" spacing={1}>
            {logoUrl && <Avatar src={logoUrl} variant="rounded" sx={{ width: 40, height: 40 }} />}
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              Preinscripción – IPES Paulo Freire
            </Typography>
          </Stack>

          {fotoPreviewUrl && (
            <Avatar
              src={fotoPreviewUrl}
              variant="rounded"
              sx={{ width: 72, height: 72, border: '1px solid #ddd' }}
            />
          )}
        </Stack>

        {/* Datos personales */}
        <Section title="Datos personales">
          <Row label="Nombres" value={values.nombres} />
          <Row label="Apellido" value={values.apellido} />
          <Row label="DNI" value={values.dni} />
          <Row label="CUIL" value={values.cuil} />
          <Row label="Fecha de nacimiento" value={values.fecha_nacimiento} />
          <Row label="Nacionalidad" value={values.nacionalidad} />
          <Row label="Estado civil" value={values.estado_civil} />
          <Row label="Localidad de nacimiento" value={values.localidad_nacimiento} />
          <Row label="Provincia de nacimiento" value={values.provincia_nacimiento} />
          <Row label="País de nacimiento" value={values.pais_nacimiento} />
          <Row label="Domicilio" value={values.domicilio} />
        </Section>

        {/* Contacto */}
        <Section title="Contacto">
          <Row label="Email" value={values.email} />
          <Row label="Teléfono móvil" value={values.tel_movil} />
          <Row label="Teléfono fijo" value={values.tel_fijo} />
        </Section>

        {/* Secundarios */}
        <Section title="Estudios secundarios">
          <Row label="Título" value={values.sec_titulo} />
          <Row label="Establecimiento" value={values.sec_establecimiento} />
          <Row label="Fecha de egreso" value={values.sec_fecha_egreso} />
        </Section>

        {/* Superiores */}
        <Section title="Estudios superiores">
          <Row label="Título" value={values.sup_titulo} />
          <Row label="Establecimiento" value={values.sup_establecimiento} />
          <Row label="Fecha de egreso" value={values.sup_fecha_egreso} />
        </Section>

        {/* Laborales */}
        <Section title="Datos laborales">
          <Row label="¿Trabaja actualmente?" value={values.trabaja ? 'Sí' : 'No'} />
          <Row label="Empleador" value={values.empleador} />
          <Row label="Horario de trabajo" value={values.horario_trabajo} />
          <Row label="Domicilio de trabajo" value={values.domicilio_trabajo} />
        </Section>

        {/* Inscripción */}
        <Section title="Inscripción">
          <Row label="Carrera" value={carreraNombre} />
        </Section>

        <Box sx={{ mt: 3 }}>
          <Typography variant="caption" color="text.secondary">
            Revise los datos. El PDF se generará con este mismo formato.
          </Typography>
        </Box>
      </Paper>
    </Box>
  );
});

export default ConfirmacionDoc;
