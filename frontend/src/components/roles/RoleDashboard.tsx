import LockReset from "@mui/icons-material/LockReset";
import NotificationsNone from "@mui/icons-material/NotificationsNone";
import Settings from "@mui/icons-material/Settings";
import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useNavigate } from "react-router-dom";
import SectionCard, {
	type SectionCardProps,
} from "@/components/secretaria/SectionCard";
import { PageHero, SectionTitlePill } from "@/components/ui/GradientTitles";
import { useAuth } from "@/context/AuthContext";
import { INSTITUTIONAL_TERRACOTTA } from "@/styles/institutionalColors";

export type RoleDashboardSection = {
	title: string;
	items: SectionCardProps[];
};

type RoleDashboardProps = {
	title: string;
	subtitle: string;
	sections: RoleDashboardSection[];
};

const RoleDashboard: React.FC<RoleDashboardProps> = ({
	title,
	subtitle,
	sections,
}) => {
	const { user } = useAuth();
	const navigate = useNavigate();

	const visibleSections = sections.filter(
		(section) => section.items.length > 0,
	);

	const userName = user?.name || user?.dni || "";

	const heroTitle = userName
		? `Bienvenido a la Operatoria Diaria, ${userName}`
		: `Bienvenido a ${title}`;

	const heroSubtitle = `IPES Paulo Freire / ${title}`;

	return (
		<Stack spacing={3}>
			<PageHero title={heroTitle} subtitle={heroSubtitle} />

			{visibleSections.length === 0 ? (
				<Box sx={{ p: 3, textAlign: "center" }}>
					<Typography variant="body1" color="text.secondary">
						Aún no hay accesos habilitados para este rol. Contactate con
						Secretaría si necesitás permisos adicionales.
					</Typography>
				</Box>
			) : (
				<Grid container spacing={3}>
					{/* Columna Principal con Secciones en Contenedores Beiges Agrupadores */}
					<Grid item xs={12} lg={9.2}>
						<Stack spacing={4.5}>
							{visibleSections.map((section) => (
								<Box
									key={section.title}
									sx={{
										position: "relative",
										backgroundColor: "#E8DFD3",
										border: "1px solid #D6CAA",
										borderRadius: "20px",
										p: { xs: 2, md: 3 },
										pt: { xs: 3.5, md: 4 },
										boxShadow: "0 4px 15px rgba(0, 0, 0, 0.03)",
									}}
								>
									<SectionTitlePill title={section.title} />
									<Grid container spacing={2}>
										{section.items.map((item) => (
											<SectionCard
												key={`${section.title}-${item.title}`}
												{...item}
											/>
										))}
									</Grid>
								</Box>
							))}
						</Stack>
					</Grid>

					{/* Columna Derecha: Notificaciones y Acciones */}
					<Grid item xs={12} lg={2.8}>
						<Paper
							elevation={0}
							sx={{
								p: 2.5,
								borderRadius: "18px",
								backgroundColor: "#ffffff",
								border: "1px solid #D6CAA",
								boxShadow: "0 4px 15px rgba(0, 0, 0, 0.04)",
								position: "sticky",
								top: 90,
							}}
						>
							<Typography
								variant="subtitle1"
								fontWeight={800}
								sx={{ mb: 2, color: "#1c1917", fontSize: "0.95rem" }}
							>
								Notificaciones y Acciones
							</Typography>

							<Stack spacing={1}>
								<Box
									sx={{
										display: "flex",
										alignItems: "center",
										gap: 1.5,
										p: 1.2,
										borderRadius: "10px",
										backgroundColor: "#F4EFEA",
										color: INSTITUTIONAL_TERRACOTTA,
										cursor: "pointer",
										fontWeight: 600,
										fontSize: "0.85rem",
										transition: "all 0.2s ease",
										"&:hover": {
											backgroundColor: "#E8DFD3",
										},
									}}
								>
									<NotificationsNone sx={{ fontSize: 20 }} />
									<Typography variant="body2" fontWeight={600} color="inherit">
										Notificaciones
									</Typography>
								</Box>

								<Box
									sx={{
										display: "flex",
										alignItems: "center",
										gap: 1.5,
										p: 1.2,
										borderRadius: "10px",
										color: "#57534e",
										cursor: "pointer",
										fontWeight: 500,
										fontSize: "0.85rem",
										transition: "all 0.2s ease",
										"&:hover": {
											backgroundColor: "#F4EFEA",
											color: "#1c1917",
										},
									}}
								>
									<Settings sx={{ fontSize: 20 }} />
									<Typography variant="body2" color="inherit">
										Acciones globales
									</Typography>
								</Box>

								<Box
									onClick={() => navigate("/cambiar-password")}
									sx={{
										display: "flex",
										alignItems: "center",
										gap: 1.5,
										p: 1.2,
										borderRadius: "10px",
										color: "#57534e",
										cursor: "pointer",
										fontWeight: 500,
										fontSize: "0.85rem",
										transition: "all 0.2s ease",
										"&:hover": {
											backgroundColor: "#F4EFEA",
											color: "#1c1917",
										},
									}}
								>
									<LockReset sx={{ fontSize: 20 }} />
									<Typography variant="body2" color="inherit">
										Cambiar contraseña
									</Typography>
								</Box>
							</Stack>
						</Paper>
					</Grid>
				</Grid>
			)}
		</Stack>
	);
};

export default RoleDashboard;
