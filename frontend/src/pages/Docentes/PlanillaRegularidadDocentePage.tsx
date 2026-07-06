import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { enqueueSnackbar } from "notistack";
import React, { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
type GuardarRegularidadPayload,
guardarPlanillaRegularidad,
obtenerPlanillaRegularidad,
type RegularidadPlanillaDTO,
} from "@/api/cargaNotas";
import RegularidadPlanillaEditor from "@/components/secretaria/RegularidadPlanillaEditor";
import BackButton from "@/components/ui/BackButton";
import { PageHero } from "@/components/ui/GradientTitles";

export default function PlanillaRegularidadDocentePage() {
const { comisionId } = useParams();
const navigate = useNavigate();
const [planilla, setPlanilla] = useState<RegularidadPlanillaDTO | null>(null);
const [loading, setLoading] = useState(true);
const [saving, setSaving] = useState(false);

useEffect(() => {
if (!comisionId) return;
setLoading(true);
		obtenerPlanillaRegularidad(Number(comisionId))
			.then((data) => {
				setPlanilla(data);
			})
.catch((err) => {
enqueueSnackbar(
err.message || "Error al cargar la planilla de regularidad",
{ variant: "error" },
);
navigate("/docentes/mis-materias");
})
.finally(() => setLoading(false));
}, [comisionId, navigate]);

const handleSave = useCallback(
async (payload: GuardarRegularidadPayload) => {
setSaving(true);
try {
await guardarPlanillaRegularidad(payload);
enqueueSnackbar("Planilla guardada correctamente.", {
variant: "success",
});
				// Recargar la planilla para ver los cambios
				const data = await obtenerPlanillaRegularidad(Number(comisionId));
				setPlanilla(data);
} catch (err: any) {
enqueueSnackbar(err.message || "Error al guardar la planilla", {
variant: "error",
});
} finally {
setSaving(false);
}
},
[comisionId],
);

return (
<Box sx={{ p: { xs: 2, md: 4 } }}>
			<BackButton fallbackPath="/docentes/mis-materias" />
			<Stack
				direction={{ xs: "column", sm: "row" }}
				justifyContent="space-between"
				alignItems={{ xs: "flex-start", sm: "center" }}
				mb={2}
			>
				<PageHero
					title="Planilla de Regularidad"
					subtitle="Gestión de calificaciones y condición final"
				/>
				{planilla?.planilla_id && (
					<Button
						variant="outlined"
						onClick={() =>
							window.open(
								`/api/admin/primera-carga/regularidades/planillas/${planilla.planilla_id}/pdf`,
								"_blank",
							)
						}
					>
						Descargar Planilla PDF
					</Button>
				)}
			</Stack>

			{loading ? (
<Box sx={{ display: "flex", justifyContent: "center", p: 4 }}>
<CircularProgress />
</Box>
) : !planilla ? (
<Paper sx={{ p: 4, textAlign: "center" }}>
<Typography color="text.secondary">
No se encontró la planilla para la comisión solicitada.
</Typography>
<Button
sx={{ mt: 2 }}
variant="outlined"
onClick={() => navigate("/docentes/mis-materias")}
>
Volver
</Button>
</Paper>
) : (
<Paper elevation={0} sx={{ p: 3, borderRadius: 2 }}>
<RegularidadPlanillaEditor
comisionId={Number(comisionId)}
planilla={planilla}
situaciones={planilla.situaciones}
defaultFechaCierre={
planilla.fecha_cierre || new Date().toISOString().slice(0, 10)
}
saving={saving}
onSave={handleSave}
readOnly={planilla.esta_cerrada || !planilla.puede_editar}
/>
</Paper>
)}
</Box>
);
}
