import AssignmentIndIcon from "@mui/icons-material/AssignmentInd";
import CloseIcon from "@mui/icons-material/Close";
import DeleteIcon from "@mui/icons-material/DeleteForever";
import DescriptionIcon from "@mui/icons-material/Description";
import FolderSharedIcon from "@mui/icons-material/FolderShared";
import GavelIcon from "@mui/icons-material/Gavel";
import LockResetIcon from "@mui/icons-material/LockReset";
import SchoolIcon from "@mui/icons-material/School";
import VerifiedUserIcon from "@mui/icons-material/VerifiedUser";
import Alert from "@mui/material/Alert";
import Badge from "@mui/material/Badge";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Divider from "@mui/material/Divider";
import FormControlLabel from "@mui/material/FormControlLabel";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import type React from "react";
import { useEffect, useState } from "react";
import type {
	Control,
	UseFormHandleSubmit,
	UseFormWatch,
} from "react-hook-form";
import type { EstudianteAdminDetailDTO } from "@/api/estudiantes";
import {
	condicionColorMap,
	type DetailDocumentacionForm,
	type DetailFormValues,
} from "../types";
import { EstudianteDetailForm } from "./EstudianteDetailForm";

type Props = {
	open: boolean;
	onClose: () => void;
	detailQuery: {
		data?: EstudianteAdminDetailDTO;
		isLoading: boolean;
		isFetching: boolean;
	};
	selectedDni: string | null;
	condicionCalculada: string;
	control: Control<DetailFormValues>;
	handleSubmit: UseFormHandleSubmit<DetailFormValues>;
	watch: UseFormWatch<DetailFormValues>;
		setValue: (name: any, value: any, options?: any) => void;
	onSubmit: (values: DetailFormValues) => void;
	anioIngresoOptions: string[];
	docValues: DetailDocumentacionForm;
	anyMainSelected: boolean;
	handleMainDocChange: (
		target: keyof DetailDocumentacionForm,
	) => (_: unknown, checked: boolean) => void;
	handleAdeudaChange: (_: unknown, checked: boolean) => void;
	handleEstudianteRegularChange: (_: unknown, checked: boolean) => void;
	updateIsPending: boolean;
	deleteIsPending: boolean;
	resetPassIsPending?: boolean;
	onDeleteClick: () => void;
	onResetPassword?: () => void;
	onAutorizarRendir?: (
		autorizado: boolean,
		observacion: string,
		materias_autorizadas?: number[],
	) => void;
	autorizarRendirIsPending?: boolean;
	onAgregarCarrera?: (profesorado_id: number, anio_ingreso?: number) => void;
	agregarCarreraIsPending?: boolean;
	isAdmin?: boolean;
	isAttp?: boolean;
	isRectorado?: boolean;
	canResetPassword?: boolean;
};

export function EstudianteDetailDialog({
	open,
	onClose,
	detailQuery,
		selectedDni,
	condicionCalculada,
	control,
	handleSubmit,
	watch,
	setValue,
	onSubmit,
	anioIngresoOptions,
	docValues,
	anyMainSelected,
	handleMainDocChange,
	handleAdeudaChange,
	handleEstudianteRegularChange,
	updateIsPending,
	deleteIsPending,
	resetPassIsPending,
	onDeleteClick,
	onResetPassword,
	onAutorizarRendir,
	autorizarRendirIsPending,
	onAgregarCarrera,
	agregarCarreraIsPending,
	isAdmin = true,
	isAttp = false,
	isRectorado = false,
	canResetPassword = false,
}: Props) {
	const estudiante = detailQuery.data;
	const [activeTab, setActiveTab] = useState(0);
	const [autorizadoSwitch, setAutorizadoSwitch] = useState(false);
	const [autorizadoObs, setAutorizadoObs] = useState("");

	useEffect(() => {
		if (estudiante) {
			setAutorizadoSwitch(estudiante.autorizado_rendir ?? false);
			setAutorizadoObs(estudiante.autorizado_rendir_observacion ?? "");
		}
	}, [estudiante]);

	const handleTabChange = (_: React.SyntheticEvent, newValue: number) => {
		setActiveTab(newValue);
	};

	return (
		<Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
			<DialogTitle>
				{detailQuery.data
					? `Ficha del estudiante ${detailQuery.data.apellido}, ${detailQuery.data.nombre}`
					: "Ficha del estudiante"}
			</DialogTitle>
			<DialogContent dividers>
				{detailQuery.isLoading || detailQuery.isFetching ? (
					<Box p={4} textAlign="center">
						<CircularProgress />
					</Box>
				) : detailQuery.data ? (
					<Stack spacing={3}>
						{isAdmin && (
							<Box sx={{ borderBottom: 1, borderColor: "divider", mb: 2 }}>
								<Tabs
									value={activeTab}
									onChange={handleTabChange}
									variant="scrollable"
									scrollButtons="auto"
									textColor="primary"
									indicatorColor="primary"
								>
									<Tab
										icon={<AssignmentIndIcon />}
										iconPosition="start"
										label="Datos Personales"
									/>
									<Tab
										icon={<SchoolIcon />}
										iconPosition="start"
										label="Situación Académica"
									/>
									<Tab
										icon={<FolderSharedIcon />}
										iconPosition="start"
										label="Legajo"
									/>
									<Tab
										icon={
											<Badge
												color="warning"
												variant="dot"
												invisible={!autorizadoSwitch}
											>
												<VerifiedUserIcon />
											</Badge>
										}
										iconPosition="start"
										label="Autorización"
									/>
								</Tabs>
							</Box>
						)}

						{isAdmin && (
							<Stack
								direction="row"
								spacing={1}
								alignItems="center"
								justifyContent="space-between"
							>
								<Box>
									<Typography variant="subtitle2" color="text.secondary">
										Carreras
									</Typography>
									<Stack direction="row" spacing={1} mt={0.5} flexWrap="wrap">
										{detailQuery.data.carreras_detalle &&
										detailQuery.data.carreras_detalle.length > 0
											? detailQuery.data.carreras_detalle.map((c) => (
													<Chip
														key={c.nombre}
														label={`${c.nombre} (${c.estado_academico_display})`}
														size="small"
														variant="outlined"
														sx={{ fontSize: "0.7rem" }}
														color={
															c.estado_academico === "ACT"
																? "success"
																: "default"
														}
													/>
												))
											: detailQuery.data.carreras.map((carrera) => (
													<Chip key={carrera} label={carrera} size="small" />
												))}
									</Stack>
								</Box>
								{condicionCalculada && (
									<Box textAlign="right">
										<Typography variant="subtitle2" color="text.secondary">
											Condición
										</Typography>
										<Chip
											size="small"
											label={condicionCalculada}
											color={condicionColorMap[condicionCalculada] ?? "default"}
										/>
									</Box>
								)}
							</Stack>
						)}

						<EstudianteDetailForm
							control={control}
							handleSubmit={handleSubmit}
							watch={watch}
							setValue={setValue}
							onSubmit={onSubmit}
							anioIngresoOptions={anioIngresoOptions}
							docValues={docValues}
							anyMainSelected={anyMainSelected}
							handleMainDocChange={handleMainDocChange}
							handleAdeudaChange={handleAdeudaChange}
							handleEstudianteRegularChange={handleEstudianteRegularChange}
							activeTab={isAdmin ? activeTab : 0}
							autorizadoSwitch={autorizadoSwitch}
							setAutorizadoSwitch={setAutorizadoSwitch}
							autorizadoObs={autorizadoObs}
							setAutorizadoObs={setAutorizadoObs}
							onAutorizarRendir={onAutorizarRendir}
							autorizarRendirIsPending={autorizarRendirIsPending}
							onAgregarCarrera={onAgregarCarrera}
							agregarCarreraIsPending={agregarCarreraIsPending}
							detailData={detailQuery.data}
							isAdmin={isAdmin}
							isAttp={isAttp}
							isRectorado={isRectorado}
							carrerasDetalle={detailQuery.data?.carreras_detalle}
						/>
					</Stack>
				) : (
					<Alert severity="error">
						No se pudo cargar la ficha del estudiante.
					</Alert>
				)}
			</DialogContent>
			<DialogActions sx={{ px: 3, pb: 2, justifyContent: "space-between" }}>
				<Stack direction="row" spacing={1}>
					{!isAttp && !isRectorado && (
						<Button
							color="error"
							startIcon={<DeleteIcon />}
							onClick={onDeleteClick}
							disabled={
								updateIsPending || deleteIsPending || !!resetPassIsPending
							}
						>
							Eliminar estudiante
						</Button>
					)}
					{(canResetPassword || (!isAttp && !isRectorado)) &&
						onResetPassword && (
							<Button
								color="warning"
								variant="outlined"
								startIcon={
									resetPassIsPending ? (
										<CircularProgress size={18} color="inherit" />
									) : (
										<LockResetIcon />
									)
								}
								onClick={onResetPassword}
								disabled={
									updateIsPending || deleteIsPending || !!resetPassIsPending
								}
							>
								Resetear Contraseña
							</Button>
						)}
				</Stack>
				<Stack direction="row" spacing={1} sx={{ ml: "auto" }}>
					<Button startIcon={<CloseIcon />} onClick={onClose}>
						Cerrar
					</Button>
					{!isAttp && !isRectorado && (
						<Button
							type="submit"
							form="estudiante-admin-form"
							variant="contained"
							startIcon={
								updateIsPending ? (
									<CircularProgress size={18} color="inherit" />
								) : undefined
							}
							disabled={updateIsPending || deleteIsPending}
						>
							{updateIsPending ? "Guardando..." : "Guardar cambios"}
						</Button>
					)}
				</Stack>
			</DialogActions>
		</Dialog>
	);
}
