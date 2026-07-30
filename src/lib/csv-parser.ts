import Papa from "papaparse";
import { prisma } from "./db";
import {
  CsvMappingConfig,
  CsvUpdateResult,
  CustomerMappingValue,
  ParsedOrderRow,
  WeeklyCsvByClientStats,
  WeeklyCsvCustomerInfo,
  WeeklyCsvImportResult,
  WeeklyCsvPreviewResult,
} from "@/types/orders";
import {
  normalizeOrderNumber,
  parseDate,
  parseInteger,
  parseNumber,
  resolveImportStatus,
} from "./utils";
import { OrderSource } from "@prisma/client";
import { upsertOrderFromImport } from "./orders";
import { findClientIdByRelatedName } from "./customer-matching";

export function parseCsvContent(content: string): {
  headers: string[];
  rows: Record<string, string>[];
} {
  const result = Papa.parse<Record<string, string>>(content, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (header) => header.trim(),
  });

  const headers = result.meta.fields ?? [];
  const rows = (result.data ?? []).filter((row) =>
    Object.values(row).some((v) => v?.trim())
  );

  return { headers, rows };
}

/** Detects Daniel Ennis / jobs system Sales Rep Summary export format */
export function isSalesRepSummaryCsv(headers: string[]): boolean {
  const lower = headers.map((h) => h.toLowerCase());
  return lower.includes("order_no") && lower.includes("workflow_status");
}

function cleanCsvField(value: string | undefined): string | null {
  const cleaned = value?.replace(/\s+/g, " ").trim();
  return cleaned || null;
}

export function mapSalesRepSummaryRow(row: Record<string, string>): ParsedOrderRow | null {
  const orderNo = cleanCsvField(row.Order_No);
  if (!orderNo) return null;

  const designName = cleanCsvField(row.Design_Name);
  const shortDesc = cleanCsvField(row.ShortDescription);
  const range = cleanCsvField(row.RangeDescription);
  const colour = cleanCsvField(row.Colourway);
  const style = cleanCsvField(row.StyleCode);

  const description =
    designName ||
    [shortDesc, range, colour].filter(Boolean).join(" — ") ||
    shortDesc;

  const noteParts = [
    cleanCsvField(row.Latest_Note),
    row.Red_Flag?.trim() ? `Flag: ${row.Red_Flag.trim()}` : null,
    row.Admin_Status?.trim() ? `Admin: ${row.Admin_Status.trim()}` : null,
    row.Qty_Balance?.trim() ? `Balance qty: ${row.Qty_Balance.trim()}` : null,
  ].filter(Boolean);

  const orderDate = cleanCsvField(row.Date_Ordered);
  const required = cleanCsvField(row.Date_Required);
  const scheduledOffshore = cleanCsvField(row.Date_Scheduled_Offshore);
  const received = cleanCsvField(row.Date_Received);
  const notes = noteParts.length > 0 ? noteParts.join(" | ") : null;

  return {
    orderNumber: normalizeOrderNumber(orderNo),
    csvCustomerName: cleanCsvField(row.customer),
    orderDate: orderDate && parseDate(orderDate) ? orderDate : null,
    poNumber: null,
    description,
    quantity: parseInteger(row.Quantity),
    status: resolveImportStatus(cleanCsvField(row.Workflow_Status), notes) ?? undefined,
    expectedDeliveryDate: required && parseDate(required) ? required : null,
    leavingOsFactoryDate:
      scheduledOffshore && parseDate(scheduledOffshore) ? scheduledOffshore : null,
    actualDeliveryDate: received && parseDate(received) ? received : null,
    notes,
    lineItems: style
      ? [
          {
            description: [shortDesc, style, colour].filter(Boolean).join(" / "),
            quantity: parseInteger(row.Quantity) ?? undefined,
          },
        ]
      : undefined,
  };
}

export function mapCsvRowsToOrders(
  rows: Record<string, string>[],
  headers: string[],
  mapping?: CsvMappingConfig
): ParsedOrderRow[] {
  if (isSalesRepSummaryCsv(headers)) {
    return rows
      .map((row) => mapSalesRepSummaryRow(row))
      .filter((row): row is ParsedOrderRow => row !== null);
  }

  const resolvedMapping = mapping ?? suggestMapping(headers);
  return rows
    .map((row) => mapCsvRowToOrder(row, resolvedMapping))
    .filter((row): row is ParsedOrderRow => row !== null);
}

export function suggestMapping(headers: string[]): CsvMappingConfig {
  const lowerHeaders = headers.map((h) => h.toLowerCase());

  const find = (...candidates: string[]) => {
    const idx = lowerHeaders.findIndex((h) =>
      candidates.some((c) => h === c || h.includes(c))
    );
    return idx >= 0 ? headers[idx] : undefined;
  };

  return {
    orderNumber:
      find("order_no", "order number", "order no", "order #", "order_number", "job number", "job no") ?? "",
    orderDate: find("date_ordered", "order date", "order_date", "date ordered"),
    poNumber: find("customer", "po number", "po no", "po_number", "purchase order"),
    description: find("design_name", "shortdescription", "description", "product", "item"),
    quantity: find("quantity", "qty", "order qty"),
    unitPrice: find("unit price", "price each", "unit_price"),
    totalPrice: find("total price", "total", "amount", "order total", "total_price"),
    status: find("workflow_status", "status", "order status", "order_status", "production status"),
    expectedDeliveryDate: find(
      "date_required",
      "date wanted",
      "date_wanted",
      "expected delivery",
      "expected_delivery",
      "due date",
      "delivery date"
    ),
    leavingOsFactoryDate: find(
      "date_scheduled_offshore",
      "scheduled offshore",
      "schedualed offshore",
      "leaving os factory"
    ),
    actualDeliveryDate: find("date_received", "actual delivery", "actual_delivery", "delivered date"),
    notes: find("latest_note", "notes", "comment", "remarks", "comments"),
  };
}

function getMappedValue(
  row: Record<string, string>,
  mapping: CsvMappingConfig,
  field: keyof CsvMappingConfig
): string | null {
  const column = mapping[field];
  if (!column) return null;
  const value = row[column];
  return value?.trim() || null;
}

export function mapCsvRowToOrder(
  row: Record<string, string>,
  mapping: CsvMappingConfig
): ParsedOrderRow | null {
  const orderNumberRaw = getMappedValue(row, mapping, "orderNumber");
  if (!orderNumberRaw) return null;

  const workflowStatus = getMappedValue(row, mapping, "status");
  const notes = getMappedValue(row, mapping, "notes");

  return {
    orderNumber: normalizeOrderNumber(orderNumberRaw),
    orderDate: getMappedValue(row, mapping, "orderDate"),
    poNumber: getMappedValue(row, mapping, "poNumber"),
    description: getMappedValue(row, mapping, "description"),
    quantity: parseInteger(getMappedValue(row, mapping, "quantity")),
    unitPrice: parseNumber(getMappedValue(row, mapping, "unitPrice")),
    totalPrice: parseNumber(getMappedValue(row, mapping, "totalPrice")),
    status: resolveImportStatus(workflowStatus, notes) ?? undefined,
    expectedDeliveryDate: getMappedValue(row, mapping, "expectedDeliveryDate"),
    leavingOsFactoryDate: getMappedValue(row, mapping, "leavingOsFactoryDate"),
    actualDeliveryDate: getMappedValue(row, mapping, "actualDeliveryDate"),
    notes,
  };
}

function normalizeCustomerName(name: string | null | undefined): string | null {
  const cleaned = name?.replace(/\s+/g, " ").trim();
  return cleaned || null;
}

interface CustomerLookupContext {
  lookup: Map<string, string | "skip">;
  clients: Array<{ id: string; name: string }>;
  aliases: Array<{ clientId: string; csvCustomerName: string }>;
}

async function buildCustomerLookupContext(
  extraMappings?: Record<string, CustomerMappingValue>
): Promise<CustomerLookupContext> {
  const [aliases, clients] = await Promise.all([
    prisma.customerAlias.findMany({
      select: { csvCustomerName: true, clientId: true },
    }),
    prisma.client.findMany({
      where: { active: true },
      select: { id: true, name: true },
    }),
  ]);

  const lookup = new Map<string, string | "skip">();
  for (const alias of aliases) {
    lookup.set(alias.csvCustomerName, alias.clientId);
  }

  if (extraMappings) {
    for (const [name, value] of Object.entries(extraMappings)) {
      if (value) lookup.set(name, value);
    }
  }

  return { lookup, clients, aliases };
}

function resolveClientIdForRow(
  csvCustomerName: string | null,
  ctx: CustomerLookupContext
): { clientId: string | "skip" | null; autoMatched: boolean; matchedToName: string | null } {
  if (!csvCustomerName) {
    return { clientId: null, autoMatched: false, matchedToName: null };
  }

  const fromLookup = ctx.lookup.get(csvCustomerName);
  if (fromLookup) {
    return { clientId: fromLookup, autoMatched: false, matchedToName: null };
  }

  const related = findClientIdByRelatedName(csvCustomerName, ctx.clients, ctx.aliases);
  if (related) {
    return {
      clientId: related.clientId,
      autoMatched: true,
      matchedToName: related.matchedName,
    };
  }

  return { clientId: null, autoMatched: false, matchedToName: null };
}

function getDistinctCustomers(rows: Record<string, string>[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const name = normalizeCustomerName(row.customer);
    if (!name) continue;
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return counts;
}

async function loadExistingOrderKeys(clientIds: string[]): Promise<Set<string>> {
  if (clientIds.length === 0) return new Set();

  const existing = await prisma.order.findMany({
    where: { clientId: { in: clientIds } },
    select: { clientId: true, orderNumber: true },
  });

  return new Set(
    existing.map((o) => `${o.clientId}:${normalizeOrderNumber(o.orderNumber)}`)
  );
}

export async function previewWeeklyCsvImport(
  rows: Record<string, string>[],
  headers: string[],
  customerMappings?: Record<string, CustomerMappingValue>
): Promise<WeeklyCsvPreviewResult> {
  const isSalesRepSummary = isSalesRepSummaryCsv(headers);
  const mappedOrders = mapCsvRowsToOrders(rows, headers);
  const ctx = await buildCustomerLookupContext(customerMappings);
  const clientNameById = new Map(ctx.clients.map((c) => [c.id, c.name]));

  const customerCounts = getDistinctCustomers(rows);
  const customers: WeeklyCsvCustomerInfo[] = [];
  const unmappedCustomers: string[] = [];

  for (const [csvCustomerName, rowCount] of customerCounts) {
    const { clientId: resolved, autoMatched, matchedToName } = resolveClientIdForRow(
      csvCustomerName,
      ctx
    );
    const isSkipped = resolved === "skip";
    const mappedClientId = resolved && resolved !== "skip" ? resolved : null;

    if (!resolved) {
      unmappedCustomers.push(csvCustomerName);
    }

    customers.push({
      csvCustomerName,
      rowCount,
      mappedClientId,
      mappedClientName: mappedClientId ? clientNameById.get(mappedClientId) ?? null : null,
      isSkipped,
      isAutoMatched: autoMatched,
      matchedToName: autoMatched ? matchedToName : null,
    });
  }

  customers.sort((a, b) => a.csvCustomerName.localeCompare(b.csvCustomerName));

  const mappedClientIds = [
    ...new Set(
      customers
        .map((c) => c.mappedClientId)
        .filter((id): id is string => !!id)
    ),
  ];
  const existingKeys = await loadExistingOrderKeys(mappedClientIds);

  const byClientMap = new Map<string, WeeklyCsvByClientStats>();
  let wouldCreate = 0;
  let wouldUpdate = 0;
  let wouldSkip = 0;

  for (let i = 0; i < mappedOrders.length; i++) {
    const mapped = mappedOrders[i];
    const rawCustomer = normalizeCustomerName(rows[i]?.customer ?? mapped.csvCustomerName);
    const { clientId: resolved } = resolveClientIdForRow(rawCustomer, ctx);

    if (!mapped?.orderNumber) {
      wouldSkip++;
      continue;
    }

    if (!resolved || resolved === "skip") {
      wouldSkip++;
      continue;
    }

    const clientName = clientNameById.get(resolved) ?? "Unknown";
    if (!byClientMap.has(resolved)) {
      byClientMap.set(resolved, {
        clientId: resolved,
        clientName,
        wouldCreate: 0,
        wouldUpdate: 0,
        wouldSkip: 0,
      });
    }

    const stats = byClientMap.get(resolved)!;
    const key = `${resolved}:${mapped.orderNumber}`;

    if (existingKeys.has(key)) {
      wouldUpdate++;
      stats.wouldUpdate++;
    } else {
      wouldCreate++;
      stats.wouldCreate++;
    }
  }

  return {
    isSalesRepSummary,
    headers,
    rows: rows.slice(0, 20),
    totalRows: rows.length,
    customers,
    byClient: [...byClientMap.values()].sort((a, b) => a.clientName.localeCompare(b.clientName)),
    unmappedCustomers,
    wouldCreate,
    wouldUpdate,
    wouldSkip,
  };
}

export async function applyWeeklyCsvImport(
  rows: Record<string, string>[],
  headers: string[],
  importBatchId: string,
  customerMappings?: Record<string, CustomerMappingValue>
): Promise<WeeklyCsvImportResult> {
  const result: WeeklyCsvImportResult = {
    created: 0,
    updated: 0,
    skipped: 0,
    errors: [],
    unmappedCustomers: [],
    clientsCreated: [],
    aliasesCreated: [],
    byClient: [],
  };

  const ctx = await buildCustomerLookupContext(customerMappings);
  const mappedOrders = mapCsvRowsToOrders(rows, headers);
  const clientNameById = new Map(ctx.clients.map((c) => [c.id, c.name]));
  const byClientMap = new Map<string, WeeklyCsvByClientStats>();

  const unmappedSet = new Set<string>();

  for (let i = 0; i < mappedOrders.length; i++) {
    const mapped = mappedOrders[i];
    const rawCustomer = normalizeCustomerName(rows[i]?.customer ?? mapped.csvCustomerName);

    if (!mapped?.orderNumber) {
      result.skipped++;
      continue;
    }

    const { clientId: resolved } = resolveClientIdForRow(rawCustomer, ctx);

    if (!resolved) {
      if (rawCustomer) unmappedSet.add(rawCustomer);
      result.skipped++;
      continue;
    }

    if (resolved === "skip") {
      result.skipped++;
      continue;
    }

    if (!byClientMap.has(resolved)) {
      byClientMap.set(resolved, {
        clientId: resolved,
        clientName: clientNameById.get(resolved) ?? "Unknown",
        wouldCreate: 0,
        wouldUpdate: 0,
        wouldSkip: 0,
      });
    }

    const stats = byClientMap.get(resolved)!;

    try {
      const action = await upsertOrderFromImport({
        clientId: resolved,
        row: mapped,
        importBatchId,
        source: OrderSource.CSV_IMPORT,
      });

      if (action === "created") {
        result.created++;
        stats.wouldCreate++;
      } else if (action === "updated") {
        result.updated++;
        stats.wouldUpdate++;
      } else {
        result.skipped++;
        stats.wouldSkip++;
      }
    } catch (err) {
      result.errors.push(
        `Order ${mapped.orderNumber}: ${err instanceof Error ? err.message : "Unknown error"}`
      );
      result.skipped++;
      stats.wouldSkip++;
    }
  }

  result.unmappedCustomers = [...unmappedSet].sort();
  result.byClient = [...byClientMap.values()].sort((a, b) =>
    a.clientName.localeCompare(b.clientName)
  );

  return result;
}

export async function applyCsvUpdates(
  clientId: string,
  rows: Record<string, string>[],
  mapping: CsvMappingConfig,
  importBatchId?: string,
  headers?: string[]
): Promise<CsvUpdateResult> {
  const result: CsvUpdateResult = {
    updated: 0,
    notFound: [],
    skipped: 0,
    errors: [],
  };

  const existingOrders = await prisma.order.findMany({
    where: { clientId },
    select: { id: true, orderNumber: true, status: true, notes: true },
  });

  const orderMap = new Map(
    existingOrders.map((o) => [normalizeOrderNumber(o.orderNumber), o])
  );

  const mappedOrders = headers
    ? mapCsvRowsToOrders(rows, headers, mapping)
    : rows
        .map((row) => mapCsvRowToOrder(row, mapping))
        .filter((row): row is ParsedOrderRow => row !== null);

  for (let i = 0; i < mappedOrders.length; i++) {
    const mapped = mappedOrders[i];
    const sourceRow = rows[i];

    if (!mapped?.orderNumber) {
      result.skipped++;
      continue;
    }

    const existing = orderMap.get(mapped.orderNumber);
    if (!existing) {
      result.notFound.push({
        row: i + 2,
        orderNumber: mapped.orderNumber,
        data: sourceRow ?? {},
      });
      continue;
    }

    const updates: Record<string, unknown> = {};
    const events: Array<{ field: string; oldValue: string | null; newValue: string | null }> = [];

    const setField = (field: string, dbField: string, newVal: unknown, oldVal: unknown) => {
      const oldStr = oldVal == null ? null : String(oldVal);
      const newStr = newVal == null ? null : String(newVal);
      if (newStr !== null && newStr !== oldStr) {
        updates[dbField] = newVal;
        events.push({ field, oldValue: oldStr, newValue: newStr });
      }
    };

    const status = resolveImportStatus(mapped.status ?? undefined, mapped.notes ?? undefined);
    if (status) setField("status", "status", status, existing.status);

    if (mapped.notes) setField("notes", "notes", mapped.notes, existing.notes);
    if (mapped.description) updates.description = mapped.description;
    if (mapped.poNumber) updates.poNumber = mapped.poNumber;
    if (mapped.quantity != null) updates.quantity = mapped.quantity;
    if (mapped.unitPrice != null) updates.unitPrice = mapped.unitPrice;
    if (mapped.totalPrice != null) updates.totalPrice = mapped.totalPrice;

    const orderDate = parseDate(mapped.orderDate ?? undefined);
    if (orderDate) updates.orderDate = orderDate;

    const expectedDelivery = parseDate(mapped.expectedDeliveryDate ?? undefined);
    if (expectedDelivery) updates.expectedDeliveryDate = expectedDelivery;

    const leavingOsFactory = parseDate(mapped.leavingOsFactoryDate ?? undefined);
    if (leavingOsFactory) updates.leavingOsFactoryDate = leavingOsFactory;

    const actualDelivery = parseDate(mapped.actualDeliveryDate ?? undefined);
    if (actualDelivery) updates.actualDeliveryDate = actualDelivery;

    if (Object.keys(updates).length === 0) {
      result.skipped++;
      continue;
    }

    updates.source = OrderSource.CSV_IMPORT;
    if (importBatchId) updates.importBatchId = importBatchId;

    await prisma.order.update({
      where: { id: existing.id },
      data: updates,
    });

    if (events.length > 0) {
      await prisma.orderEvent.createMany({
        data: events.map((e) => ({
          orderId: existing.id,
          field: e.field,
          oldValue: e.oldValue,
          newValue: e.newValue,
          source: OrderSource.CSV_IMPORT,
        })),
      });
    }

    result.updated++;
  }

  return result;
}

export function generateUnmatchedCsv(
  notFound: CsvUpdateResult["notFound"]
): string {
  if (notFound.length === 0) return "";

  const headers = Object.keys(notFound[0].data);
  const rows = notFound.map((item) => ({
    _row: String(item.row),
    _orderNumber: item.orderNumber,
    ...item.data,
  }));

  return Papa.unparse({
    fields: ["_row", "_orderNumber", ...headers],
    data: rows.map((row) =>
      ["_row", "_orderNumber", ...headers].map((h) => row[h as keyof typeof row] ?? "")
    ),
  });
}
