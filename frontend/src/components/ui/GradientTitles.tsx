import { Box, Stack, Typography, SxProps, Theme } from "@mui/material";
import { ReactNode } from "react";
import {
  INSTITUTIONAL_TERRACOTTA,
  INSTITUTIONAL_TERRACOTTA_DARK,
  TITLE_GRADIENT,
} from "@/styles/institutionalColors";

type PageHeroProps = {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  sx?: SxProps<Theme>;
};

export function PageHero({ title, subtitle, actions, sx }: PageHeroProps) {
  const baseSx: SxProps<Theme> = {
    p: { xs: 2, md: 3 },
    borderRadius: 3,
    background: `linear-gradient(120deg, #7D7F6E 0%, #B7694E 100%)`,
    color: "#fff",
    boxShadow: "0 25px 50px rgba(0,0,0,0.12)",
    mb: { xs: 2, md: 3 },
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
      <Box>
        <Typography
          variant="h5"
          sx={{
            fontWeight: 800,
            letterSpacing: 1,
            textTransform: "uppercase",
            color: "#fff",
          }}
        >
          {title}
        </Typography>
        {subtitle && (
          <Typography sx={{ color: "rgba(255,255,255,0.85)" }}>
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
    px: 3,
    py: 1,
    borderRadius: 999,
    background: TITLE_GRADIENT,
    boxShadow: "0 10px 25px rgba(0,0,0,0.15)",
    mt: 0,
    mb: 2,
  };
  const combinedSx: SxProps<Theme> = sx
    ? Array.isArray(sx)
      ? [baseSx, ...sx]
      : [baseSx, sx]
    : baseSx;

  return (
    <Box
      sx={combinedSx}
    >
      <Typography
        variant="subtitle1"
        sx={{
          fontWeight: 700,
          letterSpacing: 1,
          textTransform: "uppercase",
          color: "#fff",
        }}
      >
        {title}
      </Typography>
    </Box>
  );
}

