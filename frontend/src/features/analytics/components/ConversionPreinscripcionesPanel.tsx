import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import LinearProgress from "@mui/material/LinearProgress";
import Paper from "@mui/material/Paper";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import { useQuery } from "@tanstack/react-query";
import { obtenerResumenInscripciones } from "@/api/metrics";
import {
	INSTITUTIONAL_GREEN,
	INSTITUTIONAL_TERRACOTTA,
} from "@/styles/institutionalColors";

/**
 * Cuantas preinscripciones terminaron confirmandose, por profesorado.
 * Migrado desde /reportes: es el unico dato de esa pagina que el dashboard
 * no tenia (aca ya se mostraba el total, pero no la conversion).
 */
export default function ConversionPreinscripcionesPanel() {
	const { data, isLoading, isError } = useQuery({
		queryKey: ["resumenInscripcionesPorProfesorado"],
		queryFn: obtenerResumenInscripciones,
	});

	return (
		<Paper sx={{ borderRadius: 2, overflow: "hidden" }}>
			<Box sx={{ backgroundColor: INSTITUTIONAL_GREEN, p: 2 }}>
				<Typography variant="h6" sx={{ fontWeight: 700, color: "white" }}>
					Conversión de preinscripciones
				</Typography>
				<Typography variant="caption" sx={{ color: "rgba(255,255,255,0.9)" }}>
					Cuántas preinscripciones terminaron confirmándose, por profesorado
				</Typography>
			</Box>

			{isLoading ? (
				<Box sx={{ p: 2 }}>
					<LinearProgress />
				</Box>
			) : isError ? (
				<Alert severity="error" sx={{ m: 2 }}>
					No se pudo cargar la conversión de preinscripciones.
				</Alert>
			) : !data || data.length === 0 ? (
				<Box sx={{ p: 2 }}>
					<Typography variant="body2" color="textSecondary">
						Sin datos disponibles
					</Typography>
				</Box>
			) : (
				<Box sx={{ overflow: "auto" }}>
					<Table size="small">
						<TableHead>
							<TableRow>
								<TableCell sx={{ fontWeight: 700, color: INSTITUTIONAL_GREEN }}>
									Profesorado
								</TableCell>
								<TableCell align="right" sx={{ fontWeight: 700, color: INSTITUTIONAL_GREEN }}>
									Preinscriptos
								</TableCell>
								<TableCell align="right" sx={{ fontWeight: 700, color: INSTITUTIONAL_GREEN }}>
									Confirmados
								</TableCell>
								<TableCell align="right" sx={{ fontWeight: 700, color: INSTITUTIONAL_GREEN }}>
									Conversión
								</TableCell>
							</TableRow>
						</TableHead>
						<TableBody>
							{data.map((r) => (
								<TableRow key={r.profesorado} hover>
									<TableCell>{r.profesorado}</TableCell>
									<TableCell align="right">{r.total_preinscripciones}</TableCell>
									<TableCell align="right">{r.total_confirmadas}</TableCell>
									<TableCell
										align="right"
										sx={{
											fontWeight: 700,
											color:
												r.tasa_conversion >= 50
													? INSTITUTIONAL_GREEN
													: INSTITUTIONAL_TERRACOTTA,
										}}
									>
										{r.tasa_conversion.toFixed(1)}%
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				</Box>
			)}
		</Paper>
	);
}
