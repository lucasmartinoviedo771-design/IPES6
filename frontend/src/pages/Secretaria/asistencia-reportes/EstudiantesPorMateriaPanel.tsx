import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import CircularProgress from "@mui/material/CircularProgress";

import { fetchReporteMateriaEstudiantes } from "@/api/asistencia";
import { fetchCarreras, listarPlanes } from "@/api/carreras";
import { listarMaterias, listarComisiones } from "@/api/comisiones";

export const EstudiantesPorMateriaPanel: React.FC = () => {
	const [selectedCarrera, setSelectedCarrera] = useState<number | "">("");
	const [selectedPlan, setSelectedPlan] = useState<number | "">("");
	const [selectedMateria, setSelectedMateria] = useState<number | "">("");
	const [selectedComision, setSelectedComision] = useState<number | "">("");

	const { data: carreras } = useQuery({
		queryKey: ["carreras-reporte"],
		queryFn: fetchCarreras,
	});

	const { data: planes } = useQuery({
		queryKey: ["planes-reporte", selectedCarrera],
		queryFn: () => listarPlanes(selectedCarrera as number),
		enabled: !!selectedCarrera,
	});

	const { data: materias } = useQuery({
		queryKey: ["materias-reporte", selectedPlan],
		queryFn: () => listarMaterias(selectedPlan as number),
		enabled: !!selectedPlan,
	});

	const { data: comisionesResponse } = useQuery({
		queryKey: ["comisiones-reporte", selectedMateria],
		queryFn: () => listarComisiones({ materia_id: selectedMateria as number }),
		enabled: !!selectedMateria,
	});
	const comisiones = comisionesResponse || [];

	const { data: reporteMateria, isLoading } = useQuery({
		queryKey: ["reporte-materia-estudiantes", selectedComision],
		queryFn: () => fetchReporteMateriaEstudiantes(selectedComision as number),
		enabled: !!selectedComision,
	});

	// Transformar los datos para mostrarlos como tabla pivoteada por alumno y fecha
	const { alumnos, fechas, reporteMap } = useMemo(() => {
		if (!reporteMateria) return { alumnos: [], fechas: [], reporteMap: {} };

		const alumnosMap = new Map<number, any>();
		const fechasSet = new Set<string>();
		const rMap: Record<string, any> = {};

		reporteMateria.forEach((item) => {
			if (!alumnosMap.has(item.estudiante_id)) {
				alumnosMap.set(item.estudiante_id, {
					id: item.estudiante_id,
					nombre: item.estudiante_nombre,
					dni: item.estudiante_dni,
				});
			}
			fechasSet.add(item.fecha);
			rMap[`${item.estudiante_id}_${item.fecha}`] = item;
		});

		const sortedFechas = Array.from(fechasSet).sort();
		const sortedAlumnos = Array.from(alumnosMap.values()).sort((a, b) =>
			a.nombre.localeCompare(b.nombre)
		);

		return { alumnos: sortedAlumnos, fechas: sortedFechas, reporteMap: rMap };
	}, [reporteMateria]);

	return (
		<Paper sx={{ p: 3, display: "flex", flexDirection: "column", gap: 3 }}>
			<Box>
				<Typography variant="h6" gutterBottom>
					Asistencia de Estudiantes por Comisión
				</Typography>
				<Typography variant="body2" color="text.secondary">
					Seleccione una comisión para ver la asistencia de todos sus alumnos a
					lo largo de las clases dictadas.
				</Typography>
			</Box>

			<Stack direction={{ xs: "column", md: "row" }} spacing={2}>
				<FormControl size="small" fullWidth>
					<InputLabel>Profesorado</InputLabel>
					<Select
						value={selectedCarrera}
						label="Profesorado"
						onChange={(e) => {
							setSelectedCarrera(e.target.value as number);
							setSelectedPlan("");
							setSelectedMateria("");
							setSelectedComision("");
						}}
					>
						{carreras?.map((c: any) => (
							<MenuItem key={c.id} value={c.id}>
								{c.nombre}
							</MenuItem>
						))}
					</Select>
				</FormControl>

				<FormControl size="small" fullWidth disabled={!selectedCarrera}>
					<InputLabel>Plan</InputLabel>
					<Select
						value={selectedPlan}
						label="Plan"
						onChange={(e) => {
							setSelectedPlan(e.target.value as number);
							setSelectedMateria("");
							setSelectedComision("");
						}}
					>
						{planes?.map((p: any) => (
							<MenuItem key={p.id} value={p.id}>
								{p.resolucion}
							</MenuItem>
						))}
					</Select>
				</FormControl>

				<FormControl size="small" fullWidth disabled={!selectedPlan}>
					<InputLabel>Materia</InputLabel>
					<Select
						value={selectedMateria}
						label="Materia"
						onChange={(e) => {
							setSelectedMateria(e.target.value as number);
							setSelectedComision("");
						}}
					>
						{materias?.map((m: any) => (
							<MenuItem key={m.id} value={m.id}>
								{m.nombre}
							</MenuItem>
						))}
					</Select>
				</FormControl>

				<FormControl size="small" fullWidth disabled={!selectedMateria}>
					<InputLabel>Comisión</InputLabel>
					<Select
						value={selectedComision}
						label="Comisión"
						onChange={(e) => {
							setSelectedComision(e.target.value as number);
						}}
					>
						{comisiones?.map((c: any) => (
							<MenuItem key={c.id} value={c.id}>
								{c.codigo}
							</MenuItem>
						))}
					</Select>
				</FormControl>
			</Stack>

			{isLoading && (
				<Box display="flex" justifyContent="center" p={3}>
					<CircularProgress />
				</Box>
			)}

			{!isLoading && selectedComision && alumnos.length > 0 && (
				<TableContainer variant="outlined" component={Paper} sx={{ maxHeight: 600 }}>
					<Table size="small" stickyHeader>
						<TableHead>
							<TableRow>
								<TableCell sx={{ minWidth: 200, backgroundColor: "grey.100" }}>
									Estudiante
								</TableCell>
								<TableCell sx={{ backgroundColor: "grey.100" }} align="center">
									% Asist.
								</TableCell>
								{fechas.map((f) => (
									<TableCell key={f} align="center" sx={{ backgroundColor: "grey.100", whiteSpace: "nowrap" }}>
										{f.substring(0, 5)}
									</TableCell>
								))}
							</TableRow>
						</TableHead>
						<TableBody>
							{alumnos.map((a) => {
								let presentes = 0;
								let totales = 0;

								fechas.forEach((f) => {
									const item = reporteMap[`${a.id}_${f}`];
									if (item) {
										totales++;
										if (item.estado === "Presente") presentes++;
									}
								});

								const porcentaje = totales > 0 ? Math.round((presentes / totales) * 100) : 0;

								return (
									<TableRow key={a.id} hover>
										<TableCell>
											<Typography variant="body2" fontWeight={500}>
												{a.nombre}
											</Typography>
											<Typography variant="caption" color="text.secondary">
												DNI: {a.dni}
											</Typography>
										</TableCell>
										<TableCell align="center">
											<Typography
												variant="body2"
												fontWeight="bold"
												color={porcentaje < 60 ? "error.main" : "text.primary"}
											>
												{porcentaje}%
											</Typography>
										</TableCell>
										{fechas.map((f) => {
											const item = reporteMap[`${a.id}_${f}`];
											let text = "-";
											let color = "text.secondary";
											if (item) {
												if (item.estado === "Presente") {
													text = "P";
													color = "success.main";
												} else if (item.estado === "Ausente") {
													text = item.justificado ? "AJ" : "A";
													color = item.justificado ? "warning.main" : "error.main";
												} else if (item.estado === "Tarde") {
													text = "T";
													color = "warning.main";
												}
											}

											return (
												<TableCell key={f} align="center">
													<Typography variant="body2" fontWeight="bold" color={color}>
														{text}
													</Typography>
												</TableCell>
											);
										})}
									</TableRow>
								);
							})}
						</TableBody>
					</Table>
				</TableContainer>
			)}

			{!isLoading && selectedComision && alumnos.length === 0 && (
				<Box p={3} textAlign="center">
					<Typography color="text.secondary">
						No hay alumnos inscritos o no hay clases registradas en esta comisión.
					</Typography>
				</Box>
			)}
		</Paper>
	);
};
