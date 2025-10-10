import { Stack, Typography, Paper, TextField, MenuItem, Button } from "@mui/material";
const ROLES = ["preinscripciones","secretaria","admin","consulta"];
export default function AsignarRolPage(){
  return (
    <Stack gap={2}>
      <Typography variant="h5" fontWeight={800}>Asignar Rol</Typography>
      <Paper sx={{ p:2 }}>
        <Stack direction={{ xs:"column", sm:"row" }} gap={1.5}>
          <TextField size="small" label="Usuario (DNI o email)" />
          <TextField size="small" label="Rol" select defaultValue={ROLES[0]} sx={{ minWidth:220 }}>
            {ROLES.map(r => <MenuItem key={r} value={r}>{r}</MenuItem>)}
          </TextField>
          <Button variant="contained">Asignar</Button>
        </Stack>
      </Paper>
    </Stack>
  );
}
