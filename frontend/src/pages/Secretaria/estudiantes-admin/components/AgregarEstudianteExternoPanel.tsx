/* eslint-disable react-doctor/no-array-index-as-key */

import AddIcon from "@mui/icons-material/Add";
import PersonSearchIcon from "@mui/icons-material/PersonSearch";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Divider from "@mui/material/Divider";
import FormControlLabel from "@mui/material/FormControlLabel";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { enqueueSnackbar } from "notistack";
import { useState } from "react";
import { listarTodosProfesorados, type ProfesoradoDTO } from "@/api/cargaNotas";
import {
	agregarCarreraEstudiante,
	buscarEstudiantesGlobal,
	type EstudianteGlobalResultDTO,
} from "@/api/estudiantes/admin";
import { useAuth } from "@/context/AuthContext";
import { useDebouncedValue } from "../hooks/useDebouncedValue";

export function AgregarEstudianteExternoPanel() {
	const [activo, setActivo] = useState(false);
	const [busqueda, setBusqueda] = useState("");
	const debouncedBusqueda = useDebouncedValue(busqueda, 400);

	const { user } = useAuth();
	const myProfIds: number[] | null = user?.profesorado_ids ?? null;

	const queryClient = useQueryClient();

	const { data: resultados = [], isFetching } = useQuery({
		queryKey: ["buscar-global-estudiantes", debouncedBusqueda],
		queryFn: () => buscarEstudiantesGlobal(debouncedBusqueda),
		enabled: activo && debouncedBusqueda.length >= 2,
	});

	const { data: profesorados = [] } = useQuery({
		queryKey: ["profesorados-todos"],
		queryFn: () => listarTodosProfesorados(),
		enabled: activo,
	});

	// Para admin/sec (sin restricción): usar el primer profesorado disponible como destino
	// Para bedel: usar su único o elegido profesorado
	const [profesoradoDestino, setProfesradoDestino] = useState<number | "">("");

	const profesoradosDisponibles: ProfesoradoDTO[] =
		myProfIds !== null
			? profesorados.filter((p) => myProfIds.includes(p.id))
			: profesorados;

	const agregarMutation = useMutation({
		mutationFn: ({
			dni,
			profesorado_id,
		}: {
			dni: string;
			profesorado_id: number;
		}) => agregarCarreraEstudiante(dni, { profesorado_id }),
		onSuccess: (_data, vars) => {
			enqueueSnackbar("Estudiante agregado a la carrera correctamente", {
				variant: "success",
			});
			queryClient.invalidateQueries({ queryKey: ["admin-estudiantes"] });
			queryClient.invalidateQueries({
				queryKey: ["admin-estudiante", vars.dni],
			});
			setBusqueda("");
		},
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		onError: (error: any) => {
			const msg =
				error?.response?.data?.message || "No se pudo agregar el estudiante";
			enqueueSnackbar(msg, { variant: "error" });
		},
	});

	const profDestino =
		profesoradoDestino !== ""
			? profesoradoDestino
			: profesoradosDisponibles[0]?.id;

	const yaEnDestino = (est: EstudianteGlobalResultDTO) => {
		if (!profDestino) return false;
		const carreraDestino = profesorados.find((p) => p.id === profDestino);
		if (!carreraDestino) return false;
		return est.carreras.some((c) => c.nombre === carreraDestino.nombre);
	};

	return (
		<Box>
			<FormControlLabel
				control={
					<Switch
						checked={activo}
						onChange={(e) => {
							setActivo(e.target.checked);
							if (!e.target.checked) setBusqueda("");
						}}
						size="small"
					/>
				}
				label={
					<Stack direction="row" alignItems="center" gap={0.5}>
						<PersonSearchIcon
							fontSize="small"
							color={activo ? "primary" : "disabled"}
						/>
						<Typography
							variant="body2"
							color={activo ? "primary" : "text.secondary"}
						>
							Agregar estudiante de otra carrera
						</Typography>
					</Stack>
				}
			/>

			{activo && (
				<Paper variant="outlined" sx={{ p: 2, mt: 1 }}>
					<Stack gap={2}>
						<Stack
							direction={{ xs: "column", sm: "row" }}
							gap={2}
							alignItems="flex-start"
						>
							<TextField
								size="small"
								label="Buscar por DNI o Apellido y nombre"
								value={busqueda}
								onChange={(e) => setBusqueda(e.target.value)}
								autoFocus // eslint-disable-line jsx-a11y/no-autofocus
								sx={{ minWidth: 280 }}
								InputProps={{
									endAdornment: isFetching ? (
										<CircularProgress size={16} />
									) : null,
								}}
							/>
							{profesoradosDisponibles.length > 1 && (
								<TextField
									select
									size="small"
									label="Agregar a carrera"
									value={profesoradoDestino}
									onChange={(e) => setProfesradoDestino(Number(e.target.value))}
									sx={{ minWidth: 240 }}
								>
									{profesoradosDisponibles.map((p) => (
										<MenuItem key={p.id} value={p.id}>
											{p.nombre}
										</MenuItem>
									))}
								</TextField>
							)}
						</Stack>

						{debouncedBusqueda.length >= 2 &&
							!isFetching &&
							resultados.length === 0 && (
								<Typography variant="body2" color="text.secondary">
									Sin resultados para &ldquo;{debouncedBusqueda}&rdquo;.
								</Typography>
							)}

						{resultados.length > 0 && (
							<>
								<Divider />
								<Stack gap={1}>
									{resultados.map((est) => {
										const enDestino = yaEnDestino(est);
										return (
											<Box
												key={est.dni}
												sx={{
													display: "flex",
													alignItems: "center",
													justifyContent: "space-between",
													gap: 2,
													p: 1.5,
													borderRadius: 1,
													border: "1px solid",
													borderColor: "divider",
													bgcolor: enDestino
														? "action.hover"
														: "background.paper",
												}}
											>
												<Box>
													<Typography variant="body2" fontWeight={600}>
														{est.apellido}, {est.nombre}
														<Typography
															component="span"
															variant="caption"
															color="text.secondary"
															sx={{ ml: 1 }}
														>
															DNI {est.dni}
														</Typography>
													</Typography>
													<Stack
														direction="row"
														gap={0.5}
														flexWrap="wrap"
														mt={0.5}
													>
														{est.carreras.map((c, i) => (
															<Chip
																key={i}
																label={`${c.nombre} (${c.estado_academico})`}
																size="small"
																variant="outlined"
															/>
														))}
														{est.carreras.length === 0 && (
															<Typography
																variant="caption"
																color="text.secondary"
															>
																Sin carreras
															</Typography>
														)}
													</Stack>
												</Box>

												{enDestino ? (
													<Chip
														label="Ya está en esta carrera"
														size="small"
														color="default"
													/>
												) : (
													<Button
														size="small"
														variant="contained"
														startIcon={<AddIcon />}
														disabled={!profDestino || agregarMutation.isPending}
														onClick={() =>
															profDestino &&
															agregarMutation.mutate({
																dni: est.dni,
																profesorado_id: profDestino,
															})
														}
													>
														Agregar
													</Button>
												)}
											</Box>
										);
									})}
								</Stack>
							</>
						)}
					</Stack>
				</Paper>
			)}
		</Box>
	);
}
