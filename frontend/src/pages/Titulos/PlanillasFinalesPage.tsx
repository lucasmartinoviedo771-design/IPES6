import { useEffect, useState } from "react";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import IconButton from "@mui/material/IconButton";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import VisibilityIcon from "@mui/icons-material/Visibility";

import {
  listarProfesorados,
  listarPlanes,
  listarMesasFinales,
  obtenerDatosCargaNotas,
  type PlanDTO,
  type ProfesoradoDTO,
  type MateriaOptionDTO,
} from "@/api/cargaNotas";
import { obtenerMesaPlanilla, type MesaPlanillaDTO } from "@/api/estudiantes";
import { PageHero } from "@/components/ui/GradientTitles";

import { CURRENT_YEAR, formatDate } from "./planillas-finales/utils";
import FiltrosPanel from "./planillas-finales/FiltrosPanel";
import MesaPlanillaDialog from "./planillas-finales/MesaPlanillaDialog";

export default function PlanillasFinalesPage() {
  const [anioFiltro, setAnioFiltro] = useState(CURRENT_YEAR);
  const [profesoradoId, setProfesoradoId] = useState("");
  const [planId, setPlanId] = useState("");
  const [materiaId, setMateriaId] = useState("");
  const [modalidad, setModalidad] = useState("");
  const [tipo, setTipo] = useState("");
  const [profesorados, setProfesorados] = useState<ProfesoradoDTO[]>([]);
  const [planes, setPlanes] = useState<PlanDTO[]>([]);
  const [materias, setMaterias] = useState<MateriaOptionDTO[]>([]);
  const [mesas, setMesas] = useState<
    {
      id: number;
      materia: string;
      fecha: string;
      modalidad: string;
      tipo: string;
      codigo?: string | null;
    }[]
  >([]);
  const [mesasLoading, setMesasLoading] = useState(false);
  const [planillaDialogOpen, setPlanillaDialogOpen] = useState(false);
  const [planillaLoading, setPlanillaLoading] = useState(false);
  const [planillaSeleccionada, setPlanillaSeleccionada] = useState<MesaPlanillaDTO | null>(null);

  useEffect(() => {
    listarProfesorados().then(setProfesorados).catch(() => setProfesorados([]));
  }, []);

  useEffect(() => {
    if (!profesoradoId) { setPlanes([]); setPlanId(""); return; }
    listarPlanes(Number(profesoradoId)).then(setPlanes).catch(() => setPlanes([]));
  }, [profesoradoId]);

  useEffect(() => {
    if (!planId) { setMaterias([]); return; }
    obtenerDatosCargaNotas({ plan_id: Number(planId) })
      .then((data) => setMaterias(data.materias))
      .catch(() => setMaterias([]));
  }, [planId]);

  useEffect(() => {
    if (!planId) { setMesas([]); return; }
    setMesasLoading(true);
    listarMesasFinales({
      plan_id: Number(planId),
      profesorado_id: profesoradoId ? Number(profesoradoId) : undefined,
      materia_id: materiaId ? Number(materiaId) : undefined,
      modalidad: (modalidad as "REG" | "LIB") || undefined,
      tipo: (tipo as "FIN" | "EXT" | "ESP") || undefined,
    })
      .then((data) => {
        const filtered = data
          .filter((mesa) =>
            anioFiltro ? new Date(mesa.fecha).getFullYear().toString() === anioFiltro : true,
          )
          .map((mesa) => ({
            id: mesa.id,
            materia: mesa.materia_nombre ?? "-",
            fecha: mesa.fecha,
            modalidad: mesa.modalidad,
            tipo: mesa.tipo,
            codigo: mesa.codigo,
          }));
        setMesas(filtered);
      })
      .catch(() => setMesas([]))
      .finally(() => setMesasLoading(false));
  }, [planId, profesoradoId, materiaId, modalidad, tipo, anioFiltro]);

  const handleVerPlanilla = async (mesaId: number) => {
    setPlanillaDialogOpen(true);
    setPlanillaLoading(true);
    try {
      const data = await obtenerMesaPlanilla(mesaId);
      setPlanillaSeleccionada(data);
    } catch {
      setPlanillaSeleccionada(null);
    } finally {
      setPlanillaLoading(false);
    }
  };

  return (
    <Stack spacing={4}>
      <PageHero
        title="Planillas de mesas finales"
        subtitle="Visualice las actas finales y resultados sin posibilidad de edición."
      />

      <FiltrosPanel
        anioFiltro={anioFiltro}
        setAnioFiltro={setAnioFiltro}
        profesoradoId={profesoradoId}
        setProfesoradoId={setProfesoradoId}
        planId={planId}
        setPlanId={setPlanId}
        materiaId={materiaId}
        setMateriaId={setMateriaId}
        modalidad={modalidad}
        setModalidad={setModalidad}
        tipo={tipo}
        setTipo={setTipo}
        profesorados={profesorados}
        planes={planes}
        materias={materias}
      />

      <Paper>
        <Box px={3} py={2} display="flex" justifyContent="space-between" alignItems="center">
          <Typography variant="h6">Mesas encontradas</Typography>
          {mesasLoading && <CircularProgress size={24} />}
        </Box>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Materia</TableCell>
                <TableCell>Fecha</TableCell>
                <TableCell>Modalidad</TableCell>
                <TableCell>Tipo</TableCell>
                <TableCell>Código</TableCell>
                <TableCell>Acciones</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {mesas.map((mesa) => (
                <TableRow key={mesa.id}>
                  <TableCell>{mesa.materia}</TableCell>
                  <TableCell>{formatDate(mesa.fecha)}</TableCell>
                  <TableCell>{mesa.modalidad}</TableCell>
                  <TableCell>{mesa.tipo}</TableCell>
                  <TableCell>{mesa.codigo || "-"}</TableCell>
                  <TableCell>
                    <IconButton onClick={() => handleVerPlanilla(mesa.id)} size="small">
                      <VisibilityIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
              {!mesas.length && (
                <TableRow>
                  <TableCell colSpan={6}>
                    <Typography align="center" sx={{ py: 3 }}>
                      No se encontraron mesas con los filtros seleccionados.
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      <MesaPlanillaDialog
        open={planillaDialogOpen}
        planilla={planillaSeleccionada}
        loading={planillaLoading}
        onClose={() => setPlanillaDialogOpen(false)}
      />
    </Stack>
  );
}
