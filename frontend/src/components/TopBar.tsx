import { AppBar, Toolbar, Box, Typography } from "@mui/material";

// Si el archivo está en public/, podés referenciarlo así:
const LOGO_SRC = "/ipes-logo.jpg"; // o "/logoipes.jpg"

export default function TopBar() {
  // ancho reservado a los costados para mantener el título perfectamente centrado
  const sideWidth = 56; // px (igual al ancho aprox. del logo)
  return (
    <>
      <AppBar
        position="fixed"
        color="primary"
        elevation={0}
        sx={{
          bgcolor: "primary.main",         // verde
          borderBottom: "1px solid",
          borderColor: "divider",
        }}
      >
        <Toolbar sx={{ minHeight: { xs: 56, sm: 64 } }}>
          {/* IZQUIERDA: logo */}
          <Box sx={{ width: sideWidth, display: "flex", alignItems: "center" }}>
            <img
              src={LOGO_SRC}
              alt="IPES Paulo Freire"
              style={{ height: 36, width: "auto", display: "block" }}
            />
          </Box>

          {/* CENTRO: título naranja, centrado perfecto */}
          <Box sx={{ flex: 1, textAlign: "center" }}>
            <Typography
              variant="h6"
              sx={{
                color: "secondary.main",    // naranja
                textShadow: "0 1px 0 rgba(0,0,0,.15)", // opcional
                fontWeight: 700,
                letterSpacing: 0.2,
                fontSize: { xs: 16, sm: 18, md: 20 },
                userSelect: "none",
              }}
            >
              IPES Paulo Freire
            </Typography>
          </Box>

          {/* DERECHA: “fantasma” para mantener el título centrado */}
          <Box sx={{ width: sideWidth }} />
        </Toolbar>
      </AppBar>

      {/* Empuje para que el contenido no quede debajo de la appbar */}
      <Toolbar sx={{ minHeight: { xs: 56, sm: 64 } }} />
    </>
  );
}
