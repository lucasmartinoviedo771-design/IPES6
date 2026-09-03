import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import FormControl from "@mui/material/FormControl";
import Grid from "@mui/material/Grid";
import InputLabel from "@mui/material/InputLabel";
import LinearProgress from "@mui/material/LinearProgress";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Select from "@mui/material/Select";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { useState } from "react";
import {
	Bar,
	BarChart,
	Cell,
	ResponsiveContainer,
	Tooltip as RechartsTooltip,
	XAxis,
	YAxis,
} from "recharts";
import { useCarreras } from "@/hooks/useCarreras";
import {
	useTeacherAttendanceByWeekday,
	useTeacherAttendanceSummary,
	useTeachersDesgranamiento,
} from "../hooks/useAnalytics";

interface TabDocentesProps {
	anio: number;
	profesoradoId?: number;
	onAnioChange: (anio: number) => void;
	onProfesoradoChange: (profesoradoId?: number) => void;
}

export default function TabDocentes({
	anio,
	profesoradoId,
	onAnioChange,
	onProfesoradoChange,
}: TabDocentesProps) {
	const [docenteId] = useState<number | undefined>(undefined);
	const { data: carreras } = useCarreras();

	const { data: attendance, isLoading: loadingAttendance } =
		useTeacherAttendanceSummary({
			anio,
			docente_id: docenteId,
		});

	const { data: weekdayData, isLoading: loadingWeekday } =
		useTeacherAttendanceByWeekday({
			anio,
			docente_id: docenteId,
		});

	const { data: desgranamiento, isLoading: loadingDesgranamiento } =
		useTeachersDesgranamiento({
			anio,
			profesorado_id: profesoradoId,
		});

	const presentismo = attendance?.porcentaje_asistencia ?? 0;

	return (
		<Stack spacing={3}>
			{/* Aclaración metodológica obligatoria */}
			<Alert
				severity="info"
				sx={{
					borderRadius: 2,
					backgroundColor: "#f8fafc",
					border: "1px solid #cbd5e1",
					"& .MuiAlert-icon": { color: "#0284c7" },
				}}
			>
				<Typography variant="subtitle2" fontWeight={700} color="#0f172a">
					Aviso Metodológico Institucional
				</Typography>
				<Typography variant="body2" color="#334155" mt={0.5}>
					La <strong>Tasa de Desgranamiento por Cátedra</strong> refleja el porcentaje de alumnos que no
					continuaron la cursada regular (Libre por Inasistencias o Abandono Temprano). No debe interpretarse
					como una evaluación causal directa del desempeño docente, ya que intervienen variables determinantes como el año de cursada (alto desgranamiento estructural en 1° año), correlatividades y licencias o suplencias transitorias. Solo se calculan tasas para comisiones con un mínimo de 15 alumnos inscriptos.
				</Typography>
			</Alert>

			{/* Filtros */}
			<Paper
				elevation={0}
				sx={{
					p: 2.5,
					borderRadius: 3,
					border: "1px solid #e2e8f0",
					backgroundColor: "#fff",
				}}
			>
				<Grid container spacing={2} alignItems="center">
					<Grid item xs={12} sm={4} md={3}>
						<FormControl fullWidth size="small">
							<InputLabel id="doc-anio-label">Ciclo Lectivo</InputLabel>
							<Select
								labelId="doc-anio-label"
								value={anio}
								label="Ciclo Lectivo"
								onChange={(e) => onAnioChange(Number(e.target.value))}
							>
								{[2026, 2025, 2024, 2023, 2022].map((y) => (
									<MenuItem key={y} value={y}>
										Año {y}
									</MenuItem>
								))}
							</Select>
						</FormControl>
					</Grid>

					<Grid item xs={12} sm={8} md={6}>
						<FormControl fullWidth size="small">
							<InputLabel id="doc-carrera-label">Carrera / Profesorado</InputLabel>
							<Select
								labelId="doc-carrera-label"
								value={profesoradoId || ""}
								label="Carrera / Profesorado"
								onChange={(e) =>
									onProfesoradoChange(
										e.target.value ? Number(e.target.value) : undefined,
									)
								}
							>
								<MenuItem value="">Todas las carreras</MenuItem>
								{(carreras || []).map((c) => (
									<MenuItem key={c.id} value={c.id}>
										{c.nombre}
									</MenuItem>
								))}
							</Select>
						</FormControl>
					</Grid>
				</Grid>
			</Paper>

			{/* Módulo 1: Asistencia y Patrón de Ausencias */}
			<Grid container spacing={3}>
				{/* Tarjeta de Asistencia Anual */}
				<Grid item xs={12} md={5}>
					<Paper
						elevation={0}
						sx={{
							p: 3,
							borderRadius: 3,
							border: "1px solid #e2e8f0",
							height: 380,
							display: "flex",
							flexDirection: "column",
							justifyContent: "space-between",
						}}
					>
						<Box>
							<Typography variant="h6" fontWeight={700} color="#1e293b">
								Presentismo Docente Anual
							</Typography>
							<Typography variant="body2" color="#64748b" mb={3}>
								Registro institucional de asistencias sobre clases programadas
							</Typography>

							{loadingAttendance ? (
								<Skeleton variant="rectangular" height={80} />
							) : (
								<Box>
									<Stack direction="row" alignItems="baseline" spacing={1}>
										<Typography variant="h3" fontWeight={800} color={presentismo >= 80 ? "#15803d" : "#b45309"}>
											{presentismo}%
										</Typography>
										<Typography variant="body2" color="#64748b">
											tasa global de asistencia
										</Typography>
									</Stack>

									<LinearProgress
										variant="determinate"
										value={Math.min(presentismo, 100)}
										sx={{
											mt: 2,
											mb: 3,
											height: 10,
											borderRadius: 5,
											backgroundColor: "#e2e8f0",
											"& .MuiLinearProgress-bar": {
												backgroundColor: presentismo >= 80 ? "#16a34a" : "#eab308",
											},
										}}
									/>

									<Grid container spacing={1.5}>
										<Grid item xs={6}>
											<Card elevation={0} sx={{ bgcolor: "#f8fafc", border: "1px solid #e2e8f0" }}>
												<CardContent sx={{ p: 1.5, "&:last-child": { pb: 1.5 } }}>
													<Typography variant="caption" color="#64748b" fontWeight={600}>
														CLASES PRESENTES
													</Typography>
													<Typography variant="h6" fontWeight={700} color="#15803d">
														{attendance?.presentes ?? 0}
													</Typography>
												</CardContent>
											</Card>
										</Grid>
										<Grid item xs={6}>
											<Card elevation={0} sx={{ bgcolor: "#f8fafc", border: "1px solid #e2e8f0" }}>
												<CardContent sx={{ p: 1.5, "&:last-child": { pb: 1.5 } }}>
													<Typography variant="caption" color="#64748b" fontWeight={600}>
														INASISTENCIAS
													</Typography>
													<Typography variant="h6" fontWeight={700} color="#dc2626">
														{attendance?.ausentes ?? 0}
													</Typography>
												</CardContent>
											</Card>
										</Grid>
									</Grid>
								</Box>
							)}
						</Box>

						<Typography variant="caption" color="#94a3b8">
							Total de clases registradas en el ciclo: {attendance?.total_registros ?? 0}
						</Typography>
					</Paper>
				</Grid>

				{/* Patrón de Ausencias por Día de la Semana */}
				<Grid item xs={12} md={7}>
					<Paper
						elevation={0}
						sx={{
							p: 3,
							borderRadius: 3,
							border: "1px solid #e2e8f0",
							height: 380,
							display: "flex",
							flexDirection: "column",
						}}
					>
						<Typography variant="h6" fontWeight={700} color="#1e293b">
							Patrón de Ausencias por Día de la Semana
						</Typography>
						<Typography variant="body2" color="#64748b" mb={2}>
							Distribución de inasistencias docentes según día (lunes a viernes)
						</Typography>

						{loadingWeekday ? (
							<Skeleton variant="rectangular" height={260} sx={{ borderRadius: 2 }} />
						) : !weekdayData || weekdayData.length === 0 ? (
							<Box m="auto" textAlign="center">
								<Typography color="#94a3b8">No hay registros de ausencias para graficar</Typography>
							</Box>
						) : (
							<ResponsiveContainer width="100%" height="100%">
								<BarChart data={weekdayData}>
									<XAxis dataKey="dia_nombre" tick={{ fontSize: 12, fontWeight: 600 }} />
									<YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
									<RechartsTooltip
										formatter={(val: any) => [`${val} inasistencias registradas`, "Ausencias"]}
									/>
									<Bar dataKey="ausencias" radius={[4, 4, 0, 0]}>
										{weekdayData.map((entry) => (
											<Cell
												key={entry.dia_numero}
												fill={entry.dia_nombre === "Jueves" || entry.dia_nombre === "Lunes" ? "#f97316" : "#64748b"}
											/>
										))}
									</Bar>
								</BarChart>
							</ResponsiveContainer>
						)}
					</Paper>
				</Grid>
			</Grid>

			{/* Módulo 2: Desgranamiento por Cátedra */}
			<Paper
				elevation={0}
				sx={{
					p: 3,
					borderRadius: 3,
					border: "1px solid #e2e8f0",
					backgroundColor: "#fff",
				}}
			>
				<Stack
					direction={{ xs: "column", sm: "row" }}
					justifyContent="space-between"
					alignItems={{ xs: "flex-start", sm: "center" }}
					mb={2}
					gap={1}
				>
					<Box>
						<Typography variant="h6" fontWeight={700} color="#1e293b">
							Desgranamiento por Cátedra y Espacio Curricular
						</Typography>
						<Typography variant="body2" color="#64748b">
							Comparativa contra la tasa promedio de su mismo año de cursada (1°, 2°, 3° o 4°)
						</Typography>
					</Box>
					{desgranamiento && (
						<Chip
							label={`${desgranamiento.comisiones_sin_muestra_suficiente} comisiones con muestra < 15`}
							size="small"
							variant="outlined"
							color="default"
						/>
					)}
				</Stack>

				<TableContainer sx={{ maxHeight: 440 }}>
					<Table size="small" stickyHeader>
						<TableHead>
							<TableRow>
								<TableCell sx={{ fontWeight: 700, bgcolor: "#f8fafc" }}>Materia / Cátedra</TableCell>
								<TableCell sx={{ fontWeight: 700, bgcolor: "#f8fafc" }}>Año</TableCell>
								<TableCell sx={{ fontWeight: 700, bgcolor: "#f8fafc" }}>Docente(s) a Cargo</TableCell>
								<TableCell align="center" sx={{ fontWeight: 700, bgcolor: "#f8fafc" }}>Inscriptos</TableCell>
								<TableCell align="center" sx={{ fontWeight: 700, bgcolor: "#f8fafc" }}>Tasa Desgranamiento</TableCell>
								<TableCell align="center" sx={{ fontWeight: 700, bgcolor: "#f8fafc" }}>vs. Promedio del Año</TableCell>
							</TableRow>
						</TableHead>
						<TableBody>
							{loadingDesgranamiento ? (
								Array.from({ length: 6 }).map((_, idx) => (
									<TableRow key={idx}>
										<TableCell><Skeleton width={180} /></TableCell>
										<TableCell><Skeleton width={40} /></TableCell>
										<TableCell><Skeleton width={160} /></TableCell>
										<TableCell align="center"><Skeleton width={50} /></TableCell>
										<TableCell align="center"><Skeleton width={70} /></TableCell>
										<TableCell align="center"><Skeleton width={80} /></TableCell>
									</TableRow>
								))
							) : !desgranamiento || desgranamiento.items.length === 0 ? (
								<TableRow>
									<TableCell colSpan={6} align="center" sx={{ py: 4, color: "#64748b" }}>
										No se encontraron comisiones o planillas finalizadas para los filtros seleccionados.
									</TableCell>
								</TableRow>
							) : (
								desgranamiento.items.slice(0, 50).map((row, idx) => {
									const diff = row.diferencia_vs_promedio;
									const esFavorable = diff !== null && diff < 0;
									const esAlerta = diff !== null && diff > 5;

									return (
										<TableRow key={`${row.materia_id}-${idx}`} hover>
											<TableCell>
												<Typography variant="subtitle2" fontWeight={700} color="#1e293b">
													{row.materia_nombre}
												</Typography>
												<Typography variant="caption" color="#64748b">
													{row.profesorado_nombre} {row.comision_codigo ? `• ${row.comision_codigo}` : ""}
												</Typography>
											</TableCell>
											<TableCell>
												<Chip label={`${row.anio_cursada}° Año`} size="small" sx={{ fontSize: 11 }} />
											</TableCell>
											<TableCell>
												<Typography variant="body2" color="#334155">
													{row.docentes.length > 0 ? row.docentes.join(", ") : "Sin asignar"}
												</Typography>
												{row.hubo_suplencia && (
													<Chip label="Suplencia transitoria" size="small" color="warning" variant="outlined" sx={{ mt: 0.5, height: 20, fontSize: 10 }} />
												)}
											</TableCell>
											<TableCell align="center">
												<Typography variant="body2" fontWeight={600} color="#1e293b">
													{row.total_inscriptos}
												</Typography>
											</TableCell>
											<TableCell align="center">
												{row.muestra_suficiente ? (
													<Typography
														variant="subtitle2"
														fontWeight={700}
														color={esAlerta ? "#dc2626" : esFavorable ? "#15803d" : "#334155"}
													>
														{row.tasa_desgranamiento}%
													</Typography>
												) : (
													<Tooltip title="Menos de 15 estudiantes inscriptos en la comisión. No es estadísticamente concluyente.">
														<Chip label="Muestra insuficiente" size="small" sx={{ fontSize: 10, bgcolor: "#f1f5f9" }} />
													</Tooltip>
												)}
											</TableCell>
											<TableCell align="center">
												{row.muestra_suficiente && diff !== null ? (
													<Chip
														label={`${diff > 0 ? "+" : ""}${diff}% (Prom: ${row.promedio_desgranamiento_anio}%)`}
														size="small"
														sx={{
															fontWeight: 600,
															fontSize: 11,
															bgcolor: esFavorable ? "#dcfce7" : esAlerta ? "#fee2e2" : "#f1f5f9",
															color: esFavorable ? "#15803d" : esAlerta ? "#b91c1c" : "#475569",
														}}
													/>
												) : (
													<Typography variant="caption" color="#94a3b8">--</Typography>
												)}
											</TableCell>
										</TableRow>
									);
								})
							)}
						</TableBody>
					</Table>
				</TableContainer>
			</Paper>
		</Stack>
	);
}
