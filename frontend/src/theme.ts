import { createTheme } from "@mui/material/styles";

export const theme = createTheme({
  palette: {
    primary: { main: "#87973a" }, // verde IPES
    secondary: { main: "#c57b38" }, // ocre
    background: { default: "#f7f4ec", paper: "#ffffff" },
    text: { primary: "#2e2f2a", secondary: "#6b6f61" },
    grey: { 100: "#f1f2ea", 200: "#e6e8da", 300: "#d8dcc7" },
  },
  shape: { borderRadius: 14 },
  typography: {
    fontFamily: `"Inter", system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif`,
    h1: { fontSize: 28, fontWeight: 800, letterSpacing: 0.2 },
    h2: { fontSize: 24, fontWeight: 800, letterSpacing: 0.2 },
    h3: { fontSize: 20, fontWeight: 800, letterSpacing: 0.2 },
    h4: { fontSize: 18, fontWeight: 700 },
    h5: { fontSize: 16, fontWeight: 800 },
    h6: { fontSize: 15, fontWeight: 800 },
    subtitle1: { fontSize: 14, fontWeight: 600 },
    subtitle2: { fontSize: 13, fontWeight: 600 },
    body1: { fontSize: 14 },
    body2: { fontSize: 13 },
    button: { textTransform: "none", fontWeight: 600 },
  },
  components: {
    MuiPaper: {
      styleOverrides: {
        root: {
          border: "1px solid #eee",
          boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: { borderRadius: 12 },
      },
    },
    MuiTableHead: {
      styleOverrides: {
        root: {
          '& .MuiTableCell-root': {
            fontWeight: 700,
            background: '#faf7f2',
          },
        },
      },
    },
    MuiCardHeader: {
      defaultProps: {
        titleTypographyProps: { variant: 'h6', fontWeight: 800 },
        subheaderTypographyProps: { variant: 'body2', color: 'text.secondary' },
      },
    },
  },
});
