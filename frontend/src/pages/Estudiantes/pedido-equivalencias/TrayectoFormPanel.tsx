import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import FormControl from "@mui/material/FormControl";
import FormHelperText from "@mui/material/FormHelperText";
import Grid from "@mui/material/Grid";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import DownloadIcon from "@mui/icons-material/Download";
import SaveIcon from "@mui/icons-material/Save";
import { SectionTitlePill } from "@/components/ui/GradientTitles";
import { TrayectoriaCarreraDetalleDTO } from "@/api/estudiantes";
import { FormState, FormType, MateriaRow } from "./types";
import MateriasTable from "./MateriasTable";

interface TrayectoFormPanelProps {
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
  materias: MateriaRow[];
  selectedId: number | null;
  puedeEditar: boolean;
  datosDeshabilitados: boolean;
  esAnexoA: boolean;
  esAnexoB: boolean;
  puedeGuardar: boolean;
  puedeDescargar: boolean;
  saving: boolean;
  descargando: boolean;
  carrerasDestino: { id: number; nombre: string }[];
  carrerasEstudiante: TrayectoriaCarreraDetalleDTO[];
  carrerasLoading: boolean;
  planesOrigenDisponibles: any[];
  trayectoriaLoading: boolean;
  selectedPedido: any;
  onMateriaChange: (index: number, field: keyof MateriaRow, value: string) => void;
  onAddMateria: () => void;
  onRemoveMateria: (index: number) => void;
  onGuardar: () => void;
  onDescargar: () => void;
  setAutoFillKey?: (key: string) => void;
}

export default function TrayectoFormPanel({
  form, setForm, materias, selectedId, puedeEditar,
  datosDeshabilitados, esAnexoA, esAnexoB,
  puedeGuardar, puedeDescargar, saving, descargando,
  carrerasDestino, carrerasEstudiante, carrerasLoading, planesOrigenDisponibles,
  trayectoriaLoading, selectedPedido,
  onMateriaChange, onAddMateria, onRemoveMateria, onGuardar, onDescargar,
  setAutoFillKey,
}: TrayectoFormPanelProps) {
  return (
    <Stack spacing={3}>
      <Card variant="outlined">
        <CardContent>
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <TextField
                select
                label="Tipo de formulario"
                value={form.tipo}
                onChange={(event) => {
                  const value = event.target.value as FormType;
                  setForm((prev) => ({ ...prev, tipo: value }));
                }}
                fullWidth
                size="small"
              >
                <MenuItem value="">Seleccioná una opción</MenuItem>
                <MenuItem value="ANEXO_A">Anexo A - Interno IPES</MenuItem>
                <MenuItem value="ANEXO_B">Anexo B - Otra institución</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                label="Ciclo lectivo"
                value={form.cicloLectivo}
                onChange={(event) => setForm((prev) => ({ ...prev, cicloLectivo: event.target.value }))}
                fullWidth
                size="small"
                disabled={datosDeshabilitados}
              />
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      <Box
        sx={{
          opacity: datosDeshabilitados ? 0.5 : 1,
          pointerEvents: datosDeshabilitados ? "none" : "auto",
          transition: "opacity 0.2s ease",
        }}
      >
        <SectionTitlePill title="Datos del trayecto" />
        <Card variant="outlined" sx={{ mb: 3 }}>
          <CardContent>
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth size="small" disabled={datosDeshabilitados || !puedeEditar}>
                  <InputLabel>Profesorado destino (IPES)</InputLabel>
                  <Select
                    label="Profesorado destino (IPES)"
                    value={form.profesoradoDestinoId}
                    onChange={(event) => {
                      const value = String(event.target.value);
                      const seleccionado = carrerasDestino.find((item) => String(item.id) === value);
                      setForm((prev) => ({
                        ...prev,
                        profesoradoDestinoId: value,
                        profesoradoDestinoNombre: seleccionado?.nombre || "",
                      }));
                    }}
                  >
                    <MenuItem value="">Seleccioná...</MenuItem>
                    {carrerasDestino.map((item) => (
                      <MenuItem key={item.id} value={String(item.id)}>
                        {item.nombre}
                      </MenuItem>
                    ))}
                  </Select>
                  <FormHelperText>
                    El nombre seleccionado se utilizará en la nota final.
                  </FormHelperText>
                </FormControl>
              </Grid>
              <Grid item xs={12}>
                <TextField
                  label="Resolución destino"
                  value={form.planDestinoResolucion}
                  fullWidth
                  size="small"
                  InputProps={{ readOnly: true }}
                  disabled
                  helperText="Se completa automáticamente con el plan vigente."
                />
              </Grid>

              {esAnexoA && (
                <>
                  <Grid item xs={12} md={6}>
                    <FormControl
                      fullWidth
                      size="small"
                      disabled={datosDeshabilitados || !puedeEditar || carrerasLoading || carrerasEstudiante.length === 0}
                    >
                      <InputLabel>Profesorado de origen (IPES)</InputLabel>
                      <Select
                        label="Profesorado de origen (IPES)"
                        value={form.profesoradoOrigenId}
                        onChange={(event) => {
                          const value = String(event.target.value);
                          const carrera = carrerasEstudiante.find((item) => String(item.profesorado_id) === value);
                          setForm((prev) => ({
                            ...prev,
                            profesoradoOrigenId: value,
                            profesoradoOrigenNombre: carrera?.nombre || "",
                            planOrigenId: "",
                            planOrigenResolucion: "",
                          }));
                          setAutoFillKey?.("");
                        }}
                      >
                        <MenuItem value="">Seleccioná...</MenuItem>
                        {carrerasEstudiante.map((carrera) => (
                          <MenuItem key={carrera.profesorado_id} value={String(carrera.profesorado_id)}>
                            {carrera.nombre}
                          </MenuItem>
                        ))}
                      </Select>
                      <FormHelperText>Se tomará como profesorado de origen acreditado.</FormHelperText>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <FormControl fullWidth size="small" disabled={datosDeshabilitados || !puedeEditar || !planesOrigenDisponibles.length}>
                      <InputLabel>Plan / resolución de origen</InputLabel>
                      <Select
                        label="Plan / resolución de origen"
                        value={form.planOrigenId}
                        onChange={(event) => {
                          const value = String(event.target.value);
                          const plan = planesOrigenDisponibles.find((item) => String(item.id) === value);
                          setForm((prev) => ({
                            ...prev,
                            planOrigenId: value,
                            planOrigenResolucion: plan?.resolucion || `Plan ${plan?.id ?? ""}`,
                          }));
                          setAutoFillKey?.("");
                        }}
                      >
                        <MenuItem value="">Seleccioná...</MenuItem>
                        {planesOrigenDisponibles.map((plan) => (
                          <MenuItem key={plan.id} value={String(plan.id)}>
                            {plan.resolucion || `Plan ${plan.id}`} {plan.vigente ? "(vigente)" : ""}
                          </MenuItem>
                        ))}
                      </Select>
                      <FormHelperText>
                        Resolución seleccionada: {form.planOrigenResolucion || "—"}
                      </FormHelperText>
                    </FormControl>
                  </Grid>
                </>
              )}

              {esAnexoB && (
                <>
                  <Grid item xs={12} md={4}>
                    <TextField
                      label="Establecimiento de origen"
                      value={form.establecimientoOrigen}
                      onChange={(event) => setForm((prev) => ({ ...prev, establecimientoOrigen: event.target.value }))}
                      fullWidth
                      size="small"
                      disabled={datosDeshabilitados || !puedeEditar}
                    />
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <TextField
                      label="Ciudad / localidad"
                      value={form.establecimientoLocalidad}
                      onChange={(event) => setForm((prev) => ({ ...prev, establecimientoLocalidad: event.target.value }))}
                      fullWidth
                      size="small"
                      disabled={datosDeshabilitados || !puedeEditar}
                    />
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <TextField
                      label="Provincia"
                      value={form.establecimientoProvincia}
                      onChange={(event) => setForm((prev) => ({ ...prev, establecimientoProvincia: event.target.value }))}
                      fullWidth
                      size="small"
                      disabled={datosDeshabilitados || !puedeEditar}
                    />
                  </Grid>
                </>
              )}
            </Grid>
          </CardContent>
        </Card>

        <SectionTitlePill title="Detalle de espacios curriculares" />
        {trayectoriaLoading && esAnexoA && (
          <Alert severity="info" sx={{ mb: 2 }}>
            Cargando espacios aprobados del plan de origen...
          </Alert>
        )}
        <MateriasTable
          materias={materias}
          datosDeshabilitados={datosDeshabilitados}
          puedeEditar={puedeEditar}
          onMateriaChange={onMateriaChange}
          onAddMateria={onAddMateria}
          onRemoveMateria={onRemoveMateria}
        />

        {selectedPedido && !selectedPedido.puede_editar && (
          <Alert severity="info" sx={{ mt: 2 }}>
            Este pedido ya fue finalizado. Sólo el personal autorizado puede modificarlo.
          </Alert>
        )}

        <Stack direction="row" spacing={2} justifyContent="flex-end" sx={{ mt: 3 }}>
          <Button
            variant="outlined"
            startIcon={<SaveIcon />}
            onClick={onGuardar}
            disabled={!puedeGuardar || saving}
          >
            {selectedId ? "Guardar cambios" : "Guardar borrador"}
          </Button>
          <Button
            variant="contained"
            startIcon={<DownloadIcon />}
            onClick={onDescargar}
            disabled={!puedeDescargar || descargando}
          >
            Descargar nota
          </Button>
        </Stack>
        {!selectedId && (
          <Typography variant="caption" color="text.secondary">
            Guardá el pedido para habilitar la descarga del PDF.
          </Typography>
        )}
      </Box>
    </Stack>
  );
}
