import { useSearchParams, useNavigate } from "react-router-dom";
import { Box, Button, Stack, TextField, Typography, Paper } from "@mui/material";
import PreConfirmEditor from "@/components/preinscripcion/PreConfirmEditor";

export default function ConfirmarInscripcionPage() {
  const [sp, setSp] = useSearchParams();
  const navigate = useNavigate();
  const codigo = sp.get("codigo") || "";

  return (
    <Stack gap={2}>
      <Typography variant="h5" fontWeight={800}>Confirmación de Preinscripción</Typography>

      {!codigo && (
        <Paper sx={{ p:2 }}>
          <Stack direction="row" alignItems="center" gap={1}>
            <TextField
              size="small"
              label="Código PRE-..."
              value={codigo}
              onChange={(e) => setSp({ codigo: e.target.value })}
            />
            <Button variant="contained">Abrir</Button>
            <Button variant="text" onClick={() => navigate("/preinscripciones")}>Volver al listado</Button>
          </Stack>
        </Paper>
      )}

      {codigo && <PreConfirmEditor codigo={codigo} />}
    </Stack>
  );
}