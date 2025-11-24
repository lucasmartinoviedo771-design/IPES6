import ActaExamenForm from "@/components/secretaria/ActaExamenForm";
import BackButton from "@/components/ui/BackButton";
import { Box } from "@mui/material";

const ActaExamenPage: React.FC = () => {
  return (
    <Box sx={{ p: 3 }}>
      <BackButton fallbackPath="/secretaria" sx={{ mb: 2 }} />
      <ActaExamenForm
        strict
        title="Generar acta de examen"
        subtitle="Complete los datos del acta y registre los resultados obtenidos por cada estudiante."
      />
    </Box>
  );
};

export default ActaExamenPage;
