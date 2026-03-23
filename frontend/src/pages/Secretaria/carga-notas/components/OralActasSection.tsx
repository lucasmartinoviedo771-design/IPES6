import React from "react";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import ActaExamenForm from "@/components/secretaria/ActaExamenForm";

const OralActasSection: React.FC = () => {
  return (
    <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 } }}>
      <Stack spacing={1.5}>
        <Box>
          <Typography variant="subtitle1" fontWeight={700}>
            Acta de examen manual
          </Typography>
          <Typography color="text.secondary">
            Generá o actualizá actas finales cargando los datos manualmente. El sistema valida correlatividades, regularidades y ventanas vigentes.
          </Typography>
        </Box>
        <ActaExamenForm
          strict
          title="Acta de examen"
          subtitle="Ingresá los datos del acta para los estudiantes rendidos."
          successMessage="Acta generada correctamente."
        />
      </Stack>
    </Paper>
  );
};

export default OralActasSection;
