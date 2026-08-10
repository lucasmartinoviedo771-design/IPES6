import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Grid from "@mui/material/Grid";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import {
	INSTITUTIONAL_TERRACOTTA,
	INSTITUTIONAL_TERRACOTTA_DARK,
} from "@/styles/institutionalColors";

export type SectionCardProps = {
	title: string;
	subtitle: string;
	icon: ReactNode;
	path: string;
	disabled?: boolean;
	status?: "success" | "info" | "warning";
};

export default function SectionCard({
	title,
	subtitle,
	icon,
	path,
	disabled = false,
}: SectionCardProps) {
	const navigate = useNavigate();

	return (
		<Grid item xs={12} sm={6} md={4} sx={{ display: "flex" }}>
			<Card
				onClick={() => !disabled && navigate(path)}
				sx={{
					width: "100%",
					minHeight: 115,
					cursor: disabled ? "not-allowed" : "pointer",
					opacity: disabled ? 0.6 : 1,
					borderRadius: "14px",
					border: "1px solid #D6CAA",
					backgroundColor: "#ffffff",
					boxShadow: "0 2px 8px rgba(0, 0, 0, 0.04)",
					transition: "all 0.2s ease-in-out",
					position: "relative",
					overflow: "hidden",
					"&:hover": disabled
						? {}
						: {
								borderColor: INSTITUTIONAL_TERRACOTTA,
								boxShadow: "0 8px 20px rgba(140, 67, 46, 0.18)",
								transform: "translateY(-3px)",
							},
				}}
			>
				<CardContent sx={{ height: "100%", p: 2, "&:last-child": { pb: 2 } }}>
					<Stack direction="row" spacing={2} alignItems="flex-start" sx={{ height: "100%" }}>
						<Box
							sx={{
								width: 46,
								height: 46,
								borderRadius: "12px",
								backgroundColor: INSTITUTIONAL_TERRACOTTA,
								backgroundImage: `linear-gradient(135deg, ${INSTITUTIONAL_TERRACOTTA}, ${INSTITUTIONAL_TERRACOTTA_DARK})`,
								color: "#ffffff",
								display: "flex",
								alignItems: "center",
								justifyContent: "center",
								fontSize: 24,
								boxShadow: "0 4px 10px rgba(156, 78, 53, 0.3)",
								flexShrink: 0,
								mt: 0.2,
							}}
						>
							{icon}
						</Box>

						<Stack spacing={0.5} sx={{ flexGrow: 1 }}>
							<Typography
								variant="subtitle1"
								fontWeight={700}
								sx={{
									fontSize: "0.95rem",
									lineHeight: 1.25,
									color: "#26211d",
									wordBreak: "break-word",
								}}
							>
								{title}
							</Typography>
							<Typography
								variant="body2"
								sx={{
									fontSize: "0.78rem",
									color: "#6b625b",
									lineHeight: 1.35,
								}}
							>
								{subtitle}
							</Typography>
						</Stack>
					</Stack>
				</CardContent>
			</Card>
		</Grid>
	);
}
