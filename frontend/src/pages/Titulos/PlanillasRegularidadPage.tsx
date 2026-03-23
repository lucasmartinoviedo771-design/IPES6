import { useEffect, useMemo, useState } from "react";
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
  obtenerDatosCargaNotas,
  obtenerPlanillaRegularidad,
  type ComisionOptionDTO,
  type MateriaOptionDTO,
  type PlanDTO,
  type ProfesoradoDTO,
  type RegularidadPlanillaDTO,
} from "@/api/cargaNotas";
import { PageHero } from "@/components/ui/GradientTitles";

import { CURRENT_YEAR } from "./planillas-regularidad/utils";
import FiltrosPanel from "./planillas-regularidad/FiltrosPanel";
import RegularidadDialog from "./planillas-regularidad/RegularidadDialog";

export default function PlanillasRegularidadPage() {
  const [anioLectivo, setAnioLectivo] = useState(CURRENT_YEAR);
  const [profesoradoId, setProfesoradoId] = useState("");
  const [planId, setPlanId] = useState("");
  const [materiaId, setMateriaId] = useState("");
  const [anioCursada, setAnioCursada] = useState("");
  const [cuatrimestre, setCuatrimestre] = useState("");
  const [profesorados, setProfesorados] = useState<ProfesoradoDTO[]>([]);
  const [planes, setPlanes] = useState<PlanDTO[]>([]);
  const [materias, setMaterias] = useState<MateriaOptionDTO[]>([]);
  const [comisiones, setComisiones] = useState<ComisionOptionDTO[]>([]);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [planillaDialogOpen, setPlanillaDialogOpen] = useState(false);
  const [planillaLoading, setPlanillaLoading] = useState(false);
  const [planillaSeleccionada, setPlanillaSeleccionada] = useState<RegularidadPlanillaDTO | null>(null);
  const [comisionSeleccionada, setComisionSeleccionada] = useState<ComisionOptionDTO | null>(null);
  const [materiaSeleccionada, setMateriaSeleccionada] = useState<MateriaOptionDTO | null>(null);

  const uniqueAnios = useMemo(() => {
    const set = new Set<number>();
    comisiones.forEach((c) => { if (c.anio) set.add(c.anio); });
    return Array.from(set).sort((a, b) => b - a);
  }, [comisiones]);

  const uniqueAniosCursada = useMemo(() => {
    const set = new Set<number>();
    materias.forEach((m) => { if (m.anio) set.add(m.anio); });
    return Array.from(set).sort((a, b) => a - b);
  }, [materias]);

  useEffect(() => {
    listarProfesorados().then(setProfesorados).catch(() => setProfesorados([]));
  }, []);

  useEffect(() => {
    if (!profesoradoId) { setPlanes([]); setPlanId(""); return; }
    listarPlanes(Number(profesoradoId)).then(setPlanes).catch(() => setPlanes([]));
  }, [profesoradoId]);

  useEffect(() => {
    if (!planId) { setMaterias([]); setComisiones([]); return; }
    setLookupLoading(true);
    obtenerDatosCargaNotas({ plan_id: Number(planId) })
      .then((data) => { setMaterias(data.materias); setComisiones(data.comisiones); })
      .catch(() => { setMaterias([]); setComisiones([]); })
      .finally(() => setLookupLoading(false));
  }, [planId]);

  const materiaLookup = useMemo(() => {
    const map = new Map<number, MateriaOptionDTO>();
    materias.forEach((materia) => map.set(materia.id, materia));
    return map;
  }, [materias]);

  const filteredComisiones = useMemo(() => {
    return comisiones.filter((comision) => {
      if (anioLectivo && comision.anio !== Number(anioLectivo)) return false;
      if (materiaId && comision.materia_id !== Number(materiaId)) return false;
      if (profesoradoId && comision.profesorado_id !== Number(profesoradoId)) return false;
      if (planId && comision.plan_id !== Number(planId)) return false;
      if (anioCursada || cuatrimestre) {
        const mat = materiaLookup.get(comision.materia_id);
        if (!mat) return false;
        if (anioCursada && mat.anio !== Number(anioCursada)) return false;
        if (cuatrimestre && mat.cuatrimestre !== cuatrimestre) return false;
      }
      return true;
    });
  }, [comisiones, materiaId, profesoradoId, planId, anioCursada, cuatrimestre, materiaLookup]);

  const filteredMateriasOptions = useMemo(() => {
    return materias.filter((m) => {
      if (anioCursada && m.anio !== Number(anioCursada)) return false;
      if (cuatrimestre && m.cuatrimestre !== cuatrimestre) return false;
      return true;
    });
  }, [materias, anioCursada, cuatrimestre]);

  const handleVerPlanilla = async (comision: ComisionOptionDTO) => {
    setComisionSeleccionada(comision);
    setMateriaSeleccionada(materiaLookup.get(comision.materia_id) ?? null);
    setPlanillaDialogOpen(true);
    setPlanillaLoading(true);
    try {
      const data = await obtenerPlanillaRegularidad(comision.id);
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
        title="Planillas de regularidad"
        subtitle="Consulte las planillas de cursada informadas por cada comisión."
      />

      <FiltrosPanel
        anioLectivo={anioLectivo}
        setAnioLectivo={setAnioLectivo}
        profesoradoId={profesoradoId}
        setProfesoradoId={setProfesoradoId}
        planId={planId}
        setPlanId={setPlanId}
        anioCursada={anioCursada}
        setAnioCursada={setAnioCursada}
        cuatrimestre={cuatrimestre}
        setCuatrimestre={setCuatrimestre}
        materiaId={materiaId}
        setMateriaId={setMateriaId}
        profesorados={profesorados}
        planes={planes}
        uniqueAnios={uniqueAnios}
        uniqueAniosCursada={uniqueAniosCursada}
        filteredMateriasOptions={filteredMateriasOptions}
        lookupLoading={lookupLoading}
      />

      <Paper>
        <Box px={3} py={2} display="flex" justifyContent="space-between" alignItems="center">
          <Typography variant="h6">Resultados</Typography>
          {lookupLoading && <CircularProgress size={24} />}
        </Box>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Materia</TableCell>
                <TableCell>Comisión</TableCell>
                <TableCell>Año lectivo</TableCell>
                <TableCell>Turno</TableCell>
                <TableCell>Plan</TableCell>
                <TableCell>Acciones</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredComisiones.map((comision) => (
                <TableRow key={comision.id}>
                  <TableCell>{comision.materia_nombre}</TableCell>
                  <TableCell>{comision.codigo || "-"}</TableCell>
                  <TableCell>{comision.anio}</TableCell>
                  <TableCell>{comision.turno || "-"}</TableCell>
                  <TableCell>{comision.plan_resolucion}</TableCell>
                  <TableCell>
                    <IconButton onClick={() => handleVerPlanilla(comision)} size="small">
                      <VisibilityIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
              {!filteredComisiones.length && (
                <TableRow>
                  <TableCell colSpan={6}>
                    <Typography align="center" sx={{ py: 3 }}>
                      No se encontraron planillas para los filtros seleccionados.
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      <RegularidadDialog
        open={planillaDialogOpen}
        loading={planillaLoading}
        planilla={planillaSeleccionada}
        comisionInfo={comisionSeleccionada}
        materiaInfo={materiaSeleccionada}
        onClose={() => setPlanillaDialogOpen(false)}
      />
    </Stack>
  );
}
