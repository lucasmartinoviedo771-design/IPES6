import CameraAltIcon from "@mui/icons-material/CameraAlt";
import CloseIcon from "@mui/icons-material/Close";
import PhotoCameraIcon from "@mui/icons-material/PhotoCamera";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { enqueueSnackbar } from "notistack";
import { useCallback, useEffect, useRef, useState } from "react";
import { uploadFotoPerfil } from "@/api/estudiantes/admin";

interface Props {
	fotoUrl?: string | null;
	nombre?: string;
}

const MAX_SIZE_MB = 5;
const ACCEPTED = "image/jpeg,image/png,image/webp,image/heic,image/heif";

function compressImage(file: File, maxWidthPx = 800): Promise<File> {
	return new Promise((resolve) => {
		const img = new Image();
		const url = URL.createObjectURL(file);
		img.onload = () => {
			URL.revokeObjectURL(url);
			const scale = Math.min(1, maxWidthPx / Math.max(img.width, img.height));
			const canvas = document.createElement("canvas");
			canvas.width = img.width * scale;
			canvas.height = img.height * scale;
			canvas
				.getContext("2d")!
				.drawImage(img, 0, 0, canvas.width, canvas.height);
			canvas.toBlob(
				(blob) =>
					resolve(
						blob ? new File([blob], "foto.jpg", { type: "image/jpeg" }) : file,
					),
				"image/jpeg",
				0.85,
			);
		};
		img.onerror = () => {
			URL.revokeObjectURL(url);
			resolve(file);
		};
		img.src = url;
	});
}

export default function FotoPerfilEditor({ fotoUrl, nombre }: Props) {
	const queryClient = useQueryClient();
	const [open, setOpen] = useState(false);
	const [mode, setMode] = useState<"menu" | "camera">("menu");
	const [preview, setPreview] = useState<string | null>(null);
	const [capturedFile, setCapturedFile] = useState<File | null>(null);
	const [cameraAvailable, setCameraAvailable] = useState(false);
	const [isMobile, setIsMobile] = useState(false);
	const videoRef = useRef<HTMLVideoElement>(null);
	const streamRef = useRef<MediaStream | null>(null);
	const fileInputRef = useRef<HTMLInputElement>(null);

	// Detect mobile and camera availability
	useEffect(() => {
		const mobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
		setIsMobile(mobile);
		if (!mobile && navigator.mediaDevices?.enumerateDevices) {
			navigator.mediaDevices.enumerateDevices().then((devices) => {
				setCameraAvailable(devices.some((d) => d.kind === "videoinput"));
			});
		}
	}, []);

	const stopStream = useCallback(() => {
		streamRef.current?.getTracks().forEach((t) => t.stop());
		streamRef.current = null;
	}, []);

	const handleClose = useCallback(() => {
		stopStream();
		setOpen(false);
		setMode("menu");
		setPreview(null);
		setCapturedFile(null);
	}, [stopStream]);

	const startCamera = async () => {
		setMode("camera");
		try {
			const stream = await navigator.mediaDevices.getUserMedia({
				video: { facingMode: "user" },
			});
			streamRef.current = stream;
			if (videoRef.current) videoRef.current.srcObject = stream;
		} catch {
			enqueueSnackbar(
				"No se pudo acceder a la cámara. Revisá los permisos del navegador.",
				{ variant: "warning" },
			);
			setMode("menu");
		}
	};

	const captureFromCamera = () => {
		if (!videoRef.current) return;
		const canvas = document.createElement("canvas");
		canvas.width = videoRef.current.videoWidth;
		canvas.height = videoRef.current.videoHeight;
		canvas.getContext("2d")!.drawImage(videoRef.current, 0, 0);
		canvas.toBlob(
			(blob) => {
				if (!blob) return;
				const file = new File([blob], "foto.jpg", { type: "image/jpeg" });
				setCapturedFile(file);
				setPreview(URL.createObjectURL(file));
				stopStream();
			},
			"image/jpeg",
			0.9,
		);
	};

	const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (!file) return;
		if (file.size > MAX_SIZE_MB * 1024 * 1024) {
			enqueueSnackbar(`La imagen no puede superar ${MAX_SIZE_MB}MB.`, {
				variant: "warning",
			});
			return;
		}
		const compressed = await compressImage(file);
		setCapturedFile(compressed);
		setPreview(URL.createObjectURL(compressed));
		// Reset input so same file can be selected again
		e.target.value = "";
	};

	const mutation = useMutation({
		mutationFn: (file: File) => uploadFotoPerfil(file),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["perfil-completar"] });
			queryClient.invalidateQueries({ queryKey: ["trayectoria"] });
			enqueueSnackbar("Foto de perfil actualizada.", { variant: "success" });
			handleClose();
		},
		onError: () => {
			enqueueSnackbar("No se pudo guardar la foto. Intentá nuevamente.", {
				variant: "error",
			});
		},
	});

	const handleSave = () => {
		if (capturedFile) mutation.mutate(capturedFile);
	};

	return (
		<>
			{/* Avatar clickeable */}
			<Box
				sx={{
					position: "relative",
					width: 100,
					height: 100,
					cursor: "pointer",
				}}
				onClick={() => setOpen(true)}
			>
				<Avatar
					src={fotoUrl ?? undefined}
					sx={{
						width: 100,
						height: 100,
						fontSize: 36,
						bgcolor: "primary.light",
					}}
				>
					{!fotoUrl && nombre ? nombre[0].toUpperCase() : undefined}
				</Avatar>
				<Box
					sx={{
						position: "absolute",
						bottom: 0,
						right: 0,
						bgcolor: "primary.main",
						borderRadius: "50%",
						width: 32,
						height: 32,
						display: "flex",
						alignItems: "center",
						justifyContent: "center",
						border: "2px solid white",
					}}
				>
					<CameraAltIcon sx={{ fontSize: 18, color: "white" }} />
				</Box>
			</Box>

			<Dialog open={open} onClose={handleClose} maxWidth="xs" fullWidth>
				<DialogTitle
					sx={{
						display: "flex",
						justifyContent: "space-between",
						alignItems: "center",
					}}
				>
					{mode === "camera" ? "Tomar foto" : "Actualizar foto de perfil"}
					<IconButton onClick={handleClose} size="small">
						<CloseIcon />
					</IconButton>
				</DialogTitle>

				<DialogContent>
					{/* Preview de foto capturada/seleccionada */}
					{preview && (
						<Box
							display="flex"
							flexDirection="column"
							alignItems="center"
							gap={2}
						>
							<Avatar src={preview} sx={{ width: 140, height: 140 }} />
							<Typography variant="body2" color="text.secondary">
								¿Usar esta foto?
							</Typography>
						</Box>
					)}

					{/* Vista de cámara web (solo PC) */}
					{mode === "camera" && !preview && (
						<Box
							display="flex"
							flexDirection="column"
							alignItems="center"
							gap={2}
						>
							<Box
								component="video"
								ref={videoRef}
								autoPlay
								playsInline
								muted
								sx={{
									width: "100%",
									maxHeight: 280,
									borderRadius: 2,
									bgcolor: "black",
								}}
							/>
							<Button
								variant="contained"
								startIcon={<PhotoCameraIcon />}
								onClick={captureFromCamera}
							>
								Capturar
							</Button>
						</Box>
					)}

					{/* Menú de opciones */}
					{mode === "menu" && !preview && (
						<Stack spacing={2} mt={1}>
							{/* Opción cámara: input capture en móvil, getUserMedia en PC */}
							{isMobile ? (
								<>
									<Button
										variant="outlined"
										startIcon={<PhotoCameraIcon />}
										component="label"
										fullWidth
									>
										Tomar foto con cámara
										<input
											type="file"
											accept={ACCEPTED}
											capture="user"
											hidden
											onChange={handleFileChange}
										/>
									</Button>
								</>
							) : cameraAvailable ? (
								<Button
									variant="outlined"
									startIcon={<PhotoCameraIcon />}
									onClick={startCamera}
									fullWidth
								>
									Usar cámara web
								</Button>
							) : null}

							{/* Adjuntar archivo — siempre disponible */}
							<Button
								variant="outlined"
								startIcon={<UploadFileIcon />}
								component="label"
								fullWidth
							>
								Adjuntar archivo
								<input
									ref={fileInputRef}
									type="file"
									accept={ACCEPTED}
									hidden
									onChange={handleFileChange}
								/>
							</Button>

							<Typography
								variant="caption"
								color="text.secondary"
								textAlign="center"
							>
								JPG, PNG o WEBP · máx. {MAX_SIZE_MB}MB
							</Typography>
						</Stack>
					)}
				</DialogContent>

				<DialogActions>
					{preview && (
						<>
							<Button
								onClick={() => {
									setPreview(null);
									setCapturedFile(null);
									setMode("menu");
								}}
							>
								Volver
							</Button>
							<Button
								variant="contained"
								onClick={handleSave}
								disabled={mutation.isPending}
								startIcon={
									mutation.isPending ? (
										<CircularProgress size={16} />
									) : undefined
								}
							>
								Guardar foto
							</Button>
						</>
					)}
					{!preview && <Button onClick={handleClose}>Cancelar</Button>}
				</DialogActions>
			</Dialog>
		</>
	);
}
