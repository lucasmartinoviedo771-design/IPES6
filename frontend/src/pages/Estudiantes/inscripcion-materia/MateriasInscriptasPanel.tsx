import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import type React from "react";
import { useState } from "react";
import type { MateriaInscriptaItemDTO } from "@/api/estudiantes";
import type { Materia } from "./types";

interface InscriptaDetalle {
	materia: Materia;
	inscripcion: MateriaInscriptaItemDTO | null;
}

interface MateriasInscriptasPanelProps {
	inscriptasDetalle: InscriptaDetalle[];
	ventanaActiva: boolean;
	mCancelarIsPending: boolean;
	cancelarVars: { inscripcionId: number; materiaId: number } | undefined;
	onCancelar: (materiaId: number, inscripcionId?: number | null) => void;
	onBaja: (inscripcionId: number, motivo: string) => void;
	mBajaIsPending: boolean;
}

const MateriasInscriptasPanel: React.FC<MateriasInscriptasPanelProps> = ({
	inscriptasDetalle,
	ventanaActiva,
	mCancelarIsPending,
	cancelarVars,
	onCancelar,
	onBaja,
	mBajaIsPending,
}) => {
	const [bajaTarget, setBajaTarget] = useState<{
		inscripcionId: number;
		materiaNombre: string;
	} | null>(null);
	const [confirmNombre, setConfirmNombre] = useState("");
	const [motivo, setMotivo] = useState("");

	const handleOpenBaja = (inscripcionId: number, materiaNombre: string) => {
		setBajaTarget({ inscripcionId, materiaNombre });
		setConfirmNombre("");
		setMotivo("");
	};

	const handleCloseBaja = () => {
		if (mBajaIsPending) return;
		setBajaTarget(null);
	};

	const handleConfirmBaja = () => {
		if (!bajaTarget || mBajaIsPending) return;
		onBaja(bajaTarget.inscripcionId, motivo);
	};

	const nombreCoincide = bajaTarget
		? confirmNombre.trim().toLowerCase() ===
			bajaTarget.materiaNombre.trim().toLowerCase()
		: false;

	// Agrupar materias inscriptas por año de cursada (1°, 2°, 3°, 4°, etc.)
	const groupedInscriptas = inscriptasDetalle.reduce<Record<number, InscriptaDetalle[]>>(
		(acc, item) => {
			const anio = item.materia.anio || 1;
			if (!acc[anio]) acc[anio] = [];
			acc[anio].push(item);
			return acc;
		},
		{},
	);

	const aniosOrdenados = Object.keys(groupedInscriptas)
		.map(Number)
		.sort((a, b) => a - b);

	return (
		<>
			<Paper
				elevation={0}
				sx={{
					p: 3,
					borderRadius: 3,
					border: "1px solid #d8ccb0",
					bgcolor: "#fff",
				}}
			>
				<Typography variant="h6" fontWeight={700} gutterBottom>
					Materias ya inscriptas en esta ventana
				</Typography>
				{inscriptasDetalle.length === 0 ? (
					<Typography variant="body2" color="text.secondary">
						Todavía no tenés inscripciones registradas.
					</Typography>
				) : (
					<Stack spacing={3}>
						{aniosOrdenados.map((anio) => (
							<Box key={anio}>
								<Typography
									variant="subtitle1"
									fontWeight={700}
									sx={{
										color: "#5c4d32",
										mb: 1.5,
										pb: 0.5,
										borderBottom: "1px dashed #d8ccb0",
										display: "flex",
										alignItems: "center",
										gap: 1,
									}}
								>
									<span>{anio}° Año</span>
									<Typography
										variant="caption"
										color="text.secondary"
										sx={{ fontWeight: 500 }}
									>
										({groupedInscriptas[anio].length}{" "}
										{groupedInscriptas[anio].length === 1
											? "materia inscripta"
											: "materias inscriptas"}
										)
									</Typography>
								</Typography>

								<Stack spacing={2}>
									{groupedInscriptas[anio].map(({ materia, inscripcion }) => {
											const isBaja = inscripcion?.estado === "BAJA";
											const canceling = inscripcion
												? cancelarVars?.inscripcionId ===
														inscripcion.inscripcion_id && mCancelarIsPending
												: false;

											return (
												<Box
													key={materia.id}
													sx={{
														p: 2,
														borderRadius: 2,
														border: "1px solid #cbb891",
														bgcolor: isBaja ? "#fdf3f3" : "#f7f1df",
													}}
												>
													<Typography fontWeight={600}>
														{materia.nombre}
													</Typography>
													{materia.horarios.length > 0 ? (
														materia.horarios.map((h, idx) => (
															<Typography
																key={idx}
																variant="body2"
																color="text.secondary"
															>
																{h.dia} {h.desde} - {h.hasta}
															</Typography>
														))
													) : (
														<Typography
															variant="body2"
															color="text.secondary"
														>
															Horario no informado.
														</Typography>
													)}
													<Stack
														direction="row"
														spacing={1}
														alignItems="center"
														flexWrap="wrap"
														gap={1}
														sx={{ mt: 1 }}
													>
														<Chip
															label={`${materia.anio}° Año`}
															size="small"
															variant="outlined"
															sx={{ fontWeight: 600 }}
														/>
										{isBaja ? (
											<Chip
												label="Baja voluntaria"
												color="error"
												size="small"
											/>
										) : inscripcion?.estado_regularidad ? (
											<Chip
												label={inscripcion.estado_regularidad}
												color="secondary"
												size="small"
											/>
										) : (
											<Chip
												label={
													inscripcion?.motivo_cambio
														? `Comisionado en ${
																inscripcion.profesorado_nombre ||
																"otro profesorado"
														  }`
														: "Inscripta"
												}
												color={
													inscripcion?.motivo_cambio ? "info" : "success"
												}
												size="small"
												variant={
													inscripcion?.motivo_cambio ? "outlined" : undefined
												}
											/>
										)}

										{inscripcion?.regimen && (
											<Chip
												label={inscripcion.regimen}
												size="small"
												variant="outlined"
											/>
										)}

										{/* Cancelar: solo durante ventana abierta, sin baja, y sin notas finales */}
										{!isBaja &&
											!inscripcion?.estado_regularidad &&
											ventanaActiva &&
											inscripcion && (
												<Button
													variant="outlined"
													color="error"
													size="small"
													disabled={canceling}
													onClick={() =>
														onCancelar(materia.id, inscripcion.inscripcion_id)
													}
												>
													{canceling ? (
														<CircularProgress size={16} />
													) : (
														"Cancelar inscripción"
													)}
												</Button>
											)}

										{/* Dar de baja: Solo después de cerrada la ventana y sin notas finales */}
										{!isBaja &&
											!inscripcion?.estado_regularidad &&
											!ventanaActiva &&
											inscripcion && (
												<Button
													variant="outlined"
													color="warning"
													size="small"
													onClick={() =>
														handleOpenBaja(
															inscripcion.inscripcion_id,
															materia.nombre,
														)
													}
												>
													Dar de baja
												</Button>
											)}
									</Stack>
								</Box>
							);
						})}
					</Stack>
				</Box>
			))}
		</Stack>
	)}
</Paper>

			{/* Diálogo de confirmación de baja */}
			<Dialog
				open={!!bajaTarget}
				onClose={handleCloseBaja}
				maxWidth="sm"
				fullWidth
			>
				<DialogTitle>Confirmar baja voluntaria</DialogTitle>
				<DialogContent>
					<Stack spacing={2} sx={{ mt: 1 }}>
						<Alert severity="warning">
							<Typography variant="body2" fontWeight={700}>
								Esta acción es definitiva e irreversible.
							</Typography>
							<Typography variant="body2">
								Al darte de baja no podrás volver a inscribirte en esta materia
								hasta la próxima apertura del período de inscripción
								correspondiente.
							</Typography>
						</Alert>

						<Typography variant="body2">
							Para confirmar, escribí exactamente el nombre de la materia:
							<br />
							<strong>{bajaTarget?.materiaNombre}</strong>
						</Typography>

						<TextField
							label="Nombre de la materia"
							value={confirmNombre}
							onChange={(e) => setConfirmNombre(e.target.value)}
							size="small"
							fullWidth
							autoFocus // eslint-disable-line jsx-a11y/no-autofocus
							error={confirmNombre.length > 0 && !nombreCoincide}
							helperText={
								confirmNombre.length > 0 && !nombreCoincide
									? "El nombre no coincide"
									: ""
							}
						/>

						<TextField
							label="Motivo de la baja (obligatorio)"
							value={motivo}
							onChange={(e) => setMotivo(e.target.value)}
							size="small"
							fullWidth
							multiline
							rows={2}
							placeholder="Ej: Razones personales / laborales / académicas..."
						/>
					</Stack>
				</DialogContent>
				<DialogActions>
					<Button onClick={handleCloseBaja} disabled={mBajaIsPending}>
						Cancelar
					</Button>
					<Button
						variant="contained"
						color="error"
						disabled={!nombreCoincide || !motivo.trim() || mBajaIsPending}
						onClick={handleConfirmBaja}
						startIcon={
							mBajaIsPending ? (
								<CircularProgress size={16} color="inherit" />
							) : undefined
						}
					>
						{mBajaIsPending ? "Procesando..." : "Confirmar baja"}
					</Button>
				</DialogActions>
			</Dialog>
		</>
	);
};

export default MateriasInscriptasPanel;
