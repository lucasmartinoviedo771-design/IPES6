/* eslint-disable react-doctor/query-mutation-missing-invalidation */

import LockResetIcon from "@mui/icons-material/LockReset";
import SearchIcon from "@mui/icons-material/Search";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import InputAdornment from "@mui/material/InputAdornment";
import Paper from "@mui/material/Paper";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { fetchEstudiantesAdmin } from "@/api/estudiantes";
import { resetPasswordEstudiante } from "@/api/estudiantes/admin";
import BackButton from "@/components/ui/BackButton";
import { toast } from "@/utils/toast";
import { useDebouncedValue } from "../Secretaria/estudiantes-admin/hooks/useDebouncedValue";

export default function ResetearPasswordPage() {
	const [search, setSearch] = useState("");
	const debouncedSearch = useDebouncedValue(search);
	const [selectedEstudiante, setSelectedEstudiante] = useState<{
		dni: string;
		nombre: string;
		apellido: string;
	} | null>(null);

	const { data: listData, isLoading: isListLoading } = useQuery({
		queryKey: ["attp-reset-estudiantes", debouncedSearch],
		queryFn: () =>
			fetchEstudiantesAdmin({
				q: debouncedSearch || undefined,
				limit: 30,
				offset: 0,
			}),
		enabled: debouncedSearch.length >= 2,
	});

	const resetMutation = useMutation({
		mutationFn: (dni: string) => resetPasswordEstudiante(dni),
		onSuccess: (_data, dni) => {
			toast.success(
				`Contraseña reseteada. El estudiante puede ingresar con: pass${dni}`,
			);
			setSelectedEstudiante(null);
		},
		onError: () => {
			toast.error("No se pudo resetear la contraseña.");
		},
	});

	const estudiantes = listData?.items ?? [];

	return (
		<Box
			p={2}
			display="flex"
			flexDirection="column"
			gap={3}
			maxWidth={700}
			mx="auto"
		>
			<BackButton fallbackPath="/attp" />

			<Box>
				<Typography variant="h5" fontWeight={700} mb={0.5}>
					Resetear contraseña
				</Typography>
				<Typography variant="body2" color="text.secondary">
					Buscá al estudiante por DNI o apellido y restablecé su contraseña. La
					nueva clave será <strong>pass + DNI</strong>.
				</Typography>
			</Box>

			<TextField
				label="Buscar por DNI o apellido"
				value={search}
				onChange={(e) => setSearch(e.target.value)}
				fullWidth
				InputProps={{
					startAdornment: (
						<InputAdornment position="start">
							<SearchIcon />
						</InputAdornment>
					),
				}}
			/>

			{debouncedSearch.length < 2 && (
				<Alert severity="info">
					Escribí al menos 2 caracteres para buscar.
				</Alert>
			)}

			{debouncedSearch.length >= 2 && isListLoading && (
				<Box textAlign="center" py={4}>
					<CircularProgress />
				</Box>
			)}

			{debouncedSearch.length >= 2 &&
				!isListLoading &&
				estudiantes.length === 0 && (
					<Alert severity="warning">No se encontraron estudiantes.</Alert>
				)}

			{estudiantes.length > 0 && (
				<TableContainer component={Paper} variant="outlined">
					<Table size="small">
						<TableHead>
							<TableRow>
								<TableCell>DNI</TableCell>
								<TableCell>Apellido y Nombre</TableCell>
								<TableCell align="center">Acción</TableCell>
							</TableRow>
						</TableHead>
						<TableBody>
							{estudiantes.map((e) => (
								<TableRow key={e.dni} hover>
									<TableCell>{e.dni}</TableCell>
									<TableCell>
										{e.apellido}, {e.nombre}
									</TableCell>
									<TableCell align="center">
										<Button
											size="small"
											variant="outlined"
											color="warning"
											startIcon={<LockResetIcon />}
											onClick={() =>
												setSelectedEstudiante({
													dni: e.dni,
													nombre: e.nombre,
													apellido: e.apellido,
												})
											}
										>
											Resetear
										</Button>
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				</TableContainer>
			)}

			<Dialog
				open={!!selectedEstudiante}
				onClose={() => setSelectedEstudiante(null)}
				maxWidth="xs"
				fullWidth
			>
				<DialogTitle>Confirmar reset de contraseña</DialogTitle>
				<DialogContent>
					<Typography>
						¿Resetear la contraseña de{" "}
						<strong>
							{selectedEstudiante?.apellido}, {selectedEstudiante?.nombre}
						</strong>
						?
					</Typography>
					<Typography variant="body2" color="text.secondary" mt={1}>
						La nueva contraseña será:{" "}
						<strong>pass{selectedEstudiante?.dni}</strong>
					</Typography>
				</DialogContent>
				<DialogActions>
					<Button
						onClick={() => setSelectedEstudiante(null)}
						disabled={resetMutation.isPending}
					>
						Cancelar
					</Button>
					<Button
						variant="contained"
						color="warning"
						onClick={() =>
							selectedEstudiante && resetMutation.mutate(selectedEstudiante.dni)
						}
						disabled={resetMutation.isPending}
						startIcon={
							resetMutation.isPending ? (
								<CircularProgress size={16} color="inherit" />
							) : (
								<LockResetIcon />
							)
						}
					>
						{resetMutation.isPending ? "Reseteando..." : "Confirmar"}
					</Button>
				</DialogActions>
			</Dialog>
		</Box>
	);
}
