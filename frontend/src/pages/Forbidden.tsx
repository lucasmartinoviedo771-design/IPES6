import { Stack, Typography, Button } from "@mui/material";
import { Link } from "react-router-dom";

export default function Forbidden() {
  return (
    <Stack alignItems="center" mt={10} spacing={2}>
      <Typography variant="h4">403 — No autorizado</Typography>
      <Typography color="text.secondary">
        No tenés permisos para acceder a esta sección.
      </Typography>
      <Button component={Link} to="/" variant="contained">Ir al inicio</Button>
    </Stack>
  );
}