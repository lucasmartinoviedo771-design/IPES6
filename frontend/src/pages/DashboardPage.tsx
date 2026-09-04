import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Container from "@mui/material/Container";
import Stack from "@mui/material/Stack";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import HowToRegIcon from "@mui/icons-material/HowToReg";
import SchoolIcon from "@mui/icons-material/School";
import PeopleAltIcon from "@mui/icons-material/PeopleAlt";
import ScheduleIcon from "@mui/icons-material/Schedule";
import BarChartIcon from "@mui/icons-material/BarChart";
import { useCallback, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import StudentAlerts from "@/components/dashboard/StudentAlerts";
import { PageHero } from "@/components/ui/GradientTitles";
import TabDocentes from "@/features/analytics/components/TabDocentes";
import TabEstudiantes from "@/features/analytics/components/TabEstudiantes";
import TabPreinscripciones from "@/features/analytics/components/TabPreinscripciones";
import TabRendimientoAcademico from "@/features/analytics/components/TabRendimientoAcademico";
import TabAuditoria from "@/features/analytics/components/TabAuditoria";
import TabAusentismo from "@/features/analytics/components/TabAusentismo";
import TabMesasYTramites from "@/features/analytics/components/TabMesasYTramites";
import {
	INSTITUTIONAL_TERRACOTTA,
	INSTITUTIONAL_TERRACOTTA_DARK,
} from "@/styles/institutionalColors";
import GavelIcon from "@mui/icons-material/Gavel";
import ReportIcon from "@mui/icons-material/Report";
import EventNoteIcon from "@mui/icons-material/EventNote";

type TabKey =
	| "preinscripciones"
	| "estudiantes"
	| "docentes"
	| "rendimiento"
	| "auditoria"
	| "ausentismo"
	| "mesas";

const TABS_VALIDAS: TabKey[] = [
	"preinscripciones",
	"estudiantes",
	"docentes",
	"rendimiento",
	"auditoria",
	"ausentismo",
	"mesas",
];

export default function DashboardPage() {
	const navigate = useNavigate();
	const [searchParams, setSearchParams] = useSearchParams();

	// 1. Manejo del Tab activo sincronizado con la URL
	const currentTabParam = (searchParams.get("tab") as TabKey) || "preinscripciones";
	const [currentTab, setCurrentTab] = useState<TabKey>(
		TABS_VALIDAS.includes(currentTabParam)
			? currentTabParam
			: "preinscripciones",
	);

	// Filtros compartidos
	const anioParam = Number(searchParams.get("anio")) || 2026;
	const profParam = searchParams.get("profesorado_id")
		? Number(searchParams.get("profesorado_id"))
		: undefined;

	const [anio, setAnio] = useState<number>(anioParam);
	const [profesoradoId, setProfesoradoId] = useState<number | undefined>(profParam);

	useEffect(() => {
		const tabFromUrl = searchParams.get("tab") as TabKey;
		if (tabFromUrl && tabFromUrl !== currentTab) {
			setCurrentTab(tabFromUrl);
		}
	}, [searchParams, currentTab]);

	const handleTabChange = (_: React.SyntheticEvent, newTab: TabKey) => {
		setCurrentTab(newTab);
		const newParams = new URLSearchParams(searchParams);
		newParams.set("tab", newTab);
		setSearchParams(newParams);
	};

	const handleAnioChange = useCallback(
		(newAnio: number) => {
			setAnio(newAnio);
			const newParams = new URLSearchParams(searchParams);
			newParams.set("anio", String(newAnio));
			setSearchParams(newParams);
		},
		[searchParams, setSearchParams],
	);

	const handleProfesoradoChange = useCallback(
		(newProf?: number) => {
			setProfesoradoId(newProf);
			const newParams = new URLSearchParams(searchParams);
			if (newProf) {
				newParams.set("profesorado_id", String(newProf));
			} else {
				newParams.delete("profesorado_id");
			}
			setSearchParams(newParams);
		},
		[searchParams, setSearchParams],
	);

	return (
		<Stack spacing={3}>
			{/* Alertas institucionales para estudiantes si las hubiera */}
			<StudentAlerts />

			{/* Hero Principal */}
			<PageHero
				title="Panel de Control y Analítica Institucional"
				subtitle="Monitoreo ejecutivo de admisión, trayectorias estudiantiles y espacios curriculares"
				actions={
					<Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} alignItems="center">
						
						<Button
							variant="contained"
							onClick={() => navigate("/preinscripciones")}
							startIcon={<ScheduleIcon />}
							sx={{
								background: `linear-gradient(135deg, ${INSTITUTIONAL_TERRACOTTA} 0%, ${INSTITUTIONAL_TERRACOTTA_DARK} 100%)`,
								color: "#fff",
								textTransform: "none",
								fontWeight: 700,
								borderRadius: 999,
								px: 3,
								boxShadow: "0 20px 40px rgba(183,105,78,0.35)",
								"&:hover": {
									background: `linear-gradient(135deg, ${INSTITUTIONAL_TERRACOTTA_DARK} 0%, ${INSTITUTIONAL_TERRACOTTA_DARK} 100%)`,
								},
							}}
						>
							Gestionar preinscripciones
						</Button>
					</Stack>
				}
			/>

			{/* Barra de Tabs */}
			<Box sx={{ borderBottom: 1, borderColor: "divider", bgcolor: "background.paper", borderRadius: 2, px: 2 }}>
				<Tabs
					value={currentTab}
					onChange={handleTabChange}
					variant="scrollable"
					scrollButtons="auto"
					textColor="primary"
					indicatorColor="primary"
					sx={{
						"& .MuiTab-root": {
							textTransform: "none",
							fontWeight: 700,
							fontSize: "0.95rem",
							py: 1.8,
							gap: 1,
						},
					}}
				>
					<Tab
						value="preinscripciones"
						icon={<HowToRegIcon />}
						iconPosition="start"
						label="Preinscripciones"
					/>
					<Tab
						value="estudiantes"
						icon={<SchoolIcon />}
						iconPosition="start"
						label="Estudiantes (Alerta Temprana)"
					/>
					<Tab
						value="docentes"
						icon={<PeopleAltIcon />}
						iconPosition="start"
						label="Docentes & Cátedras"
					/>
					<Tab
						value="rendimiento"
						icon={<BarChartIcon />}
						iconPosition="start"
						label="Rendimiento Académico"
					/>
					<Tab
						value="auditoria"
						icon={<GavelIcon />}
						iconPosition="start"
						label="Auditoría & Seguridad"
					/>
					<Tab
						value="ausentismo"
						icon={<ReportIcon />}
						iconPosition="start"
						label="Ausentismo Consolidado"
					/>
					<Tab
						value="mesas"
						icon={<EventNoteIcon />}
						iconPosition="start"
						label="Mesas & Trámites"
					/>
				</Tabs>
			</Box>

			{/* Contenido según la solapa activa */}
			{currentTab === "preinscripciones" && (
				<TabPreinscripciones
					anio={anio}
					profesoradoId={profesoradoId}
					onAnioChange={handleAnioChange}
					onProfesoradoChange={handleProfesoradoChange}
				/>
			)}

			{currentTab === "estudiantes" && (
				<TabEstudiantes
					anio={anio}
					profesoradoId={profesoradoId}
					onAnioChange={handleAnioChange}
					onProfesoradoChange={handleProfesoradoChange}
				/>
			)}

			{currentTab === "docentes" && (
				<TabDocentes
					anio={anio}
					profesoradoId={profesoradoId}
					onAnioChange={handleAnioChange}
					onProfesoradoChange={handleProfesoradoChange}
				/>
			)}

			{currentTab === "rendimiento" && (
				<TabRendimientoAcademico
					anio={anio}
					profesoradoId={profesoradoId}
					onAnioChange={handleAnioChange}
					onProfesoradoChange={handleProfesoradoChange}
				/>
			)}

			{currentTab === "auditoria" && (
				<TabAuditoria />
			)}

			{currentTab === "ausentismo" && (
				<TabAusentismo
					anio={anio}
					profesoradoId={profesoradoId}
					onAnioChange={handleAnioChange}
					onProfesoradoChange={handleProfesoradoChange}
				/>
			)}

			{currentTab === "mesas" && (
				<TabMesasYTramites />
			)}
		</Stack>
	);
}
