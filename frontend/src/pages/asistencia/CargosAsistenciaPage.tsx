import React from "react";
import { Box, Typography } from "@mui/material";
import { PageHero } from "@/components/ui/GradientTitles";

const CargosAsistenciaPage: React.FC = () => {
	return (
		<Box sx={{ pb: 8 }}>
			<PageHero
				title="Asistencia de Cargos"
				subtitle="Reportes y planilla de asistencia para cargos institucionales"
			/>
			<Box sx={{ maxWidth: 1200, mx: "auto", px: 2, mt: 4 }}>
				<Typography variant="body1">
					Página en construcción. Aquí se visualizarán los reportes de asistencia específicos de cargos.
				</Typography>
			</Box>
		</Box>
	);
};

export default CargosAsistenciaPage;
