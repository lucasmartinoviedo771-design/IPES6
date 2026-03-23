import Stack from "@mui/material/Stack";
import Divider from "@mui/material/Divider";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import Select from "@mui/material/Select";
import Checkbox from "@mui/material/Checkbox";
import FormControlLabel from "@mui/material/FormControlLabel";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { Controller, Control, UseFormHandleSubmit, UseFormWatch } from "react-hook-form";
import { DetailFormValues, DetailDocumentacionForm, ESTADO_OPTIONS, generoOptions } from "../types";
import { DocumentacionSection } from "./DocumentacionSection";

type Props = {
  control: Control<DetailFormValues>;
  handleSubmit: UseFormHandleSubmit<DetailFormValues>;
  watch: UseFormWatch<DetailFormValues>;
  setValue: (name: any, value: any, options?: any) => void;
  onSubmit: (values: DetailFormValues) => void;
  anioIngresoOptions: string[];
  docValues: DetailDocumentacionForm;
  anyMainSelected: boolean;
  handleMainDocChange: (target: keyof DetailDocumentacionForm) => (_: unknown, checked: boolean) => void;
  handleAdeudaChange: (_: unknown, checked: boolean) => void;
  handleEstudianteRegularChange: (_: unknown, checked: boolean) => void;
};

export function EstudianteDetailForm({
  control,
  handleSubmit,
  watch,
  setValue,
  onSubmit,
  anioIngresoOptions,
  docValues,
  anyMainSelected,
  handleMainDocChange,
  handleAdeudaChange,
  handleEstudianteRegularChange,
}: Props) {
  return (
    <form id="estudiante-admin-form" onSubmit={handleSubmit(onSubmit)}>
      <Stack spacing={2}>
        <Divider>Datos Personales</Divider>
        <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
          <Controller
            name="dni"
            control={control}
            render={({ field }) => (
              <TextField {...field} label="DNI" size="small" fullWidth />
            )}
          />
          <Controller
            name="cuil"
            control={control}
            render={({ field }) => (
              <TextField {...field} label="CUIL" size="small" fullWidth />
            )}
          />
        </Stack>
        <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
          <Controller
            name="apellido"
            control={control}
            render={({ field }) => (
              <TextField {...field} label="Apellido" size="small" fullWidth />
            )}
          />
          <Controller
            name="nombre"
            control={control}
            render={({ field }) => (
              <TextField {...field} label="Nombre" size="small" fullWidth />
            )}
          />
        </Stack>
        <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
          <Controller
            name="fecha_nacimiento"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                label="Fecha de nacimiento"
                size="small"
                placeholder="DD/MM/AAAA"
                fullWidth
              />
            )}
          />
          <Controller
            name="genero"
            control={control}
            render={({ field }) => (
              <TextField {...field} select label="Genero" size="small" fullWidth>
                {generoOptions.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </TextField>
            )}
          />
        </Stack>
        <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
          <Controller
            name="nacionalidad"
            control={control}
            render={({ field }) => (
              <TextField {...field} label="Nacionalidad" size="small" fullWidth />
            )}
          />
          <Controller
            name="estado_civil"
            control={control}
            render={({ field }) => (
              <TextField {...field} label="Estado Civil" size="small" fullWidth />
            )}
          />
        </Stack>

        <Divider>Lugar de Nacimiento</Divider>
        <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
          <Controller
            name="localidad_nac"
            control={control}
            render={({ field }) => (
              <TextField {...field} label="Localidad de Nacimiento" size="small" fullWidth />
            )}
          />
          <Controller
            name="provincia_nac"
            control={control}
            render={({ field }) => (
              <TextField {...field} label="Provincia de Nacimiento" size="small" fullWidth />
            )}
          />
          <Controller
            name="pais_nac"
            control={control}
            render={({ field }) => (
              <TextField {...field} label="País de Nacimiento" size="small" fullWidth />
            )}
          />
        </Stack>

        <Divider>Contacto y Domicilio</Divider>
        <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
          <Controller
            name="telefono"
            control={control}
            render={({ field }) => (
              <TextField {...field} label="Teléfono / Celular" size="small" fullWidth />
            )}
          />
          <Controller
            name="domicilio"
            control={control}
            render={({ field }) => (
              <TextField {...field} label="Domicilio" size="small" fullWidth />
            )}
          />
        </Stack>
        <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
          <Controller
            name="emergencia_telefono"
            control={control}
            render={({ field }) => (
              <TextField {...field} label="Teléfono de Emergencia" size="small" fullWidth />
            )}
          />
          <Controller
            name="emergencia_parentesco"
            control={control}
            render={({ field }) => (
              <TextField {...field} label="Parentesco Emergencia" size="small" fullWidth />
            )}
          />
        </Stack>

        <Divider>Estudios Secundarios</Divider>
        <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
          <Controller
            name="sec_titulo"
            control={control}
            render={({ field }) => (
              <TextField {...field} label="Título Secundario" size="small" fullWidth />
            )}
          />
          <Controller
            name="sec_establecimiento"
            control={control}
            render={({ field }) => (
              <TextField {...field} label="Establecimiento" size="small" fullWidth />
            )}
          />
        </Stack>
        <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
          <Controller
            name="sec_fecha_egreso"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                label="Fecha Egreso"
                size="small"
                fullWidth
                placeholder="DD/MM/AAAA"
              />
            )}
          />
          <Controller
            name="sec_localidad"
            control={control}
            render={({ field }) => (
              <TextField {...field} label="Localidad" size="small" fullWidth />
            )}
          />
        </Stack>
        <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
          <Controller
            name="sec_provincia"
            control={control}
            render={({ field }) => (
              <TextField {...field} label="Provincia" size="small" fullWidth />
            )}
          />
          <Controller
            name="sec_pais"
            control={control}
            render={({ field }) => (
              <TextField {...field} label="País" size="small" fullWidth />
            )}
          />
        </Stack>

        <Divider>Estudios Superiores</Divider>
        <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
          <Controller
            name="sup1_titulo"
            control={control}
            render={({ field }) => (
              <TextField {...field} label="Título Superior" size="small" fullWidth />
            )}
          />
          <Controller
            name="sup1_establecimiento"
            control={control}
            render={({ field }) => (
              <TextField {...field} label="Establecimiento" size="small" fullWidth />
            )}
          />
        </Stack>
        <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
          <Controller
            name="sup1_fecha_egreso"
            control={control}
            render={({ field }) => (
              <TextField {...field} label="Fecha Egreso" type="date" size="small" fullWidth InputLabelProps={{ shrink: true }} />
            )}
          />
          <Controller
            name="sup1_localidad"
            control={control}
            render={({ field }) => (
              <TextField {...field} label="Localidad" size="small" fullWidth />
            )}
          />
        </Stack>

        <Divider>Datos Laborales</Divider>
        <Stack direction="row" spacing={2} alignItems="center">
          <Controller
            name="trabaja"
            control={control}
            render={({ field }) => (
              <FormControlLabel
                control={<Checkbox checked={field.value} onChange={(e) => field.onChange(e.target.checked)} />}
                label="¿Trabaja?"
              />
            )}
          />
          <Controller
            name="empleador"
            control={control}
            render={({ field }) => (
              <TextField {...field} label="Empleador" size="small" fullWidth disabled={!watch("trabaja")} />
            )}
          />
        </Stack>
        <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
          <Controller
            name="horario_trabajo"
            control={control}
            render={({ field }) => (
              <TextField {...field} label="Horario de Trabajo" size="small" fullWidth disabled={!watch("trabaja")} />
            )}
          />
          <Controller
            name="domicilio_trabajo"
            control={control}
            render={({ field }) => (
              <TextField {...field} label="Domicilio de Trabajo" size="small" fullWidth disabled={!watch("trabaja")} />
            )}
          />
        </Stack>

        <Divider>Accesibilidad y Salud</Divider>
        <Stack direction="row" spacing={2} flexWrap="wrap">
          <Controller
            name="cud_informado"
            control={control}
            render={({ field }) => (
              <FormControlLabel
                control={<Checkbox checked={field.value} onChange={(e) => field.onChange(e.target.checked)} />}
                label="Posee CUD"
              />
            )}
          />
          <Controller
            name="condicion_salud_informada"
            control={control}
            render={({ field }) => (
              <FormControlLabel
                control={<Checkbox checked={field.value} onChange={(e) => field.onChange(e.target.checked)} />}
                label="Informa condición de salud"
              />
            )}
          />
        </Stack>
        <Controller
          name="condicion_salud_detalle"
          control={control}
          render={({ field }) => (
            <TextField {...field} label="Detalle condición de salud / Apoyo necesario" size="small" multiline rows={2} fullWidth />
          )}
        />

        <Divider>Estado de Legajo y Sistema</Divider>
        <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
          <Controller
            name="estado_legajo"
            control={control}
            render={({ field }) => (
              <FormControl size="small" fullWidth disabled>
                <InputLabel>Estado legajo</InputLabel>
                <Select {...field} label="Estado legajo">
                  {ESTADO_OPTIONS.filter((option) => option.value).map((option) => (
                    <MenuItem key={option.value} value={option.value}>
                      {option.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}
          />
          <Controller
            name="anio_ingreso"
            control={control}
            render={({ field }) => (
              <TextField {...field} select label="Año de ingreso" size="small" fullWidth>
                <MenuItem value="">Sin especificar</MenuItem>
                {anioIngresoOptions.map((option) => (
                  <MenuItem key={option} value={option}>
                    {option}
                  </MenuItem>
                ))}
              </TextField>
            )}
          />
        </Stack>

        <Stack direction="row" spacing={2} flexWrap="wrap">
          <Controller
            name="must_change_password"
            control={control}
            render={({ field }) => (
              <FormControlLabel
                control={<Checkbox checked={field.value} onChange={(e) => field.onChange(e.target.checked)} />}
                label="Forzar cambio de clave"
              />
            )}
          />
          <Controller
            name="activo"
            control={control}
            render={({ field }) => (
              <FormControlLabel
                control={<Checkbox checked={field.value} onChange={(e) => field.onChange(e.target.checked)} color="primary" />}
                label="Cuenta Activa"
              />
            )}
          />
        </Stack>

        <Controller
          name="observaciones"
          control={control}
          render={({ field }) => (
            <TextField {...field} label="Observaciones Administrativas" size="small" multiline rows={2} fullWidth />
          )}
        />

        <Box>
          <Typography variant="subtitle1" fontWeight={700} gutterBottom>
            Seguimiento general
          </Typography>
          <Stack direction="row" spacing={2} flexWrap="wrap">
            <Controller
              name="curso_introductorio_aprobado"
              control={control}
              render={({ field }) => (
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={Boolean(field.value)}
                      onChange={(event) => field.onChange(event.target.checked)}
                    />
                  }
                  label="Curso introductorio aprobado"
                />
              )}
            />
            <Controller
              name="libreta_entregada"
              control={control}
              render={({ field }) => (
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={Boolean(field.value)}
                      onChange={(event) => field.onChange(event.target.checked)}
                    />
                  }
                  label="Libreta entregada"
                />
              )}
            />
          </Stack>
        </Box>

        <DocumentacionSection
          docValues={docValues}
          anyMainSelected={anyMainSelected}
          control={control}
          setValue={setValue}
          handleMainDocChange={handleMainDocChange}
          handleAdeudaChange={handleAdeudaChange}
          handleEstudianteRegularChange={handleEstudianteRegularChange}
        />
      </Stack>
    </form>
  );
}
