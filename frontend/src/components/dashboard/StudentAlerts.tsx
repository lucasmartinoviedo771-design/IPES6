import { useEffect, useState } from "react";
import { Alert, AlertTitle, Stack, Box, Collapse } from "@mui/material";
import { getMisAlertas, CorrelativaCaidaItem } from "@/api/reportes";

export default function StudentAlerts() {
  const [alerts, setAlerts] = useState<CorrelativaCaidaItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAlerts = async () => {
      try {
        const data = await getMisAlertas();
        setAlerts(data);
      } catch (err) {
        console.error("Error fetching student alerts:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchAlerts();
  }, []);

  if (loading || alerts.length === 0) {
    return null;
  }

  return (
    <Box sx={{ mb: 3 }}>
      <Stack spacing={2}>
        {alerts.map((alert, index) => (
          <Collapse in={true} key={index}>
            <Alert severity="warning" variant="filled" sx={{ borderRadius: 2 }}>
              <AlertTitle>Atención: Problema de Correlatividad</AlertTitle>
              Estás cursando <strong>{alert.materia_actual}</strong> pero tenés pendiente{" "}
              <strong>{alert.materia_correlativa}</strong>.
              <br />
              Motivo: {alert.motivo}.
            </Alert>
          </Collapse>
        ))}
      </Stack>
    </Box>
  );
}
