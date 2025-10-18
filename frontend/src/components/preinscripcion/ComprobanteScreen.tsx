import { Box, CircularProgress, Typography, Button } from "@mui/material";
import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import PrintablePreinscripcion from "./PrintablePreinscripcion";
import { obtenerPreinscripcion } from "@/api/preinscripciones";

export default function ComprobanteScreen() {
  const navigate = useNavigate();
  const { state } = useLocation() as any;
  const params = useParams<{ id: string }>();
  const id = state?.id ?? (params.id ? Number(params.id) : undefined);

  // Valores provenientes del wizard o cargados desde API
  const [values, setValues] = useState<any>(state?.values);

  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ensureValues = async () => {
      // Si no hay valores desde el wizard, intentar obtenerlos desde la API
      if (!values && id) {
        try {
          const pre = await obtenerPreinscripcion(id);
          // Mapear DTO -> valores esperados por PrintablePreinscripcion
          const v = {
            ...pre.datos_extra, // Spread all extra data
            apellido: pre?.alumno?.apellido,
            nombres: pre?.alumno?.nombre,
            dni: pre?.alumno?.dni,
            fecha_nacimiento: pre?.alumno?.fecha_nacimiento,
            domicilio: pre?.alumno?.domicilio,
            email: pre?.alumno?.email,
            tel_movil: pre?.alumno?.telefono,
            carrera_desc: pre?.carrera?.nombre,
          } as any;
          setValues(v);
        } catch (e) {
          navigate("/", { replace: true });
          return;
        }
      }
    };
    ensureValues();
  }, [values, id, navigate]);

  const generatePdf = async () => {

  };

  if (!values) {
    return (
        <Box sx={{p: 4, textAlign: 'center'}}>
            <Typography>Redirigiendo...</Typography>
            <CircularProgress sx={{mt: 2}}/>
        </Box>
    )
  }

  return (
    <Box display="flex" flexDirection="column" alignItems="center" p={2} sx={{bgcolor: '#eee'}}>
      <Button variant="contained" onClick={generatePdf} sx={{mb: 2}}>Descargar Comprobante</Button>
      <Box ref={ref} className="pdf-oficio">
        <PrintablePreinscripcion values={values} id={id} />
      </Box>
    </Box>
  );
}
