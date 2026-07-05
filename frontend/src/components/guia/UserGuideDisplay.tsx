/* eslint-disable react-doctor/dangerous-html-sink */

import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemText from "@mui/material/ListItemText";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import { useQuery } from "@tanstack/react-query";
import DOMPurify from "dompurify";
import { useMemo } from "react";
import { fetchGuiaUsuario } from "@/api/guias";
import { useAuth } from "@/context/AuthContext";

const slugify = (text: string) =>
	text
		.toLowerCase()
		.replace(/[^a-z0-9 -]/g, "")
		.replace(/\s+/g, "-")
		.replace(/-+/g, "-");

const UserGuideDisplay = () => {
	const { user, loading: authLoading } = useAuth();
	const { data, isLoading, isError, error } = useQuery({
		queryKey: ["guiaUsuario", user?.id],
		queryFn: fetchGuiaUsuario,
		enabled: !authLoading && !!user,
	});

	const { titles, contentWithIds } = useMemo(() => {
		if (!data?.manual) return { titles: [], contentWithIds: "" };

		const lines = data.manual.split("\n");
		const titles: { text: string; slug: string }[] = [];
		let htmlContent = "";

		for (let i = 0; i < lines.length; i++) {
			const line = lines[i];
			const trimmedLine = line.trim();

			if (trimmedLine === "") {
				htmlContent += "<br />";
				continue;
			}

			const nextLine = lines[i + 1]?.trim();
			const prevLine = lines[i - 1]?.trim();

			const isMarkdownHeader = nextLine && nextLine.match(/^[=-]+$/);
			const isStandaloneTitle =
				(prevLine === "" || i === 0) &&
				trimmedLine.length < 80 &&
				!trimmedLine.endsWith(".") &&
				!trimmedLine.endsWith(":") &&
				!trimmedLine.startsWith("- ") &&
				!trimmedLine.startsWith("* ") &&
				!trimmedLine.match(/^\d+\.\s/);

			if (isMarkdownHeader || isStandaloneTitle) {
				const slug = slugify(trimmedLine);
				titles.push({ text: trimmedLine, slug });
				htmlContent += `<h2 id="${slug}" style="margin-top: 2em; margin-bottom: 0.5em; font-size: 1.2em; font-weight: bold;">${trimmedLine}</h2>`;
				if (isMarkdownHeader) {
					i++; // Skip the underline line
				}
			} else {
				htmlContent += `<span>${line.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</span><br />`;
			}
		}

		const sanitized = htmlContent;
		return { titles, contentWithIds: sanitized };
	}, [data?.manual]);

	if (isLoading || authLoading) {
		return (
			<Box
				display="flex"
				justifyContent="center"
				alignItems="center"
				sx={{ p: 4 }}
			>
				<CircularProgress />
				<Typography sx={{ ml: 2 }}>Cargando guía...</Typography>
			</Box>
		);
	}

	if (isError) {
		const axiosLike = error as { response?: { data?: { message?: string } } };
		const errorMessage = axiosLike?.response?.data?.message || error.message;
		return (
			<Alert severity="error">No se pudo cargar la guía: {errorMessage}</Alert>
		);
	}

	return (
		<Paper
			elevation={0}
			sx={{
				p: 2,
				backgroundColor: "#f5f5f5",
				maxHeight: "70vh",
				overflowY: "auto",
			}}
		>
			<Typography variant="h6" gutterBottom>
				Guía para el rol: {data?.rol}
			</Typography>

			{titles.length > 1 && (
				<Box mb={3} p={2} bgcolor="#e8e8e8" borderRadius={2}>
					<Typography variant="subtitle1" gutterBottom fontWeight="bold">
						Índice
					</Typography>
					<List dense>
						{titles.map((title) => (
							<ListItemButton
								key={title.slug}
								component="a"
								href={`#${title.slug}`}
								sx={{ py: 0, borderRadius: 1 }}
							>
								<ListItemText primary={title.text} />
							</ListItemButton>
						))}
					</List>
				</Box>
			)}

			<Box
				component="div"
				sx={{ fontFamily: "monospace", fontSize: 13, lineHeight: 1.5 }}
				dangerouslySetInnerHTML={{
					__html:
						typeof window === "undefined"
							? contentWithIds
							: DOMPurify.sanitize(contentWithIds),
				}}
			/>
		</Paper>
	);
};

export default UserGuideDisplay;
