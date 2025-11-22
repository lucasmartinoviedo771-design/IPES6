import { Box, Grid, Stack, Typography } from "@mui/material";

import { PageHero, SectionTitlePill } from "@/components/ui/GradientTitles";
import SectionCard, { SectionCardProps } from "@/components/secretaria/SectionCard";

export type RoleDashboardSection = {
  title: string;
  items: SectionCardProps[];
};

type RoleDashboardProps = {
  title: string;
  subtitle: string;
  sections: RoleDashboardSection[];
};

const RoleDashboard: React.FC<RoleDashboardProps> = ({ title, subtitle, sections }) => {
  const visibleSections = sections.filter((section) => section.items.length > 0);

  return (
    <Stack gap={4}>
      <PageHero title={title} subtitle={subtitle} />

      {visibleSections.length === 0 ? (
        <Box>
          <Typography variant="body1" color="text.secondary">
            Aún no hay accesos habilitados para este rol. Contactate con Secretaría si necesitás permisos adicionales.
          </Typography>
        </Box>
      ) : (
        visibleSections.map((section) => (
          <Box key={section.title}>
            <SectionTitlePill title={section.title} />
            <Grid container spacing={2}>
              {section.items.map((item) => (
                <SectionCard key={`${section.title}-${item.title}`} {...item} />
              ))}
            </Grid>
          </Box>
        ))
      )}
    </Stack>
  );
};

export default RoleDashboard;
