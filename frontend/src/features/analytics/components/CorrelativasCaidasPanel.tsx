import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import LinearProgress from "@mui/material/LinearProgress";
import Paper from "@mui/material/Paper";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import { useQuery } from "@tanstack/react-query";
import {
	type CorrelativaCaidaItem,
	getCorrelativasCaidas,
} from "@/api/reportes";
import {
	INSTITUTIONAL_GREEN,
	INSTITUTIONAL_TERRACOTTA,
} from "@/styles/institutionalColors";

/**
 * Estudiantes cursando una materia cuya correlativa dejo de estar aprobada/regular.
 * Migrado desde la pagina /reportes: es un indicador de alerta temprana, por lo que
 * vive junto al resto de la deteccion de riesgo academico.
 */
export default function CorrelativasCaidasPanel({ anio }: { anio?: number }) {
	const { data, isLoading, isError, error } = useQuery<CorrelativaCaidaItem[]>({
		queryKey: ["correlativas-caidas", anio],
		queryFn: () => getCorrelativasCaidas(anio),
	});

	return (
		<Paper sx={{ borderRadius: 2, overflow: "hidden" }}>
			<Box sx={{ backgroundColor: INSTITUTIONAL_TERRACOTTA, p: 2 }}>
				<Typography variant="h6" sx={{ fontWeight: 700, color: "white" }}>
					Correlativas caídas{!isLoading && data ? ` (${data.length})` : ""}
				</Typography>
				<Typography variant="caption" sx={{ color: "rgba(255,255,255,0.9)" }}>
					Estudiantes cursando una materia cuya correlativa dejó de estar aprobada o regular
				</Typography>
			</Box>

			{isLoading ? (
				<Box sx={{ p: 2 }}>
					<LinearProgress />
				</Box>
			) : isError ? (
				<Alert severity="error" sx={{ m: 2 }}>
					No se pudo cargar el listado de correlativas caídas
					{error instanceof Error ? `: ${error.message}` : "."}
				</Alert>
			) : !data || data.length === 0 ? (
				<Box sx={{ p: 3, textAlign: "center" }}>
					<Typography variant="body2" sx={{ color: INSTITUTIONAL_GREEN, fontWeight: 600 }}>
						Sin estudiantes con problemas de correlatividad
					</Typography>
				</Box>
			) : (
				<TableContainer sx={{ maxHeight: 420 }}>
					<Table size="small" stickyHeader>
						<TableHead>
							<TableRow>
								{["DNI", "Apellido y Nombre", "Materia que cursa", "Correlativa caída", "Motivo"].map(
									(h) => (
										<TableCell key={h} sx={{ fontWeight: 700, color: INSTITUTIONAL_GREEN }}>
											{h}
										</TableCell>
									),
								)}
							</TableRow>
						</TableHead>
						<TableBody>
							{data.map((row, i) => (
								<TableRow key={`${row.estudiante_id}-${i}`} hover>
									<TableCell>{row.dni}</TableCell>
									<TableCell>{row.apellido_nombre}</TableCell>
									<TableCell>{row.materia_actual}</TableCell>
									<TableCell sx={{ color: INSTITUTIONAL_TERRACOTTA, fontWeight: 700 }}>
										{row.materia_correlativa}
									</TableCell>
									<TableCell>{row.motivo}</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				</TableContainer>
			)}
		</Paper>
	);
}
