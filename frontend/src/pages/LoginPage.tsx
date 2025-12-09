import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useNavigate, useLocation } from "react-router-dom";
import {
  TextField,
  Button,
  Alert,
  Paper,
  Stack,
  Typography,
  IconButton,
  InputAdornment,
  Box,
  Divider,
} from "@mui/material";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";
import { getDefaultHomeRoute, isOnlyStudent } from "@/utils/roles";
import ipesLogoDark from "@/assets/ipes-logo-dark.png";
import sigedFirma from "@/assets/siged-firma.png";
import { PageHero } from "@/components/ui/GradientTitles";

const GoogleGlyph = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M17.64 9.2045C17.64 8.56682 17.5827 7.95227 17.4764 7.36364H9V10.845H13.8436C13.635 11.97 13.0009 12.9232 12.0477 13.5614V15.8195H14.9564C16.6582 14.2523 17.64 11.9455 17.64 9.2045Z"
      fill="#4285F4"
    />
    <path
      d="M9 18C11.43 18 13.4673 17.1941 14.9564 15.8195L12.0477 13.5614C11.2427 14.1014 10.2118 14.4232 9 14.4232C6.65591 14.4232 4.67182 12.8382 3.96409 10.71H0.957275V13.0418C2.43818 15.9832 5.48182 18 9 18Z"
      fill="#34A853"
    />
    <path
      d="M3.96409 10.71C3.78409 10.17 3.68182 9.59318 3.68182 9C3.68182 8.40682 3.78409 7.83 3.96409 7.29V4.95818H0.957273C0.347727 6.17682 0 7.54773 0 9C0 10.4523 0.347727 11.8232 0.957273 13.0418L3.96409 10.71Z"
      fill="#FBBC05"
    />
    <path
      d="M9 3.57682C10.3214 3.57682 11.5077 4.03182 12.4323 4.91227L15.0205 2.32409C13.4632 0.883636 11.4259 0 9 0C5.48182 0 2.43818 2.01682 0.957275 4.95818L3.96409 7.29C4.67182 5.16136 6.65591 3.57682 9 3.57682Z"
      fill="#EA4335"
    />
  </svg>
);

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as any)?.from?.pathname ?? null;

  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  // URL absoluta apuntando al backend en su subdominio (via Cloudflare Tunnel)
  const googleLoginUrl = import.meta.env.VITE_GOOGLE_LOGIN_URL ?? "https://ipes6-api.lucasoviedodev.org/api/auth/google/login";

  const hasGoogleEndpoint = true;

  const handleClickShowPassword = () => setShowPassword((show) => !show);
  const handleMouseDownPassword = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
  };

  const handleGoogleLogin = () => {
    window.location.href = googleLoginUrl;
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
      // Limpiar password del estado local tras login exitoso (aunque se desmonte)
      setPassword("");

      if (loggedUser?.must_change_password) {
        navigate("/cambiar-password", { replace: true, state: { from: { pathname: from } } });
      } else {
        const defaultHome = getDefaultHomeRoute(loggedUser);
        let target = from ?? defaultHome;
        if (target === "/preinscripcion") {
          target = defaultHome;
        }
        if (isOnlyStudent(loggedUser) && target && !target.startsWith("/alumnos")) {
          target = defaultHome;
        }
        if (!target) {
          target = defaultHome;
        }
        navigate(target, { replace: true });
      }
    } catch (err: any) {
      const msg = err?.message || err?.response?.data?.detail || "Credenciales inválidas.";
      setError(msg);
      console.warn("[Login] error:", err);
      // Limpiar password en error también si se desea, pero suele ser molesto. 
      // El usuario pidió "borrar la contraseña... cuando pone mal la contraseña".
      setPassword("");
    }
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        backgroundColor: "#070d1f",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        py: 8,
        px: 2,
      }}
    >
      <Stack spacing={4} alignItems="center" sx={{ width: "100%", maxWidth: 420 }}>
        <Stack spacing={1.5} alignItems="center">
          <Box component="img" src={ipesLogoDark} alt="IPES Paulo Freire" sx={{ height: 96, objectFit: "contain" }} />
        </Stack>

        <Paper
          elevation={0}
          sx={{
            width: "100%",
            borderRadius: 4,
            p: 4,
            background: "rgba(19,25,48,0.85)",
            border: "1px solid rgba(255,255,255,0.1)",
            color: "#fff",
            backdropFilter: "blur(30px)",
          }}
        >
          <Stack spacing={3}>
            <PageHero
              title="Iniciar sesión"
              subtitle="Ingresá con tu cuenta institucional"
              sx={{
                width: "100%",
                boxShadow: "none",
                borderRadius: 3,
                background: "linear-gradient(135deg, rgba(125,127,110,0.95), rgba(183,105,78,0.95))",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                textAlign: "center",
              }}
            />
            <form onSubmit={handleSubmit} autoComplete="off">
              <Stack spacing={2.5}>
                <Button
                  variant="contained"
                  fullWidth
                  disabled={false} // Habilitado ahora que tenemos HTTPS
                  onClick={handleGoogleLogin}
                  startIcon={<GoogleGlyph />}
                  sx={{
                    borderRadius: 999,
                    textTransform: "none",
                    fontWeight: 600,
                    backgroundColor: "rgba(9,13,28,0.9)",
                    color: "#fff",
                    border: "1px solid rgba(255,255,255,0.12)",
                    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08), 0 12px 24px rgba(0,0,0,0.45)",
                    // opacity: hasGoogleEndpoint ? 1 : 0.5,
                    "&:hover": {
                      backgroundColor: "rgba(15,22,40,0.95)",
                      borderColor: "rgba(255,255,255,0.3)",
                    },
                    "& .MuiButton-startIcon": {
                      marginRight: 1.5,
                    },
                  }}
                >
                  Continuar con Google
                </Button>

                <Typography
                  variant="caption"
                  sx={{ color: "rgba(255,255,255,0.7)", display: "block", textAlign: "center" }}
                >
                  Solo pueden ingresar cuentas institucionales ya cargadas en el sistema.
                </Typography>


                <Divider sx={{ borderColor: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.6)" }}>
                  o ingresá con usuario
                </Divider>

                <TextField
                  label="DNI o usuario"
                  value={loginId}
                  onChange={(e) => setLoginId(e.target.value)}
                  autoComplete="off"
                  required
                  fullWidth
                  variant="filled"
                  InputLabelProps={{ sx: { color: "rgba(255,255,255,0.7)" } }}
                  InputProps={{
                    sx: {
                      borderRadius: 3,
                      backgroundColor: "rgba(255,255,255,0.08)",
                      color: "#fff",
                      "& .MuiFilledInput-input": { color: "#fff" },
                      "&:hover": { backgroundColor: "rgba(255,255,255,0.12)" },
                    },
                  }}
                />
                <TextField
                  label="Contraseña"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password" // A veces 'off' no basta, 'new-password' es más agresivo
                  required
                  fullWidth
                  variant="filled"
                  InputLabelProps={{ sx: { color: "rgba(255,255,255,0.7)" } }}
                  InputProps={{
                    sx: {
                      borderRadius: 3,
                      backgroundColor: "rgba(255,255,255,0.08)",
                      color: "#fff",
                      "& .MuiFilledInput-input": { color: "#fff" },
                      "&:hover": { backgroundColor: "rgba(255,255,255,0.12)" },
                    },
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          aria-label="toggle password visibility"
                          onClick={handleClickShowPassword}
                          onMouseDown={handleMouseDownPassword}
                          edge="end"
                          sx={{ color: "#fff" }}
                        >
                          {showPassword ? <VisibilityOff /> : <Visibility />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                />
                {error && <Alert severity="error">{error}</Alert>}

                <Button
                  type="submit"
                  variant="contained"
                  fullWidth
                  sx={{
                    mt: 1,
                    py: 1.5,
                    borderRadius: 3,
                    textTransform: "none",
                    fontSize: "1rem",
                    background: "linear-gradient(135deg,#4776E6,#8E54E9)",
                    boxShadow: "0 20px 40px rgba(71,118,230,0.35)",
                  }}
                >
                  Ingresar
                </Button>
              </Stack>
            </form>
          </Stack>
        </Paper>

        <Box component="img" src={sigedFirma} alt="Firma de la dirección" sx={{ height: 75, opacity: 0.85 }} />
      </Stack>
    </Box>
  );
}
