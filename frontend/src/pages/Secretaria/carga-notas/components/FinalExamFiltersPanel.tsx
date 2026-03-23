import React from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { MateriaOptionDTO, PlanDTO, ProfesoradoDTO } from "@/api/cargaNotas";
import { VentanaDto } from "@/api/ventanas";
import { FinalFiltersState } from "../types";

type Props = {
  finalFilters: FinalFiltersState;
  setFinalFilters: React.Dispatch<React.SetStateAction<FinalFiltersState>>;
  profesorados: ProfesoradoDTO[];
  ventanasFinales: VentanaDto[];
  finalPlanes: PlanDTO[];
  finalMaterias: MateriaOptionDTO[];
  loadingFinalPlanes: boolean;
  loadingFinalMaterias: boolean;
  finalAvailableAnios: number[];
  finalCuatrimestreOptions: { value: string; label: string }[];
  finalMateriasFiltradas: MateriaOptionDTO[];
  finalError: string | null;
  setFinalError: (value: string | null) => void;
  finalSuccess: string | null;
  setFinalSuccess: (value: string | null) => void;
};

const FinalExamFiltersPanel: React.FC<Props> = ({
  finalFilters,
  setFinalFilters,
  profesorados,
  ventanasFinales,
  finalPlanes,
  loadingFinalPlanes,
  loadingFinalMaterias,
  finalAvailableAnios,
  finalCuatrimestreOptions,
  finalMateriasFiltradas,
  finalError,
  setFinalError,
  finalSuccess,
  setFinalSuccess,
}) => {
  return (
    <>
      <Box>
        <Typography variant="subtitle1" fontWeight={700}>
          Exámenes finales (planilla de mesa)
        </Typography>
        <Typography color="text.secondary">
          Gestioná las planillas de actas y notas de las mesas finales habilitadas.
        </Typography>
      </Box>

      <Stack direction={{ xs: "column", md: "row" }} gap={2} sx={{ flexWrap: "wrap" }}>
        <TextField
          select
          label="Periodo"
          size="small"
          sx={{ minWidth: 220 }}
          value={finalFilters.ventanaId}
          onChange={(event) =>
            setFinalFilters((prev) => ({ ...prev, ventanaId: event.target.value }))
          }
        >
          <MenuItem value="">Todos</MenuItem>
          {ventanasFinales.map((ventana) => (
            <MenuItem key={ventana.id} value={String(ventana.id)}>
              {new Date(ventana.desde).toLocaleDateString()} - {new Date(ventana.hasta).toLocaleDateString()} ({ventana.tipo.replace("MESAS_", "")})
            </MenuItem>
          ))}
        </TextField>
        <TextField
          select
          label="Tipo"
          size="small"
          sx={{ minWidth: 160 }}
          value={finalFilters.tipo ?? ""}
          onChange={(event) =>
            setFinalFilters((prev) => ({ ...prev, tipo: event.target.value as FinalFiltersState["tipo"] }))
          }
        >
          <MenuItem value="">Todos</MenuItem>
          <MenuItem value="FIN">Ordinaria</MenuItem>
          <MenuItem value="EXT">Extraordinaria</MenuItem>
          <MenuItem value="ESP">Especial</MenuItem>
        </TextField>
        <TextField
          select
          label="Modalidad"
          size="small"
          sx={{ minWidth: 180 }}
          value={finalFilters.modalidad ?? ""}
          onChange={(event) =>
            setFinalFilters((prev) => ({
              ...prev,
              modalidad: event.target.value as FinalFiltersState["modalidad"],
            }))
          }
        >
          <MenuItem value="">Todas</MenuItem>
          <MenuItem value="REG">Regulares</MenuItem>
          <MenuItem value="LIB">Libres</MenuItem>
        </TextField>
        <TextField
          select
          label="Profesorado"
          size="small"
          sx={{ minWidth: 220 }}
          value={finalFilters.profesoradoId ?? ""}
          onChange={(event) => {
            const value = event.target.value === "" ? null : Number(event.target.value);
            setFinalFilters((prev) => ({
              ...prev,
              profesoradoId: value,
              planId: null,
              materiaId: null,
              anio: null,
              cuatrimestre: null,
            }));
          }}
        >
          <MenuItem value="">Todos</MenuItem>
          {profesorados.map((profesorado) => (
            <MenuItem key={profesorado.id} value={String(profesorado.id)}>
              {profesorado.nombre}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          select
          label="Plan de estudio"
          size="small"
          sx={{ minWidth: 220 }}
          value={finalFilters.planId ?? ""}
          onChange={(event) => {
            const value = event.target.value === "" ? null : Number(event.target.value);
            setFinalFilters((prev) => ({
              ...prev,
              planId: value,
              materiaId: null,
              anio: null,
              cuatrimestre: null,
            }));
          }}
          disabled={!finalFilters.profesoradoId}
          InputProps={{
            endAdornment: loadingFinalPlanes ? <CircularProgress size={18} /> : undefined,
          }}
        >
          <MenuItem value="">Todos</MenuItem>
          {finalPlanes.map((plan) => (
            <MenuItem key={plan.id} value={String(plan.id)}>
              {plan.resolucion}
            </MenuItem>
          ))}
        </TextField>
      </Stack>

      <Stack direction={{ xs: "column", md: "row" }} gap={2} sx={{ flexWrap: "wrap" }}>
        <TextField
          select
          label="Año cursada"
          size="small"
          sx={{ minWidth: 160 }}
          value={finalFilters.anio ?? ""}
          onChange={(event) => {
            const value = event.target.value === "" ? null : Number(event.target.value);
            setFinalFilters((prev) => ({
              ...prev,
              anio: value,
              materiaId: null,
            }));
          }}
          disabled={!finalFilters.planId}
        >
          <MenuItem value="">Todos</MenuItem>
          {finalAvailableAnios.map((anio) => (
            <MenuItem key={anio} value={anio}>
              {anio}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          select
          label="Cuatrimestre"
          size="small"
          sx={{ minWidth: 180 }}
          value={finalFilters.cuatrimestre ?? ""}
          onChange={(event) =>
            setFinalFilters((prev) => ({
              ...prev,
              cuatrimestre: event.target.value === "" ? null : (event.target.value as string),
              materiaId: null,
            }))
          }
          disabled={!finalFilters.planId}
        >
          <MenuItem value="">Todos</MenuItem>
          {finalCuatrimestreOptions.map((option) => (
            <MenuItem key={option.value} value={option.value}>
              {option.label}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          select
          label="Materia"
          size="small"
          sx={{ minWidth: 240 }}
          value={finalFilters.materiaId ?? ""}
          onChange={(event) =>
            setFinalFilters((prev) => ({
              ...prev,
              materiaId: event.target.value === "" ? null : Number(event.target.value),
            }))
          }
          disabled={!finalFilters.planId}
          InputProps={{
            endAdornment: loadingFinalMaterias ? <CircularProgress size={18} /> : undefined,
          }}
        >
          <MenuItem value="">Todas</MenuItem>
          {finalMateriasFiltradas.map((materia) => (
            <MenuItem key={materia.id} value={materia.id}>
              {materia.nombre}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          select
          label="Estado Planilla"
          size="small"
          sx={{ minWidth: 160 }}
          value={finalFilters.estadoPlanilla}
          onChange={(event) =>
            setFinalFilters((prev) => ({
              ...prev,
              estadoPlanilla: event.target.value as "TODAS" | "ABIERTAS" | "CERRADAS",
            }))
          }
        >
          <MenuItem value="TODAS">Todas</MenuItem>
          <MenuItem value="ABIERTAS">Solo Abiertas</MenuItem>
          <MenuItem value="CERRADAS">Solo Cerradas</MenuItem>
        </TextField>
        <TextField
          select
          label="Año de Mesa"
          size="small"
          sx={{ minWidth: 130 }}
          value={finalFilters.anioMesa ?? ""}
          onChange={(event) =>
            setFinalFilters((prev) => ({
              ...prev,
              anioMesa: event.target.value === "" ? null : Number(event.target.value),
            }))
          }
        >
          <MenuItem value="">Todos</MenuItem>
          {Array.from({ length: new Date().getFullYear() - 2018 }, (_, i) => new Date().getFullYear() - i).map((year) => (
            <MenuItem key={year} value={year}>{year}</MenuItem>
          ))}
        </TextField>
      </Stack>

      {finalError && (
        <Alert severity="error" onClose={() => setFinalError(null)}>
          {finalError}
        </Alert>
      )}
      {finalSuccess && (
        <Alert severity="success" onClose={() => setFinalSuccess(null)}>
          {finalSuccess}
        </Alert>
      )}
    </>
  );
};

export default FinalExamFiltersPanel;
