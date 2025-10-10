import { Box, CircularProgress, Typography } from "@mui/material";
import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import PrintablePreinscripcion from "./PrintablePreinscripcion";

export default function ComprobanteScreen() {
  const navigate = useNavigate();
  const { state } = useLocation() as any;
  const values = state?.values;
  const id = state?.id;

  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!values) {
      navigate("/", { replace: true });
      return;
    }

    const generatePdf = async () => {
      const el = ref.current!;
      // Add a small delay to ensure images and QR codes have rendered
      await new Promise(resolve => setTimeout(resolve, 500));

      const canvas = await html2canvas(el, {
        scale: 2,
        backgroundColor: "#fff",
        useCORS: true,
        allowTaint: true,
      });
      const img = canvas.toDataURL("image/jpeg", 1.0);

      const w = 216;
      const h = 340;
      const pdf = new jsPDF({ orientation: "p", unit: "mm", format: [h, w] });

      const imgW = w;
      const imgH = (canvas.height / canvas.width) * imgW;
      pdf.addImage(img, "JPEG", 0, 0, imgW, imgH);

      pdf.save(`preinscripcion_${values?.dni ?? id}.pdf`);

      navigate("/", { replace: true });
    };

    generatePdf();
  }, [values, navigate, id]);

  if (!values) {
    return (
        <Box sx={{p: 4, textAlign: 'center'}}>
            <Typography>Redirigiendo...</Typography>
            <CircularProgress sx={{mt: 2}}/>
        </Box>
    )
  }

  return (
    <Box display="flex" justifyContent="center" p={2} sx={{bgcolor: '#eee'}}>
      <Box ref={ref} className="pdf-oficio">
        <PrintablePreinscripcion values={values} id={id} />
      </Box>
    </Box>
  );
}
