import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useNavigate, useLocation, Link } from "react-router-dom";
import {
  TextField,
  Button,
  Alert,
  Paper,
  Stack,
  Typography,
  IconButton, // Import IconButton
  InputAdornment, // Import InputAdornment
} from "@mui/material";
import Visibility from "@mui/icons-material/Visibility"; // Import Visibility icon
import VisibilityOff from "@mui/icons-material/VisibilityOff"; // Import VisibilityOff icon
import { isOnlyStudent } from "@/utils/roles";

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as any)?.from?.pathname ?? null;

  const [loginId, setLoginId] = useState(""); // DNI/usuario/email
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false); // State for password visibility

  const handleClickShowPassword = () => setShowPassword((show) => !show);
  const handleMouseDownPassword = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      if (!loginId.trim() || !password.trim()) {
        setError("Completá DNI/Usuario y contraseña.");
        return;
      }
      const loggedUser = await login(loginId, password);
      if (loggedUser?.must_change_password) {
        navigate("/cambiar-password", { replace: true, state: { from: { pathname: from } } });
      } else {
        const fallback = "/alumnos";
        const studentOnly = isOnlyStudent(loggedUser);
        const target = studentOnly ? fallback : from ?? fallback;
        navigate(target, { replace: true });
      }
    } catch (err: any) {
      const msg = err?.message || err?.response?.data?.detail || "Credenciales inválidas.";
      setError(msg);
      console.warn("[Login] error:", err);
    }
  };

  return (
    <Stack alignItems="center" justifyContent="center" sx={{ minHeight: "60vh" }}>
      <Paper sx={{ p: 4, width: 400 }} elevation={3}>
        <Typography variant="h5" mb={2}>
          Iniciar Sesión
        </Typography>
        <form onSubmit={handleSubmit}>
          <Stack spacing={2}>
            <TextField
              label="DNI o Usuario (o email)"
              value={loginId}
              onChange={(e) => setLoginId(e.target.value)}
              autoComplete="username"
              required
            />
            <TextField
              label="Contraseña"
              type={showPassword ? "text" : "password"} // Toggle type based on showPassword state
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
              InputProps={{ // Add InputProps for the adornment
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      aria-label="toggle password visibility"
                      onClick={handleClickShowPassword}
                      onMouseDown={handleMouseDownPassword}
                      edge="end"
                    >
                      {showPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
            {error && <Alert severity="error">{error}</Alert>}
            <Button type="submit" variant="contained">
              INGRESAR
            </Button>
            <Button component={Link} to="/" variant="text">
              Volver
            </Button>
          </Stack>
        </form>
      </Paper>
    </Stack>
  );
}
