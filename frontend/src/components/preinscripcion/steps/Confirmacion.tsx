// src/components/preinscripcion/steps/Confirmacion.tsx
import { useFormContext } from "react-hook-form";
import Button from "@mui/material/Button";
import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import Typography from "@mui/material/Typography";
import Divider from "@mui/material/Divider";
import Checkbox from "@mui/material/Checkbox";
import FormControlLabel from "@mui/material/FormControlLabel";
import { PreinscripcionForm } from "../schema";
import React, { useState } from "react";
import { apiPreviewPdf } from "@/api/preinscripciones";

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

export default function Confirmacion({ carreraNombre, onDownloaded }: { carreraNombre: string; onDownloaded?: () => void }) {
  const { watch } = useFormContext<PreinscripcionForm>();
  const v = watch();

  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownloadPreview = async () => {
    setIsDownloading(true);
    try {
      const blob = await apiPreviewPdf(v);
      const url = window.URL.createObjectURL(new Blob([blob]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Preinscripcion_IPES_2026.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      onDownloaded && onDownloaded();
    } catch (error) {
      console.error("Error downloading PDF:", error);
      alert("Hubo un error al generar el PDF. Por favor, reintente en unos instantes.");
    } finally {
      setIsDownloading(false);
    }
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
        {(v.cud_informado || v.condicion_salud_informada) && (
          <>
            <Divider sx={{ my: 2 }} />
            <Typography variant="h6" sx={{ mb: 2 }}>Accesibilidad y apoyos</Typography>
            {v.cud_informado && <Row label="CUD informado" value="Sí" />}
            {v.condicion_salud_informada && (
              <>
                <Row label="Condición/Asistencia informada" value="Sí" />
                <Row label="Detalle" value={v.condicion_salud_detalle} />
              </>
            )}
          </>
        )}
        <Row
          label="Consentimiento expreso"
          value={v.consentimiento_datos ? "Aceptado" : "Falta aceptar"}
        />

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
        <Row label="Localidad" value={v.sup1_localidad} />
        <Row label="Provincia" value={v.sup1_provincia} />
        <Row label="País" value={v.sup1_pais} />

        <Divider sx={{ my: 2 }} />
        <Typography variant="h6" sx={{ mb: 2 }}>Inscripción</Typography>
        <Row label="Carrera" value={carreraNombre} />

        <Divider sx={{ my: 2 }} />
        <Typography variant="h6" sx={{ mb: 2 }}>Descargue el PDF para continuar</Typography>
        <Typography variant="body2" color="text.secondary">
          
        </Typography>
      </Box>

      <Box sx={{ display: "flex", gap: 2, mt: 2, alignItems: 'center' }}>
        <Button
          variant="contained"
          disabled={isDownloading}
          onClick={handleDownloadPreview}
        >
          {isDownloading ? "Generando..." : "Descargar PDF para Revisión"}
        </Button>
        <Typography variant="body2" color="text.secondary">
          Para finalizar, primero debe descargar el formulario de preinscripción.
        </Typography>
      </Box>
    </Box>
  );
}


