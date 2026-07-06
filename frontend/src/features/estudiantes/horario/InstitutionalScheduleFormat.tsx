import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import React, { useMemo } from "react";
import type {
	HorarioMateriaCeldaDTO,
	HorarioTablaDTO,
} from "@/api/estudiantes";
import {
	getProfessoradoColor,
	getTextColorForBackground,
} from "@/styles/institutionalColors";

// Los colores se obtienen globalmente desde getProfessoradoColor

const formatProfesoradoHeader = (name: string): string => name.toUpperCase();

const DEFAULT_COLOR = "#F2F2F2";

type InstitutionalScheduleFormatProps = {
	tabla: HorarioTablaDTO;
	salon?: string;
	cuatrimestre?: string;
	variant?: "student" | "teacher";
};

const cellKey = (dia: number, posicion: number) => `${dia}-${posicion}`;

const InstitutionalScheduleFormat: React.FC<
	InstitutionalScheduleFormatProps
> = ({ tabla, salon = "---", cuatrimestre, variant = "student" }) => {
	const bgColor = getProfessoradoColor(tabla.profesorado_nombre);
	const headerTextColor = getTextColorForBackground(bgColor);

	const dias = useMemo(
		() => [...tabla.dias].sort((a, b) => a.numero - b.numero),
		[tabla.dias],
	);
	const franjas = useMemo(
		() => [...tabla.franjas].sort((a, b) => a.posicion - b.posicion),
		[tabla.franjas],
	);

	const celdas = useMemo(() => {
				const map = new Map<string, any>();
		tabla.celdas.forEach((celda) => {
			map.set(cellKey(celda.dia_numero, celda.franja_posicion), celda);
		});
		return map;
	}, [tabla.celdas]);

	const renderMateria = (materia: HorarioMateriaCeldaDTO, isMulti: boolean) => {
		// Si queremos filtrar por cuatrimestre, pero las ANUALES siempre pasan
		if (
			cuatrimestre &&
			materia.cuatrimestre !== cuatrimestre &&
			materia.cuatrimestre !== "ANUAL" &&
			materia.regimen !== "ANUAL"
		) {
			return null;
		}

		// Determinar el label de cuatrimestre/anual
		const cuatrLabel =
			materia.cuatrimestre === "ANUAL"
				? "ANUAL"
				: materia.cuatrimestre || "---";

		return (
			<Box
				key={materia.materia_id}
				sx={{
					position: "relative",
					width: "100%",
					flex: 1,
					display: "flex",
					justifyContent: "center",
					alignItems: "center",
					p: 0.5,
					minHeight: isMulti ? "40px" : "60px",
					borderBottom: isMulti ? "1px dashed #ccc" : "none",
					"&:last-child": { borderBottom: "none" },
					...(materia.es_cuatrimestral && {
						background: `repeating-linear-gradient(45deg, #f0f0f0, #f0f0f0 10px, #ffffff 10px, #ffffff 20px)`,
						border: "1.5px solid #666",
					}),
				}}
			>
				<Box sx={{ width: "100%", textAlign: "center", display: "block" }}>
					<Typography
						component="div"
						sx={{
							fontWeight: "500",
							fontSize: "0.95rem",
							lineHeight: "1.3em",
							color: "black",
							mb: 0.5,
							display: "block",
							width: "100%",
						}}
					>
						{materia.materia_nombre}
					</Typography>
					<Typography
						component="div"
						sx={{
							fontSize: "0.7rem",
							fontStyle: "italic",
							color: "#333",
							mb: 0.5,
							display: "block",
							width: "100%",
						}}
					>
						{variant === "teacher" 
							? (materia.comisiones?.length ? materia.comisiones.join("; ") : "Sin Comisión")
							: (materia.docentes?.length ? materia.docentes.join("; ") : "Sin Docente")}
					</Typography>
					{/* Indicador de cuatrimestre/anual centrado */}
					<Typography
						component="div"
						sx={{
							fontSize: "0.65rem",
							fontWeight: "700",
							color: "#444",
							textTransform: "uppercase",
							letterSpacing: "0.02em",
							display: "block",
							width: "100%",
						}}
					>
						{cuatrLabel}
					</Typography>
				</Box>
			</Box>
		);
	};

	const renderMateriasGrupo = (materiasList: HorarioMateriaCeldaDTO[]) => {
		if (materiasList.length === 0) return null;

		if (materiasList.length === 1) {
			return renderMateria(materiasList[0], false);
		}

		// Combinar nombres de materias
		const nombres = materiasList.map((m) => m.materia_nombre).join(" / ");

		// Combinar subtitulos (docentes o comisiones)
		const todosSubtitulos = Array.from(
			new Set(materiasList.flatMap((m) => variant === "teacher" ? m.comisiones : m.docentes)),
		).filter(Boolean);

		// Combinar regímenes únicos
		const todosRegimenes = Array.from(
			new Set(
				materiasList.map((m) =>
					m.cuatrimestre === "ANUAL" ? "ANUAL" : m.cuatrimestre || "---",
				),
			),
		).filter(Boolean);

		const hasCuatrimestral = materiasList.some((m) => m.es_cuatrimestral);

		return (
			<Box
				key={materiasList[0].materia_id}
				sx={{
					position: "relative",
					width: "100%",
					flex: 1,
					display: "flex",
					justifyContent: "center",
					alignItems: "center",
					p: 0.5,
					minHeight: "60px",
					...(hasCuatrimestral && {
						background: `repeating-linear-gradient(45deg, #f0f0f0, #f0f0f0 10px, #ffffff 10px, #ffffff 20px)`,
						border: "1.5px solid #666",
					}),
				}}
			>
				<Box sx={{ width: "100%", textAlign: "center", display: "block" }}>
					<Typography
						component="div"
						sx={{
							fontWeight: "500",
							fontSize: "0.95rem",
							lineHeight: "1.3em",
							color: "black",
							mb: 0.5,
							display: "block",
							width: "100%",
						}}
					>
						{nombres}
					</Typography>
					<Typography
						component="div"
						sx={{
							fontSize: "0.7rem",
							fontStyle: "italic",
							color: "#333",
							mb: 0.5,
							display: "block",
							width: "100%",
						}}
					>
						{todosSubtitulos.length 
							? todosSubtitulos.join("; ") 
							: (variant === "teacher" ? "Sin Comisión" : "Sin Docente")}
					</Typography>
					<Typography
						component="div"
						sx={{
							fontSize: "0.65rem",
							fontWeight: "700",
							color: "#444",
							textTransform: "uppercase",
							letterSpacing: "0.02em",
							display: "block",
							width: "100%",
						}}
					>
						{todosRegimenes.length ? todosRegimenes.join(" / ") : "---"}
					</Typography>
				</Box>
			</Box>
		);
	};

	return (
		<Box
			sx={{
				width: "100%",
				fontFamily: "'Roboto', sans-serif",
				bgcolor: "white",
				color: "black",
				"@media print": {
					breakInside: "avoid",
					mb: 4,
				},
			}}
		>
			{/* HEADER INSTITUCIONAL */}
			<Box
				sx={{
					border: "2px solid black",
					bgcolor: bgColor,
					p: 1,
					textAlign: "center",
					borderBottom: "none",
				}}
			>
				<Typography
					variant="subtitle1"
					sx={{
						fontWeight: "bold",
						fontSize: "1.1rem",
						color: headerTextColor,
					}}
				>
					{formatProfesoradoHeader(tabla.profesorado_nombre)}
				</Typography>
			</Box>

			{/* SUB-HEADER (TURNO, AÑO, SALON) */}
			<Box
				sx={{
					border: "2px solid black",
					borderTop: "1px solid black",
					p: 0.5,
					display: "flex",
					justifyContent: "space-between",
					alignItems: "center",
					bgcolor: bgColor,
					px: 4,
				}}
			>
				<Typography
					sx={{
						fontWeight: "bold",
						fontSize: "1.1rem",
						color: headerTextColor,
					}}
				>
					{tabla.turno_nombre.toUpperCase()}
				</Typography>
				<Typography
					sx={{
						fontWeight: "bold",
						fontSize: "1.4rem",
						textDecoration: "underline",
						flex: 1,
						textAlign: "center",
						color: headerTextColor,
					}}
				>
					{tabla.anio_plan_label.toUpperCase().replace("ANIO", "AÑO")}
				</Typography>
				<Typography
					sx={{
						fontWeight: "bold",
						fontSize: "1.1rem",
						minWidth: "100px",
						textAlign: "right",
						color: headerTextColor,
					}}
				>
					{salon}
				</Typography>
			</Box>

			{/* TABLA DE HORARIOS */}
			<Box
				sx={{
					display: "grid",
					gridTemplateColumns: `70px 35px repeat(${dias.length}, 1fr) 35px 70px`,
					border: "1px solid black",
				}}
			>
				{/* Cabecera de tabla */}
				<Box
					sx={{
						border: "1px solid black",
						p: 0.5,
						textAlign: "center",
						fontWeight: "bold",
						fontSize: "0.8rem",
						bgcolor: "#E0E0E0",
					}}
				>
					H. R.
				</Box>
				<Box
					sx={{
						border: "1px solid black",
						p: 0.5,
						textAlign: "center",
						fontWeight: "bold",
						fontSize: "0.8rem",
						bgcolor: "#E0E0E0",
					}}
				>
					H.C.
				</Box>
				{dias.map((dia) => (
					<Box
						key={dia.numero}
						sx={{
							border: "1px solid black",
							p: 0.5,
							textAlign: "center",
							fontWeight: "bold",
							fontSize: "0.8rem",
						}}
					>
						{dia.nombre.toUpperCase()}
					</Box>
				))}
				<Box
					sx={{
						border: "1px solid black",
						p: 0.5,
						textAlign: "center",
						fontWeight: "bold",
						fontSize: "0.8rem",
						bgcolor: "#E0E0E0",
					}}
				>
					H.C.
				</Box>
				<Box
					sx={{
						border: "1px solid black",
						p: 0.5,
						textAlign: "center",
						fontWeight: "bold",
						fontSize: "0.8rem",
						bgcolor: "#E0E0E0",
					}}
				>
					H. R.
				</Box>

				{/* Filas de horarios */}
				{franjas.map((franja, index) => {
					const [h1, m1] = franja.desde.split(":").map(Number);
					const [h2, m2] = franja.hasta.split(":").map(Number);
					const duration = h2 * 60 + m2 - (h1 * 60 + m1);
					const isRecreo = franja.es_recreo || (duration > 0 && duration <= 15);

					if (isRecreo) {
						return (
							<React.Fragment key={`recreo-${index}`}>
								{/* Reloj Izquierdo Recreo */}
								<Box
									sx={{
										border: "1px solid black",
										p: 0.5,
										textAlign: "center",
										display: "flex",
										alignItems: "center",
										justifyContent: "center",
										fontSize: "0.7rem",
										fontWeight: "bold",
										bgcolor: "#E0E0E0",
									}}
								>
									{franja.desde}
									<br />
									{franja.hasta}
								</Box>
								{/* Cat Izquierda Recreo */}
								<Box
									sx={{
										border: "1px solid black",
										p: 0.5,
										textAlign: "center",
										display: "flex",
										alignItems: "center",
										justifyContent: "center",
										fontWeight: "bold",
										bgcolor: "#E0E0E0",
									}}
								>
									-
								</Box>

								{/* BANNER CENTRADO RECREO - Solo ocupa las columnas de los días (3 a 8 inclusive) */}
								<Box
									sx={{
										gridColumn: "3 / 9",
										bgcolor: "#F5F5F5",
										border: "1px solid black",
										display: "flex",
										alignItems: "center",
										justifyContent: "center",
										py: 0.3,
										gap: 4,
									}}
								>
									<Typography
										sx={{
											fontWeight: "bold",
											fontStyle: "italic",
											fontSize: "0.8rem",
											letterSpacing: 3,
											color: "#444",
										}}
									>
										• R E C R E O •
									</Typography>
								</Box>

								{/* Cat Derecha Recreo */}
								<Box
									sx={{
										border: "1px solid black",
										p: 0.5,
										textAlign: "center",
										display: "flex",
										alignItems: "center",
										justifyContent: "center",
										fontWeight: "bold",
										bgcolor: "#E0E0E0",
									}}
								>
									-
								</Box>
								{/* Reloj Derecho Recreo */}
								<Box
									sx={{
										border: "1px solid black",
										p: 0.5,
										textAlign: "center",
										display: "flex",
										alignItems: "center",
										justifyContent: "center",
										fontSize: "0.7rem",
										fontWeight: "bold",
										bgcolor: "#E0E0E0",
									}}
								>
									{franja.desde_sec || franja.desde}
									<br />
									{franja.hasta_sec || franja.hasta}
								</Box>
							</React.Fragment>
						);
					}

					return (
						<React.Fragment key={franja.orden}>
							{/* Hora Reloj (Izquierda) */}
							<Box
								sx={{
									border: "1px solid black",
									p: 0.5,
									textAlign: "center",
									display: "flex",
									alignItems: "center",
									justifyContent: "center",
									fontSize: "0.7rem",
									fontWeight: "bold",
									bgcolor: "#E0E0E0",
								}}
							>
								{franja.desde}
								<br />
								{franja.hasta}
							</Box>
							{/* Hora Cátedra (Izquierda) */}
							<Box
								sx={{
									border: "1px solid black",
									p: 0.5,
									textAlign: "center",
									display: "flex",
									alignItems: "center",
									justifyContent: "center",
									fontWeight: "bold",
									bgcolor: "#E0E0E0",
								}}
							>
								{franja.orden > 0 ? `${franja.orden}º` : ""}
							</Box>

							{/* Días de la semana */}
							{dias.map((dia) => {
								const entry = celdas.get(cellKey(dia.numero, franja.posicion));
								const materias = entry?.materias || [];
								return (
									<Box
										key={dia.numero}
										sx={{
											border: "1px solid black",
											minHeight: "125px",
											display: "flex",
											flexDirection: "column",
											alignItems: "stretch",
											justifyContent: "stretch",
											bgcolor: materias.length > 0 ? "white" : "transparent",
											overflow: "hidden",
										}}
									>
										{(() => {
											const filtered = materias.filter(
												(m: HorarioMateriaCeldaDTO) =>
													!cuatrimestre ||
													m.cuatrimestre === cuatrimestre ||
													m.cuatrimestre === "ANUAL" ||
													m.regimen === "ANUAL",
											);
											return renderMateriasGrupo(filtered);
										})()}
									</Box>
								);
							})}

							{/* Hora Cátedra (Derecha) */}
							<Box
								sx={{
									border: "1px solid black",
									p: 0.5,
									textAlign: "center",
									display: "flex",
									alignItems: "center",
									justifyContent: "center",
									fontWeight: "bold",
									bgcolor: "#E0E0E0",
								}}
							>
								{franja.orden > 0 ? `${franja.orden}º` : ""}
							</Box>
							{/* Hora Reloj (Derecha) */}
							<Box
								sx={{
									border: "1px solid black",
									p: 0.5,
									textAlign: "center",
									display: "flex",
									alignItems: "center",
									justifyContent: "center",
									fontSize: "0.7rem",
									fontWeight: "bold",
									bgcolor: "#E0E0E0",
								}}
							>
								{franja.desde_sec || franja.desde}
								<br />
								{franja.hasta_sec || franja.hasta}
							</Box>
						</React.Fragment>
					);
				})}
			</Box>

			<Box
				sx={{
					mt: 1,
					p: 1,
					border: "2px solid black",
					display: "flex",
					alignItems: "stretch",
					gap: 3,
					bgcolor: "#fff",
				}}
			>
				<Box sx={{ flex: 1, minHeight: 40 }}>
					{tabla.observaciones && (
						<>
							<Typography
								variant="caption"
								sx={{
									fontWeight: "bold",
									display: "block",
									textDecoration: "underline",
								}}
							>
								OBSERVACIONES:
							</Typography>
							<Typography
								variant="caption"
								sx={{ fontSize: "0.65rem", whiteSpace: "pre-wrap" }}
							>
								{tabla.observaciones}
							</Typography>
						</>
					)}
				</Box>

				{/* Leyenda de materias cuatrimestrales */}
				<Stack
					direction="row"
					spacing={1}
					alignItems="center"
					sx={{
						border: "1px solid black",
						p: 0.5,
						bgcolor: "#f9f9f9",
						minWidth: 200,
					}}
				>
					<Box
						sx={{
							width: 40,
							height: 25,
							border: "1px solid black",
							background: `repeating-linear-gradient(45deg, #e0e0e0, #e0e0e0 5px, #ffffff 5px, #ffffff 10px)`,
						}}
					/>
					<Typography
						variant="caption"
						sx={{ fontSize: "0.6rem", fontWeight: 600 }}
					>
						Las celdas sombreadas con borde reforzado corresponden a MATERIAS
						CUATRIMESTRALES
					</Typography>
				</Stack>
			</Box>

			{/* Leyenda Malvinas (Institucional) */}
			<Box sx={{ mt: 1.5, textAlign: "center" }}>
				<Typography
					sx={{ fontSize: "0.65rem", fontStyle: "italic", color: "#666" }}
				>
					&ldquo;Las Islas Malvinas, Georgias, Sándwich del Sur y los Hielos
					Continentales, son y serán Argentinas&rdquo;
				</Typography>
			</Box>
		</Box>
	);
};

export default InstitutionalScheduleFormat;
