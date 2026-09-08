import React, { useState, useRef, useEffect } from "react";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import TextField from "@mui/material/TextField";
import Stack from "@mui/material/Stack";
import Chip from "@mui/material/Chip";
import Tooltip from "@mui/material/Tooltip";
import CircularProgress from "@mui/material/CircularProgress";
import SendIcon from "@mui/icons-material/Send";
import CloseIcon from "@mui/icons-material/Close";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";

import PauloFreireAvatar from "./PauloFreireAvatar";
import {
	enviarMensajeAsistente,
	obtenerSugerenciasAsistente,
	type ChatMessage,
} from "../api/asistenteApi";

/**
 * Formatea texto básico en Markdown (negritas, cursivas, listas con viñetas)
 */
function renderMarkdownText(text: string) {
	const lines = text.split("\n");
	return lines.map((line, idx) => {
		const isBullet = line.trim().startsWith("- ") || line.trim().startsWith("* ");
		const isNumbered = /^\d+\.\s/.test(line.trim());
		const cleanLine = isBullet ? line.trim().replace(/^[-*]\s/, "") : line;

		const parts = cleanLine.split(/(\*\*.*?\*\*)/g);
		const renderedContent = parts.map((part, pIdx) => {
			if (part.startsWith("**") && part.endsWith("**")) {
				return (
					<strong key={pIdx} style={{ fontWeight: 650, color: "inherit" }}>
						{part.slice(2, -2)}
					</strong>
				);
			}
			return part;
		});

		if (isBullet) {
			return (
				<Box
					key={idx}
					sx={{
						display: "flex",
						alignItems: "flex-start",
						gap: 0.8,
						ml: 1,
						my: 0.25,
					}}
				>
					<Box
						sx={{
							width: 5,
							height: 5,
							borderRadius: "50%",
							backgroundColor: "currentColor",
							mt: 0.9,
							flexShrink: 0,
						}}
					/>
					<Typography variant="body2" sx={{ fontSize: "0.86rem", lineHeight: 1.45 }}>
						{renderedContent}
					</Typography>
				</Box>
			);
		}

		if (isNumbered) {
			return (
				<Box key={idx} sx={{ ml: 1, my: 0.25 }}>
					<Typography variant="body2" sx={{ fontSize: "0.86rem", lineHeight: 1.45 }}>
						{renderedContent}
					</Typography>
				</Box>
			);
		}

		if (!cleanLine.trim()) {
			return <Box key={idx} sx={{ height: 6 }} />;
		}

		return (
			<Typography
				key={idx}
				variant="body2"
				sx={{ fontSize: "0.86rem", lineHeight: 1.45, my: 0.2 }}
			>
				{renderedContent}
			</Typography>
		);
	});
}

export default function ChatWidget() {
	const [isOpen, setIsOpen] = useState(false);
	const [hasClosedBubble, setHasClosedBubble] = useState(false);
	const [messages, setMessages] = useState<ChatMessage[]>([]);
	const [inputValue, setInputValue] = useState("");
	const [isLoading, setIsLoading] = useState(false);
	const [suggestions, setSuggestions] = useState<string[]>([
		"¿Cuáles son mis notas?",
		"¿Por qué no puedo inscribirme a una materia?",
		"¿Qué materias tengo regularizadas?",
		"¿Cómo pido una equivalencia?",
	]);

	const messagesEndRef = useRef<HTMLDivElement>(null);
	const inputRef = useRef<HTMLInputElement>(null);

	// Cargar sugerencias contextuales al inicio
	useEffect(() => {
		obtenerSugerenciasAsistente()
			.then((sugs) => {
				if (sugs && sugs.length > 0) setSuggestions(sugs);
			})
			.catch(() => {});
	}, []);

	// Scroll automático al último mensaje
	useEffect(() => {
		if (isOpen) {
			messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
		}
	}, [messages, isLoading, isOpen]);

	const handleSend = async (textToSend?: string) => {
		const text = (textToSend || inputValue).trim();
		if (!text || isLoading) return;

		const userMsg: ChatMessage = { role: "user", content: text };
		const newHistorial = [...messages, userMsg];
		setMessages(newHistorial);
		setInputValue("");
		setIsLoading(true);

		try {
			const res = await enviarMensajeAsistente(text, messages);
			setMessages([
				...newHistorial,
				{ role: "assistant", content: res.respuesta },
			]);
			if (res.sugerencias && res.sugerencias.length > 0) {
				setSuggestions(res.sugerencias);
			}
		} catch (error: any) {
			const errorMsg =
				error?.message ||
				"Ocurrió un problema al procesar tu consulta. Por favor probá de nuevo.";
			setMessages([
				...newHistorial,
				{
					role: "assistant",
					content: `⚠️ ${errorMsg}`,
				},
			]);
		} finally {
			setIsLoading(false);
		}
	};

	const handleReset = () => {
		setMessages([]);
	};

	return (
		<>
			{/* Globo de Diálogo de Paulo Freire y Botón Flotante */}
			{!isOpen && (
				<Box
					sx={{
						position: "fixed",
						bottom: { xs: 20, sm: 28 },
						right: { xs: 20, sm: 28 },
						zIndex: 1300,
						display: "flex",
						flexDirection: "column",
						alignItems: "flex-end",
						gap: 1.5,
					}}
				>
					{/* Bocadillo de diálogo introductorio */}
					{!hasClosedBubble && (
						<Paper
							elevation={4}
							sx={{
								p: 1.6,
								pr: 3.5,
								maxWidth: 270,
								borderRadius: 3,
								backgroundColor: "#ffffff",
								border: "1.5px solid #bfdbfe",
								boxShadow: "0 10px 25px rgba(30, 58, 138, 0.15)",
								position: "relative",
								cursor: "pointer",
								animation: "bounceIn 0.5s ease-out",
								"&:hover": {
									borderColor: "#3b82f6",
									transform: "translateY(-2px)",
								},
								transition: "all 0.2s ease",
							}}
							onClick={() => setIsOpen(true)}
						>
							<Typography
								variant="caption"
								sx={{
									display: "block",
									fontWeight: 750,
									color: "#1e40af",
									fontSize: "0.78rem",
									mb: 0.3,
								}}
							>
								¡Hola! Soy Paulo Freire 👓
							</Typography>
							<Typography
								variant="body2"
								sx={{
									fontSize: "0.82rem",
									lineHeight: 1.35,
									color: "#334155",
								}}
							>
								¿Dudas con inscripciones, correlativas o tus notas? Hacé clic y charlemos.
							</Typography>

							<IconButton
								size="small"
								aria-label="Cerrar saludo"
								onClick={(e) => {
									e.stopPropagation();
									setHasClosedBubble(true);
								}}
								sx={{
									position: "absolute",
									top: 4,
									right: 4,
									color: "#94a3b8",
									p: 0.4,
									"&:hover": { color: "#475569" },
								}}
							>
								<CloseIcon sx={{ fontSize: 14 }} />
							</IconButton>
						</Paper>
					)}

					{/* Botón Flotante con Avatar de Paulo Freire */}
					<Tooltip title="Hablar con Paulo Freire" placement="left" arrow>
						<Box
							onClick={() => setIsOpen(true)}
							sx={{
								width: 62,
								height: 62,
								borderRadius: "50%",
								cursor: "pointer",
								position: "relative",
								p: 0.3,
								background: "linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)",
								boxShadow: "0 8px 26px rgba(30, 64, 175, 0.45)",
								transition: "all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)",
								"&:hover": {
									transform: "scale(1.1) rotate(2deg)",
									boxShadow: "0 12px 32px rgba(30, 64, 175, 0.55)",
								},
								display: "flex",
								alignItems: "center",
								justifyContent: "center",
							}}
						>
							<PauloFreireAvatar size={56} animated />

							{/* Indicador de estado en línea */}
							<Box
								sx={{
									position: "absolute",
									bottom: 2,
									right: 2,
									width: 15,
									height: 15,
									borderRadius: "50%",
									backgroundColor: "#22c55e",
									border: "2.5px solid #ffffff",
									boxShadow: "0 0 8px rgba(34, 197, 94, 0.6)",
								}}
							/>
						</Box>
					</Tooltip>
				</Box>
			)}

			{/* Ventana de Chat Flotante */}
			{isOpen && (
				<Paper
					elevation={14}
					sx={{
						position: "fixed",
						bottom: { xs: 12, sm: 24 },
						right: { xs: 12, sm: 24 },
						width: { xs: "calc(100vw - 24px)", sm: 420 },
						height: { xs: "80vh", sm: 590 },
						maxHeight: "92vh",
						zIndex: 1300,
						borderRadius: 4,
						display: "flex",
						flexDirection: "column",
						overflow: "hidden",
						border: "1.5px solid rgba(226, 232, 240, 0.95)",
						boxShadow: "0 24px 50px rgba(15, 23, 42, 0.22)",
						backgroundColor: "#ffffff",
					}}
				>
					{/* Encabezado con Paulo Freire */}
					<Box
						sx={{
							px: 2.2,
							py: 1.6,
							background: "linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%)",
							color: "#ffffff",
							display: "flex",
							alignItems: "center",
							justifyContent: "space-between",
							borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
						}}
					>
						<Stack direction="row" spacing={1.5} alignItems="center">
							<Box sx={{ position: "relative" }}>
								<PauloFreireAvatar size={42} />
								<Box
									sx={{
										position: "absolute",
										bottom: -1,
										right: -1,
										width: 12,
										height: 12,
										borderRadius: "50%",
										backgroundColor: "#22c55e",
										border: "2px solid #0f172a",
									}}
								/>
							</Box>
							<Box>
								<Stack direction="row" spacing={0.8} alignItems="center">
									<Typography
										variant="subtitle1"
										sx={{ fontWeight: 750, fontSize: "1rem", lineHeight: 1.2 }}
									>
										Paulo Freire
									</Typography>
									<AutoAwesomeIcon sx={{ fontSize: 16, color: "#60a5fa" }} />
								</Stack>
								<Typography
									variant="caption"
									sx={{ color: "#93c5fd", fontSize: "0.75rem", display: "block" }}
								>
									Asistente Pedagógico del IPES
								</Typography>
							</Box>
						</Stack>

						<Stack direction="row" spacing={0.5}>
							<Tooltip title="Reiniciar conversación">
								<IconButton
									size="small"
									onClick={handleReset}
									sx={{ color: "rgba(255,255,255,0.75)", "&:hover": { color: "#ffffff" } }}
								>
									<RestartAltIcon fontSize="small" />
								</IconButton>
							</Tooltip>
							<Tooltip title="Minimizar">
								<IconButton
									size="small"
									onClick={() => setIsOpen(false)}
									sx={{ color: "rgba(255,255,255,0.75)", "&:hover": { color: "#ffffff" } }}
								>
									<CloseIcon fontSize="small" />
								</IconButton>
							</Tooltip>
						</Stack>
					</Box>

					{/* Cuerpo de Mensajes */}
					<Box
						sx={{
							flexGrow: 1,
							p: 2,
							overflowY: "auto",
							backgroundColor: "#f8fafc",
							display: "flex",
							flexDirection: "column",
							gap: 1.5,
						}}
					>
						{messages.length === 0 && (
							<Box sx={{ textAlign: "center", py: 2.5, px: 1 }}>
								<Box sx={{ display: "inline-block", mb: 1.5 }}>
									<PauloFreireAvatar size={68} animated />
								</Box>
								<Typography
									variant="subtitle1"
									sx={{ fontWeight: 700, color: "#0f172a", mb: 0.5, fontSize: "1rem" }}
								>
									¡Hola! Qué gusto saludarte.
								</Typography>
								<Typography
									variant="body2"
									sx={{
										color: "#475569",
										fontSize: "0.84rem",
										fontStyle: "italic",
										mb: 1.5,
										px: 1,
									}}
								>
									«Enseñar no es transferir conocimiento, sino crear las posibilidades para su propia producción o construcción.»
								</Typography>
								<Typography
									variant="body2"
									sx={{ color: "#64748b", fontSize: "0.82rem", mb: 2 }}
								>
									Estoy aquí para acompañarte: consultame si cumplís correlativas para cursar o rendir, tus notas de finales o normativas del instituto.
								</Typography>

								{/* Preguntas Sugeridas Iniciales */}
								<Stack spacing={1} sx={{ mt: 1 }}>
									{suggestions.map((sug, idx) => (
										<Chip
											key={idx}
											label={sug}
											onClick={() => handleSend(sug)}
											clickable
											sx={{
												justifyContent: "flex-start",
												height: "auto",
												py: 0.9,
												px: 1.2,
												backgroundColor: "#ffffff",
												border: "1px solid #e2e8f0",
												borderRadius: 2,
												"& .MuiChip-label": {
													whiteSpace: "normal",
													textAlign: "left",
													fontSize: "0.82rem",
													color: "#1e40af",
													fontWeight: 600,
												},
												"&:hover": {
													backgroundColor: "#eff6ff",
													borderColor: "#bfdbfe",
													transform: "translateX(2px)",
												},
												transition: "all 0.15s ease",
											}}
										/>
									))}
								</Stack>
							</Box>
						)}

						{messages.map((msg, idx) => {
							const isUser = msg.role === "user";
							return (
								<Box
									key={idx}
									sx={{
										display: "flex",
										justifyContent: isUser ? "flex-end" : "flex-start",
										alignItems: "flex-start",
										gap: 1,
									}}
								>
									{!isUser && (
										<Box sx={{ mt: 0.5, flexShrink: 0 }}>
											<PauloFreireAvatar size={28} />
										</Box>
									)}
									<Paper
										elevation={0}
										sx={{
											maxWidth: "84%",
											p: 1.5,
											borderRadius: 2.5,
											borderTopRightRadius: isUser ? 0.5 : 2.5,
											borderTopLeftRadius: !isUser ? 0.5 : 2.5,
											backgroundColor: isUser ? "#1e40af" : "#ffffff",
											color: isUser ? "#ffffff" : "#1e293b",
											border: isUser ? "none" : "1px solid #e2e8f0",
											boxShadow: isUser
												? "0 3px 10px rgba(30, 64, 175, 0.25)"
												: "0 2px 6px rgba(15, 23, 42, 0.04)",
										}}
									>
										{renderMarkdownText(msg.content)}
									</Paper>
								</Box>
							);
						})}

						{isLoading && (
							<Box sx={{ display: "flex", alignItems: "center", gap: 1.2, py: 1 }}>
								<PauloFreireAvatar size={26} />
								<CircularProgress size={16} sx={{ color: "#2563eb" }} />
								<Typography variant="caption" sx={{ color: "#64748b", fontStyle: "italic" }}>
									Paulo está consultando tu situación académica...
								</Typography>
							</Box>
						)}
						<div ref={messagesEndRef} />
					</Box>

					{/* Chips de Sugerencia rápidos */}
					{messages.length > 0 && !isLoading && (
						<Box
							sx={{
								px: 1.5,
								py: 0.8,
								backgroundColor: "#f1f5f9",
								display: "flex",
								gap: 0.8,
								overflowX: "auto",
								borderTop: "1px solid #e2e8f0",
								"&::-webkit-scrollbar": { display: "none" },
							}}
						>
							{suggestions.slice(0, 3).map((sug, idx) => (
								<Chip
									key={idx}
									size="small"
									label={sug}
									onClick={() => handleSend(sug)}
									clickable
									sx={{
										backgroundColor: "#ffffff",
										border: "1px solid #cbd5e1",
										fontSize: "0.75rem",
										flexShrink: 0,
										fontWeight: 500,
										"&:hover": { backgroundColor: "#eff6ff", borderColor: "#93c5fd" },
									}}
								/>
							))}
						</Box>
					)}

					{/* Entrada de Texto */}
					<Box
						component="form"
						onSubmit={(e) => {
							e.preventDefault();
							handleSend();
						}}
						sx={{
							p: 1.5,
							backgroundColor: "#ffffff",
							borderTop: "1px solid #e2e8f0",
							display: "flex",
							alignItems: "center",
							gap: 1,
						}}
					>
						<TextField
							inputRef={inputRef}
							fullWidth
							size="small"
							placeholder="Escribile a Paulo Freire..."
							value={inputValue}
							onChange={(e) => setInputValue(e.target.value)}
							disabled={isLoading}
							sx={{
								"& .MuiOutlinedInput-root": {
									borderRadius: 2.5,
									fontSize: "0.88rem",
									backgroundColor: "#f8fafc",
								},
							}}
						/>
						<IconButton
							type="submit"
							color="primary"
							disabled={!inputValue.trim() || isLoading}
							sx={{
								backgroundColor: "#1e40af",
								color: "#ffffff",
								"&:hover": { backgroundColor: "#1e3a8a" },
								"&.Mui-disabled": { backgroundColor: "#e2e8f0", color: "#94a3b8" },
							}}
						>
							<SendIcon fontSize="small" />
						</IconButton>
					</Box>

					{/* Disclaimer institucional */}
					<Box sx={{ px: 2, pb: 0.8, pt: 0.2, textAlign: "center", backgroundColor: "#ffffff" }}>
						<Typography variant="caption" sx={{ fontSize: "0.68rem", color: "#94a3b8" }}>
							Asistente orientativo oficial. Trámites administrativos formales en Bedelía.
						</Typography>
					</Box>
				</Paper>
			)}
		</>
	);
}
