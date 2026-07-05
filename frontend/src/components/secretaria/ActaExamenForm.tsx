import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import PrintIcon from "@mui/icons-material/Print";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import type React from "react";
import {
	descargarActaComisionadosPdf,
	descargarActaPdf,
} from "@/api/cargaNotas";
import OralExamActaDialog from "@/components/secretaria/OralExamActaDialog";
import FinalConfirmationDialog from "@/components/ui/FinalConfirmationDialog";
import { BuscarMesaSection } from "./acta-examen-form/BuscarMesaSection";
import { EncabezadoActaSection } from "./acta-examen-form/EncabezadoActaSection";
import { ResultadosTable } from "./acta-examen-form/ResultadosTable";
import { TribunalSection } from "./acta-examen-form/TribunalSection";
import type { ActaExamenFormProps } from "./acta-examen-form/types";
import { useActaExamenForm } from "./acta-examen-form/useActaExamenForm";

const ActaExamenForm: React.FC<ActaExamenFormProps> = ({
	strict = true,
	title = "Generar acta de examen",
	subtitle = "Complete los datos del acta y registre los resultados obtenidos por cada estudiante.",
	successMessage = "Acta generada correctamente.",
	initialEstudiantes = [],
	headerAction,
	editId,
	mesaPreseleccionada,
	estudiantesPreseleccionados,
}) => {
	const f = useActaExamenForm({
		strict,
		successMessage,
		editId,
		mesaPreseleccionada,
		estudiantesPreseleccionados,
	});

	if (f.metadataQuery.isLoading) {
		return (
			<Box
				display="flex"
				justifyContent="center"
				alignItems="center"
				minHeight="60vh"
			>
				<CircularProgress />
			</Box>
		);
	}

	if (f.metadataQuery.isError || !f.metadata) {
		return (
			<Alert severity="error">
				No se pudo cargar la información inicial para generar actas de examen.
			</Alert>
		);
	}

	return (
		<>
			<Stack spacing={3} sx={{ p: { xs: 1, md: 3 } }}>
				<Stack
					direction="row"
					justifyContent="space-between"
					alignItems="flex-start"
					spacing={2}
				>
					<Box>
						<Typography variant="h4" fontWeight={700}>
							{title}
						</Typography>
						<Typography color="text.secondary">{subtitle}</Typography>
					</Box>
					{headerAction && <Box>{headerAction}</Box>}
				</Stack>

				{!mesaPreseleccionada && (
					<BuscarMesaSection
						mesaCodigo={f.mesaCodigo}
						setMesaCodigo={f.setMesaCodigo}
						mesaBuscando={f.mesaBuscando}
						mesaBusquedaError={f.mesaBusquedaError}
						mesaSeleccionada={f.mesaSeleccionada}
						onBuscar={f.handleBuscarMesa}
					/>
				)}

				<EncabezadoActaSection
					tipo={f.tipo}
					setTipo={f.setTipo}
					profesoradoId={f.profesoradoId}
					setProfesoradoId={f.setProfesoradoId}
					setPlanId={f.setPlanId}
					setMateriaId={f.setMateriaId}
					profesorados={f.profesorados}
					planesDisponibles={f.planesDisponibles}
					planId={f.planId}
					setPlanId2={f.setPlanId2}
					selectedProfesorado={f.selectedProfesorado}
					materiasDisponibles={f.materiasDisponibles}
					materiaId={f.materiaId}
					selectedPlan={f.selectedPlan}
					fecha={f.fecha}
					setFecha={f.setFecha}
					folio={f.folio}
					setFolio={f.setFolio}
					libro={f.libro}
					setLibro={f.setLibro}
					observaciones={f.observaciones}
					setObservaciones={f.setObservaciones}
					readOnly={!!mesaPreseleccionada}
				/>

				<TribunalSection
					docentes={f.docentes}
					docenteOptions={f.docenteOptions}
					onDocenteInputChange={f.handleDocenteInputChange}
					readOnly={!!mesaPreseleccionada}
				/>

				<ResultadosTable
					estudiantes={f.estudiantes}
					notaOptions={f.notaOptions}
					loadingEstudianteDni={f.loadingEstudianteDni}
					initialEstudiantes={initialEstudiantes}
					estudiantesMetadata={f.metadata?.estudiantes ?? []}
					strict={strict}
					summary={f.summary}
					onAgregar={f.handleAgregarEstudiante}
					onEliminar={f.handleEliminarEstudiante}
					onDniChange={f.handleEstudianteDniChange}
					onUpdateEstudiante={f.updateEstudiante}
					onOpenOralActa={f.handleOpenOralActa}
					readOnlyEstudiantes={!!mesaPreseleccionada}
				/>

				<Stack direction="row" justifyContent="flex-end">
					<Button
						variant="contained"
						size="large"
						onClick={f.handleSubmit}
						disabled={f.isSaving}
						startIcon={
							f.isSaving ? (
								<CircularProgress size={18} color="inherit" />
							) : undefined
						}
					>
						{f.isSaving
							? f.isEditing
								? "Actualizando..."
								: "Generando..."
							: f.isEditing
								? "Actualizar acta"
								: "Generar acta"}
					</Button>
				</Stack>
			</Stack>

			{f.oralDialogEstudiante && (
				<OralExamActaDialog
					open
					onClose={() => f.setOralDialogEstudiante(null)}
					estudianteNombre={
						f.oralDialogEstudiante.apellido_nombre || "Estudiante/a"
					}
					estudianteDni={f.oralDialogEstudiante.dni || "-"}
					carrera={f.selectedProfesorado?.nombre ?? ""}
					unidadCurricular={f.selectedMateria?.nombre ?? ""}
					curso={f.mesaSeleccionada?.codigo ?? ""}
					fechaMesa={f.fecha}
					tribunal={f.tribunalInfo}
					existingValues={f.oralActDrafts[f.oralDialogEstudiante.internoId]}
					defaultNota={f.oralDialogEstudiante.calificacion_definitiva}
					loading={false}
					saving={false}
					onSave={f.handleSaveOralActa}
					mesaId={f.mesaSeleccionada?.id}
					inscripcionId={f.oralDialogEstudiante.inscripcionId}
				/>
			)}

			<FinalConfirmationDialog
				open={f.confirmActaOpen}
				onConfirm={f.handleConfirmActaSubmit}
				onCancel={f.handleCancelActaSubmit}
				contextText={f.confirmActaContext}
				loading={f.isSaving}
			/>

			<Dialog
				open={!!f.createdActa}
				onClose={() => f.setCreatedActa(null)}
				maxWidth="xs"
				fullWidth
			>
				<DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1 }}>
					<CheckCircleIcon color="success" />
					Acta Generada
				</DialogTitle>
				<DialogContent>
					<Typography variant="body1" gutterBottom>
						El acta <b>{f.createdActa?.codigo}</b> ha sido generada
						correctamente.
					</Typography>
					<Typography variant="body2" color="text.secondary">
						¿Desea descargar los documentos PDF ahora?
					</Typography>
				</DialogContent>
				<DialogActions sx={{ flexDirection: "column", gap: 1, p: 2 }}>
					<Button
						fullWidth
						variant="contained"
						startIcon={<PrintIcon />}
						onClick={() =>
							f.createdActa &&
							descargarActaPdf(f.createdActa.id, f.createdActa.codigo)
						}
					>
						Descargar Acta Principal
					</Button>
					<Button
						fullWidth
						variant="outlined"
						startIcon={<PrintIcon />}
						onClick={() =>
							f.createdActa &&
							descargarActaComisionadosPdf(
								f.createdActa.id,
								f.createdActa.codigo,
							)
						}
					>
						Descargar Comisionados
					</Button>
					<Button fullWidth onClick={() => f.setCreatedActa(null)}>
						Cerrar
					</Button>
				</DialogActions>
			</Dialog>
		</>
	);
};

export default ActaExamenForm;
