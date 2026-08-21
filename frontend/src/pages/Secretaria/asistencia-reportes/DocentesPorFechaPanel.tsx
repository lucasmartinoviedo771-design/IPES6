import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import dayjs from "dayjs";

import { fetchReporteDiarioDocentes } from "@/api/asistencia";

export const DocentesPorFechaPanel: React.FC = () => {
	const [fechaSeleccionada, setFechaSeleccionada] = useState<string>(
		dayjs().format("YYYY-MM-DD")
	);

	const { data: reporteDiario, isLoading } = useQuery({
		queryKey: ["reporte-diario-docentes", fechaSeleccionada],
		queryFn: () => fetchReporteDiarioDocentes(fechaSeleccionada),
		enabled: !!fechaSeleccionada,
	});

	return (
		<Paper sx={{ p: 3, display: "flex", flexDirection: "column", gap: 3 }}>
			<Box>
				<Typography variant="h6" gutterBottom>
					Asistencia Docente Diaria
				</Typography>
				<Typography variant="body2" color="text.secondary" gutterBottom>
					Seleccione una fecha para ver todos los docentes que tienen clases o
					cargos programados.
				</Typography>
			</Box>

			<Box sx={{ maxWidth: 250 }}>
				<TextField
					label="Fecha"
					type="date"
					value={fechaSeleccionada}
					onChange={(e) => setFechaSeleccionada(e.target.value)}
					fullWidth
					InputLabelProps={{ shrink: true }}
					size="small"
				/>
			</Box>

			{isLoading ? (
				<Box display="flex" justifyContent="center" p={3}>
					<CircularProgress />
				</Box>
			) : (
				<TableContainer variant="outlined" component={Paper}>
					<Table size="small">
						<TableHead>
							<TableRow sx={{ backgroundColor: "action.hover" }}>
								<TableCell sx={{ fontWeight: 700 }}>Docente</TableCell>
								<TableCell sx={{ fontWeight: 700 }}>Tipo</TableCell>
								<TableCell sx={{ fontWeight: 700 }}>Asignatura / Cargo</TableCell>
								<TableCell sx={{ fontWeight: 700 }}>Comisión / Código</TableCell>
								<TableCell sx={{ fontWeight: 700 }}>Horario</TableCell>
								<TableCell sx={{ fontWeight: 700 }} align="center">Estado</TableCell>
							</TableRow>
						</TableHead>
						<TableBody>
							{!reporteDiario || reporteDiario.length === 0 ? (
								<TableRow>
									<TableCell colSpan={6} align="center">
										No hay clases ni cargos programados para esta fecha.
									</TableCell>
								</TableRow>
							) : (
								reporteDiario.map((item, idx) => (
									<TableRow
										key={`${item.docente_id}-${idx}`}
										hover
										sx={{
											bgcolor: item.es_cargo ? "rgba(255, 247, 237, 0.5)" : "inherit",
										}}
									>
										<TableCell>
											<Typography variant="body2" fontWeight={600}>
												{item.docente_nombre}
											</Typography>
											<Typography variant="caption" color="text.secondary">
												DNI: {item.docente_dni}
											</Typography>
										</TableCell>
										<TableCell>
											{item.es_cargo ? (
												<Chip
													size="small"
													label="CARGO"
													sx={{
														bgcolor: "#ea580c",
														color: "#fff",
														fontWeight: 700,
														fontSize: "0.72rem",
													}}
												/>
											) : (
												<Chip
													size="small"
													label="CÁTEDRA"
													color="primary"
													variant="outlined"
													sx={{ fontWeight: 700, fontSize: "0.72rem" }}
												/>
											)}
										</TableCell>
										<TableCell>
											<Typography variant="body2" fontWeight={600}>
												{item.materia_o_cargo}
											</Typography>
										</TableCell>
										<TableCell>
											<Typography variant="body2" color="text.secondary">
												{item.comision || "-"}
											</Typography>
										</TableCell>
										<TableCell>
											<Typography variant="body2">{item.horario}</Typography>
										</TableCell>
										<TableCell align="center">
											<Typography
												variant="body2"
												fontWeight="bold"
												color={
													item.estado === "Presente"
														? "success.main"
														: item.estado === "Ausente"
															? "error.main"
															: "warning.main"
												}
											>
												{item.estado}
											</Typography>
											{item.registrado_en && (
												<Typography variant="caption" display="block">
													{item.registrado_en}
												</Typography>
											)}
										</TableCell>
									</TableRow>
								))
							)}
						</TableBody>
					</Table>
				</TableContainer>
			)}
		</Paper>
	);
};
