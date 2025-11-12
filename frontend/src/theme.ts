import { createTheme } from "@mui/material/styles";

const PRIMARY_TERRACOTTA = "#B7694E";
const PRIMARY_TERRACOTTA_DARK = "#9f4f37";
const SECONDARY_OLIVE = "#7D7F6E";
const SECONDARY_OLIVE_DARK = "#6a6c5d";
const TEXT_COLOR = "#020617";

export const theme = createTheme({
  palette: {
    primary: { main: PRIMARY_TERRACOTTA, contrastText: "#ffffff" },
    secondary: { main: SECONDARY_OLIVE, contrastText: "#ffffff" },
    background: { default: "#f3f4ef", paper: "#ffffff" },
    text: { primary: TEXT_COLOR, secondary: TEXT_COLOR },
    grey: { 100: "#f8faf0", 200: "#e3e5dc", 300: "#c5c7bc" },
  },
  shape: { borderRadius: 2 },
  typography: {
    fontFamily: `"Inter", system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif`,
    allVariants: { color: TEXT_COLOR },
    h1: { fontSize: 32, fontWeight: 700, letterSpacing: 0.2 },
    h2: { fontSize: 28, fontWeight: 700, letterSpacing: 0.2 },
    h3: { fontSize: 24, fontWeight: 700 },
    h4: { fontSize: 20, fontWeight: 600 },
    h5: { fontSize: 18, fontWeight: 600 },
    h6: { fontSize: 16, fontWeight: 600 },
    subtitle1: { fontSize: 16, fontWeight: 500 },
    subtitle2: { fontSize: 14, fontWeight: 500 },
    body1: { fontSize: 15 },
    body2: { fontSize: 13 },
    button: { textTransform: "none", fontWeight: 600 },
  },
  components: {
    MuiPaper: {
      styleOverrides: {
        root: {
          border: "1px solid #e2e8f0",
          boxShadow: "0 10px 30px rgba(15,23,42,0.08)",
          borderRadius: 10,
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: { borderRadius: 10 },
        containedPrimary: {
          backgroundColor: PRIMARY_TERRACOTTA,
          "&:hover": { backgroundColor: PRIMARY_TERRACOTTA_DARK },
        },
        outlinedPrimary: {
          borderColor: PRIMARY_TERRACOTTA,
          color: PRIMARY_TERRACOTTA,
          "&:hover": { borderColor: PRIMARY_TERRACOTTA_DARK },
        },
      },
    },
    MuiTableHead: {
      styleOverrides: {
        root: {
          "& .MuiTableCell-root": {
            fontWeight: 700,
            background: "#f8fafc",
          },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 10,
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 5,
          "& fieldset": {
            borderRadius: 5,
          },
        },
      },
    },
  },
});
