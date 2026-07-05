// src/components/preinscripcion/steps/Confirmacion.tsx

import Box from "@mui/material/Box";
import Checkbox from "@mui/material/Checkbox";
import Divider from "@mui/material/Divider";
import FormControlLabel from "@mui/material/FormControlLabel";
import Grid from "@mui/material/Grid";
import Typography from "@mui/material/Typography";
import React from "react";
import { useFormContext } from "react-hook-form";
import type { PreinscripcionForm } from "../schema";

const fmtDate = (iso?: string) => {
	if (!iso) return undefined;
	const [y, m, d] = iso.split("-");
	if (!y || !m || !d) return iso;
	return `${d}/${m}/${y}`;
};

function Row({ label, value }: { label: string; value?: any }) {
	return (
		<Grid container sx={{ mb: 0.5 }}>
			<Grid item xs={5} md={3} sx={{ color: "text.secondary" }}>
				{label}
			</Grid>
			<Grid item xs={7} md={9}>
				{value || "—"}
			</Grid>
		</Grid>
	);
}

async function imageUrlToDataUrl(url: string): Promise<string> {
	const response = await fetch(url);
	const blob = await response.blob();
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onloadend = () => resolve(reader.result as string);
		reader.onerror = reject;
		reader.readAsDataURL(blob);
	});
}

export default function Confirmacion({
	carreraNombre,
}: {
	carreraNombre: string;
}) {
	const { watch } = useFormContext<PreinscripcionForm>();
	const v = watch();

	return (
		<Box>
			{/* Resumen visual en pantalla */}
			<Box sx={{ p: 2 }}>
				<Typography variant="h6" sx={{ mb: 2 }}>
					Datos personales
				</Typography>
				<Row label="Nombres" value={v.nombres} />
				<Row label="Apellido" value={v.apellido} />
				<Row label="DNI" value={v.dni} />
				<Row label="CUIL" value={v.cuil} />
				<Row label="Fecha de nacimiento" value={fmtDate(v.fecha_nacimiento)} />
				<Row label="Nacionalidad" value={v.nacionalidad} />
				<Row label="Estado civil" value={v.estado_civil} />
				<Row label="Localidad de nacimiento" value={v.localidad_nac} />
				<Row label="Provincia de nacimiento" value={v.provincia_nac} />
				<Row label="País de nacimiento" value={v.pais_nac} />
				<Row label="Domicilio" value={v.domicilio} />
				{(v.cud_informado || v.condicion_salud_informada) && (
					<>
						<Divider sx={{ my: 2 }} />
						<Typography variant="h6" sx={{ mb: 2 }}>
							Accesibilidad y apoyos
						</Typography>
						{v.cud_informado && <Row label="CUD informado" value="Sí" />}
						{v.condicion_salud_informada && (
							<>
								<Row label="Condición/Asistencia informada" value="Sí" />
								<Row label="Detalle" value={v.condicion_salud_detalle} />
							</>
						)}
					</>
				)}
				<Row
					label="Consentimiento expreso"
					value={v.consentimiento_datos ? "Aceptado" : "Falta aceptar"}
				/>

				<Divider sx={{ my: 2 }} />
				<Typography variant="h6" sx={{ mb: 2 }}>
					Contacto
				</Typography>
				<Row label="Email" value={v.email} />
				<Row label="Teléfono móvil" value={v.tel_movil} />
				<Row label="Teléfono fijo" value={v.tel_fijo} />
				<Row label="Tel. emergencia" value={v.emergencia_telefono} />
				<Row label="Parentesco emergencia" value={v.emergencia_parentesco} />

				<Divider sx={{ my: 2 }} />
				<Typography variant="h6" sx={{ mb: 2 }}>
					Estudios secundarios
				</Typography>
				<Row label="Título" value={v.sec_titulo} />
				<Row label="Establecimiento" value={v.sec_establecimiento} />
				<Row label="Fecha de egreso" value={fmtDate(v.sec_fecha_egreso)} />
				<Row label="Localidad" value={v.sec_localidad} />
				<Row label="Provincia" value={v.sec_provincia} />
				<Row label="País" value={v.sec_pais} />

				<Divider sx={{ my: 2 }} />
				<Typography variant="h6" sx={{ mb: 2 }}>
					Estudios superiores
				</Typography>
				<Row label="Título" value={v.sup1_titulo} />
				<Row label="Establecimiento" value={v.sup1_establecimiento} />
				<Row label="Fecha de egreso" value={fmtDate(v.sup1_fecha_egreso)} />
				<Row label="Localidad" value={v.sup1_localidad} />
				<Row label="Provincia" value={v.sup1_provincia} />
				<Row label="País" value={v.sup1_pais} />

				<Divider sx={{ my: 2 }} />
				<Typography variant="h6" sx={{ mb: 2 }}>
					Inscripción
				</Typography>
				<Row label="Carrera" value={carreraNombre} />
			</Box>
		</Box>
	);
}
