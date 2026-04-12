import React from "react";
import Box from "@mui/material/Box";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import AssignmentIcon from "@mui/icons-material/Assignment";
import CompareArrowsIcon from "@mui/icons-material/CompareArrows";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import { useNavigate, useLocation } from "react-router-dom";

type TabConfig = {
  label: string;
  path: string;
  icon: React.ReactElement;
};

const STAFF_TABS: TabConfig[] = [
  { label: "Analíticos", path: "/secretaria/analiticos", icon: <AssignmentIcon fontSize="small" /> },
  { label: "Equivalencias", path: "/secretaria/pedidos-equivalencias", icon: <CompareArrowsIcon fontSize="small" /> },
  { label: "Cambio de comisión", path: "/secretaria/cambio-comision", icon: <CheckCircleOutlineIcon fontSize="small" /> },
];

const TAB_SX = {
  "& .MuiTab-root": {
    fontWeight: 600,
    textTransform: "none",
    fontSize: "0.95rem",
    minHeight: 48,
  },
  "& .Mui-selected": { color: "#8b4513" },
  "& .MuiTabs-indicator": { backgroundColor: "#8b4513" },
};

export const TramitesNavTabs: React.FC = () => {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const activeIndex = STAFF_TABS.findIndex((t) => pathname.startsWith(t.path));

  const handleChange = (_: React.SyntheticEvent, newIndex: number) => {
    navigate(STAFF_TABS[newIndex].path);
  };

  return (
    <Box sx={{ borderBottom: 1, borderColor: "divider", mb: 3 }}>
      <Tabs value={activeIndex === -1 ? 0 : activeIndex} onChange={handleChange} sx={TAB_SX}>
        {STAFF_TABS.map((t) => (
          <Tab key={t.path} label={t.label} icon={t.icon} iconPosition="start" />
        ))}
      </Tabs>
    </Box>
  );
};
