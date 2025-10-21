import { Stack, Typography, Button } from "@mui/material";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useState } from "react";

export default function Forbidden() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLoginClick = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      if (user) {
        await logout();
      }
    } catch (error) {
      console.warn("Forbidden: error al cerrar sesion previo al login", error);
    } finally {
      setLoggingOut(false);
      navigate("/login", {
        replace: true,
        state: { from: location.state?.from ?? { pathname: "/dashboard" } },
      });
    }
  };

  return (
    <Stack alignItems="center" mt={10} spacing={3} px={2}>
      <Typography variant="h4">403 - No autorizado</Typography>
      <Typography color="text.secondary" textAlign="center" maxWidth={520}>
        No tenes permisos para acceder a esta seccion. Inicia sesion con un
        usuario habilitado o continua con la preinscripcion.
      </Typography>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={2}
        alignItems="center"
      >
        <Button
          variant="contained"
          color="primary"
          onClick={handleLoginClick}
          disabled={loggingOut}
        >
          {loggingOut ? "Abriendo login..." : "Iniciar sesion"}
        </Button>
        <Button
          component={Link}
          to="/preinscripcion"
          variant="outlined"
          color="secondary"
        >
          Ir a preinscripcion
        </Button>
        <Button component={Link} to="/" variant="text">
          Volver al inicio
        </Button>
      </Stack>
    </Stack>
  );
}
