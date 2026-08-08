import { NextRequest, NextResponse } from "next/server";
import { ImportType } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  assertAccountManagerClientAccess,
  isAccountManager,
  requireAdminOrAccountManager,
} from "@/lib/auth";
import { findClientIdByRelatedName } from "@/lib/customer-matching";
import { markDuplicates } from "@/lib/orders";
import {
  parseStockOrderXlsx,
  stockOrderToParsedRow,
} from "@/lib/stock-order-xlsx-parser";
import { saveUploadedFile } from "@/lib/upload";

async function getClientsForImport(session: Awaited<ReturnType<typeof requireAdminOrAccountManager>>) {
  if (session.user.role === "ADMIN") {
    return prisma.client.findMany({
      where: { active: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });
  }

  return prisma.client.findMany({
    where: { accountManagerId: session.user.id, active: true },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireAdminOrAccountManager();
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const clientIdOverride = formData.get("clientId") as string | null;

    if (!file) {
      return NextResponse.json({ error: "Excel file is required" }, { status: 400 });
    }

    const lowerName = file.name.toLowerCase();
    if (!lowerName.endsWith(".xlsx") && !lowerName.endsWith(".xls")) {
      return NextResponse.json({ error: "Please upload an Excel (.xlsx) file" }, { status: 400 });
    }

    const { filePath, filename } = await saveUploadedFile(file, "excel/stock-order");
    const parsed = await parseStockOrderXlsx(filePath);
    const row = stockOrderToParsedRow(parsed);

    const clients = await getClientsForImport(session);
    const aliases = await prisma.customerAlias.findMany({
      select: { clientId: true, csvCustomerName: true },
    });

    let suggestedClientId: string | null = null;
    let suggestedClientName: string | null = null;

    if (parsed.customerName) {
      const exact = clients.find(
        (client) => client.name.toLowerCase() === parsed.customerName.toLowerCase()
      );
      if (exact) {
        suggestedClientId = exact.id;
        suggestedClientName = exact.name;
      } else {
        const alias = aliases.find(
          (entry) =>
            entry.csvCustomerName.toLowerCase() === parsed.customerName.toLowerCase() &&
            clients.some((client) => client.id === entry.clientId)
        );
        if (alias) {
          suggestedClientId = alias.clientId;
          suggestedClientName =
            clients.find((client) => client.id === alias.clientId)?.name ?? null;
        } else {
          const related = findClientIdByRelatedName(parsed.customerName, clients, aliases);
          if (related && clients.some((client) => client.id === related.clientId)) {
            suggestedClientId = related.clientId;
            suggestedClientName =
              clients.find((client) => client.id === related.clientId)?.name ?? related.matchedName;
            row.warnings = [
              ...(row.warnings ?? []),
              `Customer matched to ${related.matchedName} from "${parsed.customerName}"`,
            ];
          }
        }
      }
    }

    const clientId = clientIdOverride || suggestedClientId;

    if (clientId && isAccountManager(session)) {
      try {
        await assertAccountManagerClientAccess(session.user.id, clientId);
      } catch {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    const batch = await prisma.importBatch.create({
      data: {
        clientId: clientId ?? undefined,
        type: ImportType.EXCEL,
        status: "PENDING",
        filename,
        filePath,
        rowCount: 1,
        metadata: JSON.stringify({
          customerName: parsed.customerName,
          orderNumber: parsed.orderNumber,
        }),
      },
    });

    let markedRow = row;
    let isDuplicate = false;

    if (clientId) {
      const [marked] = await markDuplicates(clientId, [row]);
      markedRow = marked;
      isDuplicate = !!marked.isDuplicate;
    }

    return NextResponse.json({
      batchId: batch.id,
      filename,
      parsed,
      row: markedRow,
      clients,
      suggestedClientId,
      suggestedClientName,
      clientId,
      isDuplicate,
      warnings: row.warnings ?? [],
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Forbidden") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("Stock order import failed:", error);
    const message = error instanceof Error ? error.message : "Failed to parse Excel file";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
