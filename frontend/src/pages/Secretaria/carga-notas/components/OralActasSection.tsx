import React from "react";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import ActaExamenForm from "@/components/secretaria/ActaExamenForm";
import { MesaResumenDTO } from "@/api/cargaNotas";
import { FinalRowState } from "../types";

interface OralActasSectionProps {
  mesaPreseleccionada?: MesaResumenDTO | null;
  finalRows?: FinalRowState[];
}

const OralActasSection: React.FC<OralActasSectionProps> = ({ mesaPreseleccionada, finalRows }) => {
  const estudiantesPreseleccionados = React.useMemo(
    () =>
      (finalRows ?? []).map((r) => ({
        dni: r.dni,
        apellido_nombre: r.apellidoNombre,
        inscripcionId: r.inscripcionId,
      })),
    [finalRows]
  );

  return (
    <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 } }}>
      <Stack spacing={1.5}>
        <Box>
          <Typography variant="subtitle1" fontWeight={700}>
            Acta de examen manual
          </Typography>
          <Typography color="text.secondary">
            {mesaPreseleccionada
              ? `Datos pre-cargados desde la mesa seleccionada. Completá folio, libro y las calificaciones.`
              : "Generá o actualizá actas finales cargando los datos manualmente. El sistema valida correlatividades, regularidades y ventanas vigentes."}
          </Typography>
        </Box>
        <ActaExamenForm
          strict
          title="Acta de examen"
          subtitle="Ingresá los datos del acta para los estudiantes rendidos."
          successMessage="Acta generada correctamente."
          mesaPreseleccionada={mesaPreseleccionada}
          estudiantesPreseleccionados={estudiantesPreseleccionados}
        />
      </Stack>
    </Paper>
  );
};

export default OralActasSection;
