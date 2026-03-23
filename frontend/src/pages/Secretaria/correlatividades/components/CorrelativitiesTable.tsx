import React from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TableSortLabel from '@mui/material/TableSortLabel';
import type { MatrixRow, CorrSet } from '../types';

interface CorrelativitiesTableProps {
  matrix: MatrixRow[];
  loading: boolean;
  filter: string;
  sortBy: 'nombre' | 'anio' | 'regimen';
  setSortBy: (val: 'nombre' | 'anio' | 'regimen') => void;
  sortDir: 'asc' | 'desc';
  setSortDir: React.Dispatch<React.SetStateAction<'asc' | 'desc'>>;
  pending: Record<number, CorrSet>;
  resolveMateriaNombre: (id: number) => string;
  openEditor: (row: MatrixRow) => void;
}

export function CorrelativitiesTable({
  matrix,
  loading,
  filter,
  sortBy,
  setSortBy,
  sortDir,
  setSortDir,
  pending,
  resolveMateriaNombre,
  openEditor,
}: CorrelativitiesTableProps) {
  return (
    <TableContainer sx={{ maxHeight: 520 }}>
      <Table stickyHeader size="small">
        <TableHead>
          <TableRow>
            <TableCell>ID</TableCell>

            <TableCell sortDirection={sortBy === 'nombre' ? sortDir : false}>
              <TableSortLabel
                active={sortBy === 'nombre'}
                direction={sortBy === 'nombre' ? sortDir : 'asc'}
                onClick={() => {
                  setSortBy('nombre');
                  setSortDir(d => sortBy !== 'nombre' ? 'asc' : (d === 'asc' ? 'desc' : 'asc'));
                }}
              >
                Materia
              </TableSortLabel>
            </TableCell>

            <TableCell sortDirection={sortBy === 'anio' ? sortDir : false}>
              <TableSortLabel
                active={sortBy === 'anio'}
                direction={sortBy === 'anio' ? sortDir : 'asc'}
                onClick={() => {
                  setSortBy('anio');
                  setSortDir(d => sortBy !== 'anio' ? 'asc' : (d === 'asc' ? 'desc' : 'asc'));
                }}
              >
                Año
              </TableSortLabel>
            </TableCell>

            <TableCell sortDirection={sortBy === 'regimen' ? sortDir : false}>
              <TableSortLabel
                active={sortBy === 'regimen'}
                direction={sortBy === 'regimen' ? sortDir : 'asc'}
                onClick={() => {
                  setSortBy('regimen');
                  setSortDir(d => sortBy !== 'regimen' ? 'asc' : (d === 'asc' ? 'desc' : 'asc'));
                }}
              >
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
            <TableRow>
              <TableCell colSpan={8}>
                <Box display="flex" justifyContent="center" py={3}>
                  <CircularProgress size={22} />
                </Box>
              </TableCell>
            </TableRow>
          ) : (
            [...matrix]
              .filter(r => !filter || r.nombre.toLowerCase().includes(filter.toLowerCase()))
              .sort((a, b) => {
                const dir = sortDir === 'asc' ? 1 : -1;
                if (sortBy === 'nombre') return a.nombre.localeCompare(b.nombre) * dir;
                if (sortBy === 'anio') return (a.anio_cursada - b.anio_cursada) * dir;
                if (sortBy === 'regimen') return (a.regimen || '').localeCompare(b.regimen || '') * dir;
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

                  <TableCell>
                    {r.regular_para_cursar?.length
                      ? r.regular_para_cursar.map(id => resolveMateriaNombre(id)).join(', ')
                      : <em>Ninguna</em>}
                  </TableCell>

                  <TableCell>
                    {r.aprobada_para_cursar?.length
                      ? r.aprobada_para_cursar.map(id => resolveMateriaNombre(id)).join(', ')
                      : <em>Ninguna</em>}
                  </TableCell>

                  <TableCell>
                    {r.aprobada_para_rendir?.length
                      ? r.aprobada_para_rendir.map(id => resolveMateriaNombre(id)).join(', ')
                      : <em>Ninguna</em>}
                  </TableCell>

                  <TableCell>
                    <Button size="small" onClick={() => openEditor(r)}>Editar</Button>
                  </TableCell>
                </TableRow>
              ))
          )}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
