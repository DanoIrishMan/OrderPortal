import ExcelJS from "exceljs";
import { prisma } from "./db";
import { EXPORT_COLUMNS, ORDER_STATUS_LABELS } from "./constants";
import { formatDate, formatDateTime, formatSectionLabel } from "./utils";
import { OrderStatus, Prisma } from "@prisma/client";

type ExportOrder = {
  orderNumber: string;
  section: string | null;
  orderDate: Date | null;
  poNumber: string | null;
  description: string | null;
  quantity: number | null;
  unitPrice: number | null;
  totalPrice: number | null;
  status: OrderStatus;
  expectedDeliveryDate: Date | null;
  actualDeliveryDate: Date | null;
  notes: string | null;
  updatedAt: Date;
};

function orderToRow(order: ExportOrder, clubName?: string): Record<string, string | number> {
  return {
    orderNumber: order.orderNumber,
    section: formatSectionLabel(order.section, clubName),
    orderDate: formatDate(order.orderDate),
    poNumber: order.poNumber ?? "",
    description: order.description ?? "",
    quantity: order.quantity ?? "",
    unitPrice: order.unitPrice ?? "",
    totalPrice: order.totalPrice ?? "",
    status: ORDER_STATUS_LABELS[order.status],
    expectedDeliveryDate: formatDate(order.expectedDeliveryDate),
    actualDeliveryDate: formatDate(order.actualDeliveryDate),
    notes: order.notes ?? "",
    lastUpdated: formatDateTime(order.updatedAt),
  };
}

export async function fetchOrdersForExport(params: {
  clientId: string;
  dateFrom?: Date;
  dateTo?: Date;
  updatedSince?: Date;
  status?: OrderStatus;
  openOnly?: boolean;
}) {
  const where: Prisma.OrderWhereInput = {
    clientId: params.clientId,
  };

  if (params.status) where.status = params.status;
  if (params.openOnly) {
    where.status = { notIn: ["DELIVERED", "CANCELLED"] };
  }
  if (params.updatedSince) {
    where.updatedAt = { gte: params.updatedSince };
  }
  if (params.dateFrom || params.dateTo) {
    where.orderDate = {};
    if (params.dateFrom) where.orderDate.gte = params.dateFrom;
    if (params.dateTo) where.orderDate.lte = params.dateTo;
  }

  return prisma.order.findMany({
    where,
    orderBy: [{ orderDate: "desc" }, { orderNumber: "asc" }],
  });
}

export async function fetchRecentChanges(clientId: string, since: Date) {
  return prisma.orderEvent.findMany({
    where: {
      createdAt: { gte: since },
      order: { clientId },
    },
    include: {
      order: { select: { orderNumber: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function generateExcelBuffer(
  orders: ExportOrder[],
  clientName: string,
  changesSince?: Date
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Pro Club Order Portal";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("Orders");
  sheet.columns = EXPORT_COLUMNS.map((col) => ({
    header: col.header,
    key: col.key,
    width: col.key === "description" || col.key === "notes" ? 40 : 18,
  }));

  sheet.getRow(1).font = { bold: true };
  sheet.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF1E3A5F" },
  };
  sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };

  for (const order of orders) {
    sheet.addRow(orderToRow(order, clientName));
  }

  if (changesSince && orders.length > 0) {
    const orderNumbers = orders.map((o) => o.orderNumber);
    const relevantChanges = await prisma.orderEvent.findMany({
      where: {
        createdAt: { gte: changesSince },
        order: {
          orderNumber: { in: orderNumbers },
        },
      },
      include: { order: { select: { orderNumber: true } } },
      orderBy: { createdAt: "desc" },
    });

    if (relevantChanges.length > 0) {
      const changeSheet = workbook.addWorksheet("Changes This Week");
      changeSheet.columns = [
        { header: "Order Number", key: "orderNumber", width: 18 },
        { header: "Field", key: "field", width: 20 },
        { header: "Old Value", key: "oldValue", width: 25 },
        { header: "New Value", key: "newValue", width: 25 },
        { header: "Changed At", key: "changedAt", width: 22 },
      ];
      changeSheet.getRow(1).font = { bold: true };

      for (const change of relevantChanges) {
        changeSheet.addRow({
          orderNumber: change.order.orderNumber,
          field: change.field,
          oldValue: change.oldValue ?? "",
          newValue: change.newValue ?? "",
          changedAt: formatDateTime(change.createdAt),
        });
      }
    }
  }

  workbook.addWorksheet("_meta").state = "hidden";
  const metaSheet = workbook.getWorksheet("_meta")!;
  metaSheet.addRow(["Client", clientName]);
  metaSheet.addRow(["Generated", formatDateTime(new Date())]);
  metaSheet.addRow(["Order Count", orders.length]);

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

export function generateCsvContent(orders: ExportOrder[], clubName?: string): string {
  const headers = EXPORT_COLUMNS.map((c) => c.header);
  const rows = orders.map((order) => {
    const row = orderToRow(order, clubName);
    return EXPORT_COLUMNS.map((col) => {
      const val = row[col.key];
      const str = String(val ?? "");
      return str.includes(",") || str.includes('"')
        ? `"${str.replace(/"/g, '""')}"`
        : str;
    });
  });

  return [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
}
