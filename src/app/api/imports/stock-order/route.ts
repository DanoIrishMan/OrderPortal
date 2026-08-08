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
  StockOrderParseResult,
} from "@/lib/stock-order-xlsx-parser";
import { saveUploadedFile } from "@/lib/upload";
import { ParsedOrderRow } from "@/types/orders";

type ClientOption = { id: string; name: string };
type AliasOption = { clientId: string; csvCustomerName: string };

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

function matchClientForStockOrder(
  parsed: StockOrderParseResult,
  row: ParsedOrderRow,
  clients: ClientOption[],
  aliases: AliasOption[],
  clientIdOverride: string | null
) {
  let suggestedClientId: string | null = null;
  let suggestedClientName: string | null = null;
  const warnings = [...(row.warnings ?? [])];

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
          warnings.push(
            `Customer matched to ${related.matchedName} from "${parsed.customerName}"`
          );
        }
      }
    }
  }

  const clientId = clientIdOverride || suggestedClientId;

  return {
    row: { ...row, warnings },
    suggestedClientId,
    suggestedClientName,
    clientId,
  };
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireAdminOrAccountManager();
    const formData = await request.formData();
    const clientIdOverride = (formData.get("clientId") as string | null) || null;
    const files = [
      ...formData.getAll("files"),
      ...(formData.get("file") ? [formData.get("file")] : []),
    ].filter((entry): entry is File => entry instanceof File);

    if (files.length === 0) {
      return NextResponse.json({ error: "At least one Excel file is required" }, { status: 400 });
    }

    const clients = await getClientsForImport(session);
    const aliases = await prisma.customerAlias.findMany({
      select: { clientId: true, csvCustomerName: true },
    });

    if (clientIdOverride && isAccountManager(session)) {
      try {
        await assertAccountManagerClientAccess(session.user.id, clientIdOverride);
      } catch {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    const allWarnings: string[] = [];
    const items: Array<{
      batchId: string;
      filename: string;
      parsed: StockOrderParseResult;
      row: ParsedOrderRow;
      suggestedClientId: string | null;
      suggestedClientName: string | null;
      clientId: string | null;
      isDuplicate: boolean;
    }> = [];

    for (const file of files) {
      const lowerName = file.name.toLowerCase();
      if (!lowerName.endsWith(".xlsx") && !lowerName.endsWith(".xls")) {
        allWarnings.push(`${file.name}: skipped (not an Excel file)`);
        continue;
      }

      try {
        const { filePath, filename } = await saveUploadedFile(file, "excel/stock-order");
        const parsed = await parseStockOrderXlsx(filePath);
        const baseRow = stockOrderToParsedRow(parsed);
        const matched = matchClientForStockOrder(
          parsed,
          baseRow,
          clients,
          aliases,
          clientIdOverride
        );

        if (matched.clientId && isAccountManager(session) && !clientIdOverride) {
          try {
            await assertAccountManagerClientAccess(session.user.id, matched.clientId);
          } catch {
            allWarnings.push(`${filename}: no access to matched client — assign manually`);
            matched.clientId = null;
          }
        }

        allWarnings.push(...(matched.row.warnings ?? []).map((w) => `${filename}: ${w}`));
        if (parsed.warnings.length > 0) {
          allWarnings.push(...parsed.warnings.map((w) => `${filename}: ${w}`));
        }

        const batch = await prisma.importBatch.create({
          data: {
            clientId: matched.clientId ?? undefined,
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

        items.push({
          batchId: batch.id,
          filename,
          parsed,
          row: matched.row,
          suggestedClientId: matched.suggestedClientId,
          suggestedClientName: matched.suggestedClientName,
          clientId: matched.clientId,
          isDuplicate: false,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to parse file";
        allWarnings.push(`${file.name}: ${message}`);
      }
    }

    if (items.length === 0) {
      return NextResponse.json(
        { error: "No Excel files could be parsed", warnings: allWarnings },
        { status: 400 }
      );
    }

    const itemsByClient = new Map<string, number[]>();
    items.forEach((item, index) => {
      if (!item.clientId) return;
      const indices = itemsByClient.get(item.clientId) ?? [];
      indices.push(index);
      itemsByClient.set(item.clientId, indices);
    });

    for (const [clientId, indices] of itemsByClient.entries()) {
      const rows = indices.map((index) => items[index].row);
      const marked = await markDuplicates(clientId, rows);
      marked.forEach((row, markedIndex) => {
        const itemIndex = indices[markedIndex];
        items[itemIndex].row = row;
        items[itemIndex].isDuplicate = !!row.isDuplicate;
      });
    }

    return NextResponse.json({
      items,
      clients,
      clientId: clientIdOverride,
      warnings: allWarnings,
      duplicateCount: items.filter((item) => item.isDuplicate).length,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Forbidden") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("Stock order import failed:", error);
    const message = error instanceof Error ? error.message : "Failed to parse Excel files";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
