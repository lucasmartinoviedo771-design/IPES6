import { VentanaDto } from '@/api/ventanas';
import { DocenteDTO } from '@/api/docentes';
import { MesaTipo, MesaModalidad } from './types';
import { MESA_TIPO_LABEL, MESA_MODALIDAD_LABEL, VENTANA_TIPO_LABEL } from './constants';

export const getTipoLabel = (tipo: string) => MESA_TIPO_LABEL[(tipo as MesaTipo)] ?? tipo;

export const getModalidadLabel = (modalidad: string) =>
  MESA_MODALIDAD_LABEL[(modalidad as MesaModalidad)] ?? modalidad;

export const ventanaTipoToMesaTipo = (ventana?: VentanaDto): MesaTipo | null => {
  if (!ventana) return null;
  switch (ventana.tipo) {
    case 'MESAS_FINALES':
      return 'FIN';
    case 'MESAS_EXTRA':
      return 'EXT';
    default:
      return null;
  }
};

export const buildVentanaLabel = (ventana: VentanaDto) => {
  const rango = `${new Date(ventana.desde).toLocaleDateString()} - ${new Date(ventana.hasta).toLocaleDateString()}`;
  const tipo = VENTANA_TIPO_LABEL[ventana.tipo] ?? ventana.tipo.replace('MESAS_', '');
  return `${rango} (${tipo})`;
};

export const formatDocenteLabel = (docente?: DocenteDTO | null) => {
  if (!docente) return '';
  const partes = [];
  if (docente.dni) partes.push(docente.dni);
  partes.push(`${docente.apellido}, ${docente.nombre}`);
  return partes.join(' - ');
};
