// src/components/preinscripcion/steps/Confirmacion.tsx
import { useFormContext } from "react-hook-form";
import { Button, Box, Grid, Typography, Divider, Checkbox, FormControlLabel } from "@mui/material";
import { generarPlanillaPDF, DocsFlags } from "@/utils/pdf"; // <-- importa el helper
import { PreinscripcionForm } from "../schema";
import React, { useEffect, useState } from "react";
import QRCode from "qrcode";

function Row({ label, value }: { label: string; value?: any }) {
  return (
    <Grid container sx={{ mb: 0.5 }}>
      <Grid item xs={5} md={3} sx={{ color: "text.secondary" }}>{label}</Grid>
      <Grid item xs={7} md={9}>{value || "—"}</Grid>
    </Grid>
  );
}

async function imageUrlToDataUrl(url: string): Promise<string> {
  const response = await fetch(url);
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export default function Confirmacion({ carreraNombre }: { carreraNombre: string }) {
  const { watch } = useFormContext<PreinscripcionForm>();
  const v = watch();
  const [docs, setDocs] = React.useState<DocsFlags>({});
  const [logos, setLogos] = useState<{left?: string, right?: string}>({});
  const [qrDataUrl, setQrDataUrl] = useState<string | undefined>();

  useEffect(() => {
    imageUrlToDataUrl("/ipes-logo.jpg").then(logoIpesDataUrl => {
      setLogos({ left: logoIpesDataUrl });
    });

    if (v.dni) {
      QRCode.toDataURL(v.dni).then(setQrDataUrl);
    }
  }, [v.dni]);

  const handleDocChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDocs({ ...docs, [e.target.name]: e.target.checked });
  };

  return (
    <Box>
      {/* Resumen visual en pantalla */}
      <Box sx={{ p: 2 }}>
        <Typography variant="h6" sx={{ mb: 2 }}>Datos personales</Typography>
        <Row label="Nombres" value={v.nombres} />
        <Row label="Apellido" value={v.apellido} />
        <Row label="DNI" value={v.dni} />
        <Row label="CUIL" value={v.cuil} />
        <Row label="Fecha de nacimiento" value={v.fecha_nacimiento} />
        <Row label="Nacionalidad" value={v.nacionalidad} />
        <Row label="Estado civil" value={v.estado_civil} />
        <Row label="Localidad de nacimiento" value={v.localidad_nac} />
        <Row label="Provincia de nacimiento" value={v.provincia_nac} />
        <Row label="País de nacimiento" value={v.pais_nac} />
        <Row label="Domicilio" value={v.domicilio} />

        <Divider sx={{ my: 2 }} />
        <Typography variant="h6" sx={{ mb: 2 }}>Contacto</Typography>
        <Row label="Email" value={v.email} />
        <Row label="Teléfono móvil" value={v.tel_movil} />
        <Row label="Teléfono fijo" value={v.tel_fijo} />
        <Row label="Tel. emergencia" value={v.emergencia_telefono} />
        <Row label="Parentesco emergencia" value={v.emergencia_parentesco} />

        <Divider sx={{ my: 2 }} />
        <Typography variant="h6" sx={{ mb: 2 }}>Estudios secundarios</Typography>
        <Row label="Título" value={v.sec_titulo} />
        <Row label="Establecimiento" value={v.sec_establecimiento} />
        <Row label="Fecha de egreso" value={v.sec_fecha_egreso} />
        <Row label="Localidad" value={v.sec_localidad} />
        <Row label="Provincia" value={v.sec_provincia} />
        <Row label="País" value={v.sec_pais} />

        <Divider sx={{ my: 2 }} />
        <Typography variant="h6" sx={{ mb: 2 }}>Estudios superiores</Typography>
        <Row label="Título" value={v.sup1_titulo} />
        <Row label="Establecimiento" value={v.sup1_establecimiento} />
        <Row label="Fecha de egreso" value={v.sup1_fecha_egreso} />

        <Divider sx={{ my: 2 }} />
        <Typography variant="h6" sx={{ mb: 2 }}>Inscripción</Typography>
        <Row label="Carrera" value={carreraNombre} />

        <Divider sx={{ my: 2 }} />
        <Typography variant="h6" sx={{ mb: 2 }}>Documentación a presentar</Typography>
        <Grid container spacing={1}>
          <Grid item xs={12} md={6}>
            <FormControlLabel control={<Checkbox name="dni" checked={docs.dni} onChange={handleDocChange} />} label="Fotocopia DNI" />
            <FormControlLabel control={<Checkbox name="analitico" checked={docs.analitico} onChange={handleDocChange} />} label="Fotocopia analítico" />
            <FormControlLabel control={<Checkbox name="fotos" checked={docs.fotos} onChange={handleDocChange} />} label="2 fotos 4x4" />
            <FormControlLabel control={<Checkbox name="titulo" checked={docs.titulo} onChange={handleDocChange} />} label="Título secundario" />
          </Grid>
          <Grid item xs={12} md={6}>
            <FormControlLabel control={<Checkbox name="alumnoRegular" checked={docs.alumnoRegular} onChange={handleDocChange} />} label="Cert. alumno regular" />
            <FormControlLabel control={<Checkbox name="tituloTramite" checked={docs.tituloTramite} onChange={handleDocChange} />} label="Cert. título en trámite" />
            <FormControlLabel control={<Checkbox name="salud" checked={docs.salud} onChange={handleDocChange} />} label="Cert. buena salud" />
            <FormControlLabel control={<Checkbox name="folios" checked={docs.folios} onChange={handleDocChange} />} label="3 folios oficio" />
          </Grid>
        </Grid>
      </Box>

      <Box sx={{ display: "flex", gap: 2, mt: 2 }}>
        <Button
          variant="outlined"
          onClick={() => generarPlanillaPDF(v, carreraNombre, { docs, logos, qrDataUrl, studentPhotoDataUrl: v.foto_dataUrl, fotoW: v.fotoW, fotoH: v.fotoH })}
        >
          Descargar PDF
        </Button>
      </Box>
    </Box>
  );
}
