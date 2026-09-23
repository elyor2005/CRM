/**
 * Format a number as UZS currency with thousand separators, no decimals.
 * e.g. 1234567 → "1 234 567"
 * Uses non-breaking space as thousands separator.
 */
export function formatUZS(amount: number | string | { toNumber?: () => number }): string {
  let num: number;
  if (typeof amount === "object" && amount !== null && "toNumber" in amount) {
    num = (amount as { toNumber: () => number }).toNumber();
  } else {
    num = Number(amount);
  }
  if (isNaN(num)) return "0";
  const rounded = Math.round(num);
  const isNegative = rounded < 0;
  const abs = Math.abs(rounded).toString();
  // Insert thin spaces as thousand separators
  const formatted = abs.replace(/\B(?=(\d{3})+(?!\d))/g, "\u00A0");
  return isNegative ? `−${formatted}` : formatted;
}

const monthNames = {
  ru: {
    short: ["янв", "фев", "мар", "апр", "май", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"],
    long: ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"],
  },
  uz: {
    short: ["yan", "fev", "mar", "apr", "may", "iyn", "iyl", "avg", "sen", "okt", "noy", "dek"],
    long: ["yanvar", "fevral", "mart", "aprel", "may", "iyun", "iyul", "avgust", "sentabr", "oktabr", "noyabr", "dekabr"],
  },
  en: {
    short: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
    long: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
  },
};

/**
 * Format date short: e.g., "23 sen 2026"
 */
export function formatDateShort(date: Date | string, lang: "ru" | "uz" | "en" = "ru"): string {
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "";
  const months = monthNames[lang]?.short || monthNames.ru.short;
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

/**
 * Format date long: e.g., "23 sentabr 2026"
 */
export function formatDateLong(date: Date | string, lang: "ru" | "uz" | "en" = "ru"): string {
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "";
  const months = monthNames[lang]?.long || monthNames.ru.long;
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

/**
 * Format date for input fields: "2026-09-23"
 */
export function formatDateInput(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "";
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Parse a formatted UZS string back to a number.
 */
export function parseUZS(formatted: string): number {
  const cleaned = formatted.replace(/[\s\u00A0,]/g, "").replace(/−/, "-");
  const num = Number(cleaned);
  return isNaN(num) ? 0 : num;
}
