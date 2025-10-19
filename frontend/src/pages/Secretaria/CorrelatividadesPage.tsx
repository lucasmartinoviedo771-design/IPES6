import React, { useEffect, useMemo, useState } from 'react';
import { Box, Button, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, FormControl, Grid, InputLabel, MenuItem, Select, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TableSortLabel, TextField, Typography } from '@mui/material';
import Autocomplete from '@mui/material/Autocomplete';
import { client as axios } from '@/api/client';

type Profesorado = { id: number; nombre: string };
type Plan = { id: number; resolucion: string };

type MatrixRow = {
  id: number;
  nombre: string;
  anio_cursada: number;
  regimen: string;
  formato: string;
  regular_para_cursar: number[];
  aprobada_para_cursar: number[];
  aprobada_para_rendir: number[];
};

type CorrSet = {
  regular_para_cursar: number[];
  aprobada_para_cursar: number[];
  aprobada_para_rendir: number[];
};

type MateriaOption = {
  label: string;
  id: number | string;
  anio_cursada: number;
  aggregateIds?: number[];
};

export default function CorrelatividadesPage() {
  const [profesorados, setProfesorados] = useState<Profesorado[]>([]);
  const [planes, setPlanes] = useState<Plan[]>([]);
  const [planId, setPlanId] = useState<number | ''>('');
  const [profId, setProfId] = useState<number | ''>('');
  const [anio, setAnio] = useState<number | ''>('');
  const [matrix, setMatrix] = useState<MatrixRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('');
  const [regimen, setRegimen] = useState<string | ''>('');
  const [formato, setFormato] = useState<string | ''>('');
  const [sortBy, setSortBy] = useState<'nombre'|'anio'|'regimen'>('nombre');
  const [sortDir, setSortDir] = useState<'asc'|'desc'>('asc');

  // Editor modal
  const [open, setOpen] = useState(false);
  const [rowEdit, setRowEdit] = useState<MatrixRow | null>(null);
  const [editSet, setEditSet] = useState<CorrSet>({ regular_para_cursar: [], aprobada_para_cursar: [], aprobada_para_rendir: [] });
  // Fuente completa (todas las materias del plan) para opciones del editor
  const [allRows, setAllRows] = useState<MatrixRow[] | null>(null);
  // Ediciones en lote (pendientes de guardar)
  const [pending, setPending] = useState<Record<number, CorrSet>>({});
  const pendingCount = useMemo(() => Object.keys(pending).length, [pending]);

  useEffect(() => {
    axios.get<Profesorado[]>('/profesorados/').then(r => setProfesorados(r.data));
  }, []);

  useEffect(() => {
    if (profId) {
      axios.get<Plan[]>(`/profesorados/${profId}/planes`).then(r => setPlanes(r.data));
    } else {
      setPlanes([]); setPlanId('');
    }
  }, [profId]);

  const loadMatrix = async () => {
    if (!planId) { setMatrix([]); return; }
    setLoading(true);
    try {
      const params: string[] = [];
      if (anio) params.push(`anio_cursada=${anio}`);
      if (filter) params.push(`nombre=${encodeURIComponent(filter)}`);
      if (regimen) params.push(`regimen=${encodeURIComponent(regimen)}`);
      if (formato) params.push(`formato=${encodeURIComponent(formato)}`);
      const qs = params.length ? `?${params.join('&')}` : '';
      const url = `/planes/${planId}/correlatividades_matrix${qs}`;
      const { data } = await axios.get<MatrixRow[]>(url);
      setMatrix(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadMatrix(); }, [planId, anio, regimen, formato, filter]);

  const materiaOptions = useMemo<MateriaOption[]>(() => {
    const src = allRows && allRows.length ? allRows : matrix;
    const maxYear = rowEdit?.anio_cursada ?? Infinity;

    const baseOptions: MateriaOption[] = src
      .filter(m => m.anio_cursada <= maxYear)
      .map(m => ({
        label: `${m.nombre} (${m.anio_cursada}º)`,
        id: m.id,
        anio_cursada: m.anio_cursada,
      }));

    const extras: MateriaOption[] = [];
    const years = [1, 2, 3].filter(y => y < maxYear);
    years.forEach(year => {
      const matches = baseOptions.filter(opt => opt.anio_cursada === year);
      if (matches.length) {
        extras.push({
          label: `Todo ${year}º año`,
          id: `year-${year}`,
          anio_cursada: year,
          aggregateIds: matches.map(opt => opt.id as number),
        });
      }
    });

    return [...extras, ...baseOptions];
  }, [matrix, allRows, rowEdit]);

  const resolveIdsFromOptions = (vals: MateriaOption[]) => {
    const ids = new Set<number>();
    vals.forEach((v) => {
      if (typeof v.id === 'number') ids.add(v.id);
      if (Array.isArray(v.aggregateIds)) v.aggregateIds.forEach((id) => ids.add(id));
    });
    return Array.from(ids);
  };

  const handleFieldChange = (field: keyof CorrSet) => (_: any, vals: MateriaOption[]) => {
    const ids = resolveIdsFromOptions(vals);
    setEditSet((prev) => ({ ...prev, [field]: ids }));
  };

  const openEditor = async (row: MatrixRow) => {
    setRowEdit(row);
    setEditSet({
      regular_para_cursar: row.regular_para_cursar || [],
      aprobada_para_cursar: row.aprobada_para_cursar || [],
      aprobada_para_rendir: row.aprobada_para_rendir || [],
    });
    // Cargar todas las materias del plan (sin filtros) para ofrecer opciones del mismo año y anteriores
    try {
      if (planId) {
        const { data } = await axios.get<MatrixRow[]>(`/planes/${planId}/correlatividades_matrix`);
        setAllRows(data);
      } else {
        setAllRows(null);
      }
    } catch {
      // Si falla, seguimos con las filas ya cargadas
      setAllRows(null);
    }
    setOpen(true);
  };

  // Limpiar fuente completa al cambiar plan
  useEffect(() => { setAllRows(null); }, [planId]);

  const saveEditor = async () => {
    if (!rowEdit) return;
    // Guardado diferido: actualizamos la matriz local y marcamos pendiente
    setMatrix(prev => prev.map(m => m.id === rowEdit.id ? ({
      ...m,
      regular_para_cursar: [...editSet.regular_para_cursar],
      aprobada_para_cursar: [...editSet.aprobada_para_cursar],
      aprobada_para_rendir: [...editSet.aprobada_para_rendir],
    }) : m));
    setPending(prev => ({ ...prev, [rowEdit.id]: { ...editSet } }));
    setOpen(false); setRowEdit(null);
  };

  const saveBatch = async () => {
    const ids = Object.keys(pending).map(Number);
    if (!ids.length) return;
    setLoading(true);
    try {
      // Guardar en serie para simplificar manejo de errores
      for (const id of ids) {
        await axios.post(`/materias/${id}/correlatividades`, pending[id]);
      }
      setPending({});
      await loadMatrix();
    } finally {
      setLoading(false);
    }
  };

  const discardBatch = () => setPending({});

  return (
    <div className="center-page">
      <Typography variant="h5" fontWeight={800}>Correlatividades</Typography>
      <Typography variant="body2" color="text.secondary" mb={2}>Definí las correlatividades “para cursar” y “para rendir” por plan y año.</Typography>

      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid item xs={12} md={4}>
          <FormControl fullWidth size="small">
            <InputLabel>Profesorado</InputLabel>
            <Select label="Profesorado" value={profId} onChange={e => setProfId(e.target.value as any)}>
              <MenuItem value="">Seleccione</MenuItem>
              {profesorados.map(p => <MenuItem key={p.id} value={p.id}>{p.nombre}</MenuItem>)}
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={12} md={4}>
          <FormControl fullWidth size="small" disabled={!profId}>
            <InputLabel>Plan</InputLabel>
            <Select label="Plan" value={planId} onChange={e => setPlanId(e.target.value as any)}>
              <MenuItem value="">Seleccione</MenuItem>
              {planes.map(pl => <MenuItem key={pl.id} value={pl.id}>{pl.resolucion}</MenuItem>)}
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={12} md={4}>
          <FormControl fullWidth size="small">
            <InputLabel>Año (carrera)</InputLabel>
            <Select label="Año (carrera)" value={anio} onChange={e => setAnio(e.target.value as any)}>
              <MenuItem value="">Todos</MenuItem>
              <MenuItem value={1}>1º año</MenuItem>
              <MenuItem value={2}>2º año</MenuItem>
              <MenuItem value={3}>3º año</MenuItem>
              <MenuItem value={4}>4º año</MenuItem>
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={12} md={3}>
          <TextField fullWidth size="small" label="Buscar materia" value={filter} onChange={e=>setFilter(e.target.value)} />
        </Grid>
        <Grid item xs={12} md={3}>
          <FormControl fullWidth size="small">
            <InputLabel>Régimen</InputLabel>
            <Select label="Régimen" value={regimen} onChange={e => setRegimen(e.target.value as any)}>
              <MenuItem value="">Todos</MenuItem>
              <MenuItem value="ANU">Anual</MenuItem>
              <MenuItem value="PCU">1º cuatrimestre</MenuItem>
              <MenuItem value="SCU">2º cuatrimestre</MenuItem>
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={12} md={3}>
          <FormControl fullWidth size="small">
            <InputLabel>Formato</InputLabel>
            <Select label="Formato" value={formato} onChange={e => setFormato(e.target.value as any)}>
              <MenuItem value="">Todos</MenuItem>
              <MenuItem value="ASI">Asignatura</MenuItem>
              <MenuItem value="PRA">Práctica</MenuItem>
              <MenuItem value="MOD">Módulo</MenuItem>
              <MenuItem value="TAL">Taller</MenuItem>
              <MenuItem value="LAB">Laboratorio</MenuItem>
              <MenuItem value="SEM">Seminario</MenuItem>
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={12} md={3} display="flex" justifyContent="flex-end" alignItems="center" gap={1}>
          <Button variant="outlined" disabled={!pendingCount} onClick={discardBatch}>Descartar cambios</Button>
          <Button variant="contained" disabled={!pendingCount || loading} onClick={saveBatch}>
            Guardar cambios {pendingCount ? `(${pendingCount})` : ''}
          </Button>
        </Grid>
      </Grid>

      <TableContainer sx={{ maxHeight: 520 }}>
        <Table stickyHeader size="small">
          <TableHead>
            <TableRow>
              <TableCell>ID</TableCell>
              <TableCell sortDirection={sortBy==='nombre' ? sortDir : false as any}>
                <TableSortLabel active={sortBy==='nombre'} direction={sortBy==='nombre'?sortDir:'asc'} onClick={() => { setSortBy('nombre'); setSortDir(d=> (sortBy!=='nombre' ? 'asc' : (d==='asc'?'desc':'asc')) as any); }}>
                  Materia
                </TableSortLabel>
              </TableCell>
              <TableCell sortDirection={sortBy==='anio' ? sortDir : false as any}>
                <TableSortLabel active={sortBy==='anio'} direction={sortBy==='anio'?sortDir:'asc'} onClick={() => { setSortBy('anio'); setSortDir(d=> (sortBy!=='anio' ? 'asc' : (d==='asc'?'desc':'asc')) as any); }}>
                  Año
                </TableSortLabel>
              </TableCell>
              <TableCell sortDirection={sortBy==='regimen' ? sortDir : false as any}>
                <TableSortLabel active={sortBy==='regimen'} direction={sortBy==='regimen'?sortDir:'asc'} onClick={() => { setSortBy('regimen'); setSortDir(d=> (sortBy!=='regimen' ? 'asc' : (d==='asc'?'desc':'asc')) as any); }}>
                Régimen
                </TableSortLabel>
              </TableCell>
              <TableCell>Formato</TableCell>
              <TableCell>Para cursar: Regular</TableCell>
              <TableCell>Para cursar: Aprobada</TableCell>
              <TableCell>Para rendir: Aprobada</TableCell>
              <TableCell>Acciones</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={8}><Box display="flex" justifyContent="center" py={3}><CircularProgress size={22} /></Box></TableCell></TableRow>
            ) : (
              [...matrix]
                .filter(r => !filter || r.nombre.toLowerCase().includes(filter.toLowerCase()))
                .sort((a,b) => {
                  const dir = sortDir==='asc' ? 1 : -1;
                  if (sortBy==='nombre') return a.nombre.localeCompare(b.nombre) * dir;
                  if (sortBy==='anio') return (a.anio_cursada - b.anio_cursada) * dir;
                  if (sortBy==='regimen') return (a.regimen || '').localeCompare(b.regimen || '') * dir;
                  return 0;
                })
                .map((r) => (
                <TableRow key={r.id} hover sx={pending[r.id] ? { backgroundColor: 'rgba(250, 204, 21, 0.08)' } : undefined}>
                  <TableCell>{r.id}</TableCell>
                  <TableCell>
                    {r.nombre}
                    {pending[r.id] && <Chip size="small" color="warning" label="Pendiente" sx={{ ml: 1 }} />}
                  </TableCell>
                  <TableCell>{r.anio_cursada}</TableCell>
                  <TableCell>{r.regimen}</TableCell>
                  <TableCell>{r.formato}</TableCell>
                  <TableCell>{r.regular_para_cursar?.length ? r.regular_para_cursar.map(id => matrix.find(m=>m.id===id)?.nombre || id).join(', ') : <em>Ninguna</em>}</TableCell>
                  <TableCell>{r.aprobada_para_cursar?.length ? r.aprobada_para_cursar.map(id => matrix.find(m=>m.id===id)?.nombre || id).join(', ') : <em>Ninguna</em>}</TableCell>
                  <TableCell>{r.aprobada_para_rendir?.length ? r.aprobada_para_rendir.map(id => matrix.find(m=>m.id===id)?.nombre || id).join(', ') : <em>Ninguna</em>}</TableCell>
                  <TableCell><Button size="small" onClick={() => openEditor(r)}>Editar</Button></TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Editar correlatividades — {rowEdit?.nombre}</DialogTitle>
        <DialogContent>
          <Stack gap={2} sx={{ mt: 1 }}>
            <Autocomplete
              multiple options={materiaOptions}
              value={materiaOptions.filter(o => typeof o.id === 'number' && editSet.regular_para_cursar.includes(o.id))}
              onChange={handleFieldChange('regular_para_cursar')}
              getOptionDisabled={(o) => !!rowEdit && (o.id === rowEdit.id || o.anio_cursada > rowEdit.anio_cursada)}
              renderInput={(p) => <TextField {...p} size="small" label="Para cursar: Regular" />}
            />
            <Autocomplete
              multiple options={materiaOptions}
              value={materiaOptions.filter(o => typeof o.id === 'number' && editSet.aprobada_para_cursar.includes(o.id))}
              onChange={handleFieldChange('aprobada_para_cursar')}
              getOptionDisabled={(o) => !!rowEdit && (o.id === rowEdit.id || o.anio_cursada > rowEdit.anio_cursada)}
              renderInput={(p) => <TextField {...p} size="small" label="Para cursar: Aprobada" />}
            />
            <Autocomplete
              multiple options={materiaOptions}
              value={materiaOptions.filter(o => typeof o.id === 'number' && editSet.aprobada_para_rendir.includes(o.id))}
              onChange={handleFieldChange('aprobada_para_rendir')}
              getOptionDisabled={(o) => !!rowEdit && (o.id === rowEdit.id || o.anio_cursada > rowEdit.anio_cursada)}
              renderInput={(p) => <TextField {...p} size="small" label="Para rendir: Aprobada" />}
            />
            <Typography variant="body2" color="text.secondary">Sugerencia: si no hay restricciones para una columna, dejala vacía (equivale a “Ninguna”).</Typography>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancelar</Button>
          <Button variant="contained" onClick={saveEditor}>Guardar</Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}
