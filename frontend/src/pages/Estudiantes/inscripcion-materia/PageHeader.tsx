import React from "react";
import type { SelectChangeEvent } from "@mui/material";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import BackButton from "@/components/ui/BackButton";
import { TrayectoriaCarreraDetalleDTO, VentanaInscripcion } from "@/api/estudiantes";

interface PageHeaderProps {
  profesoradoNombre: string;
  periodoLabel: string;
  ventana: VentanaInscripcion | null;
  puedeInscribirse: boolean;
  isVentanaLoading: boolean;
  puedeGestionar: boolean;
  dniInput: string;
  setDniInput: React.Dispatch<React.SetStateAction<string>>;
  setDniFiltro: React.Dispatch<React.SetStateAction<string>>;
  anioFiltro: number | "all";
  aniosDisponibles: number[];
  handleAnioChange: (event: SelectChangeEvent<string>) => void;
  shouldFetchInscriptas: boolean;
  carrerasDisponibles: TrayectoriaCarreraDetalleDTO[];
  selectedCarreraId: string;
  handleCarreraChange: (event: SelectChangeEvent<string>) => void;
  planesDisponibles: Array<{ id: number; resolucion?: string | null; vigente?: boolean }>;
  selectedPlanId: string;
  handlePlanChange: (event: SelectChangeEvent<string>) => void;
}

const PageHeader: React.FC<PageHeaderProps> = ({
  profesoradoNombre,
  periodoLabel,
  ventana,
  puedeInscribirse,
  isVentanaLoading,
  puedeGestionar,
  dniInput,
  setDniInput,
  setDniFiltro,
  anioFiltro,
  aniosDisponibles,
  handleAnioChange,
  shouldFetchInscriptas,
  carrerasDisponibles,
  selectedCarreraId,
  handleCarreraChange,
  planesDisponibles,
  selectedPlanId,
  handlePlanChange,
}) => {
  return (
    <Stack
      direction={{ xs: "column", lg: "row" }}
      spacing={2}
      justifyContent="space-between"
      alignItems={{ xs: "flex-start", lg: "center" }}
    >
      <Box>
        <Typography variant="h4" fontWeight={800}>Inscripción a Materias</Typography>
        <Typography color="text.secondary">
          {profesoradoNombre} • {periodoLabel}
        </Typography>
        {ventana?.desde && ventana?.hasta && (
          <Typography variant="body2" color="text.secondary">
            Ventana: {new Date(ventana.desde).toLocaleDateString()} - {new Date(ventana.hasta).toLocaleDateString()}
          </Typography>
        )}
        {!puedeInscribirse && !isVentanaLoading && (
          <Alert severity="warning" sx={{ mt: 1 }}>
            No hay una ventana de inscripción activa. Cuando se habilite vas a poder inscribirte desde aquí.
          </Alert>
        )}
      </Box>

      <Stack spacing={1.5} sx={{ width: { xs: "100%", lg: "auto" } }}>
        {puedeGestionar && (
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ xs: "stretch", sm: "center" }}>
            <TextField
              label="DNI del estudiante"
              size="small"
              value={dniInput}
              onChange={(e) => {
                const value = e.target.value.replace(/\D+/g, "");
                if (value.length <= 8) {
                  setDniInput(value);
                }
              }}
              sx={{ maxWidth: 240, bgcolor: "#fff" }}
              inputProps={{ inputMode: "numeric", pattern: "[0-9]*", maxLength: 8 }}
            />
            <Button
              variant="contained"
              onClick={() => setDniFiltro(dniInput.trim())}
              disabled={dniInput.length < 7}
            >
              Buscar
            </Button>
            <Typography variant="caption" color="text.secondary">
              Bedel/Secretaría/Admin: filtrá por DNI para gestionar inscripciones de un estudiante.
            </Typography>
          </Stack>
        )}

        <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ xs: "stretch", sm: "center" }}>
          <FormControl size="small" sx={{ minWidth: 150, bgcolor: "#fff" }}>
            <InputLabel id="filtro-anio-label">Año</InputLabel>
            <Select
              labelId="filtro-anio-label"
              value={anioFiltro === "all" ? "all" : String(anioFiltro)}
              label="Año"
              onChange={handleAnioChange}
            >
              <MenuItem value="all">Todos los años</MenuItem>
              {aniosDisponibles.map((anio) => (
                <MenuItem key={anio} value={String(anio)}>
                  {`${anio}º año`}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {shouldFetchInscriptas && (
            <FormControl size="small" sx={{ minWidth: 220, bgcolor: "#fff" }} disabled={carrerasDisponibles.length === 0}>
              <InputLabel id="select-profesorado-label">Profesorado</InputLabel>
              <Select
                labelId="select-profesorado-label"
                value={selectedCarreraId}
                label="Profesorado"
                onChange={handleCarreraChange}
                displayEmpty
              >
                {carrerasDisponibles.length === 0 && (
                  <MenuItem value="">
                    {carrerasDisponibles.length === 0 ? "Sin profesorados" : "Cargando..."}
                  </MenuItem>
                )}
                {carrerasDisponibles.map((carrera) => (
                  <MenuItem key={carrera.profesorado_id} value={String(carrera.profesorado_id)}>
                    {carrera.nombre}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}

          {planesDisponibles.length > 1 && (
            <FormControl size="small" sx={{ minWidth: 200, bgcolor: "#fff" }}>
              <InputLabel id="select-plan-label">Plan</InputLabel>
              <Select
                labelId="select-plan-label"
                value={selectedPlanId}
                label="Plan"
                onChange={handlePlanChange}
                displayEmpty
              >
                {planesDisponibles.map((plan) => (
                  <MenuItem key={plan.id} value={String(plan.id)}>
                    {plan.resolucion ? `Plan ${plan.resolucion}` : `Plan ${plan.id}`}{plan.vigente ? " (vigente)" : ""}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
        </Stack>
        {shouldFetchInscriptas && carrerasDisponibles.length > 1 && !selectedCarreraId && (
          <Typography variant="caption" color="error">
            Seleccioná un profesorado para ver sus materias.
          </Typography>
        )}
      </Stack>
    </Stack>
  );
};

export default PageHeader;
