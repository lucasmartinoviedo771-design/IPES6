import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import InputAdornment from "@mui/material/InputAdornment";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import Tooltip from "@mui/material/Tooltip";
import IconButton from "@mui/material/IconButton";
import SearchIcon from "@mui/icons-material/Search";
import RefreshIcon from "@mui/icons-material/Refresh";
import { EstadoLegajo, ESTADO_OPTIONS, EstadoAcademico, ESTADO_ACADEMICO_OPTIONS } from "../types";

type Carrera = { id: number; nombre: string };

type Props = {
  search: string;
  onSearchChange: (value: string) => void;
  estado: EstadoLegajo;
  onEstadoChange: (value: EstadoLegajo) => void;
  estadoAcademico: EstadoAcademico;
  onEstadoAcademicoChange: (value: EstadoAcademico) => void;
  carreraId: number | "";
  onCarreraChange: (value: number | "") => void;
  anioIngreso: number | "";
  onAnioIngresoChange: (value: number | "") => void;
  anioIngresoOptions: string[];
  carreras: Carrera[];
  isListLoading: boolean;
  onRefresh: () => void;
};

export function EstudiantesFilterBar({
  search,
  onSearchChange,
  estado,
  onEstadoChange,
  estadoAcademico,
  onEstadoAcademicoChange,
  carreraId,
  onCarreraChange,
  anioIngreso,
  onAnioIngresoChange,
  anioIngresoOptions,
  carreras,
  isListLoading,
  onRefresh,
}: Props) {
  return (
    <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems={{ xs: "stretch", md: "center" }}>
      <TextField
        label="Buscar estudiante"
        size="small"
        value={search}
        onChange={(event) => onSearchChange(event.target.value)}
        placeholder="DNI, Apellido o Nombre"
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon fontSize="small" />
            </InputAdornment>
          ),
        }}
        sx={{ minWidth: 260 }}
      />
      <FormControl size="small" sx={{ minWidth: 180 }}>
        <InputLabel id="filtro-estado">Estado legajo</InputLabel>
        <Select
          labelId="filtro-estado"
          label="Estado legajo"
          value={estado}
          onChange={(event) => onEstadoChange(event.target.value as EstadoLegajo)}
        >
          {ESTADO_OPTIONS.map((option) => (
            <MenuItem key={option.value} value={option.value}>
              {option.label}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
      <FormControl size="small" sx={{ minWidth: 220 }}>
        <InputLabel id="filtro-carrera">Carrera</InputLabel>
        <Select
          labelId="filtro-carrera"
          label="Carrera"
          value={carreraId}
          onChange={(event) => onCarreraChange(event.target.value as number | "")}
        >
          <MenuItem value="">
            Todas
          </MenuItem>
          {carreras.map((carrera) => (
            <MenuItem key={carrera.id} value={carrera.id}>
              {carrera.nombre}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
      <FormControl size="small" sx={{ minWidth: 180 }}>
        <InputLabel id="filtro-estado-academico">Estado académico</InputLabel>
        <Select
          labelId="filtro-estado-academico"
          label="Estado académico"
          value={estadoAcademico}
          onChange={(event) => onEstadoAcademicoChange(event.target.value as EstadoAcademico)}
        >
          {ESTADO_ACADEMICO_OPTIONS.map((option) => (
            <MenuItem key={option.value} value={option.value}>
              {option.label}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
      <FormControl size="small" sx={{ minWidth: 140 }}>
        <InputLabel id="filtro-anio-ingreso">Año ingreso</InputLabel>
        <Select
          labelId="filtro-anio-ingreso"
          label="Año ingreso"
          value={anioIngreso}
          onChange={(event) => onAnioIngresoChange(event.target.value as number | "")}
        >
          <MenuItem value="">Todos</MenuItem>
          {anioIngresoOptions.map((year) => (
            <MenuItem key={year} value={parseInt(year)}>
              {year}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
      <Box flexGrow={1} />
      <Tooltip title="Refrescar">
        <span>
          <IconButton onClick={onRefresh} disabled={isListLoading}>
            <RefreshIcon />
          </IconButton>
        </span>
      </Tooltip>
    </Stack>
  );
}
