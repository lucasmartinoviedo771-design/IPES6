import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Container from "@mui/material/Container";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import LocationOn from "@mui/icons-material/LocationOn";
import VerifiedUser from "@mui/icons-material/VerifiedUser";
import { useSnackbar } from "notistack";
import { useNavigate } from "react-router-dom";

import { PageHero } from "@/components/ui/GradientTitles";
import BackButton from "@/components/ui/BackButton";
import { registrarAsistenciaPin } from "@/api/asistencia";

export default function PresentePage() {
  const [pin, setPin] = useState("");
  const [locationConsent, setLocationConsent] = useState(
    localStorage.getItem("gps_consent") === "true"
  );
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [locating, setLocating] = useState(false);
  const [success, setSuccess] = useState(false);
  
  // Auto-request location if consent was already given
  useEffect(() => {
    if (locationConsent && lat === null && !locating) {
      requestLocation();
    }
  }, [locationConsent, lat, locating]);

  const { enqueueSnackbar } = useSnackbar();
  const navigate = useNavigate();

  const mutation = useMutation({
    mutationFn: () => registrarAsistenciaPin({ pin, latitud: lat || undefined, longitud: lng || undefined }),
    onSuccess: () => {
      setSuccess(true);
      enqueueSnackbar("¡Asistencia registrada correctamente!", { variant: "success" });
    },
  });

  const requestLocation = () => {
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude);
        setLng(pos.coords.longitude);
        setLocating(false);
        setLocationConsent(true);
        localStorage.setItem("gps_consent", "true");
        enqueueSnackbar("Ubicación obtenida correctamente", { variant: "success" });
      },
      (err) => {
        setLocating(false);
        enqueueSnackbar("No pudimos obtener tu ubicación: " + err.message, { variant: "error" });
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  if (success) {
    return (
      <Box sx={{ minHeight: "100vh", bgcolor: "#f4f6f8", py: 8 }}>
        <Container maxWidth="sm">
          <Card sx={{ p: 4, textAlign: "center", borderRadius: 4 }}>
            <VerifiedUser sx={{ fontSize: 80, color: "success.main", mb: 2 }} />
            <Typography variant="h4" fontWeight="bold" gutterBottom>
              ¡Presente Registrado!
            </Typography>
            <Typography variant="body1" color="text.secondary" mb={4}>
              Tu asistencia ha sido guardada exitosamente.
            </Typography>
            <Button variant="contained" size="large" onClick={() => navigate("/estudiantes")}>
              Volver al Inicio
            </Button>
          </Card>
        </Container>
      </Box>
    );
  }

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "#f4f6f8", pb: 8 }}>
      <Container maxWidth="sm" sx={{ py: 4 }}>
        <BackButton fallbackPath="/estudiantes" />
        <Stack spacing={3} mt={2}>
          <PageHero
            title="Dar el Presente"
            subtitle="Ingresá el PIN brindado por el docente para registrar tu asistencia."
          />

          <Card elevation={0} variant="outlined" sx={{ bgcolor: "white", borderRadius: 3 }}>
            <CardContent sx={{ p: 4 }}>
              {!locationConsent || lat === null ? (
                <Stack spacing={3} alignItems="center" textAlign="center">
                  <LocationOn sx={{ fontSize: 60, color: "primary.main" }} />
                  <Typography variant="h6" fontWeight="bold">
                    Permiso de Ubicación
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Para registrar tu asistencia necesitamos verificar que estás dentro de la institución. 
                    Por favor, permití el acceso a tu ubicación. Esto se solicitará solo una vez.
                  </Typography>
                  <Button
                    variant="contained"
                    size="large"
                    onClick={requestLocation}
                    disabled={locating}
                    sx={{ borderRadius: 2, px: 4 }}
                  >
                    {locating ? "Obteniendo ubicación..." : "Permitir Ubicación"}
                  </Button>
                </Stack>
              ) : (
                <Stack spacing={4}>
                  <Alert severity="info" icon={<LocationOn />}>
                    Ubicación obtenida correctamente. Ya podés registrar tu presente.
                  </Alert>

                  <Box>
                    <Typography variant="subtitle1" fontWeight={600} mb={1}>
                      PIN de Asistencia
                    </Typography>
                    <TextField
                      fullWidth
                      variant="outlined"
                      placeholder="Ej: 4819"
                      value={pin}
                      onChange={(e) => setPin(e.target.value)}
                      inputProps={{ 
                        style: { fontSize: "2rem", textAlign: "center", letterSpacing: "0.5rem", fontWeight: "bold" },
                        maxLength: 6
                      }}
                    />
                  </Box>

                  <Button
                    variant="contained"
                    size="large"
                    onClick={() => mutation.mutate()}
                    disabled={mutation.isPending || pin.length < 4}
                    sx={{ py: 2, fontSize: "1.1rem", borderRadius: 2 }}
                  >
                    {mutation.isPending ? "Validando..." : "Confirmar Presente"}
                  </Button>
                </Stack>
              )}
            </CardContent>
          </Card>
        </Stack>
      </Container>
    </Box>
  );
}
