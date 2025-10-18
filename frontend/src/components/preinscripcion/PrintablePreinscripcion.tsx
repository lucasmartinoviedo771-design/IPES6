import React, { forwardRef } from "react";
import { Box, Divider, Grid, Typography } from "@mui/material";
import { QRCodeCanvas } from "qrcode.react";

type Props = {
  values: any;
  id?: number;
};

const Row = ({ label, value }: { label: string; value?: React.ReactNode }) => (
  <Grid container sx={{ mb: 0.75 }}>
    <Grid item xs={3}>
      <Typography sx={{ fontSize: 12, color: "#666" }}>{label}</Typography>
    </Grid>
    <Grid item xs={9}>
      <Typography sx={{ fontSize: 12 }}>{value ?? "-"}</Typography>
    </Grid>
  </Grid>
);

const PrintablePreinscripcion = forwardRef<HTMLDivElement, Props>(
  ({ values, id }, ref) => (
    <Box ref={ref}>
      <Grid container justifyContent="space-between" alignItems="flex-start">
        {/* Encabezado */}
        <Grid item>
          <Grid container alignItems="center" sx={{ mb: 2 }}>
            <Grid item>
              <Box
                component="img"
                src="/ipes-logo.jpg"
                alt="IPES Paulo Freire"
                sx={{ width: 28, height: 28, mr: 1 }}
                crossOrigin="anonymous"
              />
            </Grid>
            <Grid item>
              <Typography sx={{ fontSize: 16, fontWeight: 700 }}>
                IPES Paulo Freire
              </Typography>
              <Typography sx={{ fontSize: 11, color: "#666" }}>
                Preinscripción a Carreras
              </Typography>
            </Grid>
          </Grid>
        </Grid>

        {/* QR superior */}
        <Grid item>
          {values?.dni && <QRCodeCanvas value={`DNI ${values.dni}`} size={80} />}
        </Grid>
      </Grid>

      <Divider sx={{ mb: 2 }} />

      {/* Datos personales */}
      <Grid container spacing={2}>
        <Grid item xs={9}>
          <Typography sx={{ fontWeight: 700, fontSize: 13, mb: 1 }}>
            Datos personales
          </Typography>
          <Grid container columnSpacing={4}>
            <Grid item xs={6}>
              <Row label="Nombres" value={values.nombres} />
              <Row label="DNI" value={values.dni} />
              <Row label="Fecha de nacimiento" value={values.fecha_nacimiento} />
              <Row label="Estado civil" value={values.estado_civil} />
              <Row label="Domicilio" value={values.domicilio} />
            </Grid>
            <Grid item xs={6}>
              <Row label="Apellido" value={values.apellido} />
              <Row label="CUIL" value={values.cuil} />
              <Row label="Nacionalidad" value={values.pais_nac} />
              <Row label="Localidad de nacimiento" value={values.localidad_nac} />
            </Grid>
          </Grid>
        </Grid>
        {values.foto_dataUrl && (
          <Grid item xs={3} sx={{ textAlign: "right" }}>
            <Box
              component="img"
              src={values.foto_dataUrl}
              alt="Foto del estudiante"
              sx={{
                width: 100,
                height: 100,
                border: "1px solid #ccc",
                objectFit: "cover",
              }}
              crossOrigin="anonymous"
            />
          </Grid>
        )}
      </Grid>

      <Box sx={{ height: 10 }} />

      {/* Contacto */}
      <Typography sx={{ fontWeight: 700, fontSize: 13, mb: 1 }}>
        Contacto
      </Typography>
      <Grid container columnSpacing={4}>
        <Grid item xs={6}>
          <Row label="Email" value={values.email} />
        </Grid>
        <Grid item xs={6}>
          <Row label="Teléfono móvil" value={values.tel_movil} />
        </Grid>
      </Grid>

      <Box sx={{ height: 10 }} />

      {/* Estudios Secundarios */}
      <Typography sx={{ fontWeight: 700, fontSize: 13, mb: 1 }}>
        Estudios secundarios
      </Typography>
      <Grid container columnSpacing={4}>
        <Grid item xs={6}>
          <Row label="Título" value={values.sec_titulo} />
          <Row label="Establecimiento" value={values.sec_establecimiento} />
        </Grid>
        <Grid item xs={6}>
          <Row label="Fecha de egreso" value={values.sec_fecha_egreso} />
        </Grid>
      </Grid>

      <Box sx={{ height: 10 }} />

      {/* Inscripción */}
      <Typography sx={{ fontWeight: 700, fontSize: 13, mb: 1 }}>
        Inscripción
      </Typography>
      <Row label="Carrera" value={values.carrera_desc} />

      {/* QR inferior */}
      <Box sx={{ mt: 4, display: 'flex', justifyContent: 'flex-end' }}>
        {id && <QRCodeCanvas value={`ID PRE-${id}`} size={80} />}
      </Box>

    </Box>
  )
);

PrintablePreinscripcion.displayName = "PrintablePreinscripcion";
export default PrintablePreinscripcion;
