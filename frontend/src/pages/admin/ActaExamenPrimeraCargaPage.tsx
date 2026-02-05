import { useQuery } from "@tanstack/react-query";
import { Box, Button, CircularProgress } from "@mui/material";
import ActaExamenForm from "@/components/secretaria/ActaExamenForm";
import { fetchRegularidadMetadata } from "@/api/primeraCarga";

const ActaExamenPrimeraCargaPage: React.FC = () => {
  const { data: metadata, isLoading } = useQuery({
    queryKey: ["regularidad-metadata"],
    queryFn: () => fetchRegularidadMetadata(false),
  });

  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <ActaExamenForm
      strict={false}
      title="Carga inicial de actas de examen"
      subtitle="Registre rápidamente actas históricas. Algunos controles estrictos se omiten para agilizar la carga inicial."
      successMessage="Acta cargada correctamente."
      initialEstudiantes={metadata?.estudiantes}
      headerAction={
        <Button
          variant="outlined"
          onClick={() => window.open("/admin/primera-carga/historial-actas", "_blank")}
        >
          Ver Historial de Actas
        </Button>
      }
    />
  );
};

export default ActaExamenPrimeraCargaPage;
