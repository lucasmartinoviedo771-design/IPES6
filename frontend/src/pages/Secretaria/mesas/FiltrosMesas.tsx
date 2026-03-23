import React from 'react';
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import Typography from "@mui/material/Typography";
import { VentanaDto } from '@/api/ventanas';
import { PlanDTO } from '@/api/cargaNotas';
import { MateriaOption } from './types';
import { buildVentanaLabel } from './utils';

interface FiltrosMesasProps {
  ventanas: VentanaDto[];
  ventanaId: string;
  setVentanaId: (v: string) => void;
  tipo: string;
  setTipo: (v: string) => void;
  modalidadFiltro: string;
  setModalidadFiltro: (v: string) => void;
  codigoFiltro: string;
  setCodigoFiltro: (v: string) => void;
  profesorados: { id: number; nombre: string }[];
  profesoradoFiltro: string;
  setProfesoradoFiltro: (v: string) => void;
  setPlanFiltro: (v: string) => void;
  setMateriaFiltro: (v: string) => void;
  planesFiltro: PlanDTO[];
  planFiltro: string;
  anioFiltro: string;
  setAnioFiltro: (v: string) => void;
  cuatrimestreFiltro: string;
  setCuatrimestreFiltro: (v: string) => void;
  cuatrimestreOptionsFiltro: { value: string; label: string }[];
  availableAniosFiltro: number[];
  materiasFiltroFiltradas: MateriaOption[];
  materiaFiltro: string;
}

export function FiltrosMesas({
  ventanas,
  ventanaId,
  setVentanaId,
  tipo,
  setTipo,
  modalidadFiltro,
  setModalidadFiltro,
  codigoFiltro,
  setCodigoFiltro,
  profesorados,
  profesoradoFiltro,
  setProfesoradoFiltro,
  setPlanFiltro,
  setMateriaFiltro,
  planesFiltro,
  planFiltro,
  anioFiltro,
  setAnioFiltro,
  cuatrimestreFiltro,
  setCuatrimestreFiltro,
  cuatrimestreOptionsFiltro,
  availableAniosFiltro,
  materiasFiltroFiltradas,
  materiaFiltro,
}: FiltrosMesasProps) {
  return (
    <Stack gap={2} sx={{ mt: 1 }}>
      <Stack direction={{ xs: 'column', sm: 'row' }} gap={2} sx={{ flexWrap: 'wrap' }}>
        <TextField select label="Periodo" size="small" value={ventanaId} onChange={(e) => setVentanaId(e.target.value)} sx={{ minWidth: 220 }}>
          <MenuItem value="">Todos</MenuItem>
          {ventanas.map(v => (
            <MenuItem key={v.id} value={String(v.id)}>{buildVentanaLabel(v)}</MenuItem>
          ))}
        </TextField>
        <TextField select label="Tipo" size="small" value={tipo} onChange={(e) => setTipo(e.target.value)} sx={{ minWidth: 160 }}>
          <MenuItem value="">Todos</MenuItem>
          <MenuItem value="FIN">Ordinaria</MenuItem>
          <MenuItem value="EXT">Extraordinaria</MenuItem>
          <MenuItem value="ESP">Especial</MenuItem>
        </TextField>
        <TextField
          select
          label="Modalidad"
          size="small"
          value={modalidadFiltro}
          onChange={(e) => setModalidadFiltro(e.target.value)}
          sx={{ minWidth: 160 }}
        >
          <MenuItem value="">Todas</MenuItem>
          <MenuItem value="REG">Regulares</MenuItem>
          <MenuItem value="LIB">Libres</MenuItem>
        </TextField>
        <TextField
          label="Código"
          size="small"
          value={codigoFiltro}
          onChange={(e) => setCodigoFiltro(e.target.value)}
          sx={{ minWidth: 200 }}
          placeholder="MESA-..."
        />
        <TextField
          select
          label="Profesorado"
          size="small"
          value={profesoradoFiltro}
          onChange={(e) => {
            setProfesoradoFiltro(e.target.value);
            setPlanFiltro('');
            setMateriaFiltro('');
          }}
          sx={{ minWidth: 220 }}
        >
          <MenuItem value="">Todos</MenuItem>
          {profesorados.map(p => (
            <MenuItem key={p.id} value={String(p.id)}>{p.nombre}</MenuItem>
          ))}
        </TextField>
        <TextField
          select
          label="Plan de estudio"
          size="small"
          value={planFiltro}
          onChange={(e) => {
            setPlanFiltro(e.target.value);
            setMateriaFiltro('');
          }}
          sx={{ minWidth: 200 }}
          disabled={!profesoradoFiltro}
        >
          <MenuItem value="">Todos</MenuItem>
          {planesFiltro.map(p => (
            <MenuItem key={p.id} value={String(p.id)}>{p.resolucion}</MenuItem>
          ))}
        </TextField>
      </Stack>

      <Stack direction={{ xs: 'column', sm: 'row' }} gap={2} sx={{ flexWrap: 'wrap' }}>
        <TextField
          select
          label="Año cursada"
          size="small"
          value={anioFiltro}
          onChange={(e) => setAnioFiltro(e.target.value)}
          sx={{ minWidth: 160 }}
        >
          <MenuItem value="">Todos</MenuItem>
          {availableAniosFiltro.map(anio => (
            <MenuItem key={anio} value={String(anio)}>{anio}</MenuItem>
          ))}
        </TextField>
        <TextField
          select
          label="Cuatrimestre"
          size="small"
          value={cuatrimestreFiltro}
          onChange={(e) => setCuatrimestreFiltro(e.target.value)}
          sx={{ minWidth: 180 }}
        >
          {cuatrimestreOptionsFiltro.map(option => (
            <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>
          ))}
        </TextField>
        <TextField
          select
          label="Materia"
          size="small"
          value={materiaFiltro}
          onChange={(e) => setMateriaFiltro(e.target.value)}
          sx={{ minWidth: 220 }}
          disabled={!planFiltro || !materiasFiltroFiltradas.length}
        >
          <MenuItem value="">Todas</MenuItem>
          {materiasFiltroFiltradas.map(m => (
            <MenuItem key={m.id} value={String(m.id)}>{m.nombre}</MenuItem>
          ))}
        </TextField>
      </Stack>
    </Stack>
  );
}
