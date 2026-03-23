import React from "react";
import Autocomplete from "@mui/material/Autocomplete";
import Grid from "@mui/material/Grid";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { DocenteState } from './types';
import { DOCENTE_ROLES } from './constants';

interface TribunalSectionProps {
  docentes: DocenteState[];
  docenteOptions: string[];
  onDocenteInputChange: (index: number, rawValue: string) => void;
}

export function TribunalSection({
  docentes,
  docenteOptions,
  onDocenteInputChange,
}: TribunalSectionProps) {
  return (
    <Paper variant="outlined" sx={{ p: 3 }}>
      <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>
        Tribunal examinador
      </Typography>
      <Stack spacing={2}>
        {docentes.map((docente, index) => {
          const role = DOCENTE_ROLES[index];
          return (
            <Grid
              container
              spacing={2}
              alignItems="center"
              key={role.value}
            >
              <Grid item xs={12} md={3}>
                <Typography variant="subtitle2" fontWeight={600}>
                  {role.label}
                </Typography>
              </Grid>
              <Grid item xs={12} md={9}>
                <Autocomplete
                  freeSolo
                  options={docenteOptions}
                  value={docente.inputValue || ""}
                  onInputChange={(_, newInputValue) =>
                    onDocenteInputChange(index, newInputValue || "")
                  }
                  onChange={(_, newValue) =>
                    onDocenteInputChange(index, newValue || "")
                  }
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="DNI y nombre (ej: 29825234 - Apellido, Nombre)"
                      fullWidth
                    />
                  )}
                />
              </Grid>
            </Grid>
          );
        })}
      </Stack>
    </Paper>
  );
}
