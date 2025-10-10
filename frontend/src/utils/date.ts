import dayjs from "dayjs";

export const isValidDDMMYYYY = (s: string) =>
  !!s && dayjs(s, "DD/MM/YYYY", true).isValid();

export const ddmmyyyyToISO = (s: string) => {
  const d = dayjs(s, "DD/MM/YYYY", true);
  if (!d.isValid()) throw new Error("Fecha inválida (DD/MM/YYYY)");
  return d.format("YYYY-MM-DD");
};
