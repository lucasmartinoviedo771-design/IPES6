import { Box, Chip, FormControlLabel, Switch, Tooltip } from "@mui/material";
import ScienceIcon from "@mui/icons-material/Science";
import { useTestMode } from "@/context/TestModeContext";

export default function TestModeToggle() {
  const { enabled, toggle } = useTestMode();

  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
      <Chip
        icon={<ScienceIcon fontSize="small" />}
        label={enabled ? "Modo prueba activo" : "Modo prueba off"}
        color={enabled ? "warning" : "default"}
        variant={enabled ? "filled" : "outlined"}
        size="small"
      />
      <Tooltip title="Activa ventanas simuladas para pruebas sin tocar la base de datos.">
        <FormControlLabel
          control={<Switch size="small" checked={enabled} onChange={toggle} color="warning" />}
          label=""
          sx={{ m: 0 }}
        />
      </Tooltip>
    </Box>
  );
}
