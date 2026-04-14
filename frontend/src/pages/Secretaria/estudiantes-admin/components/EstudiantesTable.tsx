import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import Table from "@mui/material/Table";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TableCell from "@mui/material/TableCell";
import TableBody from "@mui/material/TableBody";
import TableContainer from "@mui/material/TableContainer";
import CircularProgress from "@mui/material/CircularProgress";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Divider from "@mui/material/Divider";
import Alert from "@mui/material/Alert";
import TablePagination from "@mui/material/TablePagination";
import { EstudianteAdminListItemDTO } from "@/api/estudiantes";
import { estadoColorMap } from "../types";

type Props = {
  estudiantes: EstudianteAdminListItemDTO[];
  total: number;
  isListLoading: boolean;
  isError: boolean;
  error: unknown;
  onRowClick: (dni: string) => void;
  page: number;
  onPageChange: (page: number) => void;
  rowsPerPage: number;
  onRowsPerPageChange: (rowsPerPage: number) => void;
};

export function EstudiantesTable({ 
  estudiantes, total, isListLoading, isError, error, onRowClick,
  page, onPageChange, rowsPerPage, onRowsPerPageChange 
}: Props) {
  return (
    <Paper elevation={0}>
      <Box display="flex" alignItems="center" justifyContent="space-between" px={2} py={1.5}>
        <Typography variant="h6" fontWeight={700}>
          Estudiantes ({total})
        </Typography>
        {isListLoading && <CircularProgress size={20} />}
      </Box>
      <Divider />
      {isError && (
        <Box p={2}>
          <Alert severity="error">
            {error instanceof Error
              ? error.message
              : "No se pudo cargar el listado."}
          </Alert>
        </Box>
      )}
      {estudiantes.length === 0 && !isListLoading && !isError ? (
        <Box p={4} textAlign="center">
          <Typography color="text.secondary">No se encontraron estudiantes con los filtros seleccionados.</Typography>
        </Box>
      ) : (
        <TableContainer sx={{ maxHeight: 560 }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell>DNI</TableCell>
                <TableCell>Apellido y nombre</TableCell>
                <TableCell>Email</TableCell>
                <TableCell>Teléfono</TableCell>
                <TableCell>Carreras</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {estudiantes.map((item: EstudianteAdminListItemDTO) => (
                <TableRow
                  key={item.dni}
                  hover
                  sx={{ cursor: "pointer" }}
                  onClick={() => onRowClick(item.dni)}
                >
                  <TableCell>{item.dni}</TableCell>
                  <TableCell>{`${item.apellido}, ${item.nombre}`}</TableCell>
                  <TableCell>
                    {item.email ? (
                      <Typography
                        component="a"
                        href={`mailto:${item.email}`}
                        color="primary"
                        sx={{ textDecoration: "underline" }}
                        onClick={(event) => event.stopPropagation()}
                      >
                        {item.email}
                      </Typography>
                    ) : (
                      "-"
                    )}
                  </TableCell>
                  <TableCell>{item.telefono || "—"}</TableCell>
                  <TableCell>
                    <Stack direction="column" spacing={0.5}>
                      {(item.carreras_detalle && item.carreras_detalle.length > 0) ? (
                        item.carreras_detalle.map((c) => (
                          <Box key={c.nombre} display="flex" alignItems="center" gap={1}>
                            <Typography variant="body2" sx={{ fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                              {c.nombre}
                            </Typography>
                            <Box display="flex" gap={0.5}>
                              <Chip 
                                label={c.estado_academico_display} 
                                size="small" 
                                variant="outlined"
                                sx={{ height: 16, fontSize: '0.65rem' }}
                                color={c.estado_academico === 'ACT' ? 'success' : 'default'}
                              />
                              <Chip
                                size="small"
                                label={c.estado_legajo_display}
                                sx={{ height: 16, fontSize: '0.65rem' }}
                                color={estadoColorMap[c.estado_legajo] ?? "default"}
                              />
                            </Box>
                          </Box>
                        ))
                      ) : (
                        item.carreras.map((carrera) => (
                          <Chip key={carrera} label={carrera} size="small" />
                        ))
                      )}
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
      <TablePagination
        component="div"
        count={total}
        page={page}
        onPageChange={(_, newPage) => onPageChange(newPage)}
        rowsPerPage={rowsPerPage}
        onRowsPerPageChange={(e) => onRowsPerPageChange(parseInt(e.target.value, 10))}
        rowsPerPageOptions={[50, 100, 200, 500]}
        labelRowsPerPage="Filas por página"
      />
    </Paper>
  );
}
