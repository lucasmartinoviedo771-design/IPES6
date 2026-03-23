import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Grid from "@mui/material/Grid";
import IconButton from "@mui/material/IconButton";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import { MateriaRow } from "./types";
import { FORMATO_OPTIONS } from "./utils";

interface MateriasTableProps {
  materias: MateriaRow[];
  datosDeshabilitados: boolean;
  puedeEditar: boolean;
  onMateriaChange: (index: number, field: keyof MateriaRow, value: string) => void;
  onAddMateria: () => void;
  onRemoveMateria: (index: number) => void;
}

export default function MateriasTable({
  materias, datosDeshabilitados, puedeEditar,
  onMateriaChange, onAddMateria, onRemoveMateria,
}: MateriasTableProps) {
  return (
    <Card variant="outlined">
      <CardContent>
        <Stack spacing={1.5}>
          {materias.map((materia, index) => (
            <Grid container spacing={1} alignItems="center" key={`materia-${index}`}>
              <Grid item xs={12} md={5}>
                <TextField
                  label="Nombre del espacio curricular"
                  value={materia.nombre}
                  onChange={(event) => onMateriaChange(index, "nombre", event.target.value)}
                  size="small"
                  fullWidth
                  disabled={datosDeshabilitados || !puedeEditar}
                />
              </Grid>
              <Grid item xs={12} md={3}>
                <TextField
                  select
                  label="Formato / tipo"
                  value={materia.formato}
                  onChange={(event) => onMateriaChange(index, "formato", event.target.value)}
                  size="small"
                  fullWidth
                  disabled={datosDeshabilitados || !puedeEditar}
                >
                  <MenuItem value="">Seleccioná...</MenuItem>
                  {FORMATO_OPTIONS.map((option) => (
                    <MenuItem key={option} value={option}>
                      {option}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid item xs={6} md={2}>
                <TextField
                  label="Año de cursada"
                  value={materia.anio_cursada}
                  onChange={(event) => onMateriaChange(index, "anio_cursada", event.target.value)}
                  size="small"
                  fullWidth
                  disabled={datosDeshabilitados || !puedeEditar}
                />
              </Grid>
              <Grid item xs={4} md={1}>
                <TextField
                  label="Nota"
                  value={materia.nota}
                  onChange={(event) => onMateriaChange(index, "nota", event.target.value)}
                  size="small"
                  fullWidth
                  disabled={datosDeshabilitados || !puedeEditar}
                />
              </Grid>
              <Grid item xs={2} md={1} textAlign="right">
                <IconButton onClick={() => onRemoveMateria(index)} disabled={datosDeshabilitados || !puedeEditar}>
                  <DeleteOutlineIcon fontSize="small" />
                </IconButton>
              </Grid>
            </Grid>
          ))}
          <Button
            variant="text"
            startIcon={<AddIcon />}
            onClick={onAddMateria}
            disabled={datosDeshabilitados || !puedeEditar}
          >
            Agregar fila
          </Button>
        </Stack>
      </CardContent>
    </Card>
  );
}
