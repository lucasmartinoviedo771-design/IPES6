import { useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Paper,
  Stack,
  TextField,
  InputAdornment,
  IconButton,
  Typography,
} from "@mui/material";
import { Visibility, VisibilityOff } from "@mui/icons-material";
import { enqueueSnackbar } from "notistack";
import { changePassword } from "@/api/auth";
import { useAuth } from "@/context/AuthContext";
import { useLocation, useNavigate } from "react-router-dom";
import { PageHero } from "@/components/ui/GradientTitles";
import { getDefaultHomeRoute, isOnlyEstudiante } from "@/utils/roles";

const ChangePasswordPage: React.FC = () => {
  const { refreshProfile, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const rawFrom = (location.state as any)?.from?.pathname;

  const defaultHome = useMemo(() => getDefaultHomeRoute(user), [user]);

  const resolveDestination = (candidate: string | undefined, profileUser = user) => {
    const base = getDefaultHomeRoute(profileUser);
    let target = candidate && candidate !== "/cambiar-password" ? candidate : base;
    if (isOnlyEstudiante(profileUser) && target && !target.startsWith("/estudiantes")) {
      target = base;
    }
    return target || base || "/estudiantes";
  };

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

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
      const refreshed = await refreshProfile();
      enqueueSnackbar("Contraseña actualizada correctamente.", {
        variant: "success",
      });
      const destination = resolveDestination(rawFrom, refreshed);
      navigate(destination, { replace: true });
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
        <PageHero
          title="Cambiar contraseña"
          subtitle="Por seguridad necesitás definir una contraseña nueva antes de continuar."
          sx={{
            width: "100%",
            boxShadow: "none",
            borderRadius: 3,
            background: "linear-gradient(135deg, rgba(125,127,110,0.95), rgba(183,105,78,0.95))",
          }}
        />
        <Box component="form" onSubmit={handleSubmit}>
          <Stack spacing={2}>
            <TextField
              type={showCurrentPassword ? "text" : "password"}
              label="Contraseña actual"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              autoComplete="current-password"
              required
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      aria-label="toggle password visibility"
                      onClick={() => setShowCurrentPassword((show) => !show)}
                      edge="end"
                    >
                      {showCurrentPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
            <TextField
              type={showNewPassword ? "text" : "password"}
              label="Contraseña nueva"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              autoComplete="new-password"
              required
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      aria-label="toggle password visibility"
                      onClick={() => setShowNewPassword((show) => !show)}
                      edge="end"
                    >
                      {showNewPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />

            {/* Requisitos sutiles */}
            <Box sx={{ pb: 1 }}>
              <Stack spacing={0.5} sx={{ px: 1 }}>
                {[
                  { label: "Mínimo 8 caracteres", met: newPassword.length >= 8 },
                  { label: "Al menos una letra", met: /[a-zA-Z]/.test(newPassword) },
                  { label: "Al menos un número", met: /[0-9]/.test(newPassword) },
                  { label: "No puede ser solo números", met: !/^\d+$/.test(newPassword) || newPassword === "" },
                ].map((req, idx) => (
                  <Stack key={idx} direction="row" spacing={1} alignItems="center">
                    <Box
                      sx={{
                        width: 6,
                        height: 6,
                        borderRadius: "50%",
                        bgcolor: newPassword === "" ? "grey.300" : req.met ? "success.main" : "error.light",
                      }}
                    />
                    <Typography
                      variant="caption"
                      sx={{
                        color: newPassword === "" ? "text.secondary" : req.met ? "success.main" : "error.main",
                        fontSize: "0.7rem",
                      }}
                    >
                      {req.label}
                    </Typography>
                  </Stack>
                ))}
              </Stack>
            </Box>

            <TextField
              type={showConfirmPassword ? "text" : "password"}
              label="Confirmar contraseña nueva"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              autoComplete="new-password"
              required
              error={newPassword !== confirmPassword && confirmPassword !== ""}
              helperText={newPassword !== confirmPassword && confirmPassword !== "" ? "Las contraseñas no coinciden" : ""}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      aria-label="toggle password visibility"
                      onClick={() => setShowConfirmPassword((show) => !show)}
                      edge="end"
                    >
                      {showConfirmPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
            {error && <Alert severity="error">{error}</Alert>}
            <Button
              type="submit"
              variant="contained"
              disabled={loading || newPassword.length < 8 || newPassword !== confirmPassword || !/[a-zA-Z]/.test(newPassword) || !/[0-9]/.test(newPassword)}
              sx={{
                mt: 1,
                py: 1,
                // Mantenemos el color coherente con el Hero si el tema no lo hace
                backgroundImage: "linear-gradient(135deg, #7d7f6e, #b7694e)",
                "&:disabled": { opacity: 0.6, backgroundImage: "none" }
              }}
            >
              {loading ? "Guardando..." : "Actualizar contraseña"}
            </Button>
          </Stack>
        </Box>
      </Paper>
    </Stack>
  );
};

export default ChangePasswordPage;
