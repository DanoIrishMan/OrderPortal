import { OrderStatusValue, STATUS_ALIASES } from "./constants";

export function normalizeOrderNumber(value: string): string {
  return value.trim().toUpperCase().replace(/^0+(?=[A-Z0-9])/, "") || "0";
}

export function parseStatus(value: string | null | undefined): OrderStatusValue | null {
  if (!value?.trim()) return null;

  // e.g. "4 - In Production" from jobs system exports
  const workflowMatch = value.trim().match(/^\d+\s*-\s*(.+)$/i);
  const candidate = (workflowMatch?.[1] ?? value).trim().toLowerCase();

  if (STATUS_ALIASES[candidate]) return STATUS_ALIASES[candidate];

  for (const [alias, status] of Object.entries(STATUS_ALIASES)) {
    if (candidate.includes(alias)) return status;
  }

  const upper = value.trim().toUpperCase().replace(/\s+/g, "_") as OrderStatusValue;
  if (Object.values(STATUS_ALIASES).includes(upper)) return upper;

  return null;
}

export function parseDate(value: string | null | undefined): Date | null {
  if (!value?.trim()) return null;
  if (/tba|n\/a|pending|unknown/i.test(value.trim())) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function parseNumber(value: string | null | undefined): number | null {
  if (!value?.trim()) return null;
  const cleaned = value.replace(/[£$,]/g, "").trim();
  const num = Number(cleaned);
  return Number.isNaN(num) ? null : num;
}

export function parseInteger(value: string | null | undefined): number | null {
  const num = parseNumber(value);
  return num === null ? null : Math.round(num);
}

export function formatDate(date: Date | null | undefined): string {
  if (!date) return "";
  return date.toISOString().slice(0, 10);
}

export function formatDateTime(date: Date | null | undefined): string {
  if (!date) return "";
  const day = String(date.getUTCDate()).padStart(2, "0");
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const year = date.getUTCFullYear();
  const hours = String(date.getUTCHours()).padStart(2, "0");
  const minutes = String(date.getUTCMinutes()).padStart(2, "0");
  return `${day}/${month}/${year} ${hours}:${minutes}`;
}

export function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined) return "";
  return `£${value.toFixed(2)}`;
}

/** Short label for CSV customer subsection, e.g. "Shelbourne FC Shop" → "Shop" */
export function formatSectionLabel(
  section: string | null | undefined,
  clubName?: string | null
): string {
  if (!section) return "";
  let label = section.trim();
  if (!clubName) return label;

  const club = clubName.trim();
  if (label.toLowerCase().startsWith(club.toLowerCase())) {
    const rest = label.slice(club.length).replace(/^[\s\-–—]+/, "").trim();
    if (rest) return rest;
  }

  const clubRoot = club.replace(/\s+FC$/i, "").trim();
  if (clubRoot && label.toLowerCase().startsWith(clubRoot.toLowerCase())) {
    const rest = label.slice(clubRoot.length).replace(/^[\s\-–—]+/, "").trim();
    if (rest) return rest;
  }

  return label;
}
