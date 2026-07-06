import RefreshIcon from "@mui/icons-material/Refresh";
import DownloadIcon from "@mui/icons-material/Download";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useQuery } from "@tanstack/react-query";
import { useRef } from "react";
import { toJpeg } from "html-to-image";
import jsPDF from "jspdf";
import { useSnackbar } from "notistack";
import BackButton from "@/components/ui/BackButton";
import { PageHero } from "@/components/ui/GradientTitles";
import InstitutionalScheduleFormat from "@/features/estudiantes/horario/InstitutionalScheduleFormat";
import { INSTITUTIONAL_TERRACOTTA } from "@/styles/institutionalColors";
import { api } from "@/api/client";
import type { HorarioTablaDTO } from "@/api/estudiantes";

export default function MiHorarioPage() {
	const { enqueueSnackbar } = useSnackbar();
	const exportRef = useRef<HTMLDivElement>(null);

	const { data: tablas, isLoading, refetch } = useQuery({
		queryKey: ["docente-horarios"],
		queryFn: async () => {
			const { data } = await api.get<HorarioTablaDTO[]>("/docentes/mis-horarios");
			return data;
		},
		staleTime: 1000 * 60 * 5, // 5 minutos
	});

	const downloadPDF = async () => {
		if (!exportRef.current || !tablas || tablas.length === 0) return;

		try {
			enqueueSnackbar("Generando PDF, por favor espere...", {
				variant: "info",
				autoHideDuration: 2000,
			});

			const pdf = new jsPDF({
				orientation: "landscape",
				unit: "mm",
				format: "a4",
			});

			const pdfWidth = pdf.internal.pageSize.getWidth();
			const pdfHeight = pdf.internal.pageSize.getHeight();
			const margin = 10;
			const contentWidth = pdfWidth - margin * 2;
			const contentHeight = pdfHeight - margin * 2;

			for (let i = 0; i < tablas.length; i++) {
				const tabla = tablas[i];
				const elementId = `horario-tabla-${tabla.key}`;
				const element = document.getElementById(elementId);

				if (!element) continue;

				if (i > 0) {
					pdf.addPage();
				}

				const dataUrl = await toJpeg(element, {
					quality: 0.95,
					backgroundColor: "#ffffff",
					pixelRatio: 2,
				});

				const imgProps = pdf.getImageProperties(dataUrl);
				const imgRatio = imgProps.width / imgProps.height;
				const pageRatio = contentWidth / contentHeight;

				let finalWidth = contentWidth;
				let finalHeight = contentWidth / imgRatio;

				if (imgRatio < pageRatio) {
					finalHeight = contentHeight;
					finalWidth = contentHeight * imgRatio;
				}

				const xOffset = margin + (contentWidth - finalWidth) / 2;
				const yOffset = margin + (contentHeight - finalHeight) / 2;

				pdf.addImage(
					dataUrl,
					"JPEG",
					xOffset,
					yOffset,
					finalWidth,
					finalHeight,
				);
			}

			pdf.save(`Mi_Horario_Docente.pdf`);

			enqueueSnackbar("PDF descargado correctamente", { variant: "success" });
		} catch (error) {
			console.error("Error al generar PDF:", error);
			enqueueSnackbar("Error al generar el PDF", { variant: "error" });
		}
	};

	return (
		<Stack spacing={4}>
			<BackButton fallbackPath="/docentes" />
			<PageHero
				title="Mi Horario"
				subtitle="Visualiza tu horario semanal asignado en todos los turnos."
				actions={
					<Stack direction="row" spacing={2}>
						<Button
							variant="outlined"
							startIcon={<RefreshIcon />}
							onClick={() => refetch()}
							disabled={isLoading}
							sx={{
								borderColor: "rgba(255,255,255,0.4)",
								color: "#fff",
								"&:hover": {
									borderColor: "rgba(255,255,255,0.8)",
									backgroundColor: "rgba(255,255,255,0.1)",
								},
							}}
						>
							Actualizar
						</Button>
						<Button
							variant="contained"
							startIcon={<DownloadIcon />}
							onClick={downloadPDF}
							disabled={isLoading || !tablas || tablas.length === 0}
							sx={{
								backgroundColor: "#fff",
								color: INSTITUTIONAL_TERRACOTTA,
								"&:hover": {
									backgroundColor: "rgba(255,255,255,0.9)",
								},
							}}
						>
							Descargar PDF
						</Button>
					</Stack>
				}
			/>

			{isLoading ? (
				<Box
					display="flex"
					justifyContent="center"
					alignItems="center"
					minHeight="400px"
				>
					<CircularProgress sx={{ color: INSTITUTIONAL_TERRACOTTA }} />
				</Box>
			) : !tablas || tablas.length === 0 ? (
				<Box
					textAlign="center"
					py={8}
					bgcolor="#fff"
					borderRadius={3}
					border="1px solid rgba(0,0,0,0.1)"
				>
					<Typography variant="h6" color="text.secondary">
						No hay horarios cargados.
					</Typography>
					<Typography variant="body2" color="text.secondary" mt={1}>
						Aún no tienes horarios asignados para el año lectivo actual.
					</Typography>
				</Box>
			) : (
				<Stack spacing={4} ref={exportRef}>
					{tablas.map((tabla: HorarioTablaDTO) => (
						<Box
							key={tabla.key}
							id={`horario-tabla-${tabla.key}`}
							sx={{ backgroundColor: "#fff", p: 2, borderRadius: 2 }}
						>
							<InstitutionalScheduleFormat tabla={tabla} />
						</Box>
					))}
				</Stack>
			)}
		</Stack>
	);
}
