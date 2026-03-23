import React from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import DownloadIcon from "@mui/icons-material/Download";

import { EquivalenciaDisposicionDTO } from "@/api/estudiantes";
import { formatFecha } from "./types";

interface DisposicionesCardProps {
  disposiciones: EquivalenciaDisposicionDTO[];
  loadingDisposiciones: boolean;
  dniFilter: string;
  onOpenDisposicionDialog: () => void;
}

const DisposicionesCard: React.FC<DisposicionesCardProps> = ({
  disposiciones,
  loadingDisposiciones,
  dniFilter,
  onOpenDisposicionDialog,
}) => {
  return (
    <Card variant="outlined" sx={{ mb: 3 }}>
      <CardContent>
        <Stack spacing={2}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Box>
              <Typography variant="subtitle1" fontWeight={600}>
                Registro de disposiciones
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Gestioná las materias aprobadas por equivalencia con número y fecha de disposición.
              </Typography>
            </Box>
            <Button
              variant="contained"
              startIcon={<DownloadIcon />}
              onClick={onOpenDisposicionDialog}
            >
              Registrar disposición
            </Button>
          </Stack>
          {loadingDisposiciones ? (
            <Typography variant="body2" color="text.secondary">
              Cargando disposiciones...
            </Typography>
          ) : disposiciones.length === 0 ? (
            <Alert severity="info">
              {dniFilter
                ? "No hay disposiciones para el DNI filtrado."
                : "Aún no se registraron disposiciones mediante este módulo."}
            </Alert>
          ) : (
            <Stack spacing={1.5}>
              {disposiciones.map((dispo) => (
                <Box
                  key={dispo.id}
                  sx={{
                    border: "1px solid",
                    borderColor: "divider",
                    borderRadius: 2,
                    p: 2,
                  }}
                >
                  <Typography variant="subtitle2" fontWeight={600}>
                    Disposición {dispo.numero_disposicion} · {formatFecha(dispo.fecha_disposicion)}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {dispo.profesorado_nombre} — {dispo.plan_resolucion}
                  </Typography>
                  <Typography variant="body2" sx={{ mt: 0.5 }}>
                    Materias:{" "}
                    {dispo.detalles
                      .map((detalle) => `${detalle.materia_nombre} (Nota ${detalle.nota})`)
                      .join(" · ")}
                  </Typography>
                </Box>
              ))}
            </Stack>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
};

export default DisposicionesCard;
