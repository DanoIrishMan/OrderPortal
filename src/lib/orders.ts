import { prisma } from "./db";
import { CustomerMappingValue, ParsedOrderRow } from "@/types/orders";
import { normalizeOrderNumber, parseDate, resolveImportStatus, getDisplayStatus } from "./utils";
import { findClientIdByRelatedName } from "./customer-matching";
import { DISPLAY_STATUS_ORDER, DisplayOrderStatus } from "./constants";
import { Order, OrderSource, OrderStatus } from "@prisma/client";

export async function markDuplicates(
  clientId: string,
  rows: ParsedOrderRow[]
): Promise<ParsedOrderRow[]> {
  const existing = await prisma.order.findMany({
    where: { clientId },
    select: { id: true, orderNumber: true },
  });

  const existingMap = new Map(
    existing.map((o) => [normalizeOrderNumber(o.orderNumber), o.id])
  );

  return rows.map((row) => {
    const existingId = existingMap.get(row.orderNumber);
    return {
      ...row,
      isDuplicate: !!existingId,
      existingOrderId: existingId,
      warnings: existingId
        ? [...(row.warnings ?? []), "Order number already exists for this client"]
        : row.warnings,
    };
  });
}

function rowToOrderFields(
  row: ParsedOrderRow,
  clientId: string,
  source: OrderSource,
  importBatchId?: string
) {
  const status = (resolveImportStatus(row.status, row.notes) ?? "RECEIVED") as OrderStatus;

  return {
    clientId,
    orderNumber: row.orderNumber,
    section: row.section ?? row.csvCustomerName ?? null,
    orderDate: parseDate(row.orderDate ?? undefined),
    poNumber: row.poNumber ?? null,
    description: row.description ?? null,
    lineItems: row.lineItems ? JSON.stringify(row.lineItems) : null,
    quantity: row.quantity ?? null,
    unitPrice: row.unitPrice ?? null,
    totalPrice: row.totalPrice ?? null,
    status,
    expectedDeliveryDate: parseDate(row.expectedDeliveryDate ?? undefined),
    leavingOsFactoryDate: parseDate(row.leavingOsFactoryDate ?? undefined),
    actualDeliveryDate: parseDate(row.actualDeliveryDate ?? undefined),
    deliveredAt: status === "DELIVERED" ? new Date() : null,
    notes: row.notes ?? null,
    source,
    importBatchId: importBatchId ?? null,
  };
}

type OrderSnapshot = Pick<
  Order,
  | "id"
  | "status"
  | "notes"
  | "description"
  | "poNumber"
  | "section"
  | "quantity"
  | "unitPrice"
  | "totalPrice"
  | "orderDate"
  | "expectedDeliveryDate"
  | "leavingOsFactoryDate"
  | "actualDeliveryDate"
  | "deliveredAt"
>;

function buildOrderUpdates(
  existing: OrderSnapshot,
  data: ReturnType<typeof rowToOrderFields>
) {
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

  setField("status", "status", data.status, existing.status);
  if (data.status === "DELIVERED" && existing.status !== "DELIVERED") {
    updates.deliveredAt = new Date();
    if (!existing.actualDeliveryDate && !data.actualDeliveryDate) {
      updates.actualDeliveryDate = new Date();
    }
  } else if (data.status !== "DELIVERED" && existing.status === "DELIVERED") {
    updates.deliveredAt = null;
  }
  if (data.notes) setField("notes", "notes", data.notes, existing.notes);
  if (data.description) updates.description = data.description;
  if (data.poNumber) updates.poNumber = data.poNumber;
  if (data.section) setField("section", "section", data.section, existing.section);
  if (data.quantity != null) updates.quantity = data.quantity;
  if (data.unitPrice != null) updates.unitPrice = data.unitPrice;
  if (data.totalPrice != null) updates.totalPrice = data.totalPrice;
  if (data.orderDate) updates.orderDate = data.orderDate;
  if (data.expectedDeliveryDate) updates.expectedDeliveryDate = data.expectedDeliveryDate;
  if (data.leavingOsFactoryDate) updates.leavingOsFactoryDate = data.leavingOsFactoryDate;
  if (data.actualDeliveryDate) updates.actualDeliveryDate = data.actualDeliveryDate;
  if (data.lineItems) updates.lineItems = data.lineItems;

  updates.source = data.source;
  if (data.importBatchId) updates.importBatchId = data.importBatchId;

  return { updates, events };
}

/** Move orders that were imported under the wrong club when customer→client mapping changes. */
export async function reassignMisplacedOrder(params: {
  orderNumber: string;
  targetClientId: string;
  csvCustomerName: string | null;
}): Promise<void> {
  if (!params.orderNumber.trim()) return;

  const misplaced = await prisma.order.findMany({
    where: {
      orderNumber: params.orderNumber,
      clientId: { not: params.targetClientId },
    },
    select: { id: true, section: true, notes: true },
  });

  for (const order of misplaced) {
    const belongsToCustomer =
      !order.section ||
      order.section === params.csvCustomerName ||
      (params.csvCustomerName
        ? order.notes?.includes(`Customer: ${params.csvCustomerName}`)
        : false);

    if (!belongsToCustomer) continue;

    const atTarget = await prisma.order.findUnique({
      where: {
        clientId_orderNumber: {
          clientId: params.targetClientId,
          orderNumber: params.orderNumber,
        },
      },
      select: { id: true },
    });

    if (atTarget) {
      await prisma.order.delete({ where: { id: order.id } });
    } else {
      await prisma.order.update({
        where: { id: order.id },
        data: { clientId: params.targetClientId },
      });
    }
  }
}

export async function upsertOrderFromImport(params: {
  clientId: string;
  row: ParsedOrderRow;
  importBatchId?: string;
  source: OrderSource;
}): Promise<"created" | "updated" | "skipped"> {
  if (!params.row.orderNumber?.trim()) {
    return "skipped";
  }

  const csvCustomerName = params.row.section ?? params.row.csvCustomerName ?? null;

  await reassignMisplacedOrder({
    orderNumber: params.row.orderNumber,
    targetClientId: params.clientId,
    csvCustomerName,
  });

  const data = rowToOrderFields(
    params.row,
    params.clientId,
    params.source,
    params.importBatchId
  );

  const existing = await prisma.order.findUnique({
    where: {
      clientId_orderNumber: {
        clientId: params.clientId,
        orderNumber: params.row.orderNumber,
      },
    },
    select: {
      id: true,
      status: true,
      notes: true,
      description: true,
      poNumber: true,
      section: true,
      quantity: true,
      unitPrice: true,
      totalPrice: true,
      orderDate: true,
      expectedDeliveryDate: true,
      leavingOsFactoryDate: true,
      actualDeliveryDate: true,
      deliveredAt: true,
    },
  });

  if (!existing) {
    await prisma.order.create({ data });
    return "created";
  }

  const { updates, events } = buildOrderUpdates(existing, data);
  const meaningfulUpdates = Object.keys(updates).filter(
    (key) => key !== "source" && key !== "importBatchId"
  );

  if (meaningfulUpdates.length === 0 && events.length === 0) {
    return "skipped";
  }

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
        source: params.source,
      })),
    });
  }

  return "updated";
}

export async function persistCustomerMappings(
  mappings: Record<string, CustomerMappingValue>
): Promise<void> {
  for (const [csvCustomerName, value] of Object.entries(mappings)) {
    if (value === "skip" || !value) continue;

    await prisma.customerAlias.upsert({
      where: { csvCustomerName },
      create: { csvCustomerName, clientId: value },
      update: { clientId: value },
    });
  }
}

function contactEmailForCsvCustomer(csvCustomerName: string): string {
  const slug = csvCustomerName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "")
    .slice(0, 40);

  return `orders.${slug || "client"}@portal.local`;
}

/** Find or create a portal client for a CSV customer name and link the alias. */
export async function ensureClientForCsvCustomer(
  csvCustomerName: string
): Promise<{ clientId: string; created: boolean; aliased?: boolean }> {
  const existingAlias = await prisma.customerAlias.findUnique({
    where: { csvCustomerName },
  });
  if (existingAlias) {
    return { clientId: existingAlias.clientId, created: false };
  }

  const existingClient = await prisma.client.findFirst({
    where: { name: csvCustomerName },
  });
  if (existingClient) {
    await prisma.customerAlias.create({
      data: { csvCustomerName, clientId: existingClient.id },
    });
    return { clientId: existingClient.id, created: false, aliased: true };
  }

  const [clients, aliases] = await Promise.all([
    prisma.client.findMany({ where: { active: true }, select: { id: true, name: true } }),
    prisma.customerAlias.findMany({ select: { clientId: true, csvCustomerName: true } }),
  ]);

  const related = findClientIdByRelatedName(csvCustomerName, clients, aliases);
  if (related) {
    await prisma.customerAlias.create({
      data: { csvCustomerName, clientId: related.clientId },
    });
    return { clientId: related.clientId, created: false, aliased: true };
  }

  const client = await prisma.client.create({
    data: {
      name: csvCustomerName,
      contactEmail: contactEmailForCsvCustomer(csvCustomerName),
      active: true,
    },
  });

  await prisma.customerAlias.create({
    data: { csvCustomerName, clientId: client.id },
  });

  return { clientId: client.id, created: true };
}

/** Auto-create clients for CSV customer names that are not yet mapped (unless skipped). */
export async function ensureClientsForCsvCustomers(
  csvCustomerNames: string[],
  customerMappings?: Record<string, CustomerMappingValue>
): Promise<{
  mappings: Record<string, CustomerMappingValue>;
  clientsCreated: string[];
  aliasesCreated: string[];
}> {
  const mappings: Record<string, CustomerMappingValue> = { ...(customerMappings ?? {}) };
  const clientsCreated: string[] = [];
  const aliasesCreated: string[] = [];

  for (const csvCustomerName of csvCustomerNames) {
    if (mappings[csvCustomerName] === "skip") continue;
    if (mappings[csvCustomerName] && mappings[csvCustomerName] !== "skip") continue;

    const result = await ensureClientForCsvCustomer(csvCustomerName);
    mappings[csvCustomerName] = result.clientId;
    if (result.created) clientsCreated.push(csvCustomerName);
    if (result.aliased) aliasesCreated.push(csvCustomerName);
  }

  return { mappings, clientsCreated, aliasesCreated };
}

export async function commitPdfImport(params: {
  clientId: string;
  batchId: string;
  rows: ParsedOrderRow[];
  skipDuplicates?: boolean;
}) {
  let created = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const row of params.rows) {
    if (!row.orderNumber?.trim()) {
      skipped++;
      continue;
    }

    if (row.isDuplicate && params.skipDuplicates) {
      skipped++;
      continue;
    }

    try {
      const status = (resolveImportStatus(row.status, row.notes) ?? "RECEIVED") as OrderStatus;
      const data = {
        clientId: params.clientId,
        orderNumber: row.orderNumber,
        section: row.section ?? row.csvCustomerName ?? null,
        orderDate: parseDate(row.orderDate ?? undefined),
        poNumber: row.poNumber ?? null,
        description: row.description ?? null,
        lineItems: row.lineItems ? JSON.stringify(row.lineItems) : null,
        quantity: row.quantity ?? null,
        unitPrice: row.unitPrice ?? null,
        totalPrice: row.totalPrice ?? null,
        status,
        expectedDeliveryDate: parseDate(row.expectedDeliveryDate ?? undefined),
        leavingOsFactoryDate: parseDate(row.leavingOsFactoryDate ?? undefined),
        actualDeliveryDate: parseDate(row.actualDeliveryDate ?? undefined),
        deliveredAt: status === "DELIVERED" ? new Date() : null,
        notes: row.notes ?? null,
        source: OrderSource.PDF_IMPORT,
        importBatchId: params.batchId,
      };

      if (row.isDuplicate && row.existingOrderId) {
        await prisma.order.update({
          where: { id: row.existingOrderId },
          data,
        });
      } else {
        await prisma.order.create({ data });
      }

      created++;
    } catch (err) {
      errors.push(`Order ${row.orderNumber}: ${err instanceof Error ? err.message : "Unknown error"}`);
      skipped++;
    }
  }

  await prisma.importBatch.update({
    where: { id: params.batchId },
    data: {
      status: "COMMITTED",
      successCount: created,
      errorCount: errors.length,
      errors: errors.length > 0 ? JSON.stringify(errors) : null,
      committedAt: new Date(),
    },
  });

  return { created, skipped, errors };
}

export async function getDashboardStats(clientId?: string) {
  const where = clientId ? { clientId } : {};

  const [totalOrders, ordersForDisplay, recentImports, overdueOrders] = await Promise.all([
    prisma.order.count({ where }),
    prisma.order.findMany({
      where,
      select: { status: true, expectedDeliveryDate: true },
    }),
    prisma.importBatch.findMany({
      where: clientId ? { clientId } : {},
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { client: { select: { name: true } } },
    }),
    prisma.order.count({
      where: {
        ...where,
        status: { notIn: ["DELIVERED", "CANCELLED"] },
        expectedDeliveryDate: { lt: new Date() },
      },
    }),
  ]);

  const displayStatusCounts = new Map<DisplayOrderStatus, number>();
  for (const order of ordersForDisplay) {
    const display = getDisplayStatus(order);
    displayStatusCounts.set(display, (displayStatusCounts.get(display) ?? 0) + 1);
  }

  return {
    totalOrders,
    displayStatusCounts: DISPLAY_STATUS_ORDER.map((status) => ({
      status,
      count: displayStatusCounts.get(status) ?? 0,
    })),
    recentImports,
    overdueOrders,
  };
}
