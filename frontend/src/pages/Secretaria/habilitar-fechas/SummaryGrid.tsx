import React from "react";
import Box from "@mui/material/Box";
import ButtonBase from "@mui/material/ButtonBase";
import Chip from "@mui/material/Chip";
import Grid from "@mui/material/Grid";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

import { Ventana, formatRange } from "./constants";

type SummaryItem = {
  key: string;
  label: string;
  reference?: Ventana;
  state: { label: string; color: "default" | "success" | "warning" };
};

type Props = {
  summaryItems: SummaryItem[];
  onItemClick: (typeKey: string) => void;
};

const SummaryGrid: React.FC<Props> = ({ summaryItems, onItemClick }) => {
  return (
    <Box sx={{ mb: 4 }}>
      <Grid container spacing={2}>
        {summaryItems.map((item) => (
          <Grid item xs={12} sm={6} md={4} key={item.key}>
            <ButtonBase
              onClick={() => onItemClick(item.key)}
              sx={{
                width: "100%",
                textAlign: "left",
                borderRadius: 2,
                border: "1px solid",
                borderColor: "divider",
                p: 2,
                transition: "all .15s ease",
                "&:hover": {
                  borderColor: "primary.main",
                  boxShadow: (theme) => `${theme.palette.primary.main}33 0px 0px 0px 2px`,
                },
              }}
            >
              <Stack spacing={1}>
                <Typography variant="subtitle1" fontWeight={700}>
                  {item.label}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {item.reference ? formatRange(item.reference) : "Sin períodos cargados"}
                </Typography>
                <Stack direction="row" spacing={1}>
                  <Chip size="small" label={item.state.label} color={item.state.color} />
                  {item.reference?.activo && <Chip size="small" label="Habilitado" color="success" />}
                </Stack>
              </Stack>
            </ButtonBase>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
};

export default SummaryGrid;
