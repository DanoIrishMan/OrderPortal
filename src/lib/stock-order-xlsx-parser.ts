import ExcelJS from "exceljs";
import { ParsedOrderRow } from "@/types/orders";

export interface StockOrderLineItem {
  description: string;
  colour?: string;
  quantity: number;
  sizes?: Record<string, number>;
  crest?: string;
  initials?: string;
  spons?: string;
  text?: string;
  other?: string;
}

export interface StockOrderEmbroideryLine {
  label: string;
  description: string;
  code?: string;
  position?: string;
}

export interface StockOrderParseResult {
  orderNumber: string;
  customerName: string;
  deliveryAddress?: string;
  orderDate?: string;
  expectedDeliveryDate?: string;
  poNumber?: string;
  priority?: string;
  rep?: string;
  section: string;
  embroidery: StockOrderEmbroideryLine[];
  lineItems: StockOrderLineItem[];
  totalQuantity: number;
  notes?: string;
  warnings: string[];
}

function cellValue(value: ExcelJS.CellValue): string | number | null {
  if (value == null) return null;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return typeof value === "boolean" ? (value ? 1 : 0) : value;
  }
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === "object") {
    if ("richText" in value && Array.isArray(value.richText)) {
      return value.richText.map((part) => part.text).join("").trim() || null;
    }
    if ("result" in value && value.result != null) {
      return cellValue(value.result as ExcelJS.CellValue);
    }
    if ("text" in value && typeof value.text === "string") {
      return value.text.trim() || null;
    }
  }
  return String(value).trim() || null;
}

function cellText(ws: ExcelJS.Worksheet, row: number, col: number): string {
  const value = cellValue(ws.getCell(row, col).value);
  if (value == null) return "";
  return String(value).replace(/\s+/g, " ").trim();
}

function cellNumber(ws: ExcelJS.Worksheet, row: number, col: number): number | null {
  const value = cellValue(ws.getCell(row, col).value);
  if (value == null || value === "") return null;
  const num = typeof value === "number" ? value : Number(String(value).replace(/,/g, ""));
  return Number.isFinite(num) ? num : null;
}

function findLabelValue(ws: ExcelJS.Worksheet, labelIncludes: string, maxRow = 25): string {
  for (let row = 1; row <= maxRow; row++) {
    for (let col = 1; col <= 30; col++) {
      const text = cellText(ws, row, col);
      if (!text.toLowerCase().includes(labelIncludes.toLowerCase())) continue;
      if (!text.trim().endsWith(":")) continue;

      for (let offset = 1; offset <= 4; offset++) {
        const candidate = cellText(ws, row, col + offset);
        if (
          candidate &&
          !candidate.endsWith(":") &&
          !candidate.toLowerCase().includes(labelIncludes.toLowerCase().replace(":", ""))
        ) {
          return candidate;
        }
      }
    }
  }
  return "";
}

function buildSizeColumnMap(ws: ExcelJS.Worksheet): Map<number, string> {
  const sizeColumns = new Map<number, string>();

  for (let row = 23; row <= 38; row++) {
    for (let col = 9; col <= 56; col++) {
      const label = cellText(ws, row, col);
      if (!label || label.length > 12) continue;
      if (/^(total qty|price|total value|description|colour|apparel|accessories|bags|balls|socks|shorts|ladies|error)/i.test(label)) {
        continue;
      }
      sizeColumns.set(col, label.replace(/\s+/g, " ").trim());
    }
  }

  return sizeColumns;
}

function parseEmbroideryLines(ws: ExcelJS.Worksheet): StockOrderEmbroideryLine[] {
  const lines: StockOrderEmbroideryLine[] = [];

  for (let row = 1; row <= 20; row++) {
    const label = cellText(ws, row, 2);
    if (!/^embroidery\s*\d+$/i.test(label)) continue;

    const description = cellText(ws, row, 3);
    if (!description) continue;

    lines.push({
      label,
      description,
      code: cellText(ws, row, 7) || undefined,
      position: cellText(ws, row, 23) || undefined,
    });
  }

  return lines;
}

function parseProductLines(
  ws: ExcelJS.Worksheet,
  sizeColumns: Map<number, string>
): StockOrderLineItem[] {
  const items: StockOrderLineItem[] = [];

  let startRow = 31;
  let endRow = ws.rowCount;

  for (let row = 1; row <= ws.rowCount; row++) {
    const text = cellText(ws, row, 2);
    if (/^description$/i.test(text)) {
      startRow = row + 1;
    }
    if (/^total$/i.test(text)) {
      endRow = row - 1;
      break;
    }
  }

  for (let row = startRow; row <= endRow; row++) {
    const description = cellText(ws, row, 2);
    if (!description) continue;
    if (/^(description|total|notes|error)/i.test(description)) continue;
    if (/:$/.test(description)) continue;
    if (/^(embroidery|print)\s*\d+$/i.test(description)) continue;

    const colour = cellText(ws, row, 3);
    const rowTotal = cellNumber(ws, row, 58);
    const sizes: Record<string, number> = {};

    for (const [col, sizeLabel] of sizeColumns.entries()) {
      const qty = cellNumber(ws, row, col);
      if (qty != null && qty > 0) {
        sizes[sizeLabel] = qty;
      }
    }

    const quantity =
      rowTotal ??
      Object.values(sizes).reduce((sum, qty) => sum + qty, 0);

    if (quantity <= 0 && Object.keys(sizes).length === 0) continue;

    items.push({
      description,
      colour: colour || undefined,
      crest: cellText(ws, row, 4) || undefined,
      initials: cellText(ws, row, 5) || undefined,
      spons: cellText(ws, row, 6) || undefined,
      text: cellText(ws, row, 7) || undefined,
      other: cellText(ws, row, 8) || undefined,
      sizes: Object.keys(sizes).length > 0 ? sizes : undefined,
      quantity,
    });
  }

  return items;
}

function formatEmbroideryNotes(embroidery: StockOrderEmbroideryLine[]): string {
  if (embroidery.length === 0) return "";
  return embroidery
    .map((line) => {
      const parts = [line.description];
      if (line.code) parts.push(`(${line.code})`);
      if (line.position) parts.push(`– ${line.position}`);
      return parts.join(" ");
    })
    .join("\n");
}

function formatLineItemDescription(items: StockOrderLineItem[]): string {
  return items
    .map((item) => {
      const colour = item.colour ? ` ${item.colour}` : "";
      return `${item.description}${colour} (${item.quantity})`;
    })
    .join("; ");
}

export function isOrderwiseStockOrderWorksheet(ws: ExcelJS.Worksheet): boolean {
  for (let row = 1; row <= 5; row++) {
    for (let col = 1; col <= 10; col++) {
      const text = cellText(ws, row, col);
      if (text.includes("CORE STOCK ORDER FORM") || text.includes("ORDERWISE")) {
        return true;
      }
    }
  }
  return false;
}

function resolveStockOrderSection(ws: ExcelJS.Worksheet): string {
  for (let row = 1; row <= 5; row++) {
    for (let col = 1; col <= 20; col++) {
      const text = cellText(ws, row, col);
      if (!/transfer\s+to/i.test(text)) continue;

      if (/\bprint\b/i.test(text)) return "Print";
      if (/\bembroidery\b/i.test(text)) return "Embroidery";
    }
  }

  return "Embroidery";
}

export async function parseStockOrderXlsx(filePath: string): Promise<StockOrderParseResult> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  const ws = workbook.worksheets[0];
  if (!ws) throw new Error("Workbook has no worksheets");
  return parseStockOrderWorksheet(ws);
}

function parseStockOrderWorksheet(ws: ExcelJS.Worksheet): StockOrderParseResult {
  if (!isOrderwiseStockOrderWorksheet(ws)) {
    throw new Error(
      "This does not look like an OrderWise Core Stock Order Form. Use the ORDER tab from OrderWise v17."
    );
  }

  const warnings: string[] = [];
  const orderNumber = findLabelValue(ws, "order number");
  const customerName = findLabelValue(ws, "customer name");
  const deliveryAddress = findLabelValue(ws, "delivery address");
  const orderDate = findLabelValue(ws, "date ordered");
  const expectedDeliveryDate = findLabelValue(ws, "date wanted");
  const poNumber = findLabelValue(ws, "po number");
  const priority = findLabelValue(ws, "priority");
  const rep = findLabelValue(ws, "rep/sales admin");

  if (!orderNumber) warnings.push("Order number not found in the spreadsheet");
  if (!customerName) warnings.push("Customer name not found in the spreadsheet");

  const embroidery = parseEmbroideryLines(ws);
  const sizeColumns = buildSizeColumnMap(ws);
  const lineItems = parseProductLines(ws, sizeColumns);
  const section = resolveStockOrderSection(ws);

  if (lineItems.length === 0) {
    warnings.push("No product lines with quantities were found");
  }

  let totalQuantity = cellNumber(ws, 43, 58) ?? 0;
  if (!totalQuantity) {
    totalQuantity = lineItems.reduce((sum, item) => sum + item.quantity, 0);
  }

  const notesParts = [
    deliveryAddress ? `Delivery: ${deliveryAddress}` : "",
    priority ? `Priority: ${priority}` : "",
    rep ? `Rep: ${rep}` : "",
    embroidery.length > 0 ? `Embroidery:\n${formatEmbroideryNotes(embroidery)}` : "",
  ].filter(Boolean);

  const notesRow = findLabelValue(ws, "notes & embroidery pricing");
  if (notesRow && !notesRow.toLowerCase().includes("notes & embroidery")) {
    notesParts.push(notesRow);
  }

  return {
    orderNumber,
    customerName,
    deliveryAddress: deliveryAddress || undefined,
    orderDate: orderDate || undefined,
    expectedDeliveryDate: expectedDeliveryDate || undefined,
    poNumber: poNumber || undefined,
    priority: priority || undefined,
    rep: rep || undefined,
    section,
    embroidery,
    lineItems,
    totalQuantity,
    notes: notesParts.length > 0 ? notesParts.join("\n") : undefined,
    warnings,
  };
}

export function stockOrderToParsedRow(parsed: StockOrderParseResult): ParsedOrderRow {
  const lineItems = parsed.lineItems.map((item) => ({
    description: [item.description, item.colour].filter(Boolean).join(" – "),
    quantity: item.quantity,
    sizes: item.sizes,
    crest: item.crest,
    initials: item.initials,
    spons: item.spons,
    text: item.text,
    other: item.other,
  }));

  return {
    orderNumber: parsed.orderNumber,
    orderDate: parsed.orderDate ?? null,
    poNumber: parsed.poNumber ?? null,
    csvCustomerName: parsed.customerName,
    section: parsed.section,
    description: formatLineItemDescription(parsed.lineItems),
    quantity: parsed.totalQuantity,
    status: "IN_PRODUCTION",
    expectedDeliveryDate: parsed.expectedDeliveryDate ?? null,
    notes: parsed.notes ?? null,
    lineItems,
    warnings: parsed.warnings,
  };
}
