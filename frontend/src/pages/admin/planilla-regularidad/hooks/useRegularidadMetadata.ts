import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  fetchRegularidadMetadata,
  RegularidadMetadataMateria,
  RegularidadMetadataPlantilla,
  RegularidadMetadataProfesorado,
} from '@/api/primeraCarga';
import { regimenToDictado, FORMATO_SLUG_MAP, DICTADO_LABELS } from '../constants';

interface UseRegularidadMetadataOptions {
  open: boolean;
  crossLoadEnabled: boolean;
  profesoradoId: number | '';
  materiaId: number | '';
  plantillaId: number | '';
}

export function useRegularidadMetadata({
  open,
  crossLoadEnabled,
  profesoradoId,
  materiaId,
  plantillaId,
}: UseRegularidadMetadataOptions) {
  const metadataQuery = useQuery({
    queryKey: ['primera-carga', 'regularidades', 'metadata', crossLoadEnabled],
    queryFn: () => fetchRegularidadMetadata(crossLoadEnabled),
    enabled: open,
    staleTime: 1000 * 60 * 10,
    retry: false,
  });

  const profesorados: RegularidadMetadataProfesorado[] = metadataQuery.data?.profesorados ?? [];

  const selectedProfesorado = useMemo(
    () => profesorados.find((p) => p.id === Number(profesoradoId)),
    [profesorados, profesoradoId],
  );

  const materias = useMemo<RegularidadMetadataMateria[]>(() => {
    if (!selectedProfesorado) {
      return [];
    }
    return selectedProfesorado.planes.flatMap((plan) => plan.materias);
  }, [selectedProfesorado]);

  const selectedMateria = useMemo(
    () => materias.find((m) => m.id === Number(materiaId)),
    [materias, materiaId],
  );

  const materiaAnioLabel = useMemo(() => {
    if (!selectedMateria) {
      return null;
    }
    const anio = selectedMateria.anio_cursada;
    if (!anio) {
      return null;
    }
    return `${anio}°`;
  }, [selectedMateria]);

  const plantillasDisponibles = useMemo<RegularidadMetadataPlantilla[]>(() => {
    if (!selectedMateria) {
      return [];
    }
    const slug = FORMATO_SLUG_MAP[selectedMateria.formato] ?? selectedMateria.formato.toLowerCase();
    const expectedDictado = regimenToDictado[selectedMateria.regimen] ?? 'ANUAL';
    const candidatas = (metadataQuery.data?.plantillas ?? []).filter(
      (plantilla) =>
        plantilla.formato.slug.toLowerCase() === slug &&
        plantilla.dictado.toUpperCase() === expectedDictado.toUpperCase(),
    );
    if (candidatas.length) {
      return candidatas;
    }
    return (metadataQuery.data?.plantillas ?? []).filter(
      (plantilla) => plantilla.formato.slug.toLowerCase() === slug,
    );
  }, [selectedMateria, metadataQuery.data?.plantillas]);

  const selectedPlantilla = useMemo(
    () => plantillasDisponibles.find((p) => p.id === Number(plantillaId)),
    [plantillasDisponibles, plantillaId],
  );

  const dictadoLabel = useMemo(() => {
    if (!selectedPlantilla) {
      return null;
    }
    return DICTADO_LABELS[selectedPlantilla.dictado] ?? selectedPlantilla.dictado;
  }, [selectedPlantilla]);

  const docentesOptions = useMemo(() => metadataQuery.data?.docentes ?? [], [metadataQuery.data?.docentes]);
  const docentesMap = useMemo(() => {
    const map = new Map<number, { id: number; nombre: string; dni?: string | null }>();
    docentesOptions.forEach((doc) => map.set(doc.id, doc));
    return map;
  }, [docentesOptions]);

  const estudiantesMetadata = useMemo(() => metadataQuery.data?.estudiantes ?? [], [metadataQuery.data?.estudiantes]);
  const estudiantePorDni = useMemo(() => {
    const map = new Map<string, { apellido_nombre: string; profesorados: number[] }>();
    estudiantesMetadata.forEach((est) => {
      map.set(est.dni, { apellido_nombre: est.apellido_nombre, profesorados: est.profesorados });
    });
    return map;
  }, [estudiantesMetadata]);

  const columnasDinamicas = selectedPlantilla?.columnas ?? [];
  const situacionesDisponibles = selectedPlantilla?.situaciones ?? [];

  return {
    metadataQuery,
    profesorados,
    selectedProfesorado,
    materias,
    selectedMateria,
    materiaAnioLabel,
    plantillasDisponibles,
    selectedPlantilla,
    dictadoLabel,
    docentesOptions,
    docentesMap,
    estudiantesMetadata,
    estudiantePorDni,
    columnasDinamicas,
    situacionesDisponibles,
  };
}
