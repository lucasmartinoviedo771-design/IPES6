import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { getDefaultHomeRoute } from "@/utils/roles";
import { Box, CircularProgress, Typography } from "@mui/material";

export default function AuthCallbackPage() {
  const { user, loading, refreshProfile } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      // Manually trigger a profile refresh to get the user data from the new session
      try {
        const freshUser = await refreshProfile();
        if (freshUser) {
          const target = getDefaultHomeRoute(freshUser);
          navigate(target, { replace: true });
        } else {
          // Not authenticated, send to login
          navigate("/login", { replace: true });
        }
      } catch {
        navigate("/login", { replace: true });
      }
    })();
  }, [navigate, refreshProfile]);

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "100vh",
      }}
    >
      <CircularProgress />
      <Typography sx={{ mt: 2 }}>
        Autenticando...
      </Typography>
    </Box>
  );
}
