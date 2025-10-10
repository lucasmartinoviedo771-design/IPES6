import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  Button,
  Chip,
  CircularProgress,
  Stack,
} from "@mui/material";
import { listarPreinscripciones, PreinscripcionDTO } from "@/api/preinscripciones";
import dayjs from "dayjs";

function EstadoChip({ estado }: { estado: string }) {
  const map: Record<string, "default" | "success" | "warning" | "error"> = {
    enviada: "default",
    observada: "warning",
    confirmada: "success",
    rechazada: "error",
    borrador: "default",
  };
  return <Chip label={estado} color={map[estado] ?? "default"} size="small" sx={{ borderRadius: 99, textTransform: "capitalize" }} />;
}

export default function PreinscripcionesPage() {
  const navigate = useNavigate();
  const { data, isLoading, isError } = useQuery<{ results: PreinscripcionDTO[] }>({
    queryKey: ["preinscripciones"],
    queryFn: () => listarPreinscripciones({}),
  });

  return (
    <Stack gap={2}>
      <Typography variant="h5" fontWeight={800}>
        Gestión de Preinscripciones
      </Typography>

      <Paper>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Código</TableCell>
                <TableCell>Nombre Completo</TableCell>
                <TableCell>Profesorado</TableCell>
                <TableCell>Fecha</TableCell>
                <TableCell>Estado</TableCell>
                <TableCell align="right">Acciones</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                    <CircularProgress />
                  </TableCell>
                </TableRow>
              )}
              {isError && (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                    <Typography color="error">Error al cargar las preinscripciones.</Typography>
                  </TableCell>
                </TableRow>
              )}
              {data?.results && data.results.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                    <Typography color="text.secondary">No se encontraron preinscripciones.</Typography>
                  </TableCell>
                </TableRow>
              )}
              {data?.results && data.results.map((p) => (
                <TableRow key={p.id} hover>
                  <TableCell>{p.codigo}</TableCell>
                  <TableCell>{p.alumno.apellido}, {p.alumno.nombre}</TableCell>
                  <TableCell>{p.carrera.nombre}</TableCell>
                  <TableCell>{dayjs(p.fecha).format("DD/MM/YYYY HH:mm")}</TableCell>
                  <TableCell>
                    <EstadoChip estado={p.estado} />
                  </TableCell>
                  <TableCell align="right">
                    <Button
                      size="small"
                      onClick={() => navigate(`/gestion/confirmar?codigo=${p.codigo}`)}
                    >
                      Ver / Editar
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </Stack>
  );
}
