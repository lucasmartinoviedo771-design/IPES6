import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useNavigate } from "react-router-dom";
import { PreinscripcionDTO } from "@/api/preinscripciones";
import { type Carrera } from "@/api/carreras";

interface ProfessoradosSectionProps {
  codigo: string;
  preinscripcionesEstudiante: PreinscripcionDTO[];
  myProfIds: number[];
  availableCarreras: Carrera[];
  isLoading: boolean;
  onAddCarrera: () => void;
}

export default function ProfessoradosSection({
  codigo, preinscripcionesEstudiante, myProfIds, availableCarreras, isLoading, onAddCarrera,
}: ProfessoradosSectionProps) {
  const navigate = useNavigate();
  return (
    <Paper variant="outlined" sx={{ p: 2, border: '1px solid #eee' }}>
      <Typography variant="subtitle1" fontWeight={700} gutterBottom>Profesorados asociados</Typography>
      <Stack spacing={1} mb={2}>
        {isLoading ? (
          <Typography variant="caption">Cargando...</Typography>
        ) : preinscripcionesEstudiante.map((pre) => {
          const activo = pre.codigo === codigo;
          const esMio = myProfIds.includes(pre.carrera?.id);
          return (
            <Button
              key={pre.codigo} size="small" variant={activo ? "contained" : "outlined"}
              color={activo ? (esMio ? "success" : "primary") : "primary"}
              onClick={() => { if (!activo) navigate(`/secretaria/confirmar-inscripcion?codigo=${pre.codigo}`); }}
              sx={{ textAlign: 'left', justifyContent: 'flex-start', borderStyle: esMio ? 'dashed' : 'solid' }}
            >
              {esMio && <Box component="span" sx={{ mr: 1 }}>⭐</Box>}
              {pre.carrera?.nombre} ({pre.codigo})
            </Button>
          );
        })}
      </Stack>
      <Button fullWidth size="small" variant="outlined" onClick={onAddCarrera} disabled={availableCarreras.length === 0}>
        Agregar nuevo profesorado
      </Button>
    </Paper>
  );
}
