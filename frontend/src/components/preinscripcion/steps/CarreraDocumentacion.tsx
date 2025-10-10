// src/components/preinscripcion/steps/CarreraDocumentacion.tsx
import React, { useId, useRef, useState } from "react";
import { Box, Button, Stack, Typography, FormControl, InputLabel, Select, MenuItem, CircularProgress } from "@mui/material";
import { useFormContext } from "react-hook-form";

type Props = {
  /** DataURL actual (para hidratar si ya había una foto guardada) */
  value?: string | null;
  /** Notifica al padre: DataURL (string) o null si se quitó */
  onFileChange?: (dataUrl: string | null) => void;
  /** Tamaño máximo permitido en bytes (por defecto 1.5MB) */
  maxBytes?: number;
  // Props para la selección de carrera
  carreras: { id: number; nombre: string }[];
  isLoading: boolean;
};

const CarreraDocumentacion: React.FC<Props> = ({
  value,
  onFileChange,
  maxBytes = 1.5 * 1024 * 1024,
  carreras,
  isLoading,
}) => {
  const { watch, setValue, formState } = useFormContext();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [preview, setPreview] = useState<string | null>(value ?? null);
  const fieldId = useId();

  const openPicker = () => inputRef.current?.click();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    if (!file) {
      if (typeof onFileChange === "function") onFileChange(null);
      setPreview(null);
      return;
    }
    if (!/^image\/(png|jpe?g)$/i.test(file.type)) {
      alert("Formato inválido. Solo JPG o PNG.");
      e.target.value = "";
      return;
    }
    if (file.size > maxBytes) {
      const mb = (maxBytes / (1024 * 1024)).toFixed(1);
      alert(`La imagen supera el tamaño máximo (${mb} MB).`);
      e.target.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === "string" ? reader.result : null;
      setPreview(dataUrl);
      if (typeof onFileChange === "function") onFileChange(dataUrl);
    };
    reader.readAsDataURL(file);
  };

  const handleRemove = () => {
    setPreview(null);
    if (inputRef.current) inputRef.current.value = "";
    if (typeof onFileChange === "function") onFileChange(null);
  };

  return (
    <Stack spacing={3}> {/* Aumentado el espaciado para separar secciones */}
      {/* Selector de Carrera */}
      <FormControl fullWidth error={!!formState.errors.carrera_id}>
        <InputLabel id="carrera-label">Carrera</InputLabel>
        <Select
          labelId="carrera-label"
          label="Carrera"
          value={watch("carrera_id") ? String(watch("carrera_id")) : ""}
          onChange={(e) =>
            setValue("carrera_id", e.target.value ? Number(e.target.value) : 0, {
              shouldValidate: true,
              shouldDirty: true,
            })
          }
          displayEmpty
          disabled={isLoading}
        >
          <MenuItem value="">
            <em>{isLoading ? "Cargando..." : "Seleccione..."}</em>
          </MenuItem>
          {carreras.map((c) => (
            <MenuItem key={c.id} value={String(c.id)}>
              {c.nombre}
            </MenuItem>
          ))}
        </Select>
        {formState.errors.carrera_id && (
          <Typography color="error" variant="caption">{String(formState.errors.carrera_id.message)}</Typography>
        )}
        {!isLoading && carreras.length === 0 && (
          <Typography variant="caption" color="text.secondary">
            No hay carreras disponibles.
          </Typography>
        )}
      </FormControl>

      {/* Subida de Foto 4x4 */}
      <Stack spacing={1}>
        <Typography variant="subtitle2" id={fieldId}>
          Foto 4x4 (JPG/PNG)
        </Typography>

        <Stack direction="row" spacing={2} alignItems="center">
          <input
            ref={inputRef}
            type="file"
            accept="image/png, image/jpeg"
            onChange={handleFileChange}
            style={{ display: "none" }}
          />
          <Button variant="outlined" onClick={openPicker}>
            Seleccionar foto 4x4 (JPG/PNG)
          </Button>
          {preview && (
            <Button color="inherit" onClick={handleRemove}>
              Quitar
            </Button>
          )}
        </Stack>

        {preview && (
          <Box
            sx={{
              mt: 1,
              width: 120,
              height: 120,
              borderRadius: 2,
              overflow: "hidden",
              boxShadow: 1,
              border: "1px solid #ddd",
            }}
          >
            <img
              src={preview}
              alt="Vista previa foto 4x4"
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          </Box>
        )}
      </Stack>
    </Stack>
  );
};

export default CarreraDocumentacion;