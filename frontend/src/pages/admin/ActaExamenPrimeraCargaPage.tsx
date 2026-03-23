import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import ActaExamenForm from "@/components/secretaria/ActaExamenForm";
import { fetchRegularidadMetadata } from "@/api/primeraCarga";

const ActaExamenPrimeraCargaPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const editId = searchParams.get("editId") ? Number(searchParams.get("editId")) : undefined;
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
      editId={editId}
      strict={false}
      title={editId ? "Actualización de acta histórica" : "Carga inicial de actas de examen"}
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
