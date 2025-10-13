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
  regular_para_cursar: number[];
  aprobada_para_cursar: number[];
  aprobada_para_rendir: number[];
};

type CorrSet = {
  regular_para_cursar: number[];
  aprobada_para_cursar: number[];
  aprobada_para_rendir: number[];
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
  const [sortBy, setSortBy] = useState<'nombre'|'anio'|'regimen'>('nombre');
  const [sortDir, setSortDir] = useState<'asc'|'desc'>('asc');

  // Editor modal
  const [open, setOpen] = useState(false);
  const [rowEdit, setRowEdit] = useState<MatrixRow | null>(null);
  const [editSet, setEditSet] = useState<CorrSet>({ regular_para_cursar: [], aprobada_para_cursar: [], aprobada_para_rendir: [] });
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
      const url = anio ? `/planes/${planId}/correlatividades_matrix?anio_cursada=${anio}` : `/planes/${planId}/correlatividades_matrix`;
      const { data } = await axios.get<MatrixRow[]>(url);
      setMatrix(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadMatrix(); }, [planId, anio]);

  const materiaOptions = useMemo(() => matrix.map(m => ({ label: `${m.nombre} (${m.anio_cursada}º)`, id: m.id, anio_cursada: m.anio_cursada })), [matrix]);

  const openEditor = (row: MatrixRow) => {
    setRowEdit(row);
    setEditSet({
      regular_para_cursar: row.regular_para_cursar || [],
      aprobada_para_cursar: row.aprobada_para_cursar || [],
      aprobada_para_rendir: row.aprobada_para_rendir || [],
    });
    setOpen(true);
  };

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
          <TextField fullWidth size="small" type="number" label="Año (carrera)" value={anio} onChange={e => setAnio(e.target.value ? Number(e.target.value) : '')} />
        </Grid>
        <Grid item xs={12} md={6}>
          <TextField fullWidth size="small" label="Buscar materia" value={filter} onChange={e=>setFilter(e.target.value)} />
        </Grid>
        <Grid item xs={12} md={6} display="flex" justifyContent="flex-end" alignItems="center" gap={1}>
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
              value={materiaOptions.filter(o => editSet.regular_para_cursar.includes(o.id))}
              onChange={(_, vals) => setEditSet(s => ({ ...s, regular_para_cursar: vals.map(v=>v.id) }))}
              getOptionDisabled={(o) => !!rowEdit && (o.id === rowEdit.id || o.anio_cursada > rowEdit.anio_cursada)}
              renderInput={(p) => <TextField {...p} size="small" label="Para cursar: Regular" />}
            />
            <Autocomplete
              multiple options={materiaOptions}
              value={materiaOptions.filter(o => editSet.aprobada_para_cursar.includes(o.id))}
              onChange={(_, vals) => setEditSet(s => ({ ...s, aprobada_para_cursar: vals.map(v=>v.id) }))}
              getOptionDisabled={(o) => !!rowEdit && (o.id === rowEdit.id || o.anio_cursada > rowEdit.anio_cursada)}
              renderInput={(p) => <TextField {...p} size="small" label="Para cursar: Aprobada" />}
            />
            <Autocomplete
              multiple options={materiaOptions}
              value={materiaOptions.filter(o => editSet.aprobada_para_rendir.includes(o.id))}
              onChange={(_, vals) => setEditSet(s => ({ ...s, aprobada_para_rendir: vals.map(v=>v.id) }))}
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
