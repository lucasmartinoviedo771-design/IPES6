import React, { useId, useRef } from "react";
import { Box, Button, Stack, Typography, FormControl, InputLabel, Select, MenuItem } from "@mui/material";
import { useFormContext } from "react-hook-form";

type Props = {
  /** Notifica al padre: el archivo (File) o null si se quito */
  onFileChange?: (file: File | null) => void;
  /** Tamano maximo permitido en bytes (por defecto 1.5MB) */
  maxBytes?: number;
  // Props para la seleccion de carrera
  carreras: { id: number; nombre: string }[];
  isLoading: boolean;
};

const CarreraDocumentacion: React.FC<Props> = ({
  onFileChange,
  maxBytes = 1.5 * 1024 * 1024,
  carreras,
  isLoading,
}) => {
  const { watch, setValue, formState } = useFormContext();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const fieldId = useId();

  const fotoDataUrl = watch("foto_dataUrl") as string | null | undefined;

  const openPicker = () => inputRef.current?.click();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0] || null;
    if (!selectedFile) {
      if (typeof onFileChange === "function") onFileChange(null);
      setValue("foto_dataUrl", undefined, { shouldDirty: true });
      setValue("fotoW", undefined, { shouldDirty: true });
      setValue("fotoH", undefined, { shouldDirty: true });
      return;
    }

    if (!/^image\/(png|jpe?g)$/i.test(selectedFile.type)) {
      alert("Formato invalido. Solo JPG o PNG.");
      e.target.value = "";
      if (typeof onFileChange === "function") onFileChange(null);
      return;
    }

    if (selectedFile.size > maxBytes) {
      const mb = (maxBytes / (1024 * 1024)).toFixed(1);
      alert(`La imagen supera el tamano maximo (${mb} MB).`);
      e.target.value = "";
      if (typeof onFileChange === "function") onFileChange(null);
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string | null;
      if (result) {
        setValue("foto_dataUrl", result, { shouldDirty: true });
        const img = new Image();
        img.onload = () => {
          setValue("fotoW", img.width, { shouldDirty: true });
          setValue("fotoH", img.height, { shouldDirty: true });
        };
        img.src = result;
      } else {
        setValue("foto_dataUrl", undefined, { shouldDirty: true });
        setValue("fotoW", undefined, { shouldDirty: true });
        setValue("fotoH", undefined, { shouldDirty: true });
      }
    };
    reader.readAsDataURL(selectedFile);

    if (typeof onFileChange === "function") onFileChange(selectedFile);
  };

  const handleRemove = () => {
    if (inputRef.current) inputRef.current.value = "";
    setValue("foto_dataUrl", undefined, { shouldDirty: true });
    setValue("fotoW", undefined, { shouldDirty: true });
    setValue("fotoH", undefined, { shouldDirty: true });
    if (typeof onFileChange === "function") onFileChange(null);
  };

  return (
    <Stack spacing={3}>
      {/* Selector de Carrera */}
      <FormControl fullWidth error={!!formState.errors.carrera_id}>
        <InputLabel id="carrera-label">Carrera</InputLabel>
        <Select
          labelId="carrera-label"
          label="Carrera"
          value={watch("carrera_id") || 0}
          onChange={(e) =>
            setValue("carrera_id", Number(e.target.value) || 0, {
              shouldValidate: true,
              shouldDirty: true,
            })
          }
          displayEmpty
          disabled={isLoading}
        >
          <MenuItem value={0} disabled>
            <em>{isLoading ? "Cargando..." : "Seleccione..."}</em>
          </MenuItem>
          {carreras.map((c) => (
            <MenuItem key={c.id} value={c.id}>
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
          {fotoDataUrl && (
            <Button color="inherit" onClick={handleRemove}>
              Quitar
            </Button>
          )}
        </Stack>

        {fotoDataUrl && (
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
              src={fotoDataUrl}
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
