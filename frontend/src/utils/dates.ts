export const formatDateToDDMMYY = (isoDate?: string | null): string => {
  if (!isoDate) return '—';

  try {
    const date = new Date(isoDate);
    // Check for invalid date
    if (isNaN(date.getTime())) return isoDate;

    const day = String(date.getUTCDate()).padStart(2, '0');
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const year = String(date.getUTCFullYear()).slice(-2);

    return `${day}/${month}/${year}`;
  } catch (e) {
    return isoDate; // Return original string if parsing fails
  }
};
