import { OrderStatusValue, STATUS_ALIASES, type DisplayOrderStatus } from "./constants";

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

/** Prefer note text over workflow when notes indicate artwork is still pending. */
export function resolveImportStatus(
  workflowStatus: string | null | undefined,
  notes: string | null | undefined
): OrderStatusValue | null {
  if (notes?.toLowerCase().includes("awaiting artwork")) {
    return "AWAITING_ARTWORK";
  }

  return parseStatus(workflowStatus);
}

const ORDINAL_DATE_PATTERN =
  /^(\d{1,2})(?:st|nd|rd|th)?\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{2,4})$/i;

const MONTH_INDEX: Record<string, number> = {
  jan: 0,
  feb: 1,
  mar: 2,
  apr: 3,
  may: 4,
  jun: 5,
  jul: 6,
  aug: 7,
  sep: 8,
  oct: 9,
  nov: 10,
  dec: 11,
};

export function parseDate(value: string | null | undefined): Date | null {
  if (!value?.trim()) return null;
  if (/tba|n\/a|pending|unknown/i.test(value.trim())) return null;

  const trimmed = value.trim();
  const ordinalMatch = trimmed.match(ORDINAL_DATE_PATTERN);
  if (ordinalMatch) {
    const day = Number.parseInt(ordinalMatch[1], 10);
    const month = MONTH_INDEX[ordinalMatch[2].slice(0, 3).toLowerCase()];
    if (month === undefined) return null;

    let year = Number.parseInt(ordinalMatch[3], 10);
    if (year < 100) year += 2000;

    const parsed = new Date(Date.UTC(year, month, day));
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const parsed = new Date(trimmed);
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
  const day = String(date.getUTCDate()).padStart(2, "0");
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const year = date.getUTCFullYear();
  return `${day}-${month}-${year}`;
}

/** ISO date for HTML `<input type="date">` values. */
export function formatDateForInput(date: Date | null | undefined): string {
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
  return `${day}-${month}-${year} ${hours}:${minutes}`;
}

export function getDisplayStatus(order: {
  status: OrderStatusValue;
  expectedDeliveryDate: Date | string | null | undefined;
}): DisplayOrderStatus {
  if (
    order.status === "SHIPPED" ||
    order.status === "DELIVERED" ||
    order.status === "CANCELLED"
  ) {
    return order.status;
  }

  if (!order.expectedDeliveryDate) return order.status;

  const required = new Date(order.expectedDeliveryDate);
  if (Number.isNaN(required.getTime())) return order.status;

  const requiredDay = Date.UTC(
    required.getUTCFullYear(),
    required.getUTCMonth(),
    required.getUTCDate()
  );
  const now = new Date();
  const todayDay = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());

  if (requiredDay < todayDay) return "DELAYED";
  return order.status;
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
