import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Select, { type SelectChangeEvent } from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import type { Carrera } from "@/api/carreras";

export type FactorRiesgo = "todos" | "recursa" | "finales" | "inscripcion" | "aplazos";

interface AnalyticsFiltersProps {
	anio: number;
	onAnioChange: (anio: number) => void;
	profesoradoId: number | undefined;
	onProfesoradoChange: (id: number | undefined) => void;
	carreras: Carrera[];
	factor?: FactorRiesgo;
	onFactorChange?: (factor: FactorRiesgo) => void;
}

const ANIOS_DISPONIBLES = [2026, 2025, 2024, 2023];

const FACTORES: { id: FactorRiesgo; label: string }[] = [
	{ id: "todos", label: "Todos los factores" },
	{ id: "recursa", label: "Recursando materias" },
	{ id: "finales", label: "Finales adeudados" },
	{ id: "inscripcion", label: "Sin inscripción activa" },
	{ id: "aplazos", label: "Aplazos recientes" },
];

export default function AnalyticsFilters({
	anio,
	onAnioChange,
	profesoradoId,
	onProfesoradoChange,
	carreras,
	factor = "todos",
	onFactorChange,
}: AnalyticsFiltersProps) {
	const handleAnioSelect = (e: SelectChangeEvent<number>) => {
		onAnioChange(Number(e.target.value));
	};

	const handleProfesoradoSelect = (e: SelectChangeEvent<string>) => {
		const val = e.target.value;
		onProfesoradoChange(val === "ALL" ? undefined : Number(val));
	};

	return (
		<Box
			sx={{
				p: 2.5,
				mb: 3,
				bgcolor: "#ffffff",
				borderRadius: 2,
				border: "1px solid #e2e8f0",
				boxShadow: "0 2px 10px rgba(15,23,42,0.03)",
			}}
		>
			<Stack spacing={2}>
				<Stack
					direction={{ xs: "column", sm: "row" }}
					spacing={2}
					alignItems={{ sm: "center" }}
					justifyContent="space-between"
				>
					<Typography variant="subtitle1" fontWeight={700} color="#1e293b">
						Filtros de Análisis
					</Typography>

					<Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ minWidth: { sm: 480 } }}>
						<FormControl size="small" sx={{ minWidth: 140 }}>
							<InputLabel id="anio-select-label">Año Lectivo</InputLabel>
							<Select
								labelId="anio-select-label"
								value={anio}
								label="Año Lectivo"
								onChange={handleAnioSelect}
							>
								{ANIOS_DISPONIBLES.map((y) => (
									<MenuItem key={y} value={y}>
										Ciclo {y}
									</MenuItem>
								))}
							</Select>
						</FormControl>

						<FormControl size="small" fullWidth>
							<InputLabel id="carrera-select-label">Carrera / Profesorado</InputLabel>
							<Select
								labelId="carrera-select-label"
								value={profesoradoId ? String(profesoradoId) : "ALL"}
								label="Carrera / Profesorado"
								onChange={handleProfesoradoSelect}
							>
								<MenuItem value="ALL">Todas las carreras</MenuItem>
								{carreras.map((c) => (
									<MenuItem key={c.id} value={String(c.id)}>
										{c.nombre}
									</MenuItem>
								))}
							</Select>
						</FormControl>
					</Stack>
				</Stack>

				{onFactorChange && (
					<>
						<Divider sx={{ borderStyle: "dashed" }} />
						<Stack
							direction={{ xs: "column", sm: "row" }}
							spacing={1.5}
							alignItems={{ sm: "center" }}
						>
							<Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ textTransform: "uppercase", letterSpacing: 0.5 }}>
								Factores Académicos:
							</Typography>
							<Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
								{FACTORES.map((f) => {
									const isSelected = factor === f.id;
									return (
										<Chip
											key={f.id}
											label={f.label}
											size="small"
											clickable
											color={isSelected ? "primary" : "default"}
											variant={isSelected ? "filled" : "outlined"}
											onClick={() => onFactorChange(f.id)}
											sx={{
												fontWeight: isSelected ? 700 : 500,
												borderRadius: "6px",
											}}
										/>
									);
								})}
							</Stack>
						</Stack>
					</>
				)}
			</Stack>
		</Box>
	);
}
