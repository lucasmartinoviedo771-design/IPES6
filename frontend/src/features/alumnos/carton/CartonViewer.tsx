import { useRef } from 'react';
import {
  Box,
  Paper,
  Button,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Grid,
  Stack,
  Divider,
} from '@mui/material';
import { Download, Print } from '@mui/icons-material';
import { useSnackbar } from 'notistack';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

import { CartonData } from '@/types/carton';
import { formatDateToDDMMYY } from '@/utils/dates';

interface CartonViewerProps {
  data: CartonData;
}

const formatDisplay = (value?: string | number | null): string => {
  if (value === null || value === undefined) return '-';
  const text = String(value).trim();
  return text.length ? text : '-';
};

const formatBooleanLabel = (value?: boolean | null, trueLabel = 'Sí', falseLabel = 'No'): string => {
  if (value === null || value === undefined) return 'No informado';
  return value ? trueLabel : falseLabel;
};

export const CartonViewer = ({ data }: CartonViewerProps) => {
  const cartonRef = useRef<HTMLDivElement>(null);
  const { enqueueSnackbar } = useSnackbar();

  const handleDownloadPDF = async () => {
    if (!cartonRef.current) return;

    enqueueSnackbar('Generando PDF...', { variant: 'info' });

    try {
      const canvas = await html2canvas(cartonRef.current, {
        scale: 2,
        useCORS: true,
        logging: false,
      });

      const imgData = canvas.toDataURL('image/png');
      const imgWidth = 210;
      const pageHeight = 295;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;

      const pdf = new jsPDF('p', 'mm', 'a4');
      let position = 0;

      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      const safeName = data.studentInfo.apellidoNombre.replace(/\s+/g, '_');
      pdf.save(`Carton_${safeName}.pdf`);
      enqueueSnackbar('PDF descargado exitosamente', { variant: 'success' });
    } catch (error) {
      console.error('Error generando PDF:', error);
      enqueueSnackbar('Error al generar el PDF', { variant: 'error' });
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const headerStyles = {
    textAlign: 'center' as const,
    mb: 3,
    pb: 2,
    borderBottom: '2px solid',
    borderColor: 'primary.main',
  };
  const sectionTitleStyles = {
    backgroundColor: 'primary.main',
    color: 'primary.contrastText',
    px: 2,
    py: 1,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
  };
  const labelStyles = { fontSize: '0.75rem', fontWeight: 700, color: 'primary.dark' };
  const valueStyles = { fontSize: '0.95rem' };

  const personalInfo = [
    { label: 'Apellido y Nombre', value: data.studentInfo.apellidoNombre },
    { label: 'DNI Nº', value: data.studentInfo.dni },
    { label: 'Tel. Nº', value: data.studentInfo.telefono },
    { label: 'Mail', value: data.studentInfo.email },
    { label: 'Lugar de Nacimiento', value: data.studentInfo.lugarNacimiento },
    {
      label: 'Fecha de Nacimiento',
      value: data.studentInfo.fechaNacimiento ? formatDateToDDMMYY(data.studentInfo.fechaNacimiento) : undefined,
    },
  ];

  const administrativeInfo = [
    { label: 'Curso Introductorio', value: data.studentInfo.cursoIntroductorio },
    { label: 'Promedio Gral.', value: data.studentInfo.promedioGeneral },
    { label: 'Libreta', value: formatBooleanLabel(data.studentInfo.libretaEntregada, 'Entregada', 'No entregada') },
    { label: 'Legajo', value: data.studentInfo.legajo },
    { label: 'Estado Legajo', value: data.studentInfo.legajoEstado },
    { label: 'Cohorte', value: data.studentInfo.cohorte },
    { label: 'Activo', value: formatBooleanLabel(data.studentInfo.activo, 'SI', 'NO') },
  ];

  const materiasTotales = data.studentInfo.materiasTotales ?? null;
  const materiasAprobadas = data.studentInfo.materiasAprobadas ?? null;
  const materiasRegularizadas = data.studentInfo.materiasRegularizadas ?? null;
  const materiasEnCurso = data.studentInfo.materiasEnCurso ?? null;

  const summaryCards = [
    {
      title: 'Materias aprobadas',
      value:
        materiasAprobadas !== null && materiasTotales !== null
          ? `${materiasAprobadas} de ${materiasTotales}`
          : formatDisplay(materiasAprobadas),
    },
    {
      title: 'Materias regularizadas (sin final)',
      value: formatDisplay(materiasRegularizadas),
    },
    {
      title: 'Materias en curso',
      value: formatDisplay(materiasEnCurso),
    },
  ];

  return (
    <Stack spacing={3}>
      <Stack direction="row" spacing={2} justifyContent="flex-end" sx={{ '@media print': { display: 'none' } }}>
        <Button onClick={handlePrint} variant="outlined" startIcon={<Print />}>
          Imprimir
        </Button>
        <Button onClick={handleDownloadPDF} variant="contained" startIcon={<Download />}>
          Descargar PDF
        </Button>
      </Stack>

      <Box ref={cartonRef} sx={{ backgroundColor: 'background.paper', p: { xs: 2, md: 4 } }}>
        <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', p: { xs: 2, md: 4 } }}>
          <Box sx={headerStyles}>
            <Typography variant="h4" component="h1" fontWeight={800} color="primary.dark">
              Registro Académico
            </Typography>
            {data.profesoradoNombre && (
              <Typography variant="body1" color="text.secondary">
                {data.profesoradoNombre}
              </Typography>
            )}
            {data.planResolucion && (
              <Typography variant="body2" color="text.secondary">
                Plan {data.planResolucion}
              </Typography>
            )}
          </Box>
          <Typography
            variant="body2"
            color="error.main"
            sx={{
              fontWeight: 700,
              textTransform: 'uppercase',
              textAlign: 'center',
              mt: 1,
              mb: 3,
            }}
          >
            Registro académico sin validez administrativa. No tomar como documento definitivo de notas.
          </Typography>

          <Paper variant="outlined" sx={{ p: 3, mb: 4, backgroundColor: 'grey.50' }}>
            <Grid container spacing={3}>
              <Grid item xs={12} md={3} sx={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-start' }}>
                <Box
                  sx={{
                    width: 128,
                    height: 160,
                    border: '2px solid',
                    borderColor: 'primary.light',
                    borderRadius: 2,
                    overflow: 'hidden',
                    backgroundColor: 'grey.200',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {data.studentInfo.fotoUrl ? (
                    <img
                      src={data.studentInfo.fotoUrl}
                      alt={`Foto de ${data.studentInfo.apellidoNombre}`}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  ) : (
                    <Typography variant="caption" color="text.secondary" textAlign="center">
                      Sin foto
                    </Typography>
                  )}
                </Box>
              </Grid>

              <Grid item xs={12} md={9}>
                <Stack spacing={3}>
                  <Box>
                    <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>
                      Datos personales
                    </Typography>
                    <Grid container spacing={2}>
                      {personalInfo.map((item) => (
                        <Grid item xs={12} sm={6} md={4} key={item.label}>
                          <Typography sx={labelStyles}>{item.label}</Typography>
                          <Typography sx={valueStyles}>{formatDisplay(item.value)}</Typography>
                        </Grid>
                      ))}
                    </Grid>
                  </Box>

                  <Box>
                    <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>
                      Datos administrativos
                    </Typography>
                    <Grid container spacing={2}>
                      {administrativeInfo.map((item) => (
                        <Grid item xs={12} sm={6} md={4} key={item.label}>
                          <Typography sx={labelStyles}>{item.label}</Typography>
                          <Typography sx={valueStyles}>{formatDisplay(item.value)}</Typography>
                        </Grid>
                      ))}
                    </Grid>
                  </Box>
                </Stack>
              </Grid>
            </Grid>
          </Paper>

          <Grid container spacing={2} sx={{ mb: 4 }}>
            {summaryCards.map((card) => (
              <Grid item xs={12} md={4} key={card.title}>
                <Paper variant="outlined" sx={{ p: 2, height: '100%' }}>
                  <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 0.4 }}>
                    {card.title}
                  </Typography>
                  <Typography variant="h6" fontWeight={700}>
                    {card.value}
                  </Typography>
                </Paper>
              </Grid>
            ))}
          </Grid>

          <Box sx={{ mb: 4 }}>
            <TableContainer component={Paper} elevation={0} variant="outlined">
              <Table
                size="small"
                sx={{
                  borderCollapse: 'collapse',
                  borderSpacing: 0,
                }}
              >
                <TableHead>
                  <TableRow>
                    <TableCell
                      colSpan={3}
                      sx={{
                        backgroundColor: 'grey.100',
                        borderLeft: '1px solid #000',
                        borderTop: '1px solid #000',
                        borderBottom: '1px solid #000',
                        borderRight: '1px solid #000',
                        fontWeight: 700,
                        fontSize: '0.85rem',
                        py: 1,
                        color: '#0f172a'
                      }}
                    />
                    <TableCell
                      colSpan={3}
                      align="center"
                      sx={{
                        background: 'linear-gradient(120deg,#B7694E,#7D7F6E)',
                        color: '#fff',
                        fontWeight: 700,
                        letterSpacing: 1,
                        textTransform: 'uppercase',
                        borderTop: '1px solid #000',
                        borderBottom: '1px solid #000',
                        borderRight: '1px solid #000',
                      }}
                    >
                      Regular
                    </TableCell>
                    <TableCell
                      colSpan={5}
                      align="center"
                      sx={{
                        background: 'linear-gradient(120deg,#B7694E,#7D7F6E)',
                        color: '#fff',
                        fontWeight: 700,
                        letterSpacing: 1,
                        textTransform: 'uppercase',
                        borderTop: '1px solid #000',
                        borderBottom: '1px solid #000',
                        borderRight: '1px solid #000',
                      }}
                    >
                      Final
                    </TableCell>
                  </TableRow>
                  <TableRow sx={{ backgroundColor: 'grey.100' }}>
                    {['Año', 'Cuat.', 'Espacio Curricular', 'Fecha', 'Sit. Académica', 'Nota', 'Fecha', 'Condición', 'Nota', 'Folio', 'Libro'].map((head, i) => (
                      <TableCell
                        key={head}
                        align={i === 2 ? 'left' : 'center'}
                        sx={{
                          fontWeight: 700,
                          fontSize: '0.75rem',
                          borderBottom: '1px solid #000',
                          borderRight: '1px solid #000',
                          borderTop: '1px solid #000',
                          borderLeft: i === 0 ? '1px solid #000' : 'none',
                          color: '#0f172a'
                        }}
                      >
                        {head}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>

                <TableBody>
                  {data.registros.map((record, index) => {
                    const nextRecord = data.registros[index + 1];
                    const isLastInGroup = !nextRecord || record.espacioCurricular !== nextRecord.espacioCurricular;

                    const bottomBorder = isLastInGroup ? '2px solid #000' : 'none';

                    const isFirstInGroup =
                      index === 0 || record.espacioCurricular !== data.registros[index - 1].espacioCurricular;

                    let rowSpan = 1;
                    if (isFirstInGroup) {
                      rowSpan = data.registros.filter((r) => r.espacioCurricular === record.espacioCurricular).length;
                    }

                    const commonCellSx = {
                      borderRight: '1px solid #000',
                      borderBottom: bottomBorder,
                      height: '35px',
                      padding: '4px 8px',
                      fontSize: '0.80rem',
                    };

                    const spanningCellSx = {
                      ...commonCellSx,
                      borderLeft: '1px solid #000',
                      borderBottom: '2px solid #000',
                      verticalAlign: 'middle',
                      backgroundColor: '#fff',
                    };

                    return (
                      <TableRow
                        key={`${record.espacioCurricular}-${index}`}
                        sx={{ '&:hover': { backgroundColor: 'rgba(0, 0, 0, 0.02)' } }}
                      >
                        {isFirstInGroup && (
                          <>
                            <TableCell rowSpan={rowSpan} align="center" sx={spanningCellSx}>
                              {record.anio}
                            </TableCell>
                            <TableCell rowSpan={rowSpan} align="center" sx={{ ...spanningCellSx, borderLeft: 'none' }}>
                              {record.cuatrimestre}
                            </TableCell>
                            <TableCell rowSpan={rowSpan} sx={{ ...spanningCellSx, borderLeft: 'none', fontWeight: 600 }}>
                              {record.espacioCurricular}
                            </TableCell>
                          </>
                        )}

                        <TableCell align="center" sx={commonCellSx}>
                          {record.tipo === 'regularidad' ? formatDateToDDMMYY(record.fecha) : '-'}
                        </TableCell>
                        <TableCell align="center" sx={commonCellSx}>
                          {record.tipo === 'regularidad'
                            ? record.condicion
                              ? record.condicion === "REGULAR"
                                ? "En curso"
                                : record.condicion
                              : "-"
                            : "-"}
                        </TableCell>
                        <TableCell align="center" sx={{ ...commonCellSx, fontWeight: 'medium' }}>
                          {record.tipo === 'regularidad' ? record.nota ?? '-' : '-'}
                        </TableCell>

                        <TableCell align="center" sx={commonCellSx}>{record.tipo === 'final' ? formatDateToDDMMYY(record.fecha) : '-'}</TableCell>
                        <TableCell align="center" sx={commonCellSx}>{record.tipo === 'final' ? record.condicion ?? '-' : '-'}</TableCell>
                        <TableCell align="center" sx={{ ...commonCellSx, fontWeight: 'medium' }}>
                          {record.tipo === 'final' ? record.nota ?? '-' : '-'}
                        </TableCell>
                        <TableCell align="center" sx={commonCellSx}>{record.tipo === 'final' ? record.folio ?? '-' : '-'}</TableCell>
                        <TableCell align="center" sx={commonCellSx}>{record.tipo === 'final' ? record.libro ?? '-' : '-'}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>

          {data.edis && data.edis.length > 0 && (
            <Box>
              <Box sx={sectionTitleStyles}>
                <Typography variant="h6" component="h2">
                  Espacios de Definición Institucional (EDI)
                </Typography>
              </Box>
              <TableContainer component={Paper} elevation={0} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ backgroundColor: 'grey.100' }}>
                      <TableCell>Año</TableCell>
                      <TableCell>Cuat.</TableCell>
                      <TableCell>EDI</TableCell>
                      <TableCell>Fecha</TableCell>
                      <TableCell>Sit. Académica</TableCell>
                      <TableCell>Nota</TableCell>
                      <TableCell>Folio</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {data.edis.map((record, index) => (
                      <TableRow key={`edi-${index}`} sx={{ '&:nth-of-type(odd)': { backgroundColor: 'action.hover' } }}>
                        <TableCell>{record.anio}</TableCell>
                        <TableCell>{record.cuatrimestre}</TableCell>
                        <TableCell sx={{ fontWeight: 500 }}>{record.espacioCurricular}</TableCell>
                        <TableCell>{formatDisplay(record.fecha)}</TableCell>
                        <TableCell>{formatDisplay(record.condicion)}</TableCell>
                        <TableCell sx={{ fontWeight: 'medium' }}>{formatDisplay(record.nota)}</TableCell>
                        <TableCell>{formatDisplay(record.folio)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          )}

          <Divider sx={{ mt: 4, mb: 2 }} />
          <Typography variant="caption" color="text.secondary" display="block" textAlign="center">
            Documento generado el{' '}
            {new Date().toLocaleDateString('es-AR', { year: 'numeric', month: 'long', day: 'numeric' })}
          </Typography>
        </Paper>
      </Box>
    </Stack>
  );
};
