/* eslint-disable react-doctor/prefer-module-scope-pure-function */

import type { ChipProps } from "@mui/material";
import Alert from "@mui/material/Alert";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import Container from "@mui/material/Container";
import Grid from "@mui/material/Grid";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Select from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { fetchDocenteMisAsistencias } from "@/api/asistencia";
import { useAuth } from "@/context/AuthContext";

const MisAsistenciasPage = () => {
	const { user } = useAuth();
	const [desde, setDesde] = useState("");
	const [hasta, setHasta] = useState("");
	const [estado, setEstado] = useState("todos");

	const {
		data: asistencias,
		isLoading,
		isError,
	} = useQuery({
		queryKey: ["docente", "mis-asistencias", desde, hasta, estado],
		queryFn: () =>
			fetchDocenteMisAsistencias({
				desde: desde || undefined,
				hasta: hasta || undefined,
				estado: estado !== "todos" ? estado : undefined,
			}),
		enabled: !!user,
	});

	const getChipColor = (
		estadoAsistencia: string,
		categoria: string,
	): ChipProps["color"] => {
		const est = estadoAsistencia.toLowerCase();
		if (est === "ausente") return "error";
		if (categoria === "tarde") return "warning";
		return "success";
	};

	const getEstadoLabel = (estadoAsistencia: string, categoria: string) => {
		const est = estadoAsistencia.toLowerCase();
		if (est === "ausente") return "Ausente";
		if (categoria === "tarde") return "Presente (Tarde)";
		return "Presente";
	};

	return (
		<Container maxWidth="lg" sx={{ py: 4 }}>
			<Box sx={{ mb: 4 }}>
				<Typography variant="h4" fontWeight={700} gutterBottom>
					Mis Asistencias
				</Typography>
				<Typography variant="body1" color="text.secondary">
					Historial de tus registros de asistencia en la institución
				</Typography>
			</Box>

			{user && (
				<Card elevation={2} sx={{ mb: 4 }}>
					<CardContent>
						<Stack direction="row" spacing={3} alignItems="center">
							<Avatar
								sx={{
									width: 80,
									height: 80,
									fontSize: 32,
									bgcolor: "primary.main",
								}}
							>
								{user.name?.[0] || ""}
							</Avatar>
							<Stack spacing={0.5}>
								<Typography variant="h5" fontWeight={700}>
									{user.name}
								</Typography>
								<Typography variant="body1" color="text.secondary">
									DNI: {user.dni}
								</Typography>
							</Stack>
						</Stack>
					</CardContent>
				</Card>
			)}

			<Paper elevation={2} sx={{ p: 3, mb: 4 }}>
				<Stack spacing={3}>
					<Typography variant="h6" fontWeight={600}>
						Filtros
					</Typography>
					<Grid container spacing={2}>
						<Grid item xs={12} sm={4}>
							<TextField
								fullWidth
								label="Desde"
								type="date"
								InputLabelProps={{ shrink: true }}
								value={desde}
								onChange={(e) => setDesde(e.target.value)}
							/>
						</Grid>
						<Grid item xs={12} sm={4}>
							<TextField
								fullWidth
								label="Hasta"
								type="date"
								InputLabelProps={{ shrink: true }}
								value={hasta}
								onChange={(e) => setHasta(e.target.value)}
							/>
						</Grid>
						<Grid item xs={12} sm={4}>
							<Select
								fullWidth
								value={estado}
								onChange={(e) => setEstado(e.target.value)}
								displayEmpty
							>
								<MenuItem value="todos">Todos los estados</MenuItem>
								<MenuItem value="presente">Presente (en término)</MenuItem>
								<MenuItem value="tarde">Presente (Tarde)</MenuItem>
								<MenuItem value="ausente">Ausente</MenuItem>
							</Select>
						</Grid>
					</Grid>
				</Stack>
			</Paper>

			{isError && (
				<Alert severity="error" sx={{ mb: 3 }}>
					Ocurrió un error al cargar el historial de asistencias.
				</Alert>
			)}

			<TableContainer component={Paper} elevation={2}>
				<Table>
					<TableHead sx={{ bgcolor: "grey.100" }}>
						<TableRow>
							<TableCell sx={{ fontWeight: 600 }}>Fecha</TableCell>
							<TableCell sx={{ fontWeight: 600 }}>Espacio Curricular</TableCell>
							<TableCell sx={{ fontWeight: 600 }}>Horarios</TableCell>
							<TableCell sx={{ fontWeight: 600 }}>Turno</TableCell>
							<TableCell sx={{ fontWeight: 600 }} align="center">
								Situación
							</TableCell>
						</TableRow>
					</TableHead>
					<TableBody>
						{isLoading ? (
							<TableRow>
								<TableCell colSpan={5} align="center" sx={{ py: 3 }}>
									Cargando historial...
								</TableCell>
							</TableRow>
						) : !asistencias || asistencias.length === 0 ? (
							<TableRow>
								<TableCell colSpan={5} align="center" sx={{ py: 3 }}>
									No se encontraron registros de asistencia para los filtros
									seleccionados.
								</TableCell>
							</TableRow>
						) : (
							asistencias.map((asist) => (
								<TableRow key={asist.id} hover>
									<TableCell>{asist.fecha}</TableCell>
									<TableCell>
										<Typography variant="body2" fontWeight={600}>
											{asist.espacio_curricular}
										</Typography>
										<Typography variant="caption" color="text.secondary">
											Comisión: {asist.comision}
										</Typography>
									</TableCell>
									<TableCell>{asist.horario}</TableCell>
									<TableCell>{asist.turno}</TableCell>
									<TableCell align="center">
										<Chip
											label={getEstadoLabel(asist.estado, asist.categoria)}
											color={getChipColor(asist.estado, asist.categoria)}
											size="small"
											sx={{ fontWeight: 600, minWidth: 100 }}
										/>
									</TableCell>
								</TableRow>
							))
						)}
					</TableBody>
				</Table>
			</TableContainer>
		</Container>
	);
};

export default MisAsistenciasPage;
