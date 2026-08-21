import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import Stack from "@mui/material/Stack";
import dayjs from "dayjs";
import { useEffect, useMemo } from "react";
import "dayjs/locale/es";
import { useQuery } from "@tanstack/react-query";
import { type Carrera, fetchCarreras } from "@/api/carreras";
import CalendarioEventosPanel from "@/components/asistencia/CalendarioEventosPanel";
import BackButton from "@/components/ui/BackButton";
import { PageHero } from "@/components/ui/GradientTitles";
import { useAuth } from "@/context/AuthContext";
import { hasAnyRole } from "@/utils/roles";
import { DocentesPanel } from "./asistencia-reportes/DocentesPanel";
import { DocentesPorFechaPanel } from "./asistencia-reportes/DocentesPorFechaPanel";
import { EstudiantesPanel } from "./asistencia-reportes/EstudiantesPanel";
import { EstudiantesPorMateriaPanel } from "./asistencia-reportes/EstudiantesPorMateriaPanel";
import { type Option, ordenarPorLabel } from "./asistencia-reportes/types";
import { useDocentesAsistencia } from "./asistencia-reportes/useDocentesAsistencia";
import { useEstudiantesAsistencia } from "./asistencia-reportes/useEstudiantesAsistencia";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import Paper from "@mui/material/Paper";
import { useState } from "react";

dayjs.locale("es");

const AsistenciaReportesPage = () => {
	const { user } = useAuth();

	const puedeGestionarDocentes = hasAnyRole(user, [
		"admin",
		"secretaria",
		"bedel",
	]);
	const puedeVerDocentes =
		puedeGestionarDocentes ||
		hasAnyRole(user, ["coordinador", "bedel", "jefes", "jefa_aaee", "docente"]);

	const puedeGestionarEstudiantes = hasAnyRole(user, [
		"admin",
		"secretaria",
		"bedel",
		"profesor",
	]);
	const puedeVerEstudiantes =
		puedeGestionarEstudiantes ||
		hasAnyRole(user, ["docente", "coordinador", "jefes", "tutor", "jefa_aaee"]);

	const esDocenteSolo =
		hasAnyRole(user, ["docente"]) &&
		!hasAnyRole(user, [
			"admin",
			"secretaria",
			"bedel",
			"coordinador",
			"tutor",
			"jefes",
			"jefa_aaee",
		]);

	useEffect(() => {
		document.title = "Reportes de asistencia";
	}, []);

	const { data: profesoradosData, isLoading: profesoradosLoading } = useQuery<
		Carrera[]
	>({
		queryKey: ["asistencia", "profesorados"],
		queryFn: () => fetchCarreras(),
		enabled: puedeVerEstudiantes || puedeVerDocentes,
		staleTime: 5 * 60 * 1000,
	});

	const profesoradoOptions = useMemo<Option[]>(() => {
		if (!profesoradosData) return [];
		return profesoradosData
			.map((prof) => ({ id: prof.id, label: prof.nombre }))
			.sort(ordenarPorLabel);
	}, [profesoradosData]);

	const estudiantesAsistencia = useEstudiantesAsistencia({
		profesoradoOptions,
		puedeVerEstudiantes,
	});

	const docentesAsistencia = useDocentesAsistencia({
		puedeVerDocentes,
		esDocenteSolo,
		userDni: user?.dni,
	});

	const [tabActual, setTabActual] = useState<number>(0);

	return (
		<Box sx={{ px: { xs: 1, md: 3 }, py: 2 }}>
			<Stack spacing={3}>
				<BackButton fallbackPath="/secretaria" />
				<PageHero
					title="Reportes de asistencia"
					subtitle="Gestión y seguimiento integral de asistencia para estudiantes, docentes y calendario institucional"
				/>

				{/* Navegación por Pestañas / Tabs Principales */}
				<Paper elevation={1} sx={{ borderRadius: 2 }}>
					<Tabs
						value={tabActual}
						onChange={(_, newValue) => setTabActual(newValue)}
						variant="scrollable"
						scrollButtons="auto"
						indicatorColor="primary"
						textColor="primary"
						sx={{
							px: 2,
							"& .MuiTab-root": {
								fontWeight: 700,
								fontSize: "0.95rem",
								py: 2,
							},
						}}
					>
						<Tab label="👨‍🎓 Asistencia de Estudiantes" />
						<Tab label="👨‍🏫 Asistencia de Docentes y Cargos" />
						<Tab label="📅 Suspensiones, Feriados y Calendario" />
					</Tabs>
				</Paper>

				{/* Contenido de la Pestaña 1: Estudiantes */}
				{tabActual === 0 && (
					<EstudiantesPanel
						puedeGestionarEstudiantes={puedeGestionarEstudiantes}
						puedeVerEstudiantes={puedeVerEstudiantes}
						profesoradoOptions={profesoradoOptions}
						profesoradosLoading={profesoradosLoading}
						estudianteProfesorado={
							estudiantesAsistencia.estudianteProfesorado
						}
						setEstudianteProfesorado={
							estudiantesAsistencia.setEstudianteProfesorado
						}
						estudiantePlan={estudiantesAsistencia.estudiantePlan}
						setEstudiantePlan={estudiantesAsistencia.setEstudiantePlan}
						estudianteMateria={estudiantesAsistencia.estudianteMateria}
						setEstudianteMateria={estudiantesAsistencia.setEstudianteMateria}
						estudianteComision={estudiantesAsistencia.estudianteComision}
						setEstudianteComision={
							estudiantesAsistencia.setEstudianteComision
						}
						estudianteDesde={estudiantesAsistencia.estudianteDesde}
						setEstudianteDesde={estudiantesAsistencia.setEstudianteDesde}
						estudianteHasta={estudiantesAsistencia.estudianteHasta}
						setEstudianteHasta={estudiantesAsistencia.setEstudianteHasta}
						estudianteResultados={estudiantesAsistencia.estudianteResultados}
						cargandoEstudiantes={estudiantesAsistencia.cargandoEstudiantes}
						estudiantePlanOptions={
							estudiantesAsistencia.estudiantePlanOptions
						}
						estudiantePlanesLoading={
							estudiantesAsistencia.estudiantePlanesLoading
						}
						estudianteMateriaOptions={
							estudiantesAsistencia.estudianteMateriaOptions
						}
						estudianteMateriasLoading={
							estudiantesAsistencia.estudianteMateriasLoading
						}
						estudianteComisionOptions={
							estudiantesAsistencia.estudianteComisionOptions
						}
						estudianteComisionesLoading={
							estudiantesAsistencia.estudianteComisionesLoading
						}
						handleBuscarEstudiantes={
							estudiantesAsistencia.handleBuscarEstudiantes
						}
					/>
				)}

				{/* Contenido de la Pestaña 2: Docentes */}
				{tabActual === 1 && (
					<DocentesPanel
						puedeGestionarDocentes={puedeGestionarDocentes}
						puedeVerDocentes={puedeVerDocentes}
						esDocenteSolo={esDocenteSolo}
						docenteDni={docentesAsistencia.docenteDni}
						setDocenteDni={docentesAsistencia.setDocenteDni}
						docenteDesde={docentesAsistencia.docenteDesde}
						setDocenteDesde={docentesAsistencia.setDocenteDesde}
						docenteHasta={docentesAsistencia.docenteHasta}
						setDocenteHasta={docentesAsistencia.setDocenteHasta}
						docenteDiaSemana={docentesAsistencia.docenteDiaSemana}
						setDocenteDiaSemana={docentesAsistencia.setDocenteDiaSemana}
						docenteClases={docentesAsistencia.docenteClases}
						docenteInfo={docentesAsistencia.docenteInfo}
						cargandoDocente={docentesAsistencia.cargandoDocente}
						docenteProfesorado={docentesAsistencia.docenteProfesorado}
						setDocenteProfesorado={docentesAsistencia.setDocenteProfesorado}
						docentePlan={docentesAsistencia.docentePlan}
						setDocentePlan={docentesAsistencia.setDocentePlan}
						docenteMateria={docentesAsistencia.docenteMateria}
						setDocenteMateria={docentesAsistencia.setDocenteMateria}
						docenteComision={docentesAsistencia.docenteComision}
						setDocenteComision={docentesAsistencia.setDocenteComision}
						docenteFecha={docentesAsistencia.docenteFecha}
						setDocenteFecha={docentesAsistencia.setDocenteFecha}
						docenteProfesOptions={docentesAsistencia.docenteProfesOptions}
						docentePlanOptions={docentesAsistencia.docentePlanOptions}
						docenteMateriaOptions={docentesAsistencia.docenteMateriaOptions}
						docenteComisionOptions={docentesAsistencia.docenteComisionOptions}
						docenteFechaOptions={docentesAsistencia.docenteFechaOptions}
						docenteClasesFiltradas={docentesAsistencia.docenteClasesFiltradas}
						handleBuscarDocente={docentesAsistencia.handleBuscarDocente}
					/>
				)}

				{/* Contenido de la Pestaña 3: Suspensiones, Feriados y Calendario */}
				{tabActual === 2 && (
					<CalendarioEventosPanel canManage={puedeGestionarDocentes} />
				)}
			</Stack>
		</Box>
	);
};

export default AsistenciaReportesPage;
