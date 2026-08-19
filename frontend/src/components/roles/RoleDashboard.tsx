import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import SectionCard, {
	type SectionCardProps,
} from "@/components/secretaria/SectionCard";
import { PageHero, SectionTitlePill } from "@/components/ui/GradientTitles";
import { useAuth } from "@/context/AuthContext";

export type RoleDashboardSection = {
	title: string;
	items: SectionCardProps[];
};

type RoleDashboardProps = {
	title: string;
	subtitle: string;
	sections: RoleDashboardSection[];
	children?: React.ReactNode;
};

const RoleDashboard: React.FC<RoleDashboardProps> = ({
	title,
	subtitle,
	sections,
	children,
}) => {
	const { user } = useAuth();

	const visibleSections = sections.filter(
		(section) => section.items.length > 0,
	);

	const userName = user?.name || user?.dni || "";

	const heroTitle = userName
		? `Bienvenido, ${userName}`
		: `Bienvenido a ${title}`;

	const heroSubtitle = `IPES Paulo Freire / ${title}`;

	return (
		<Stack spacing={3.5}>
			<PageHero title={heroTitle} subtitle={heroSubtitle} />

			{children}

			{visibleSections.length === 0 ? (
				<Box sx={{ p: 3, textAlign: "center" }}>
					<Typography variant="body1" color="text.secondary">
						Aún no hay accesos habilitados para este rol. Contactate con
						Secretaría si necesitás permisos adicionales.
					</Typography>
				</Box>
			) : (
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
			)}
		</Stack>
	);
};

export default RoleDashboard;
