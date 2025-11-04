import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  CardActions,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControlLabel,
  Checkbox,
  Alert,
  CircularProgress,
} from '@mui/material';
import { useForm, Controller } from 'react-hook-form';
import { useMutation } from '@tanstack/react-query';
import { enqueueSnackbar } from 'notistack';
import { uploadEstudiantes, uploadFoliosFinales, uploadEquivalencias } from '@/api/primeraCarga'; // Will create this API file
import PlanillaRegularidadDialog from './PlanillaRegularidadDialog';

interface UploadDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description: string;
  uploadFunction: (data: { file: File, dry_run: boolean }) => Promise<any>;
  exampleFileName: string;
}

const UploadDialog: React.FC<UploadDialogProps> = ({
  open,
  onClose,
  title,
  description,
  uploadFunction,
  exampleFileName,
}) => {
  const { control, handleSubmit, register, reset, formState: { errors } } = useForm<{ file: FileList, dry_run: boolean }>();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const mutation = useMutation({
    mutationFn: uploadFunction,
    onSuccess: (data) => {
      if (data.ok) {
        enqueueSnackbar(data.message, { variant: 'success' });
        // Optionally, show detailed results in a separate dialog or downloadable file
        if (data.data.errors && data.data.errors.length > 0) {
          // Handle downloadable error details
          const errorBlob = new Blob([data.data.errors.join('\n')], { type: 'text/plain' });
          const errorUrl = URL.createObjectURL(errorBlob);
          const a = document.createElement('a');
          a.href = errorUrl;
          a.download = `errores_${exampleFileName.replace('.csv', '')}_${new Date().toISOString()}.txt`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(errorUrl);
        }
      } else {
        enqueueSnackbar(data.message || 'Error en la importacion.', { variant: 'error' });
        if (data.data.errors && data.data.errors.length > 0) {
          const errorBlob = new Blob([data.data.errors.join('\n')], { type: 'text/plain' });
          const errorUrl = URL.createObjectURL(errorBlob);
          const a = document.createElement('a');
          a.href = errorUrl;
          a.download = `errores_${exampleFileName.replace('.csv', '')}_${new Date().toISOString()}.txt`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(errorUrl);
        }
      }
      reset();
      setSelectedFile(null);
      onClose();
    },
    onError: (error: any) => {
      enqueueSnackbar(error.response?.data?.message || 'Error de red o servidor.', { variant: 'error' });
    },
  });

  const onSubmit = (data: { file: FileList, dry_run: boolean }) => {
    if (data.file.length > 0) {
      mutation.mutate({ file: data.file[0], dry_run: data.dry_run });
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      setSelectedFile(event.target.files[0]);
    } else {
      setSelectedFile(null);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" mb={2}>
          {description}
        </Typography>
        <Box component="form" onSubmit={handleSubmit(onSubmit)} id={`upload-form-${title}`} noValidate>
          <Controller
            name="file"
            control={control}
            rules={{ required: 'Debe seleccionar un archivo.' }}
            render={({ field }) => (
              <TextField
                type="file"
                fullWidth
                margin="normal"
                label="Seleccionar archivo CSV/Excel"
                InputLabelProps={{ shrink: true }}
                inputProps={{ accept: '.csv' }}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                  field.onChange(e.target.files);
                  handleFileChange(e);
                }}
                error={!!errors.file}
                helperText={errors.file?.message}
              />
            )}
          />
          {selectedFile && (
            <Typography variant="body2" color="text.secondary" mt={1}>
              Archivo seleccionado: {selectedFile.name} ({ (selectedFile.size / 1024 / 1024).toFixed(2) } MB)
            </Typography>
          )}
          <FormControlLabel
            control={<Checkbox {...register('dry_run')} />}
            label="Simular (no guardar cambios)"
            sx={{ mt: 2 }}
          />
          <Box mt={2}>
            <Typography variant="body2" color="text.secondary">
              Descargar ejemplo: <a href={`/examples/${exampleFileName}`} download>{exampleFileName}</a>
            </Typography>
          </Box>
        </Box>
        {mutation.isError && <Alert severity="error" sx={{ mt: 2 }}>{mutation.error.message}</Alert>}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={mutation.isPending}>Cancelar</Button>
        <Button
          type="submit"
          form={`upload-form-${title}`}
          variant="contained"
          disabled={mutation.isPending || !selectedFile}
        >
          {mutation.isPending ? <CircularProgress size={24} /> : 'Procesar'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

const PrimeraCargaPage: React.FC = () => {
  const navigate = useNavigate();
  const [openDialog, setOpenDialog] = useState<string | null>(null);
  const [openPlanillaDialog, setOpenPlanillaDialog] = useState(false);

  const handleCardClick = (type: string) => {
    setOpenDialog(type);
  };

  const handleCloseDialog = () => {
    setOpenDialog(null);
  };

  const handleOpenPlanillaDialog = () => {
    setOpenPlanillaDialog(true);
  };

  const handleClosePlanillaDialog = () => {
    setOpenPlanillaDialog(false);
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Primera Carga de Datos
      </Typography>
      <Typography variant="body1" color="text.secondary" mb={4}>
        Utilice esta sección para realizar cargas masivas de datos iniciales al sistema.
        Cada tipo de carga tiene un formato específico de archivo (CSV/Excel).
      </Typography>

      <Grid container spacing={3}>
        <Grid item xs={12} sm={6} md={4}>
          <Card variant="outlined">
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Carga de Estudiantes
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Importa información de nuevos estudiantes, incluyendo datos personales y de usuario.
              </Typography>
            </CardContent>
            <CardActions>
              <Button size="small" onClick={() => handleCardClick('estudiantes')}>
                Cargar Estudiantes
              </Button>
            </CardActions>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={4}>
          <Card variant="outlined">
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Carga de Regularidades
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Genera planillas para registrar las regularidades de los estudiantes en las materias.
              </Typography>
            </CardContent>
            <CardActions>
              <Button size="small" onClick={handleOpenPlanillaDialog}>
                Generar planilla
              </Button>
              <Button size="small" onClick={() => navigate('/admin/primera-carga/actas-examen')}>
                Cargar acta de examen
              </Button>
            </CardActions>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={4}>
          <Card variant="outlined">
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Carga de Folios Finales
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Asigna números de folio y libro a las inscripciones de mesas de examen.
              </Typography>
            </CardContent>
            <CardActions>
              <Button size="small" onClick={() => handleCardClick('folios-finales')}>
                Cargar Folios Finales
              </Button>
            </CardActions>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={4}>
          <Card variant="outlined">
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Carga de Equivalencias
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Registra las equivalencias curriculares entre materias.
              </Typography>
            </CardContent>
            <CardActions>
              <Button size="small" onClick={() => handleCardClick('equivalencias')}>
                Cargar Equivalencias
              </Button>
            </CardActions>
          </Card>
        </Grid>
      </Grid>

      <UploadDialog
        open={openDialog === 'estudiantes'}
        onClose={handleCloseDialog}
        title="Cargar Estudiantes"
        description="Suba un archivo CSV/Excel con la informacion de los estudiantes a importar."
        uploadFunction={uploadEstudiantes}
        exampleFileName="ejemplo_estudiantes.csv"
      />
      <UploadDialog
        open={openDialog === 'folios-finales'}
        onClose={handleCloseDialog}
        title="Cargar Folios Finales"
        description="Suba un archivo CSV/Excel para asignar folios y libros a las inscripciones de mesas."
        uploadFunction={uploadFoliosFinales}
        exampleFileName="ejemplo_folios_finales.csv"
      />
      <UploadDialog
        open={openDialog === 'equivalencias'}
        onClose={handleCloseDialog}
        title="Cargar Equivalencias"
        description="Suba un archivo CSV/Excel con las equivalencias curriculares."
        uploadFunction={uploadEquivalencias}
        exampleFileName="ejemplo_equivalencias.csv"
      />
      <PlanillaRegularidadDialog open={openPlanillaDialog} onClose={handleClosePlanillaDialog} />
    </Box>
  );
};

export default PrimeraCargaPage;
