import React, { useEffect, useState, useMemo } from 'react';
import { 
  Box, Typography, TextField, Autocomplete, Paper, Stack,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Chip, CircularProgress, Alert, InputAdornment, FormControlLabel,
  Switch, Tooltip, Grid, TablePagination, TableSortLabel, Checkbox,
  Button
} from '@mui/material';
import { client as axios } from '@/api/client';
import { PageHero } from "@/components/ui/GradientTitles";
import BackButton from "@/components/ui/BackButton";
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import HighlightOffIcon from '@mui/icons-material/HighlightOff';
import SearchIcon from '@mui/icons-material/Search';
import FileDownloadIcon from '@mui/icons-material/FileDownload';

type Profesorado = { id: number; nombre: string };
type Plan = { id: number; resolucion: string };
type Materia = { id: number; nombre: string; anio_cursada: number };

type StudentEligibility = {
  dni: string;
  nombre: string;
  apellido: string;
  habilitado: boolean;
  motivos: string[];
  situacion: "APROBADA" | "REGULAR" | "EN_CURSO" | "PENDIENTE";
  cohorte?: number | null;
};

type AnalisisResult = {
  materia_id: number;
  materia_nombre: string;
  estudiantes: StudentEligibility[];
};

type Order = 'asc' | 'desc';

export default function AnalisisMateriaPage() {
  const [profesorados, setProfesorados] = useState<Profesorado[]>([]);
  const [selectedProf, setSelectedProf] = useState<Profesorado | null>(null);
  
  const [planes, setPlanes] = useState<Plan[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  
  const [materias, setMaterias] = useState<Materia[]>([]);
  const [selectedMateria, setSelectedMateria] = useState<Materia | null>(null);

  const [loading, setLoading] = useState(false);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [result, setResult] = useState<AnalisisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [showOnlyEnabled, setShowOnlyEnabled] = useState(true);

  // Selection state
  const [selectedDnis, setSelectedDnis] = useState<Set<string>>(new Set());

  // Pagination & Sorting state
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [orderBy, setOrderBy] = useState<keyof StudentEligibility>('apellido');
  const [order, setOrder] = useState<Order>('asc');

  // Initial load
  useEffect(() => {
    setLoadingOptions(true);
    axios.get<Profesorado[]>('/profesorados/').then(r => {
      setProfesorados(r.data);
      setLoadingOptions(false);
    }).catch(() => setLoadingOptions(false));
  }, []);

  // When prof changes, load plans
  useEffect(() => {
    if (selectedProf) {
      setLoadingOptions(true);
      axios.get<Plan[]>(`/profesorados/${selectedProf.id}/planes`).then(r => {
        setPlanes(r.data);
        if (r.data.length === 1) setSelectedPlan(r.data[0]);
        else setSelectedPlan(null);
        setLoadingOptions(false);
      }).catch(() => setLoadingOptions(false));
    } else {
      setPlanes([]);
      setSelectedPlan(null);
    }
  }, [selectedProf]);

  // When plan changes, load materias
  useEffect(() => {
    if (selectedPlan) {
      setLoadingOptions(true);
      axios.get<Materia[]>(`/planes/${selectedPlan.id}/materias`).then(r => {
        setMaterias(r.data.sort((a,b) => a.anio_cursada - b.anio_cursada || a.nombre.localeCompare(b.nombre)));
        setLoadingOptions(false);
      }).catch(() => setLoadingOptions(false));
    } else {
      setMaterias([]);
      setSelectedMateria(null);
    }
  }, [selectedPlan]);

  // When materia changes, run analysis
  useEffect(() => {
    if (selectedMateria) {
      setLoading(true);
      setError(null);
      setPage(0);
      setSelectedDnis(new Set());
      axios.get<AnalisisResult>(`/estudiantes/analisis-correlatividades/${selectedMateria.id}`)
        .then(r => {
          setResult(r.data);
          setLoading(false);
        })
        .catch(err => {
          console.error(err);
          setError("No se pudo realizar el análisis de correlatividades.");
          setLoading(false);
        });
    } else {
      setResult(null);
    }
  }, [selectedMateria]);

  const handleRequestSort = (property: keyof StudentEligibility) => {
    const isAsc = orderBy === property && order === 'asc';
    setOrder(isAsc ? 'desc' : 'asc');
    setOrderBy(property);
  };

  const processedStudents = useMemo(() => {
    if (!result) return [];
    let list = [...result.estudiantes];

    // Filter
    if (showOnlyEnabled) {
      // "En condiciones" means enabled AND not yet approved
      list = list.filter(est => est.habilitado && est.situacion !== 'APROBADA');
    }

    if (search) {
      const s = search.toLowerCase();
      list = list.filter(est => 
        est.dni.includes(s) || 
        est.nombre.toLowerCase().includes(s) || 
        est.apellido.toLowerCase().includes(s)
      );
    }

    // Sort
    list.sort((a, b) => {
      let valA = a[orderBy];
      let valB = b[orderBy];

      if (valA == null) valA = '';
      if (valB == null) valB = '';

      if (typeof valA === 'string') {
        valA = valA.toLowerCase();
        valB = (valB as string).toLowerCase();
      }

      if (valA < valB) return order === 'asc' ? -1 : 1;
      if (valA > valB) return order === 'asc' ? 1 : -1;
      return 0;
    });

    return list;
  }, [result, search, showOnlyEnabled, orderBy, order]);

  const paginatedStudents = useMemo(() => {
    return processedStudents.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);
  }, [processedStudents, page, rowsPerPage]);

  const toggleSelection = (dni: string) => {
    const newSelection = new Set(selectedDnis);
    if (newSelection.has(dni)) newSelection.delete(dni);
    else newSelection.add(dni);
    setSelectedDnis(newSelection);
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const allDnis = new Set(processedStudents.map(s => s.dni));
      setSelectedDnis(allDnis);
    } else {
      setSelectedDnis(new Set());
    }
  };

  const handleExportExcel = () => {
    if (selectedDnis.size === 0 || !result || !selectedProf) return;

    const dataToExport = result.estudiantes.filter(s => selectedDnis.has(s.dni));
    
    // Create CSV content with BOM for UTF-8 Excel support
    const BOM = '\uFEFF';
    const headers = ['Profesorado', 'Espacio Curricular', 'DNI', 'Apellido', 'Nombre', 'Cohorte', 'Situación', '¿Habilitado?', 'Observaciones'];
    const rows = dataToExport.map(s => [
        selectedProf.nombre,
        result.materia_nombre,
        s.dni,
        s.apellido,
        s.nombre,
        s.cohorte || '',
        s.situacion,
        s.habilitado ? 'SI' : 'NO',
        s.motivos.join(' | ')
    ]);

    const csvContent = BOM + [headers, ...rows]
        .map(e => e.map(val => `"${val}"`).join(';')) // Use semicolon for Latin Excel
        .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Habilitados_${result.materia_nombre.replace(/\s+/g, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getStatusChip = (situacion: string) => {
    switch (situacion) {
      case "APROBADA": return <Chip size="small" label="Aprobada" color="success" />;
      case "REGULAR": return <Chip size="small" label="Regular" color="primary" variant="outlined" />;
      case "EN_CURSO": return <Chip size="small" label="En curso" color="warning" variant="outlined" />;
      default: return <Chip size="small" label="Pendiente" variant="outlined" />;
    }
  };

  return (
    <Stack gap={3} sx={{ pb: 5 }}>
      <Stack direction="row" alignItems="center" spacing={1}>
        <BackButton />
        <PageHero title="Análisis de Correlatividades" subtitle="Consultá estudiantes habilitados por materia" />
      </Stack>

      <Paper sx={{ p: 3, borderRadius: 2 }}>
        <Grid container spacing={2}>
          <Grid item xs={12} md={4}>
            <Autocomplete
              options={profesorados}
              getOptionLabel={(o) => o.nombre}
              value={selectedProf}
              onChange={(_, v) => setSelectedProf(v)}
              loading={loadingOptions}
              renderInput={(params) => <TextField {...params} label="Profesorado" />}
            />
          </Grid>
          <Grid item xs={12} md={4}>
            <Autocomplete
              options={planes}
              getOptionLabel={(o) => o.resolucion || `ID: ${o.id}`}
              value={selectedPlan}
              onChange={(_, v) => setSelectedPlan(v)}
              disabled={!selectedProf}
              loading={loadingOptions}
              renderInput={(params) => <TextField {...params} label="Plan de Estudio" />}
            />
          </Grid>
          <Grid item xs={12} md={4}>
            <Autocomplete
              options={materias}
              getOptionLabel={(o) => `${o.anio_cursada}° - ${o.nombre}`}
              value={selectedMateria}
              onChange={(_, v) => setSelectedMateria(v)}
              disabled={!selectedPlan}
              loading={loadingOptions}
              renderInput={(params) => <TextField {...params} label="Materia" />}
            />
          </Grid>
        </Grid>
      </Paper>

      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 5 }}>
          <CircularProgress />
        </Box>
      )}

      {error && <Alert severity="error">{error}</Alert>}

      {result && !loading && (
        <Stack gap={2}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ px: 1 }}>
            <Box>
                <Typography variant="h6">
                    Resultados para: <b>{result.materia_nombre}</b>
                </Typography>
                <Typography variant="caption" color="text.secondary">
                    {processedStudents.length} estudiantes encontrados
                </Typography>
            </Box>
            <Stack direction="row" spacing={2} alignItems="center">
                <Button
                    variant="contained"
                    color="success"
                    startIcon={<FileDownloadIcon />}
                    disabled={selectedDnis.size === 0}
                    onClick={handleExportExcel}
                    size="small"
                >
                    Exportar Excel ({selectedDnis.size})
                </Button>
                <FormControlLabel
                    control={
                        <Switch 
                        checked={showOnlyEnabled} 
                        onChange={(e) => { setShowOnlyEnabled(e.target.checked); setPage(0); }} 
                        color="success"
                        />
                    }
                    label={<Typography variant="body2" sx={{ fontWeight: 500 }}>Ver solo habilitados</Typography>}
                />
            </Stack>
          </Stack>

          <Paper sx={{ p: 2, borderRadius: 2 }}>
            <TextField
              placeholder="Buscar por DNI, Nombre o Apellido..."
              fullWidth
              size="small"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0); }}
              sx={{ mb: 2 }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon color="action" />
                  </InputAdornment>
                ),
              }}
            />

            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: 'grey.50' }}>
                    <TableCell padding="checkbox">
                        <Checkbox
                            indeterminate={selectedDnis.size > 0 && selectedDnis.size < processedStudents.length}
                            checked={processedStudents.length > 0 && selectedDnis.size === processedStudents.length}
                            onChange={(e) => handleSelectAll(e.target.checked)}
                            color="primary"
                        />
                    </TableCell>
                    <TableCell>
                      <TableSortLabel
                        active={orderBy === 'apellido'}
                        direction={orderBy === 'apellido' ? order : 'asc'}
                        onClick={() => handleRequestSort('apellido')}
                      >
                        Estudiante
                      </TableSortLabel>
                    </TableCell>
                    <TableCell>
                      <TableSortLabel
                        active={orderBy === 'dni'}
                        direction={orderBy === 'dni' ? order : 'asc'}
                        onClick={() => handleRequestSort('dni')}
                      >
                        DNI
                      </TableSortLabel>
                    </TableCell>
                    <TableCell align="center">
                      <TableSortLabel
                        active={orderBy === 'cohorte'}
                        direction={orderBy === 'cohorte' ? order : 'asc'}
                        onClick={() => handleRequestSort('cohorte')}
                      >
                        Cohorte
                      </TableSortLabel>
                    </TableCell>
                    <TableCell align="center">
                      <TableSortLabel
                        active={orderBy === 'situacion'}
                        direction={orderBy === 'situacion' ? order : 'asc'}
                        onClick={() => handleRequestSort('situacion')}
                      >
                        Situación
                      </TableSortLabel>
                    </TableCell>
                    <TableCell align="center">
                      <TableSortLabel
                        active={orderBy === 'habilitado'}
                        direction={orderBy === 'habilitado' ? order : 'asc'}
                        onClick={() => handleRequestSort('habilitado')}
                      >
                        ¿Habilitado?
                      </TableSortLabel>
                    </TableCell>
                    <TableCell>Motivos / Faltantes</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {paginatedStudents.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} align="center" sx={{ py: 3 }}>
                        No se encontraron estudiantes con los filtros aplicados.
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedStudents.map((est) => (
                      <TableRow key={est.dni} hover selected={selectedDnis.has(est.dni)}>
                        <TableCell padding="checkbox">
                            <Checkbox
                                checked={selectedDnis.has(est.dni)}
                                onChange={() => toggleSelection(est.dni)}
                                color="primary"
                            />
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" sx={{ fontWeight: 500 }}>
                            {est.apellido}, {est.nombre}
                          </Typography>
                        </TableCell>
                        <TableCell>{est.dni}</TableCell>
                        <TableCell align="center">{est.cohorte || '-'}</TableCell>
                        <TableCell align="center">{getStatusChip(est.situacion)}</TableCell>
                        <TableCell align="center">
                          {est.habilitado ? (
                            <Tooltip title="Cumple las correlatividades">
                                <CheckCircleOutlineIcon color="success" />
                            </Tooltip>
                          ) : (
                            <Tooltip title="No cumple las correlatividades">
                                <HighlightOffIcon color="error" />
                            </Tooltip>
                          )}
                        </TableCell>
                        <TableCell>
                          {est.motivos.length > 0 ? (
                            <Stack gap={0.5}>
                              {est.motivos.map((m, i) => (
                                <Typography key={i} variant="caption" sx={{ display: 'block', color: est.habilitado ? 'text.secondary' : 'error.main' }}>
                                  • {m}
                                </Typography>
                              ))}
                            </Stack>
                          ) : (
                            <Typography variant="caption" color="text.disabled">Sin observaciones</Typography>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
            
            <TablePagination
              component="div"
              count={processedStudents.length}
              rowsPerPage={rowsPerPage}
              page={page}
              onPageChange={(_, p) => setPage(p)}
              onRowsPerPageChange={(e) => {
                setRowsPerPage(parseInt(e.target.value, 10));
                setPage(0);
              }}
              labelRowsPerPage="Filas por página"
            />
          </Paper>
        </Stack>
      )}
    </Stack>
  );
}
