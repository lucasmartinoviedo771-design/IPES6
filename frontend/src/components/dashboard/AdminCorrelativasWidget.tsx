import { useEffect, useState } from "react";
import {
  Card,
  CardHeader,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  Chip,
  Box,
  CircularProgress,
  Alert,
} from "@mui/material";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import { getCorrelativasCaidas, CorrelativaCaidaItem } from "@/api/reportes";

export default function AdminCorrelativasWidget() {
  const [items, setItems] = useState<CorrelativaCaidaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchReport = async () => {
      try {
        const data = await getCorrelativasCaidas();
        setItems(data);
      } catch (err) {
        console.error("Error fetching correlativas caidas:", err);
        setError("No se pudo cargar el reporte de correlativas.");
      } finally {
        setLoading(false);
      }
    };
    fetchReport();
  }, []);

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", p: 4 }}>
        <CircularProgress size={24} />
      </Box>
    );
  }

  if (error) {
    return <Alert severity="error">{error}</Alert>;
  }

  if (items.length === 0) {
    return (
      <Card variant="outlined" sx={{ p: 3, textAlign: "center", color: "text.secondary" }}>
        <Typography variant="body2">No hay alertas de correlatividades activas.</Typography>
      </Card>
    );
  }

  return (
    <Card variant="outlined" sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <CardHeader
        title={
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <WarningAmberIcon color="warning" />
            <Typography variant="h6">Alertas de Correlatividad</Typography>
            <Chip label={items.length} size="small" color="warning" variant="filled" />
          </Box>
        }
        subheader="Alumnos cursando materias sin cumplir requisitos"
      />
      <CardContent sx={{ flexGrow: 1, overflow: "auto", p: 0 }}>
        <TableContainer sx={{ maxHeight: 400 }}>
          <Table stickyHeader size="small">
            <TableHead>
              <TableRow>
                <TableCell>Alumno</TableCell>
                <TableCell>Materia Actual</TableCell>
                <TableCell>Debe</TableCell>
                <TableCell>Motivo</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {items.map((item, index) => (
                <TableRow key={`${item.estudiante_id}-${index}`} hover>
                  <TableCell>
                    <Typography variant="body2" fontWeight={500}>
                      {item.apellido_nombre}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {item.dni}
                    </Typography>
                  </TableCell>
                  <TableCell>{item.materia_actual}</TableCell>
                  <TableCell sx={{ color: "error.main", fontWeight: 500 }}>
                    {item.materia_correlativa}
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={item.motivo}
                      size="small"
                      color="error"
                      variant="outlined"
                      sx={{ fontSize: "0.7rem" }}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </CardContent>
    </Card>
  );
}
