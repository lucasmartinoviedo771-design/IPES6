import { ReactNode } from "react";
import { Card, CardContent, Grid, Stack, Typography, Box } from "@mui/material";
import { useNavigate } from "react-router-dom";
import {
  ICON_GRADIENT,
  INSTITUTIONAL_GREEN,
  INSTITUTIONAL_TERRACOTTA,
} from "@/styles/institutionalColors";

export type SectionCardProps = {
  title: string;
  subtitle: string;
  icon: ReactNode;
  path: string;
};

export default function SectionCard({
  title,
  subtitle,
  icon,
  path,
}: SectionCardProps) {
  const navigate = useNavigate();

  return (
    <Grid item xs={12} sm={6} md={4} lg={3} sx={{ display: "flex" }}>
      <Card
        onClick={() => navigate(path)}
        sx={{
          width: "100%",
          minHeight: 110,
          cursor: "pointer",
          borderRadius: 10,
          border: `1px solid ${INSTITUTIONAL_GREEN}55`,
          backgroundColor: "#fff",
          boxShadow: "0 10px 20px rgba(125,127,110,0.15)",
          transition: "all 0.2s ease",
          "&:hover": {
            borderColor: INSTITUTIONAL_TERRACOTTA,
            boxShadow: "0 15px 35px rgba(183,105,78,0.35)",
            transform: "translateY(-4px)",
          },
        }}
      >
        <CardContent sx={{ height: "100%", display: "flex" }}>
          <Stack spacing={1.5} sx={{ width: "100%" }}>
            <Stack direction="row" spacing={1.5} alignItems="center">
              <Box
                sx={{
                  width: 56,
                  height: 56,
                  borderRadius: 8,
                  backgroundImage: ICON_GRADIENT,
                  color: "common.white",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 30,
                  boxShadow: "0 10px 20px rgba(183,105,78,0.55)",
                  flexShrink: 0,
                }}
              >
                {icon}
              </Box>
              <Typography
                variant="subtitle1"
                fontWeight={600}
                sx={{ lineHeight: 1.2, wordBreak: "break-word" }}
              >
                {title}
              </Typography>
            </Stack>
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ whiteSpace: "normal" }}
            >
              {subtitle}
            </Typography>
          </Stack>
        </CardContent>
      </Card>
    </Grid>
  );
}
