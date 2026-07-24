import fs from "fs/promises";
import pdf from "pdf-parse";
import { ParsedOrderRow } from "@/types/orders";
import { normalizeOrderNumber, parseDate, parseInteger, parseNumber } from "./utils";

/** Explicit header-style labels only — avoids splitting on bare "order:" in line text */
const LABELED_ORDER_NUMBER_PATTERNS = [
  /(?:order\s*(?:no|number|#)\s*[:\s]+)([A-Z0-9][A-Z0-9-]*)/gi,
  /(?:job\s*(?:no|number|#)\s*[:\s]+)([A-Z0-9][A-Z0-9-]*)/gi,
  /\b(DLES\d+)\b/gi,
  /(?:reference\s*(?:no|number|#)?\s*[:\s]+)([A-Z0-9][A-Z0-9-]*)/gi,
];

const DATE_PATTERNS = [
  /(?:order\s*date[:\s]+)(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i,
  /(?:date[:\s]+)(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i,
  /(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4})/i,
];

const PO_PATTERNS = [
  /(?:po\s*(?:no|number|#)?[:\s]+)([A-Z0-9-]+)/i,
  /(?:purchase\s*order[:\s]+)([A-Z0-9-]+)/i,
];

const QTY_PATTERNS = [
  /(?:total\s*qty|total\s*quantity)[:\s]+(\d+)/i,
  /(?:qty|quantity)[:\s]+(\d+)/i,
];

const TOTAL_PRICE_PATTERNS = [
  /(?:order\s*total|grand\s*total|total\s*due|total\s*amount)[:\s]+[£$]?([\d,]+\.?\d*)/i,
  /(?:total|amount)[:\s]+[£$]?([\d,]+\.?\d*)/i,
];

const FALLBACK_ORDER_PATTERNS = [
  /\b(DLES\d+)\b/i,
  /\b((?:ORD|JOB|REF)[-\s]?[A-Z0-9-]+)\b/i,
];

function extractFirst(text: string, patterns: RegExp[]): string | null {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return match[1].trim();
  }
  return null;
}

function findLabeledOrderNumbers(text: string): string[] {
  const found: string[] = [];

  for (const pattern of LABELED_ORDER_NUMBER_PATTERNS) {
    for (const match of text.matchAll(pattern)) {
      const value = match[1]?.trim();
      if (!value) continue;
      const normalized = normalizeOrderNumber(value);
      if (normalized.length >= 3 && !found.includes(normalized)) {
        found.push(normalized);
      }
    }
  }

  return found;
}

function extractPrimaryOrderNumber(text: string, preferred?: string): string | null {
  if (preferred) return preferred;

  const labeled = findLabeledOrderNumbers(text);
  if (labeled.length > 0) return labeled[0];

  for (const pattern of FALLBACK_ORDER_PATTERNS) {
    const match = text.match(pattern);
    if (match?.[1]) return normalizeOrderNumber(match[1]);
  }

  return null;
}

function parseLineItems(text: string): ParsedOrderRow["lineItems"] {
  const items: NonNullable<ParsedOrderRow["lineItems"]> = [];
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);

  for (const line of lines) {
    const itemMatch = line.match(
      /^(.+?)\s+(?:qty[:\s]+)?(\d+)\s+(?:@|x|at)\s+[£$]?([\d,]+\.?\d*)$/i
    );
    if (itemMatch) {
      items.push({
        description: itemMatch[1].trim(),
        quantity: parseInteger(itemMatch[2]) ?? undefined,
        unitPrice: parseNumber(itemMatch[3]) ?? undefined,
      });
    }
  }

  return items.length > 0 ? items : undefined;
}

function buildDescription(text: string, lineItems?: ParsedOrderRow["lineItems"]): string | null {
  if (lineItems?.length) {
    return lineItems.map((item) => item.description).join("; ");
  }

  const descMatch = text.match(/(?:description[:\s]+)(.+?)(?:\n|$)/i);
  if (descMatch) return descMatch[1].trim();

  const productMatch = text.match(/(?:product[:\s]+)(.+?)(?:\n|$)/i);
  if (productMatch) return productMatch[1].trim();

  return null;
}

function parseLabeledLines(text: string): Partial<ParsedOrderRow> {
  const fields: Partial<ParsedOrderRow> = {};
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  for (const line of lines) {
    const match = line.match(/^([^:]+):\s*(.+)$/);
    if (!match) continue;

    const label = match[1].trim().toLowerCase();
    const value = match[2].trim();
    if (!value) continue;

    if (/order\s*(?:no|number|#)/.test(label) || label === "job number" || label === "job no") {
      fields.orderNumber = normalizeOrderNumber(value);
    } else if (label.includes("order date") || label === "date ordered") {
      fields.orderDate = parseDate(value)?.toISOString().slice(0, 10) ?? value;
    } else if (label.includes("po") || label.includes("purchase order")) {
      fields.poNumber = value;
    } else if (label.includes("description") || label.includes("product") || label === "item") {
      fields.description = value;
    } else if (label.includes("quantity") || label === "qty") {
      fields.quantity = parseInteger(value);
    } else if (label.includes("unit price") || label === "price each") {
      fields.unitPrice = parseNumber(value);
    } else if (
      label.includes("order total") ||
      label.includes("grand total") ||
      label === "total" ||
      label === "amount"
    ) {
      fields.totalPrice = parseNumber(value);
    } else if (
      label.includes("expected delivery") ||
      label.includes("delivery date") ||
      label.includes("due date") ||
      label.includes("promised")
    ) {
      fields.expectedDeliveryDate = parseDate(value)?.toISOString().slice(0, 10) ?? value;
    } else if (label.includes("actual delivery") || label.includes("delivered")) {
      fields.actualDeliveryDate = parseDate(value)?.toISOString().slice(0, 10) ?? value;
    } else if (label.includes("status")) {
      fields.status = value;
    } else if (label.includes("notes") || label.includes("comment")) {
      fields.notes = value;
    }
  }

  return fields;
}

function buildOrderRow(text: string, orderNumber: string): ParsedOrderRow {
  const labeled = parseLabeledLines(text);
  const lineItems = parseLineItems(text);
  const quantity =
    labeled.quantity ??
    parseInteger(extractFirst(text, QTY_PATTERNS)) ??
    lineItems?.reduce((sum, item) => sum + (item.quantity ?? 0), 0) ??
    null;

  const orderDateRaw = labeled.orderDate ?? extractFirst(text, DATE_PATTERNS);

  return {
    orderNumber: labeled.orderNumber ?? orderNumber,
    orderDate: orderDateRaw
      ? typeof orderDateRaw === "string" && orderDateRaw.includes("-")
        ? orderDateRaw
        : (parseDate(String(orderDateRaw))?.toISOString().slice(0, 10) ?? String(orderDateRaw))
      : null,
    poNumber: labeled.poNumber ?? extractFirst(text, PO_PATTERNS),
    description: labeled.description ?? buildDescription(text, lineItems),
    quantity,
    unitPrice: labeled.unitPrice ?? null,
    totalPrice: labeled.totalPrice ?? parseNumber(extractFirst(text, TOTAL_PRICE_PATTERNS)),
    expectedDeliveryDate: labeled.expectedDeliveryDate ?? null,
    actualDeliveryDate: labeled.actualDeliveryDate ?? null,
    notes: labeled.notes ?? null,
    status: labeled.status ?? "RECEIVED",
    lineItems,
  };
}

/**
 * Split text only when multiple distinct labeled order numbers exist.
 * Each PDF file defaults to a single order unless clearly multi-order.
 */
export function parseOrderText(text: string): ParsedOrderRow[] {
  const labeledOrderNumbers = findLabeledOrderNumbers(text);

  if (labeledOrderNumbers.length <= 1) {
    const orderNumber = extractPrimaryOrderNumber(
      text,
      labeledOrderNumbers[0]
    );
    if (!orderNumber) return [];
    return [buildOrderRow(text, orderNumber)];
  }

  // Multiple distinct labeled order numbers — split sections by label positions
  const splitPattern =
    /(?=(?:order\s*(?:no|number|#)\s*[:\s]+|job\s*(?:no|number|#)\s*[:\s]+|reference\s*(?:no|number|#)?\s*[:\s]+))/gi;
  const chunks = text.split(splitPattern).filter((c) => c.trim());
  const rows: ParsedOrderRow[] = [];

  for (const chunk of chunks) {
    const orderNumber = extractPrimaryOrderNumber(chunk);
    if (!orderNumber) continue;
    rows.push(buildOrderRow(chunk, orderNumber));
  }

  if (rows.length > 0) {
    const seen = new Set<string>();
    return rows.filter((row) => {
      if (seen.has(row.orderNumber)) return false;
      seen.add(row.orderNumber);
      return true;
    });
  }

  // Labeled numbers found but chunks failed — fall back to first order only
  return [buildOrderRow(text, labeledOrderNumbers[0])];
}

export async function parsePdfFile(filePath: string): Promise<{
  text: string;
  rows: ParsedOrderRow[];
  warnings: string[];
}> {
  const buffer = await fs.readFile(filePath);
  const data = await pdf(buffer);
  const text = data.text ?? "";
  const warnings: string[] = [];

  if (!text.trim()) {
    warnings.push(
      "No extractable text found. This PDF may be scanned/image-based and require OCR."
    );
    return { text, rows: [], warnings };
  }

  const rows = parseOrderText(text);

  if (rows.length === 0) {
    warnings.push(
      "Could not detect order fields automatically. Review the extracted text and add rows manually, or share a sample PDF to improve the parser template."
    );
  } else if (rows.length > 1) {
    warnings.push(
      `Detected ${rows.length} distinct order numbers in this PDF. If this should be one order, remove the extra rows before confirming.`
    );
  }

  return { text, rows, warnings };
}
