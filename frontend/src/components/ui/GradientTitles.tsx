import type { SxProps, Theme } from "@mui/material";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import type { ReactNode } from "react";
import {
	HERO_GRADIENT,
	INSTITUTIONAL_TERRACOTTA,
	INSTITUTIONAL_TERRACOTTA_DARK,
} from "@/styles/institutionalColors";

type PageHeroProps = {
	title: string;
	subtitle?: string;
	actions?: ReactNode;
	sx?: SxProps<Theme>;
};

export function PageHero({ title, subtitle, actions, sx }: PageHeroProps) {
	const baseSx: SxProps<Theme> = {
		p: { xs: 2.5, md: 3.5 },
		borderRadius: "16px",
		background: HERO_GRADIENT,
		color: "#ffffff",
		boxShadow: "0 10px 25px rgba(110, 50, 33, 0.25)",
		mb: { xs: 3, md: 4 },
		position: "relative",
		overflow: "hidden",
	};
	const combinedSx: SxProps<Theme> = sx
		? Array.isArray(sx)
			? [baseSx, ...sx]
			: [baseSx, sx]
		: baseSx;

	return (
		<Stack
			direction={{ xs: "column", md: "row" }}
			justifyContent="space-between"
			alignItems={{ xs: "flex-start", md: "center" }}
			spacing={2}
			sx={combinedSx}
		>
			<Box sx={{ textAlign: "left", zIndex: 1 }}>
				<Typography
					variant="h4"
					sx={{
						fontWeight: 800,
						fontSize: { xs: "1.3rem", md: "1.65rem" },
						color: "#ffffff",
						letterSpacing: "-0.01em",
					}}
				>
					{title}
				</Typography>
				{subtitle && (
					<Typography
						sx={{
							color: "rgba(255, 255, 255, 0.85)",
							fontSize: { xs: "0.85rem", md: "0.95rem" },
							fontWeight: 500,
							mt: 0.5,
						}}
					>
						{subtitle}
					</Typography>
				)}
			</Box>
			{actions && (
				<Box
					sx={{
						display: "flex",
						gap: 1,
						flexWrap: "wrap",
						width: { xs: "100%", md: "auto" },
						zIndex: 1,
						"& .MuiButton-root": {
							borderRadius: 999,
							textTransform: "none",
						},
						"& .MuiButton-contained": {
							backgroundColor: INSTITUTIONAL_TERRACOTTA,
							"&:hover": { backgroundColor: INSTITUTIONAL_TERRACOTTA_DARK },
						},
					}}
				>
					{actions}
				</Box>
			)}
		</Stack>
	);
}

type SectionTitleProps = {
	title: string;
	sx?: SxProps<Theme>;
};

export function SectionTitlePill({ title, sx }: SectionTitleProps) {
	const baseSx: SxProps<Theme> = {
		display: "inline-flex",
		alignSelf: "flex-start",
		alignItems: "center",
		px: 2.5,
		py: 0.8,
		borderRadius: 999,
		backgroundColor: INSTITUTIONAL_TERRACOTTA,
		backgroundImage: `linear-gradient(135deg, ${INSTITUTIONAL_TERRACOTTA}, ${INSTITUTIONAL_TERRACOTTA_DARK})`,
		boxShadow: "0 4px 12px rgba(156, 78, 53, 0.3)",
		position: "absolute",
		top: "-16px",
		left: "20px",
		zIndex: 2,
	};
	const combinedSx: SxProps<Theme> = sx
		? Array.isArray(sx)
			? [baseSx, ...sx]
			: [baseSx, sx]
		: baseSx;

	return (
		<Box sx={combinedSx}>
			<Typography
				variant="subtitle2"
				sx={{
					fontWeight: 800,
					letterSpacing: "0.05em",
					textTransform: "uppercase",
					color: "#ffffff",
					fontSize: "0.78rem",
				}}
			>
				{title}
			</Typography>
		</Box>
	);
}
