import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import DownloadIcon from "@mui/icons-material/Download";
import EmailIcon from "@mui/icons-material/Email";
import PhoneIcon from "@mui/icons-material/Phone";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import IconButton from "@mui/material/IconButton";
import Pagination from "@mui/material/Pagination";
import Paper from "@mui/material/Paper";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { useState } from "react";
import { type StudentAtRiskItem, getExportStudentsAtRiskUrl } from "@/api/analytics";
import { toast } from "@/utils/toast";

interface EstudiantesRiesgoTableProps {
	estudiantes: StudentAtRiskItem[] | undefined;
	totalCount?: number;
	nivel: string;
	loading: boolean;
	page: number;
	onPageChange: (newPage: number) => void;
	profesoradoId?: number;
}

export default function EstudiantesRiesgoTable({
	estudiantes,
	totalCount,
	nivel,
	loading,
	page,
	onPageChange,
	profesoradoId,
}: EstudiantesRiesgoTableProps) {
	const [copiedPhoneId, setCopiedPhoneId] = useState<number | null>(null);

	const handleCopyPhone = (id: number, phone: string) => {
		navigator.clipboard.writeText(phone);
		setCopiedPhoneId(id);
		toast.success(`Teléfono copiado al portapapeles: ${phone}`);
		setTimeout(() => setCopiedPhoneId(null), 2000);
	};

	const exportUrl = getExportStudentsAtRiskUrl({
		nivel,
		profesorado_id: profesoradoId,
	});

	const nivelLabelMap: Record<string, { label: string; color: string }> = {
		rojo: { label: "Riesgo Crítico", color: "#DC2626" },
		amarillo: { label: "Riesgo Medio", color: "#D97706" },
		verde: { label: "Trayectoria Regular", color: "#16A34A" },
	};

	const config = nivelLabelMap[nivel] || nivelLabelMap.rojo;

	return (
		<Paper
			sx={{
				p: 3,
				borderRadius: 2.5,
				border: "1px solid #e2e8f0",
				boxShadow: "0 4px 15px rgba(15,23,42,0.04)",
			}}
		>
			<Stack
				direction={{ xs: "column", sm: "row" }}
				justifyContent="space-between"
				alignItems={{ sm: "center" }}
				spacing={2}
				sx={{ mb: 3 }}
			>
				<Box>
					<Typography variant="h5" fontWeight={700} color="#0f172a">
						Listado de Intervención:{" "}
						<span style={{ color: config.color }}>{config.label}</span>
					</Typography>
					<Typography variant="body2" color="#64748b">
						Identificación directa de estudiantes para seguimiento, tutorías y contacto institucional.
					</Typography>
				</Box>

				<Button
					variant="outlined"
					startIcon={<DownloadIcon />}
					href={exportUrl}
					target="_blank"
					download
					size="small"
					sx={{
						textTransform: "none",
						fontWeight: 600,
						borderRadius: 2,
						borderColor: "#cbd5e1",
						color: "#334155",
						"&:hover": { borderColor: "#94a3b8", bgcolor: "#f8fafc" },
					}}
				>
					Exportar planilla (.CSV)
				</Button>
			</Stack>

			<TableContainer>
				<Table size="medium">
					<TableHead sx={{ bgcolor: "#f8fafc" }}>
						<TableRow>
							<TableCell sx={{ fontWeight: 700, color: "#334155" }}>Estudiante</TableCell>
							<TableCell sx={{ fontWeight: 700, color: "#334155" }}>DNI</TableCell>
							<TableCell sx={{ fontWeight: 700, color: "#334155" }}>Profesorado</TableCell>
							<TableCell sx={{ fontWeight: 700, color: "#334155" }}>Motivo(s) de Alerta</TableCell>
							<TableCell align="center" sx={{ fontWeight: 700, color: "#334155" }}>
								Contacto
							</TableCell>
						</TableRow>
					</TableHead>
					<TableBody>
						{loading ? (
							Array.from({ length: 5 }).map((_, idx) => (
								<TableRow key={idx}>
									<TableCell><Skeleton width={140} /></TableCell>
									<TableCell><Skeleton width={80} /></TableCell>
									<TableCell><Skeleton width={160} /></TableCell>
									<TableCell><Skeleton width={220} /></TableCell>
									<TableCell align="center"><Skeleton width={80} /></TableCell>
								</TableRow>
							))
						) : !estudiantes || estudiantes.length === 0 ? (
							<TableRow>
								<TableCell colSpan={5} align="center" sx={{ py: 6 }}>
									<Typography variant="subtitle1" fontWeight={600} color="#166534">
										🌟 No se encontraron estudiantes en este nivel de alerta.
									</Typography>
									<Typography variant="body2" color="#64748b" sx={{ mt: 0.5 }}>
										No hay registros que requieran intervención inmediata bajo los filtros seleccionados.
									</Typography>
								</TableCell>
							</TableRow>
						) : (
							estudiantes.map((est) => (
								<TableRow key={est.estudiante_id} hover>
									<TableCell>
										<Typography variant="subtitle2" fontWeight={700} color="#1e293b">
											{est.nombre_completo}
										</Typography>
									</TableCell>
									<TableCell>
										<Typography variant="body2" color="#475569" fontWeight={500}>
											{est.dni}
										</Typography>
									</TableCell>
									<TableCell>
										<Typography variant="body2" color="#334155">
											{est.profesorado || "Sin carrera asignada"}
										</Typography>
									</TableCell>
									<TableCell>
										<Stack direction="row" spacing={0.8} flexWrap="wrap" useFlexGap sx={{ py: 0.5 }}>
											{est.motivos.map((motivo, mIdx) => {
												const isRedChip =
													motivo.includes("crítica") ||
													motivo.includes("3ra vez") ||
													motivo.includes("0 inscripciones") ||
													motivo.includes("2 aplazos");

												return (
													<Chip
														key={mIdx}
														label={motivo}
														size="small"
														sx={{
															fontSize: "0.75rem",
															fontWeight: 600,
															bgcolor: isRedChip ? "#FEE2E2" : "#FEF3C7",
															color: isRedChip ? "#991B1B" : "#92400E",
															borderRadius: 1.5,
														}}
													/>
												);
											})}
										</Stack>
									</TableCell>
									<TableCell align="center">
										<Stack direction="row" spacing={1} justifyContent="center">
											{est.telefono ? (
												<Tooltip
													title={
														copiedPhoneId === est.estudiante_id
															? "¡Copiado!"
															: `Copiar: ${est.telefono}`
													}
													arrow
												>
													<IconButton
														size="small"
														onClick={() =>
															handleCopyPhone(est.estudiante_id, est.telefono!)
														}
														sx={{
															color: "#2563eb",
															bgcolor: "#eff6ff",
															"&:hover": { bgcolor: "#dbeafe" },
														}}
													>
														{copiedPhoneId === est.estudiante_id ? (
															<CheckCircleIcon fontSize="small" sx={{ color: "#16a34a" }} />
														) : (
															<PhoneIcon fontSize="small" />
														)}
													</IconButton>
												</Tooltip>
											) : (
												<Tooltip title="Sin teléfono registrado" arrow>
													<span>
														<IconButton size="small" disabled sx={{ color: "#cbd5e1" }}>
															<PhoneIcon fontSize="small" />
														</IconButton>
													</span>
												</Tooltip>
											)}

											{est.email ? (
												<Tooltip title={`Enviar correo a: ${est.email}`} arrow>
													<IconButton
														size="small"
														component="a"
														href={`mailto:${est.email}?subject=Seguimiento%20acad%C3%A9mico%20-%20IPES6`}
														sx={{
															color: "#059669",
															bgcolor: "#ecfdf5",
															"&:hover": { bgcolor: "#d1fae5" },
														}}
													>
														<EmailIcon fontSize="small" />
													</IconButton>
												</Tooltip>
											) : (
												<Tooltip title="Sin email registrado" arrow>
													<span>
														<IconButton size="small" disabled sx={{ color: "#cbd5e1" }}>
															<EmailIcon fontSize="small" />
														</IconButton>
													</span>
												</Tooltip>
											)}
										</Stack>
									</TableCell>
								</TableRow>
							))
						)}
					</TableBody>
				</Table>
			</TableContainer>

			{estudiantes && estudiantes.length > 0 && (
				<Box sx={{ mt: 3, display: "flex", justifyContent: "center" }}>
					<Pagination
						count={totalCount ? Math.ceil(totalCount / 20) : Math.max(page, 1)}
						page={page}
						onChange={(_, newP) => onPageChange(newP)}
						color="primary"
						shape="rounded"
					/>
				</Box>
			)}
		</Paper>
	);
}
