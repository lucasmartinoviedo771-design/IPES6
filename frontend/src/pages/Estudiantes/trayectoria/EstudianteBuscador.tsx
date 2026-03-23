import React, { useEffect, useState } from 'react';
import Autocomplete from "@mui/material/Autocomplete";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Divider from "@mui/material/Divider";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import SearchIcon from '@mui/icons-material/Search';

import { fetchEstudiantesAdmin, EstudianteAdminListItemDTO } from '@/api/estudiantes';

type Props = {
  dniInput: string;
  setDniInput: (val: string) => void;
  onBuscar: () => void;
  onSelectEstudiante: (dni: string) => void;
};

const EstudianteBuscador = ({ dniInput, setDniInput, onBuscar, onSelectEstudiante }: Props) => {
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchOptions, setSearchOptions] = useState<EstudianteAdminListItemDTO[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchInputValue, setSearchInputValue] = useState('');

  useEffect(() => {
    let active = true;

    if (searchInputValue.trim().length < 2) {
      setSearchOptions([]);
      return undefined;
    }

    setSearchLoading(true);
    const timer = setTimeout(() => {
      fetchEstudiantesAdmin({ q: searchInputValue, limit: 10 })
        .then((res) => {
          if (active) {
            setSearchOptions(res.items);
            setSearchLoading(false);
          }
        })
        .catch(() => {
          if (active) setSearchLoading(false);
        });
    }, 400);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [searchInputValue]);

  const handleEnter = (evt: React.KeyboardEvent<HTMLInputElement>) => {
    if (evt.key === 'Enter') {
      evt.preventDefault();
      onBuscar();
    }
  };

  return (
    <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ xs: 'stretch', sm: 'center' }}>
        <Autocomplete
          open={searchOpen}
          onOpen={() => setSearchOpen(true)}
          onClose={() => setSearchOpen(false)}
          inputValue={searchInputValue}
          onInputChange={(_, newValue) => setSearchInputValue(newValue)}
          options={searchOptions}
          loading={searchLoading}
          getOptionLabel={(option) => `${option.apellido}, ${option.nombre} (${option.dni})`}
          isOptionEqualToValue={(option, value) => option.dni === value.dni}
          onChange={(_, value) => {
            if (value) {
              setDniInput(value.dni);
              onSelectEstudiante(value.dni);
            }
          }}
          filterOptions={(x) => x} // Backend already filters
          renderInput={(params) => (
            <TextField
              {...params}
              label="Buscar por Nombre, Apellido o DNI"
              size="small"
              sx={{ minWidth: 280 }}
              InputProps={{
                ...params.InputProps,
                startAdornment: (
                  <Stack direction="row" alignItems="center" spacing={1} sx={{ pl: 1 }}>
                    <SearchIcon fontSize="small" color="action" />
                    {params.InputProps.startAdornment}
                  </Stack>
                ),
                endAdornment: (
                  <>
                    {searchLoading ? <CircularProgress color="inherit" size={20} /> : null}
                    {params.InputProps.endAdornment}
                  </>
                ),
              }}
            />
          )}
        />
        <Divider orientation="vertical" flexItem sx={{ display: { xs: 'none', sm: 'block' } }} />
        <TextField
          label="DNI manual"
          value={dniInput}
          size="small"
          onChange={(e) => setDniInput(e.target.value)}
          onKeyDown={handleEnter}
          sx={{ maxWidth: 160 }}
          helperText="O presiona Enter aquí"
        />
        <Button variant="contained" size="small" onClick={onBuscar} sx={{ height: 40 }}>
          Consultar
        </Button>
      </Stack>
    </Paper>
  );
};

export default EstudianteBuscador;
