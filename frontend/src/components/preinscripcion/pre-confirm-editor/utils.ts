/** Lee un valor de un objeto Record<string, unknown> y lo devuelve o retorna el fallback. */
export function getExtra(extra: Record<string, unknown>, key: string): unknown {
  return extra[key];
}

export const toDisplayDate = (value: string): string => {
  if (!value) return "";
  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    return `${day}/${month}/${year}`;
  }
  return value;
};
