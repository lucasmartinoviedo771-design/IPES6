import { Stack, Button } from "@mui/material";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useState } from "react";
import { PageHero } from "@/components/ui/GradientTitles";
import { getDefaultHomeRoute } from "@/utils/roles";

export default function Forbidden() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);

  const homeTarget = user ? getDefaultHomeRoute(user) : "/login";

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

  const handleGoHome = () => {
    navigate(homeTarget, { replace: true });
  };

  return (
    <Stack alignItems="center" mt={10} spacing={3} px={2}>
      <PageHero
        title="403 - No autorizado"
        subtitle="No tenés permisos para acceder a esta sección. Iniciá sesión con un usuario habilitado o continuá con la preinscripción."
        sx={{ width: "100%", maxWidth: 720, textAlign: "center" }}
      />
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={2}
        alignItems="center"
      >
        {user && (
          <Button variant="contained" color="secondary" onClick={handleGoHome}>
            Ir a mi panel
          </Button>
        )}
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
