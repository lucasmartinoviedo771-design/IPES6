import ActaExamenForm from "@/components/secretaria/ActaExamenForm";

const ActaExamenPage: React.FC = () => {
  return (
    <ActaExamenForm
      strict
      title="Generar acta de examen"
      subtitle="Complete los datos del acta y registre los resultados obtenidos por cada estudiante."
    />
  );
};

export default ActaExamenPage;
