import Box from "@mui/material/Box";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import Badge from "@mui/material/Badge";
import Paper from "@mui/material/Paper";
import AssignmentIndIcon from "@mui/icons-material/AssignmentInd";
import HowToRegIcon from "@mui/icons-material/HowToReg";
import React, { useState } from "react";
import BackButton from "@/components/ui/BackButton";
import { PageHero } from "@/components/ui/GradientTitles";
import AsistenciaDialog from "./curso-introductorio/AsistenciaDialog";
import CierreDialog from "./curso-introductorio/CierreDialog";
import CohorteDialog from "./curso-introductorio/CohorteDialog";
import CohortesTable from "./curso-introductorio/CohortesTable";
import InscribirDialog from "./curso-introductorio/InscribirDialog";
import PendientesTable from "./curso-introductorio/PendientesTable";
import RegistrosTable from "./curso-introductorio/RegistrosTable";
import { useCursoIntroductorio } from "./curso-introductorio/useCursoIntroductorio";

const CursoIntroductorioPage: React.FC = () => {
	const {
		// data
		profesorados,
		turnos,
		cohortes,
		cohortesLoading,
		ventanas,
		ventanasLoading,
		pendientes,
		pendientesLoading,
		pendientesProfesoradoId,
		setPendientesProfesoradoId,
		pendientesSoloActivos,
		setPendientesSoloActivos,
		pendientesSoloConfirmados,
		setPendientesSoloConfirmados,
		pendientesAnioIngreso,
		setPendientesAnioIngreso,
		registros,
		registrosLoading,
		registroFiltros,
		setRegistroFiltros,
		cohorteOptions,
		anioOptions,
		// permissions
		puedeGestionarCohortes,
		puedeGestionarRegistros,
		// cohorte dialog
		cohorteDialogOpen,
		cohorteForm,
		setCohorteForm,
		editingCohorteId,
		savingCohorte,
		creatingCohortesTurnos,
		cohorteAccionBloqueada,
		abrirDialogoCohorte,
		cerrarDialogoCohorte,
		handleGuardarCohorte,
		handleCrearCohortesTodosTurnos,
		// inscripción dialog
		inscribirDialogOpen,
		pendienteSeleccionado,
		inscribirForm,
		setInscribirForm,
		inscribiendo,
		abrirDialogoInscripcion,
		cerrarDialogoInscripcion,
		handleInscribir,
		// asistencia dialog
		asistenciaDialogOpen,
		asistenciaValor,
		setAsistenciaValor,
		guardandoAsistencia,
		abrirDialogoAsistencia,
		cerrarDialogoAsistencia,
		handleGuardarAsistencia,
		// cierre dialog
		cierreDialogOpen,
		cierreForm,
		setCierreForm,
		guardandoCierre,
		abrirDialogoCierre,
		cerrarDialogoCierre,
		handleGuardarCierre,
		// loaders
		loadRegistros,
	} = useCursoIntroductorio();

	const [tabActual, setTabActual] = useState<"pendientes" | "registros">("pendientes");

	return (
		<Box sx={{ p: 3 }}>
			<BackButton fallbackPath="/secretaria" />
			<PageHero
				title="Curso introductorio"
				subtitle="Gestioná cohortes, asistencias y resultados del Curso Introductorio."
			/>

			<CohortesTable
				cohortes={cohortes}
				cohortesLoading={cohortesLoading}
				puedeGestionarCohortes={puedeGestionarCohortes}
				onNuevaCohorte={() => abrirDialogoCohorte()}
				onEditarCohorte={(cohorte) => abrirDialogoCohorte(cohorte)}
			/>

			{/* ── Tabs de Navegación entre Pendientes y Registros ── */}
			<Paper variant="outlined" sx={{ mb: 3, borderRadius: 2 }}>
				<Tabs
					value={tabActual}
					onChange={(_, newValue) => setTabActual(newValue)}
					textColor="primary"
					indicatorColor="primary"
					variant="scrollable"
					scrollButtons="auto"
					sx={{ px: 2, borderBottom: 1, borderColor: "divider" }}
				>
					<Tab
						value="pendientes"
						icon={<AssignmentIndIcon />}
						iconPosition="start"
						label={
							<Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
								<span>Estudiantes pendientes</span>
								{pendientes.length > 0 && (
									<Badge
										badgeContent={pendientes.length}
										color="warning"
										max={999}
									/>
								)}
							</Box>
						}
						sx={{ textTransform: "none", fontWeight: 600, minHeight: 48 }}
					/>
					<Tab
						value="registros"
						icon={<HowToRegIcon />}
						iconPosition="start"
						label={
							<Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
								<span>Registros y asistencias</span>
								{registros.length > 0 && (
									<Badge
										badgeContent={registros.length}
										color="primary"
										max={999}
									/>
								)}
							</Box>
						}
						sx={{ textTransform: "none", fontWeight: 600, minHeight: 48 }}
					/>
				</Tabs>

				<Box sx={{ p: 2 }}>
					{tabActual === "pendientes" ? (
						<PendientesTable
							profesorados={profesorados}
							pendientes={pendientes}
							pendientesLoading={pendientesLoading}
							pendientesProfesoradoId={pendientesProfesoradoId}
							pendientesSoloActivos={pendientesSoloActivos}
							pendientesSoloConfirmados={pendientesSoloConfirmados}
							pendientesAnioIngreso={pendientesAnioIngreso}
							puedeGestionarRegistros={puedeGestionarRegistros}
							cohortesDisponibles={cohortes.length > 0}
							onChangePendientesProfesorado={setPendientesProfesoradoId}
							onChangePendientesSoloActivos={setPendientesSoloActivos}
							onChangePendientesSoloConfirmados={setPendientesSoloConfirmados}
							onChangePendientesAnioIngreso={setPendientesAnioIngreso}
							onInscribir={abrirDialogoInscripcion}
						/>
					) : (
						<RegistrosTable
							profesorados={profesorados}
							turnos={turnos}
							registros={registros}
							registrosLoading={registrosLoading}
							registroFiltros={registroFiltros}
							cohorteOptions={cohorteOptions}
							anioOptions={anioOptions}
							puedeGestionarRegistros={puedeGestionarRegistros}
							onChangeFiltros={setRegistroFiltros}
							onActualizar={loadRegistros}
							onAsistencia={abrirDialogoAsistencia}
							onCierre={abrirDialogoCierre}
						/>
					)}
				</Box>
			</Paper>

			<CohorteDialog
				open={cohorteDialogOpen}
				editingCohorteId={editingCohorteId}
				cohorteForm={cohorteForm}
				setCohorteForm={setCohorteForm}
				cohorteAccionBloqueada={cohorteAccionBloqueada}
				savingCohorte={savingCohorte}
				creatingCohortesTurnos={creatingCohortesTurnos}
				profesorados={profesorados}
				turnos={turnos}
				ventanas={ventanas}
				ventanasLoading={ventanasLoading}
				onCancelar={cerrarDialogoCohorte}
				onGuardar={handleGuardarCohorte}
				onCrearTodosTurnos={handleCrearCohortesTodosTurnos}
			/>

			<InscribirDialog
				open={inscribirDialogOpen}
				pendienteSeleccionado={pendienteSeleccionado}
				inscribirForm={inscribirForm}
				setInscribirForm={setInscribirForm}
				inscribiendo={inscribiendo}
				cohorteOptions={cohorteOptions}
				turnos={turnos}
				onCancelar={cerrarDialogoInscripcion}
				onConfirmar={handleInscribir}
			/>

			<AsistenciaDialog
				open={asistenciaDialogOpen}
				asistenciaValor={asistenciaValor}
				guardandoAsistencia={guardandoAsistencia}
				onChangeAsistencia={setAsistenciaValor}
				onCancelar={cerrarDialogoAsistencia}
				onGuardar={handleGuardarAsistencia}
			/>

			<CierreDialog
				open={cierreDialogOpen}
				cierreForm={cierreForm}
				setCierreForm={setCierreForm}
				guardandoCierre={guardandoCierre}
				onCancelar={cerrarDialogoCierre}
				onGuardar={handleGuardarCierre}
			/>
		</Box>
	);
};

export default CursoIntroductorioPage;
