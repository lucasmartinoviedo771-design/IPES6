import React from "react";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";

import { CursoIntroCohorteDTO } from "@/api/cursoIntro";

type Props = {
  cohortes: CursoIntroCohorteDTO[];
  cohortesLoading: boolean;
  puedeGestionarCohortes: boolean;
  onNuevaCohorte: () => void;
  onEditarCohorte: (cohorte: CursoIntroCohorteDTO) => void;
};

const CohortesTable: React.FC<Props> = ({
  cohortes,
  cohortesLoading,
  puedeGestionarCohortes,
  onNuevaCohorte,
  onEditarCohorte,
}) => {
  return (
    <>
      <Typography variant="h6" mb={2}>
        Cohortes
      </Typography>
      <Card variant="outlined" sx={{ mb: 3 }}>
        <CardContent>
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={2}
            justifyContent="space-between"
            alignItems={{ xs: "flex-start", sm: "center" }}
          >
            <Typography variant="subtitle1" fontWeight={600}>
              Cohortes registradas
            </Typography>
            {puedeGestionarCohortes && (
              <Button startIcon={<AddIcon />} variant="contained" onClick={onNuevaCohorte}>
                Nueva cohorte
              </Button>
            )}
          </Stack>
          {cohortesLoading ? (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
              Cargando cohortes...
            </Typography>
          ) : cohortes.length === 0 ? (
            <Alert severity="info" sx={{ mt: 2 }}>
              Todavía no se registraron cohortes.
            </Alert>
          ) : (
            <Table size="small" sx={{ mt: 2 }}>
              <TableHead>
                <TableRow>
                  <TableCell>Cohorte</TableCell>
                  <TableCell>Año</TableCell>
                  <TableCell>Profesorado</TableCell>
                  <TableCell>Turno</TableCell>
                  <TableCell>Fechas</TableCell>
                  <TableCell>Cupo</TableCell>
                  {puedeGestionarCohortes && <TableCell align="right">Acciones</TableCell>}
                </TableRow>
              </TableHead>
              <TableBody>
                {cohortes.map((cohorte) => (
                  <TableRow key={cohorte.id} hover>
                    <TableCell>{cohorte.nombre || `Cohorte ${cohorte.anio_academico}`}</TableCell>
                    <TableCell>{cohorte.anio_academico}</TableCell>
                    <TableCell>{cohorte.profesorado_nombre || "Todos"}</TableCell>
                    <TableCell>{cohorte.turno_nombre || "-"}</TableCell>
                    <TableCell>
                      {cohorte.fecha_inicio
                        ? `${new Date(cohorte.fecha_inicio).toLocaleDateString()} - ${cohorte.fecha_fin ? new Date(cohorte.fecha_fin).toLocaleDateString() : "-"
                        }`
                        : "-"}
                    </TableCell>
                    <TableCell>{cohorte.cupo ?? "-"}</TableCell>
                    {puedeGestionarCohortes && (
                      <TableCell align="right">
                        <IconButton size="small" onClick={() => onEditarCohorte(cohorte)}>
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </>
  );
};

export default CohortesTable;
