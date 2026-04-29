import React from "react";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import Accordion from "@mui/material/Accordion";
import AccordionDetails from "@mui/material/AccordionDetails";
import AccordionSummary from "@mui/material/AccordionSummary";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { MateriaEvaluada, TipoBloqueo, BLOQUEO_LABEL } from "./types";

interface MateriasBloqueadasAccordionProps {
  bloqueadasPorTipo: Record<TipoBloqueo, MateriaEvaluada[]>;
  aprobadasFiltradas: MateriaEvaluada[];
  customTitle?: string;
}

const MateriasBloqueadasAccordion: React.FC<MateriasBloqueadasAccordionProps> = ({
  bloqueadasPorTipo,
  aprobadasFiltradas,
  customTitle,
}) => {
  return (
    <Accordion defaultExpanded sx={{ bgcolor: "#fffaf1", borderRadius: 3, border: "1px solid #e2d4b5" }}>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Typography fontWeight={700}>{customTitle || "Materias pendientes / no disponibles"}</Typography>
      </AccordionSummary>
      <AccordionDetails>
        {(["correlativas", "periodo", "choque", "inscripta", "otro"] as const).map((tipo) => {
          const lista = bloqueadasPorTipo[tipo];
          if (!lista || lista.length === 0) return null;
          return (
            <Box key={tipo} sx={{ mb: 3 }}>
              <Divider textAlign="left" sx={{ mb: 1.5 }}>{BLOQUEO_LABEL[tipo]}</Divider>
              <Stack spacing={1.5}>
                {lista.map((materia: MateriaEvaluada) => (
                  <Box key={materia.id} sx={{ p: 2, borderRadius: 2, border: "1px dashed #d3c19c", bgcolor: "#fff" }}>
                    <Typography fontWeight={600}>{materia.nombre}</Typography>
                    {materia.tipoBloqueo === "correlativas" ? (
                      <>
                        {materia.faltantesRegular && materia.faltantesRegular.length > 0 && (
                          <Typography
                            variant="body2"
                            color="text.secondary"
                          >
                            <Box component="span" sx={{ textDecoration: "underline", fontWeight: 600 }}>
                              Regularizar:
                            </Box>{" "}
                            {materia.faltantesRegular.join(", ")}
                          </Typography>
                        )}
                        {materia.faltantesAprob && materia.faltantesAprob.length > 0 && (
                          <Typography
                            variant="body2"
                            color="text.secondary"
                            sx={{ mt: materia.faltantesRegular?.length ? 0.5 : 0 }}
                          >
                            <Box component="span" sx={{ textDecoration: "underline", fontWeight: 600 }}>
                              Aprobar:
                            </Box>{" "}
                            {materia.faltantesAprob.join(", ")}
                          </Typography>
                        )}
                      </>
                    ) : (
                      materia.motivos.length > 0 && (
                        <Typography variant="body2" color="text.secondary">
                          {materia.motivos.join(" | ")}
                        </Typography>
                      )
                    )}
                  </Box>
                ))}
              </Stack>
            </Box>
          );
        })}

        {aprobadasFiltradas.length > 0 && (() => {
          const porAnio = aprobadasFiltradas.reduce<Record<number, typeof aprobadasFiltradas>>(
            (acc, m) => { (acc[m.anio] ??= []).push(m); return acc; },
            {}
          );
          const aniosOrdenados = Object.keys(porAnio).map(Number).sort((a, b) => a - b);
          return (
            <Box sx={{ mt: 2 }}>
              <Divider textAlign="left" sx={{ mb: 2 }}>Trayectoria aprobada</Divider>
              <Stack spacing={2.5}>
                {aniosOrdenados.map((anio) => (
                  <Box key={anio}>
                    <Typography
                      variant="caption"
                      fontWeight={700}
                      sx={{
                        display: "inline-block",
                        mb: 1,
                        px: 1.5,
                        py: 0.4,
                        borderRadius: 2,
                        bgcolor: "success.main",
                        color: "white",
                        letterSpacing: 0.5,
                      }}
                    >
                      {anio}° AÑO
                    </Typography>
                    <Stack direction="row" flexWrap="wrap" gap={1}>
                      {porAnio[anio].map((materia) => (
                        <Chip key={materia.id} label={materia.nombre} color="success" size="small" />
                      ))}
                    </Stack>
                  </Box>
                ))}
              </Stack>
            </Box>
          );
        })()}
      </AccordionDetails>
    </Accordion>
  );
};

export default MateriasBloqueadasAccordion;
