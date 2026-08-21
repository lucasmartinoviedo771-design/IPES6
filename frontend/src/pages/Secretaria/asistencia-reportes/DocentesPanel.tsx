import GroupsIcon from "@mui/icons-material/Groups";
import ManageAccountsIcon from "@mui/icons-material/ManageAccounts";
import VisibilityIcon from "@mui/icons-material/Visibility";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import Alert from "@mui/material/Alert";
import Autocomplete from "@mui/material/Autocomplete";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Divider from "@mui/material/Divider";
import Grid from "@mui/material/Grid";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import dayjs from "dayjs";
import type { DocenteClase, DocenteClasesResponse } from "@/api/asistencia";
import React, { useMemo } from "react";
import "dayjs/locale/es";
import type { DateOption, Option } from "./types";

dayjs.locale("es");

interface DocentesPanelProps {
	puedeGestionarDocentes: boolean;
	puedeVerDocentes: boolean;
	esDocenteSolo: boolean;
	docenteDni: string;
	setDocenteDni: (v: string) => void;
	docenteDesde: string;
	setDocenteDesde: (v: string) => void;
	docenteHasta: string;
	setDocenteHasta: (v: string) => void;
	docenteDiaSemana: string;
	setDocenteDiaSemana: (v: string) => void;
	docenteClases: DocenteClase[];
	docenteInfo: DocenteClasesResponse["docente"] | null;
	cargandoDocente: boolean;
	docenteProfesorado: Option | null;
	setDocenteProfesorado: (v: Option | null) => void;
	docentePlan: Option | null;
	setDocentePlan: (v: Option | null) => void;
	docenteMateria: Option | null;
	setDocenteMateria: (v: Option | null) => void;
	docenteComision: Option | null;
	setDocenteComision: (v: Option | null) => void;
	docenteFecha: DateOption | null;
	setDocenteFecha: (v: DateOption | null) => void;
	docenteProfesOptions: Option[];
	docentePlanOptions: Option[];
	docenteMateriaOptions: Option[];
	docenteComisionOptions: Option[];
	docenteFechaOptions: DateOption[];
	docenteClasesFiltradas: DocenteClase[];
	handleBuscarDocente: (event: React.FormEvent<HTMLFormElement>) => void;
}

export const DocentesPanel: React.FC<DocentesPanelProps> = ({
	puedeGestionarDocentes,
	puedeVerDocentes,
	esDocenteSolo,
	docenteDni,
	setDocenteDni,
	docenteDesde,
	setDocenteDesde,
	docenteHasta,
	setDocenteHasta,
	docenteDiaSemana,
	setDocenteDiaSemana,
	docenteClases,
	docenteInfo,
	cargandoDocente,
	docenteProfesorado,
	setDocenteProfesorado,
	docentePlan,
	setDocentePlan,
	docenteMateria,
	setDocenteMateria,
	docenteComision,
	setDocenteComision,
	docenteFecha,
	setDocenteFecha,
	docenteProfesOptions,
	docentePlanOptions,
	docenteMateriaOptions,
	docenteComisionOptions,
	docenteFechaOptions,
	docenteClasesFiltradas,
	handleBuscarDocente,
}) => {
	return (
		<Paper elevation={3} sx={{ p: 3, height: "100%" }}>
			<Stack spacing={2} height="100%">
				<Stack direction="row" spacing={1.5} alignItems="center">
					<Chip
						icon={<GroupsIcon />}
						label="Docentes"
						sx={{
							fontWeight: 600,
							bgcolor: "primary.main",
							color: "common.white",
							"& .MuiChip-icon": { color: "common.white !important" },
						}}
					/>
					<Chip
						icon={<ManageAccountsIcon />}
						label={
							puedeGestionarDocentes
								? "Gestion habilitada"
								: "Gestion restringida"
						}
						color={puedeGestionarDocentes ? "success" : "default"}
						variant={puedeGestionarDocentes ? "filled" : "outlined"}
						sx={{
							"& .MuiChip-icon": {
								color: "common.white !important",
							},
						}}
					/>
					<Chip
						icon={<VisibilityIcon />}
						label={puedeVerDocentes ? "Vista habilitada" : "Vista restringida"}
						color={puedeVerDocentes ? "info" : "default"}
						variant={puedeVerDocentes ? "filled" : "outlined"}
						sx={{
							"& .MuiChip-icon": {
								color: "common.white !important",
							},
						}}
					/>
				</Stack>

				<Box component="form" onSubmit={handleBuscarDocente}>
					<Stack spacing={1.5}>
						<Typography variant="subtitle1" fontWeight={600}>
							Selecciona al docente
						</Typography>
						<TextField
							label="DNI del docente"
							value={docenteDni}
							onChange={(event) => setDocenteDni(event.target.value)}
							placeholder="Ej: 28126358"
							disabled={cargandoDocente || !puedeVerDocentes || esDocenteSolo}
							fullWidth
						/>
						<Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
							<TextField
								label="Desde"
								type="date"
								value={docenteDesde}
								onChange={(event) => setDocenteDesde(event.target.value)}
								disabled={cargandoDocente || !puedeVerDocentes}
								fullWidth
								InputLabelProps={{ shrink: true }}
							/>
							<TextField
								label="Hasta"
								type="date"
								value={docenteHasta}
								onChange={(event) => setDocenteHasta(event.target.value)}
								disabled={cargandoDocente || !puedeVerDocentes}
								fullWidth
								InputLabelProps={{ shrink: true }}
							/>
						</Stack>
						<TextField
							label="Filtrar por dia de semana (0=lunes ... 6=domingo)"
							value={docenteDiaSemana}
							onChange={(event) => setDocenteDiaSemana(event.target.value)}
							placeholder="Opcional"
							disabled={cargandoDocente || !puedeVerDocentes}
						/>
						<Button
							type="submit"
							variant="contained"
							color="secondary"
							disabled={cargandoDocente || !puedeVerDocentes}
						>
							{cargandoDocente ? (
								<CircularProgress size={20} />
							) : (
								"Buscar clases"
							)}
						</Button>
					</Stack>
				</Box>

				<Divider />

				{!!docenteInfo && (
					<Typography variant="subtitle2" color="text.secondary">
						Docente seleccionado: {docenteInfo.nombre} - DNI {docenteInfo.dni}
					</Typography>
				)}

				{docenteClases.length > 0 && (
					<Stack spacing={1.5}>
						<Typography variant="subtitle1" fontWeight={600}>
							Refinar resultados
						</Typography>
						<Grid container spacing={1.5}>
							<Grid item xs={12} md={6}>
								<Autocomplete
									options={docenteProfesOptions}
									value={docenteProfesorado}
									onChange={(_, value) => setDocenteProfesorado(value)}
									disabled={docenteProfesOptions.length === 0}
									fullWidth
									renderInput={(params) => (
										<TextField
											{...params}
											label="Profesorado"
											placeholder="Selecciona un profesorado"
										/>
									)}
								/>
							</Grid>
							<Grid item xs={12} md={6}>
								<Autocomplete
									options={docentePlanOptions}
									value={docentePlan}
									onChange={(_, value) => setDocentePlan(value)}
									disabled={docentePlanOptions.length === 0}
									fullWidth
									renderInput={(params) => (
										<TextField
											{...params}
											label="Plan"
											placeholder="Selecciona un plan"
										/>
									)}
								/>
							</Grid>
							<Grid item xs={12} md={6}>
								<Autocomplete
									options={docenteMateriaOptions}
									value={docenteMateria}
									onChange={(_, value) => setDocenteMateria(value)}
									disabled={docenteMateriaOptions.length === 0}
									fullWidth
									renderInput={(params) => (
										<TextField
											{...params}
											label="Materia"
											placeholder="Selecciona una materia"
										/>
									)}
								/>
							</Grid>
							<Grid item xs={12} md={6}>
								<Autocomplete
									options={docenteComisionOptions}
									value={docenteComision}
									onChange={(_, value) => setDocenteComision(value)}
									disabled={docenteComisionOptions.length === 0}
									fullWidth
									renderInput={(params) => (
										<TextField
											{...params}
											label="Catedra (comision)"
											placeholder="Selecciona una catedra"
										/>
									)}
								/>
							</Grid>
							<Grid item xs={12} md={6}>
								<Autocomplete
									options={docenteFechaOptions}
									value={docenteFecha}
									onChange={(_, value) => setDocenteFecha(value)}
									disabled={docenteFechaOptions.length === 0}
									fullWidth
									renderInput={(params) => (
										<TextField
											{...params}
											label="Fecha"
											placeholder="Selecciona una fecha"
										/>
									)}
								/>
							</Grid>
						</Grid>
					</Stack>
				)}

				{docenteClasesFiltradas.length === 0 ? (
					<Alert severity="info">
						Ingresa un DNI y rango de fechas para ver las clases asignadas.
					</Alert>
				) : (() => {
					// Agrupar clases por Materia + Comision + Fecha + Turno para mostrar un único bloque por cátedra
					const gruposMap = new Map<string, {
						id: string;
						materia: string;
						comision: string;
						fecha: string;
						turno: string;
						profesorado_nombre: string | null;
						plan_resolucion: string | null;
						bloquesCount: number;
						ya_registrada: boolean;
						registrada_en: string | null;
						hora_inicio_min: string | null;
						hora_fin_max: string | null;
						puede_marcar: boolean;
						editable_staff: boolean;
					}>();

					docenteClasesFiltradas.forEach((clase) => {
						const key = `${clase.fecha}_${clase.comision_id || clase.materia_id || clase.materia}_${clase.turno}`;
						const existente = gruposMap.get(key);

						// Extraer horas si vienen con formato "HH:mm a HH:mm" o "HH:mm - HH:mm"
						let hIni: string | null = null;
						let hFin: string | null = null;
						if (clase.horario) {
							const parts = clase.horario.split(/\s*(?:a|-)\s*/);
							if (parts.length >= 2) {
								hIni = parts[0]?.trim() || null;
								hFin = parts[1]?.trim() || null;
							}
						}

						if (!existente) {
							gruposMap.set(key, {
								id: key,
								materia: clase.materia,
								comision: clase.comision,
								fecha: clase.fecha,
								turno: clase.turno || "-",
								profesorado_nombre: clase.profesorado_nombre ?? "-",
								plan_resolucion: clase.plan_resolucion ?? "-",
								bloquesCount: 1,
								ya_registrada: clase.ya_registrada,
								registrada_en: clase.registrada_en,
								hora_inicio_min: hIni,
								hora_fin_max: hFin,
								puede_marcar: clase.puede_marcar,
								editable_staff: clase.editable_staff,
							});
						} else {
							existente.bloquesCount += 1;
							if (clase.ya_registrada) {
								existente.ya_registrada = true;
								if (clase.registrada_en) {
									existente.registrada_en = clase.registrada_en;
								}
							}
							if (hIni && (!existente.hora_inicio_min || hIni < existente.hora_inicio_min)) {
								existente.hora_inicio_min = hIni;
							}
							if (hFin && (!existente.hora_fin_max || hFin > existente.hora_fin_max)) {
								existente.hora_fin_max = hFin;
							}
							if (clase.puede_marcar) existente.puede_marcar = true;
							if (clase.editable_staff) existente.editable_staff = true;
						}
					});

					const grupos = Array.from(gruposMap.values());

					return (
						<Stack spacing={1.5} sx={{ maxHeight: 260, overflowY: "auto" }}>
							{grupos.map((grupo) => {
								const rangoHorario =
									grupo.hora_inicio_min && grupo.hora_fin_max
										? `${grupo.hora_inicio_min} a ${grupo.hora_fin_max}`
										: "Horario asignado";

								return (
									<Paper key={grupo.id} variant="outlined" sx={{ p: 1.5 }}>
										<Stack spacing={0.5}>
											<Stack direction="row" alignItems="center" justifyContent="space-between">
												<Typography variant="subtitle2" fontWeight={600}>
													{grupo.materia} - {grupo.comision}
												</Typography>
												{grupo.ya_registrada ? (
													<Typography variant="caption" sx={{ color: "success.main", fontWeight: "bold" }}>
														{grupo.registrada_en ? `Presente (${grupo.registrada_en})` : "Presente"}
													</Typography>
												) : (
													<Typography variant="caption" sx={{ color: "error.main", fontWeight: "bold" }}>
														Ausente
													</Typography>
												)}
											</Stack>
											<Typography variant="body2" color="text.secondary">
												{dayjs(grupo.fecha, "DD/MM/YYYY").format("dddd DD/MM/YYYY")} - Turno{" "}
												{grupo.turno} - {rangoHorario}{" "}
												{grupo.bloquesCount > 1 ? `(${grupo.bloquesCount} hs cátedra)` : ""}
											</Typography>
											<Typography variant="caption" color="text.secondary">
												Profes.: {grupo.profesorado_nombre} - Plan {grupo.plan_resolucion}
											</Typography>
											<Typography variant="caption" color="text.secondary">
												Puede marcar: {grupo.puede_marcar ? "si" : "no"} - Staff puede editar:{" "}
												{grupo.editable_staff ? "si" : "no"}
											</Typography>
										</Stack>
									</Paper>
								);
							})}
						</Stack>
					);
				})()}

				{!puedeVerDocentes && (
					<Stack
						direction="row"
						spacing={1}
						alignItems="center"
						color="warning.main"
						mt={1}
					>
						<WarningAmberIcon fontSize="small" />
						<Typography variant="caption">
							Tu rol no tiene acceso a la asistencia docente. Coordina con
							Secretaria para habilitarlo.
						</Typography>
					</Stack>
				)}
			</Stack>
		</Paper>
	);
};
