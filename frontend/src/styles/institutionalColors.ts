export const INSTITUTIONAL_GREEN = "#7D7F6E";
export const INSTITUTIONAL_GREEN_DARK = "#6a6c5d";
export const INSTITUTIONAL_TERRACOTTA = "#B7694E";
export const INSTITUTIONAL_TERRACOTTA_DARK = "#9f4f37";

export const SIDEBAR_GRADIENT = `linear-gradient(180deg, ${INSTITUTIONAL_GREEN} 0%, ${INSTITUTIONAL_GREEN_DARK} 45%, ${INSTITUTIONAL_TERRACOTTA} 100%)`;
export const TITLE_GRADIENT = `linear-gradient(120deg, ${INSTITUTIONAL_GREEN} 0%, ${INSTITUTIONAL_TERRACOTTA} 100%)`;
export const ICON_GRADIENT = `linear-gradient(135deg, ${INSTITUTIONAL_TERRACOTTA}, ${INSTITUTIONAL_GREEN})`;

export const PROFESORADO_COLORS: Record<string, string> = {
    especial: "#DE2F82",
    biologia: "#669933",
    primaria: "#C299D6",
    certificacion: "#B3997A",
    lengua: "#FFCC33",
    geografia: "#CC6633",
    inicial: "#99DE99",
    historia: "#262B52",
    matematica: "#66CCFF",
};

export const getProfessoradoColor = (name?: string | null): string => {
    if (!name) return "#666";
    const n = name.toLowerCase();
    if (n.includes("especial")) return PROFESORADO_COLORS.especial;
    if (n.includes("biología") || n.includes("biologia")) return PROFESORADO_COLORS.biologia;
    if (n.includes("primaria")) return PROFESORADO_COLORS.primaria;
    if (n.includes("certificación") || n.includes("certificacion")) return PROFESORADO_COLORS.certificacion;
    if (n.includes("lengua")) return PROFESORADO_COLORS.lengua;
    if (n.includes("geografía") || n.includes("geografia")) return PROFESORADO_COLORS.geografia;
    if (n.includes("inicial")) return PROFESORADO_COLORS.inicial;
    if (n.includes("historia")) return PROFESORADO_COLORS.historia;
    if (n.includes("matemática") || n.includes("matematica")) return PROFESORADO_COLORS.matematica;
    return INSTITUTIONAL_GREEN;
};
