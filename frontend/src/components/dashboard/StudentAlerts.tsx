import Alert from "@mui/material/Alert";
import AlertTitle from "@mui/material/AlertTitle";
import Box from "@mui/material/Box";
import Collapse from "@mui/material/Collapse";
import Stack from "@mui/material/Stack";
import { useEffect, useState } from "react";
import { type CorrelativaCaidaItem, getMisAlertas } from "@/api/reportes";

export default function StudentAlerts() {
	const [alerts, setAlerts] = useState<CorrelativaCaidaItem[]>([]);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		const fetchAlerts = async () => {
			try {
				const data = await getMisAlertas();
				setAlerts(data);
			} catch (_err) {
				void 0;
			} finally {
				setLoading(false);
			}
		};
		fetchAlerts();
	}, []);

	if (loading || alerts.length === 0) {
		return null;
	}

	return (
		<Box sx={{ mb: 3 }}>
			<Stack spacing={2}>
				{alerts.map((alert, index) => (
					<Collapse in={true} key={index}>
						<Alert severity="warning" variant="filled" sx={{ borderRadius: 2 }}>
							<AlertTitle>Atención: Problema de Correlatividad</AlertTitle>
							Estás cursando <strong>{alert.materia_actual}</strong> pero tenés
							pendiente <strong>{alert.materia_correlativa}</strong>.
							<br />
							Motivo: {alert.motivo}.
						</Alert>
					</Collapse>
				))}
			</Stack>
		</Box>
	);
}
