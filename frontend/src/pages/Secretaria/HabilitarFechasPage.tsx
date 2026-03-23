import React, { useEffect, useMemo, useRef, useState } from "react";
import dayjs from "dayjs";
import isSameOrAfter from "dayjs/plugin/isSameOrAfter";
import isSameOrBefore from "dayjs/plugin/isSameOrBefore";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import Typography from "@mui/material/Typography";
import { client as axios } from "@/api/client";
import { fetchVentanas } from "@/api/ventanas";
import { useSnackbar } from "notistack";
import { PageHero, SectionTitlePill } from "@/components/ui/GradientTitles";
import BackButton from "@/components/ui/BackButton";

import {
  Ventana,
  TYPE_CONFIG,
  CATEGORY_CONFIG,
  TYPE_BY_CATEGORY,
  CATEGORY_FROM_TYPE,
  today,
  classifyVentana,
} from "./habilitar-fechas/constants";
import SummaryGrid from "./habilitar-fechas/SummaryGrid";
import TypeAccordionPanel from "./habilitar-fechas/TypeAccordionPanel";
import EditVentanaDialog from "./habilitar-fechas/EditVentanaDialog";

dayjs.extend(isSameOrAfter);
dayjs.extend(isSameOrBefore);

export default function HabilitarFechasPage() {
  const { enqueueSnackbar } = useSnackbar();
  const [ventanas, setVentanas] = useState<Record<string, Ventana[]>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [drafts, setDrafts] = useState<Record<string, Ventana>>({});
  const [selectedCategory, setSelectedCategory] = useState<string>(CATEGORY_CONFIG[0].id);
  const [expandedPanel, setExpandedPanel] = useState<string | null>(null);
  const panelRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [pendingScrollKey, setPendingScrollKey] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editVentana, setEditVentana] = useState<Ventana | null>(null);

  const loadVentanas = async () => {
    try {
      const data = await fetchVentanas();
      const map: Record<string, Ventana[]> = {};
      data.forEach((ventana) => {
        (map[ventana.tipo] ||= []).push(ventana);
      });
      Object.keys(map).forEach((key) => {
        map[key].sort((a, b) => dayjs(b.desde).diff(dayjs(a.desde)));
      });
      setVentanas(map);
    } catch (error) {
      setVentanas({});
      enqueueSnackbar("No se pudieron cargar las ventanas.", { variant: "error" });
    }
  };

  useEffect(() => {
    loadVentanas();
  }, []);

  const upsertVentana = async (ventana: Ventana) => {
    setSaving((state) => ({ ...state, [ventana.tipo]: true }));
    try {
      const payload = { ...ventana };
      if (ventana.id) {
        await axios.put(`/ventanas/${ventana.id}`, payload);
      } else {
        await axios.post(`/ventanas`, payload);
      }
      enqueueSnackbar("Ventana guardada correctamente.", { variant: "success" });
    } catch (error) {
      enqueueSnackbar("No se pudo guardar la ventana.", { variant: "error" });
    } finally {
      setSaving((state) => ({ ...state, [ventana.tipo]: false }));
      loadVentanas();
    }
  };

  const openEditDialog = (ventana: Ventana) => {
    setEditVentana({ ...ventana });
    setEditOpen(true);
  };

  const closeEditDialog = () => {
    setEditOpen(false);
    setEditVentana(null);
  };

  const saveEditDialog = async () => {
    if (!editVentana?.id) return;
    try {
      await axios.put(`/ventanas/${editVentana.id}`, editVentana);
      enqueueSnackbar("Ventana actualizada.", { variant: "success" });
      closeEditDialog();
      loadVentanas();
    } catch (error) {
      enqueueSnackbar("No se pudo actualizar la ventana.", { variant: "error" });
    }
  };

  const deleteVentana = async (id?: number) => {
    if (!id) return;
    try {
      await axios.delete(`/ventanas/${id}`);
      enqueueSnackbar("Ventana eliminada.", { variant: "success" });
      closeEditDialog();
      loadVentanas();
    } catch (error) {
      enqueueSnackbar("No se pudo eliminar la ventana.", { variant: "error" });
    }
  };

  const summaryItems = useMemo(() => {
    return TYPE_CONFIG.map((config) => {
      const list = ventanas[config.key] ?? [];
      const active = list.find((item) => item.activo);
      const upcoming = list
        .filter((item) => dayjs(item.desde).isAfter(today(), "day"))
        .sort((a, b) => dayjs(a.desde).diff(dayjs(b.desde)))[0];
      const reference = active ?? upcoming ?? list[0];
      const state = classifyVentana(active ?? upcoming ?? list[0]);
      return {
        ...config,
        active,
        upcoming,
        reference,
        state,
      };
    });
  }, [ventanas]);

  const handleSummaryClick = (typeKey: string) => {
    const category = CATEGORY_FROM_TYPE[typeKey];
    if (category) {
      setSelectedCategory(category);
      setExpandedPanel(typeKey);
      setPendingScrollKey(typeKey);
    }
  };

  useEffect(() => {
    if (pendingScrollKey && expandedPanel === pendingScrollKey) {
      const node = panelRefs.current[pendingScrollKey];
      if (node) {
        node.scrollIntoView({ behavior: "smooth", block: "start" });
        (node as HTMLElement).focus?.();
      }
      setPendingScrollKey(null);
    }
  }, [expandedPanel, pendingScrollKey]);

  return (
    <Box className="center-page" sx={{ pb: 6 }}>
      <BackButton fallbackPath="/secretaria" />
      <PageHero
        title="Habilitar fechas"
        subtitle="Definí y administrá los períodos de inscripción, trámites y mesas de examen"
      />

      <Box sx={{ mt: 2 }}>
        <SectionTitlePill title="Resumen rápido" sx={{ mt: 3 }} />
      </Box>

      <SummaryGrid summaryItems={summaryItems} onItemClick={handleSummaryClick} />

      <Box sx={{ borderBottom: 1, borderColor: "divider", mb: 3 }}>
        <Tabs
          value={selectedCategory}
          onChange={(_, value) => {
            setSelectedCategory(value);
            setExpandedPanel(null);
          }}
          variant="scrollable"
          allowScrollButtonsMobile
        >
          {CATEGORY_CONFIG.map((category) => (
            <Tab key={category.id} value={category.id} label={category.label} />
          ))}
        </Tabs>
      </Box>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {
          CATEGORY_CONFIG.find((category) => category.id === selectedCategory)?.helper ??
          "Selecciona un período para editarlo."
        }
      </Typography>

      <Stack spacing={2}>
        {TYPE_BY_CATEGORY[selectedCategory].map((typeKey) => (
          <TypeAccordionPanel
            key={typeKey}
            typeKey={typeKey}
            ventanas={ventanas}
            drafts={drafts}
            setDrafts={setDrafts}
            saving={saving}
            expandedPanel={expandedPanel}
            setExpandedPanel={setExpandedPanel}
            panelRefs={panelRefs}
            onUpsert={upsertVentana}
            onEdit={openEditDialog}
            notify={enqueueSnackbar}
          />
        ))}
      </Stack>

      <EditVentanaDialog
        open={editOpen}
        editVentana={editVentana}
        setEditVentana={setEditVentana}
        onCancelar={closeEditDialog}
        onGuardar={saveEditDialog}
        onEliminar={deleteVentana}
      />
    </Box>
  );
}
