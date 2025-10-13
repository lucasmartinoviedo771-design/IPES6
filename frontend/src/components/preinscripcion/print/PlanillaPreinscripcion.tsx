import React, { forwardRef } from "react";
import { Box } from "@mui/material"; // o divs + CSS, como prefieras
import dayjs from "dayjs";

type Values = {
  apellido: string;
  nombres: string;
  dni: string;
  cuil: string;
  fecha_nacimiento: string; // ISO "1980-08-27"
  estado_civil: string;
  nacionalidad: string;
  localidad_nac: string;
  provincia_nac: string;
  pais_nac: string;
  domicilio: string;
  tel_movil?: string;
  tel_fijo?: string;
  email?: string;
  // Secundario
  sec_titulo?: string;
  sec_establecimiento?: string;
  sec_fecha_egreso?: string; // ISO
  // Superior
  sup_titulo?: string;
  sup_establecimiento?: string;
  sup_fecha_egreso?: string; // ISO
  // Laborales
  trabaja?: boolean;
  empleador?: string;
  horario_trabajo?: string;
  domicilio_trabajo?: string;
  // Carrera
  carrera?: string;
  // Para QR
  qrDataUrlTop?: string;
  qrDataUrlBottom?: string;
};

function formatDMY(iso?: string) {
  if (!iso) return "";
  return dayjs(iso).isValid() ? dayjs(iso).format("DD/MM/YYYY") : iso;
}

const PlanillaPreinscripcion = forwardRef<HTMLDivElement, { values: Values }>(
  ({ values }, ref) => {
    const {
      apellido, nombres, dni, cuil, fecha_nacimiento,
      estado_civil, nacionalidad, localidad_nac, provincia_nac, pais_nac,
      domicilio, tel_movil, tel_fijo, email,
      sec_titulo, sec_establecimiento, sec_fecha_egreso,
      sup_titulo, sup_establecimiento, sup_fecha_egreso,
      trabaja, empleador, horario_trabajo, domicilio_trabajo,
      carrera, qrDataUrlTop, qrDataUrlBottom,
    } = values;

    return (
      <div ref={ref} className="planilla-oficio">
        {/* Encabezado con QR superior */}
        <div className="encabezado">
          {qrDataUrlTop && <img className="qr qr-top" src={qrDataUrlTop} alt="QR" />}
          <div className="instituto">Instituto Provincial de Educación Superior “Paulo Freire”</div>
          <div className="titulo">PLANILLA DE PREINSCRIPCIÓN 2025</div>
          <div className="carrera">{carrera || "Carrera"}</div>
        </div>

        {/* DATOS PERSONALES */}
        <section>
          <h3>DATOS PERSONALES</h3>
          <div className="grid2">
            <div><b>Apellido y Nombres:</b> {`${apellido || ""}, ${nombres || ""}`}</div>
            <div><b>C.U.I.L.</b> {cuil}</div>
            <div><b>D.N.I.</b> {dni}</div>
            <div><b>Fecha de nacimiento:</b> {formatDMY(fecha_nacimiento)}</div>
            <div><b>Estado civil:</b> {estado_civil}</div>
            <div><b>Lugar de nacimiento:</b> {`${localidad_nac || ""}, ${provincia_nac || ""}`}</div>
            <div><b>País:</b> {pais_nac}</div>
            <div><b>Nacionalidad:</b> {nacionalidad}</div>
          </div>
        </section>

        {/* DATOS DE CONTACTO */}
        <section>
          <h3>DATOS DE CONTACTO</h3>
          <div className="grid2">
            <div><b>Domicilio:</b> {domicilio}</div>
            <div><b>Teléfono fijo:</b> {tel_fijo || "—"}</div>
            <div><b>Teléfono móvil:</b> {tel_movil || "—"}</div>
            <div><b>E-mail:</b> {email || "—"}</div>
          </div>
        </section>

        {/* DATOS LABORALES */}
        <section>
          <h3>DATOS LABORALES</h3>
          <div className="grid2">
            <div><b>¿Trabaja?</b> {trabaja ? "Sí" : "No"}</div>
            <div><b>Empleador:</b> {empleador || "—"}</div>
            <div><b>Horario:</b> {horario_trabajo || "—"}</div>
            <div><b>Domicilio de trabajo:</b> {domicilio_trabajo || "—"}</div>
          </div>
        </section>

        {/* ESTUDIOS */}
        <section>
          <h3>ESTUDIOS</h3>
          <h4>SECUNDARIO</h4>
          <div className="grid2">
            <div><b>Título:</b> {sec_titulo || "—"}</div>
            <div><b>Establecimiento:</b> {sec_establecimiento || "—"}</div>
            <div><b>Fecha de egreso:</b> {formatDMY(sec_fecha_egreso) || "—"}</div>
          </div>

          <h4>SUPERIOR (OPCIONAL)</h4>
          <div className="grid2">
            <div><b>Título:</b> {sup_titulo || "—"}</div>
            <div><b>Establecimiento:</b> {sup_establecimiento || "—"}</div>
            <div><b>Fecha de egreso:</b> {formatDMY(sup_fecha_egreso) || "—"}</div>
          </div>
        </section>

        {/* DOCUMENTACIÓN PRESENTADA (Bedelía) */}
        <section>
          <h3>DOCUMENTACIÓN PRESENTADA (A COMPLETAR POR BEDELÍA)</h3>
          <ul className="checklist">
            {
              [
                "Fotocopia legalizada del DNI",
                "Fotocopia legalizada del analítico",
                "2 fotos carnet 4×4",
                "Título secundario",
                "Certificado de alumno regular",
                "Certificado de título en trámite",
                "Certificado de buena salud",
                "3 folios oficio",
              ].map((txt) => (
                <li key={txt}><span className="box"/> {txt}</li>
              ))
            }
          </ul>
          <div className="obs">Observaciones / adeuda materias:</div>
          <div className="firmas">
            <div>Firma y aclaración del inscripto</div>
            <div>Firma, aclaración y sello del personal</div>
          </div>
        </section>

        {/* TALÓN (Comprobante) */}
        <section className="talon">
          <div className="talon-grid">
            <div><b>COMPROBANTE DE INSCRIPCIÓN DEL ALUMNO</b></div>
            {qrDataUrlBottom && <img className="qr qr-bottom" src={qrDataUrlBottom} alt="QR" />}
            <div><b>Alumno/a:</b> {`${apellido || ""}, ${nombres || ""}`}</div>
            <div><b>DNI:</b> {dni}</div>
            <div><b>Carrera:</b> {carrera || "—"}</div>
          </div>
        </section>
      </div>
    );
  }
);

export default PlanillaPreinscripcion;