import { useState } from "react";
import {
  Alert,
  Box,
  Button,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { enqueueSnackbar } from "notistack";
import { changePassword } from "@/api/auth";
import { useAuth } from "@/context/AuthContext";
import { useLocation, useNavigate } from "react-router-dom";

const ChangePasswordPage: React.FC = () => {
  const { refreshProfile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const redirectTo =
    (location.state as any)?.from?.pathname && (location.state as any)?.from?.pathname !== "/cambiar-password"
      ? (location.state as any)?.from?.pathname
      : "/dashboard";

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (!currentPassword.trim() || !newPassword.trim()) {
      setError("Completá todos los campos.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Las contraseñas nuevas no coinciden.");
      return;
    }

    setLoading(true);
    try {
      await changePassword({
        current_password: currentPassword,
        new_password: newPassword,
      });
      await refreshProfile();
      enqueueSnackbar("Contraseña actualizada correctamente.", {
        variant: "success",
      });
      navigate(redirectTo, { replace: true });
    } catch (err: any) {
      const message =
        err?.response?.data?.detail ||
        err?.message ||
        "No fue posible actualizar la contraseña.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Stack
      alignItems="center"
      justifyContent="center"
      minHeight="100vh"
      px={2}
      sx={{ bgcolor: "background.default" }}
    >
      <Paper sx={{ p: 4, maxWidth: 420, width: "100%" }} elevation={4}>
        <Typography variant="h5" fontWeight={700} gutterBottom>
          Cambiar contraseña
        </Typography>
        <Typography color="text.secondary" mb={3}>
          Por seguridad necesitás definir una contraseña nueva antes de continuar.
        <Typography color="text.secondary" variant="body2" mb={3}>
          La clave inicial entregada es Pass + DNI (por ejemplo, Pass40123456).
        </Typography>
        </Typography>
        <Box component="form" onSubmit={handleSubmit}>
          <Stack spacing={2}>
            <TextField
              type="password"
              label="Contraseña actual"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              autoComplete="current-password"
              required
            />
            <TextField
              type="password"
              label="Contraseña nueva"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              autoComplete="new-password"
              helperText="Debe cumplir con los requisitos de seguridad del sistema."
              required
            />
            <TextField
              type="password"
              label="Confirmar contraseña nueva"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              autoComplete="new-password"
              required
            />
            {error && <Alert severity="error">{error}</Alert>}
            <Button type="submit" variant="contained" disabled={loading}>
              {loading ? "Guardando..." : "Actualizar contraseña"}
            </Button>
          </Stack>
        </Box>
      </Paper>
    </Stack>
  );
};

export default ChangePasswordPage;

