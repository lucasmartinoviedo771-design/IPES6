import ActaExamenForm from "@/components/secretaria/ActaExamenForm";

const ActaExamenPrimeraCargaPage: React.FC = () => {
  return (
    <ActaExamenForm
      strict={false}
      title="Carga inicial de actas de examen"
      subtitle="Registre rápidamente actas históricas. Algunos controles estrictos se omiten para agilizar la carga inicial."
      successMessage="Acta cargada correctamente."
    />
  );
};

export default ActaExamenPrimeraCargaPage;
