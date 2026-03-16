export const formatDateToDDMMYYYY = (dateInput?: string | Date | null): string => {
  if (!dateInput) return '—';

  try {
    // If it's already a string and looks like DD/MM/YYYY, return it as is
    if (typeof dateInput === 'string' && /^\d{2}\/\d{2}\/\d{4}$/.test(dateInput)) {
      return dateInput;
    }

    const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
    
    // Check for invalid date
    if (isNaN(date.getTime())) {
      return typeof dateInput === 'string' ? dateInput : '—';
    }

    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = String(date.getFullYear());

    return `${day}/${month}/${year}`;
  } catch (e) {
    return typeof dateInput === 'string' ? dateInput : '—';
  }
};

// Alias for backward compatibility, now returning 4-digit year as per requirement
export const formatDateToDDMMYY = formatDateToDDMMYYYY;

/**
 * Formats a date string to DD/MM/YYYY including time if available
 */
export const formatDateTimeToDDMMYYYY = (isoDate?: string | null): string => {
  if (!isoDate) return '—';

  try {
    const date = new Date(isoDate);
    if (isNaN(date.getTime())) return isoDate;

    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');

    return `${day}/${month}/${year} ${hours}:${minutes}`;
  } catch (e) {
    return isoDate;
  }
};
