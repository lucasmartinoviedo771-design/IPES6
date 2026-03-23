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
}

const MateriasBloqueadasAccordion: React.FC<MateriasBloqueadasAccordionProps> = ({
  bloqueadasPorTipo,
  aprobadasFiltradas,
}) => {
  return (
    <Accordion defaultExpanded sx={{ bgcolor: "#fffaf1", borderRadius: 3, border: "1px solid #e2d4b5" }}>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Typography fontWeight={700}>Materias pendientes / no disponibles</Typography>
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

        {aprobadasFiltradas.length > 0 && (
          <Box sx={{ mt: 2 }}>
            <Divider textAlign="left" sx={{ mb: 1.5 }}>Materias ya aprobadas</Divider>
            <Stack direction="row" flexWrap="wrap" gap={1}>
              {aprobadasFiltradas.map((materia) => (
                <Chip key={materia.id} label={materia.nombre} color="success" size="small" />
              ))}
            </Stack>
          </Box>
        )}
      </AccordionDetails>
    </Accordion>
  );
};

export default MateriasBloqueadasAccordion;
