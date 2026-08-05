import React, { useState } from "react";
import {
	Box,
	Button,
	Card,
	CardContent,
	CircularProgress,
	MenuItem,
	Stack,
	TextField,
	Typography,
	Alert,
	AlertTitle,
	Container,
} from "@mui/material";
import { useNavigate } from "react-router-dom";
import PrintIcon from "@mui/icons-material/Print";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { useCarreras } from "@/hooks/useCarreras";
import { recuperarPreinscripcion } from "@/services/preinscripcion";

export default function ReimprimirPreinscripcionPage() {
	const navigate = useNavigate();
	const { data: carreras = [], isLoading: loadingCarreras } = useCarreras();
	
	const [dni, setDni] = useState("");
	const [carreraId, setCarreraId] = useState<number | "">("");
	const [fechaNac, setFechaNac] = useState("");
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [pdfUrl, setPdfUrl] = useState<string | null>(null);
	const [codigo, setCodigo] = useState<string | null>(null);

	const handleRecuperar = async () => {
		if (!dni || !carreraId || !fechaNac) {
			setError("Por favor, completa todos los campos.");
			return;
		}
		setLoading(true);
		setError(null);
		setPdfUrl(null);
		setCodigo(null);
		
		try {
			const res = await recuperarPreinscripcion(
				dni,
				Number(carreraId),
				fechaNac,
			);
			if (res.ok && res.data) {
				setPdfUrl(res.data.pdf_url);
				setCodigo(res.data.codigo);
			} else {
				setError(res.message || "Error al verificar los datos.");
			}
		} catch (err: any) {
			setError(err?.message || "Ocurrió un error al verificar.");
		} finally {
			setLoading(false);
		}
	};

	const handleDownload = () => {
		if (pdfUrl) {
			window.open(pdfUrl, "_blank");
			// Reset state to allow another search
			setDni("");
			setCarreraId("");
			setFechaNac("");
			setPdfUrl(null);
			setCodigo(null);
			setError(null);
		}
	};

	return (
		<Container maxWidth="md">
			<Box sx={{ mb: 3 }}>
				<Typography variant="h4" fontWeight={700}>
					Reimprimir Preinscripción
				</Typography>
				<Typography variant="body1" color="text.secondary" sx={{ mt: 1, mb: 2 }}>
					Generá y descargá el PDF de la planilla de preinscripción de un estudiante.
				</Typography>
				<Button
					variant="outlined"
					startIcon={<ArrowBackIcon />}
					onClick={() => navigate(-1)}
				>
					Volver
				</Button>
			</Box>

			<Card sx={{ mt: 4 }}>
				<CardContent>
					<Stack spacing={3} sx={{ mt: 1 }}>
						<Typography variant="body1" color="text.secondary">
							Ingresá los datos del estudiante para validar su identidad y descargar su planilla
							PDF de preinscripción.
						</Typography>

						{error && <Alert severity="error">{error}</Alert>}

						{pdfUrl ? (
							<Alert severity="success">
								<AlertTitle>Preinscripción encontrada</AlertTitle>
								Código de preinscripción: <strong>{codigo}</strong>
								<Box sx={{ mt: 2 }}>
									<Button
										variant="contained"
										color="success"
										onClick={handleDownload}
										startIcon={<PrintIcon />}
									>
										Descargar Planilla PDF
									</Button>
								</Box>
							</Alert>
						) : (
							<Stack spacing={2} maxWidth="sm">
								<TextField
									label="DNI del estudiante"
									value={dni}
									onChange={(e) => setDni(e.target.value.trim())}
									size="small"
									fullWidth
								/>
								<TextField
									select
									label="Carrera preinscripta"
									value={carreraId}
									onChange={(e) => setCarreraId(Number(e.target.value))}
									size="small"
									fullWidth
									disabled={loadingCarreras}
								>
									{carreras.map((c) => (
										<MenuItem key={c.id} value={c.id}>
											{c.nombre}
										</MenuItem>
									))}
								</TextField>
								<TextField
									label="Fecha de nacimiento"
									type="date"
									value={fechaNac}
									onChange={(e) => setFechaNac(e.target.value)}
									InputLabelProps={{ shrink: true }}
									size="small"
									fullWidth
								/>
								<Box pt={2}>
									<Button
										variant="contained"
										onClick={handleRecuperar}
										disabled={loading || !dni || !carreraId || !fechaNac}
										fullWidth
									>
										{loading ? <CircularProgress size={24} color="inherit" /> : "Buscar e Imprimir"}
									</Button>
								</Box>
							</Stack>
						)}
					</Stack>
				</CardContent>
			</Card>
		</Container>
	);
}
