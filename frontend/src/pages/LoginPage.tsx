import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { TextField, Button, Alert, Paper, Stack, Typography } from "@mui/material";

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as any)?.from?.pathname || "/dashboard";

  const [loginId, setLoginId] = useState("");   // DNI/usuario/email
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      if (!loginId.trim() || !password.trim()) {
        setError("Completá DNI/Usuario y contraseña.");
        return;
      }
      await login(loginId, password);
      navigate(from, { replace: true });
    } catch (err: any) {
      const msg = err?.response?.data?.detail || "Credenciales inválidas.";
      setError(msg);
      console.warn("[Login] error:", err);
    }
  };

  return (
    <Stack alignItems="center" justifyContent="center" sx={{ minHeight: "60vh" }}>
      <Paper sx={{ p: 4, width: 400 }} elevation={3}>
        <Typography variant="h5" mb={2}>Iniciar Sesión</Typography>
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
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
            {error && <Alert severity="error">{error}</Alert>}
            <Button type="submit" variant="contained">INGRESAR</Button>
            <Button component={Link} to="/" variant="text">Volver</Button>
          </Stack>
        </form>
      </Paper>
    </Stack>
  );
}