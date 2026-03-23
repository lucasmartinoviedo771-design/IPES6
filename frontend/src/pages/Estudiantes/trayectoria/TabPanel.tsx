import React from 'react';
import Box from "@mui/material/Box";

export function TabPanel({ children, value, index }: { children: React.ReactNode; value: number; index: number }) {
  return (
    <div role="tabpanel" hidden={value !== index} id={`trayectoria-panel-${index}`} aria-labelledby={`trayectoria-tab-${index}`}>
      {value === index && <Box sx={{ pt: 2 }}>{children}</Box>}
    </div>
  );
}
