import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { saveUploadedFile } from "@/lib/upload";
import {
  applyCsvUpdates,
  applyWeeklyCsvImport,
  isSalesRepSummaryCsv,
  parseCsvContent,
  previewWeeklyCsvImport,
  suggestMapping,
} from "@/lib/csv-parser";
import { persistCustomerMappings, ensureClientsForCsvCustomers } from "@/lib/orders";
import { CsvMappingConfig, CustomerMappingValue } from "@/types/orders";

function parseCustomerMappings(raw: string | null): Record<string, CustomerMappingValue> | undefined {
  if (!raw) return undefined;
  return JSON.parse(raw) as Record<string, CustomerMappingValue>;
}

export async function POST(request: NextRequest) {
  await requireAdmin();

  const formData = await request.formData();
  const clientId = formData.get("clientId") as string | null;
  const file = formData.get("file") as File;
  const mappingJson = formData.get("mapping") as string | null;
  const customerMappingsJson = formData.get("customerMappings") as string | null;
  const commit = formData.get("commit") === "true";
  const saveMapping = formData.get("saveMapping") === "true";
  const mappingName = (formData.get("mappingName") as string) || "Default";
  const saveAliases = formData.get("saveAliases") !== "false";

  if (!file) {
    return NextResponse.json({ error: "CSV file is required" }, { status: 400 });
  }

  const content = await file.text();
  const { headers, rows } = parseCsvContent(content);
  const isWeeklyFormat = isSalesRepSummaryCsv(headers);
  const customerMappings = parseCustomerMappings(customerMappingsJson);

  if (isWeeklyFormat) {
    const preview = await previewWeeklyCsvImport(rows, headers, customerMappings);

    if (!commit) {
      const clients = await prisma.client.findMany({
        where: { active: true },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      });

      return NextResponse.json({
        mode: "weekly",
        ...preview,
        clients,
      });
    }

    const { filePath, filename } = await saveUploadedFile(file, "csv/weekly");

    const batch = await prisma.importBatch.create({
      data: {
        clientId: null,
        type: "CSV",
        status: "PENDING",
        filename,
        filePath,
        rowCount: rows.length,
      },
    });

    const { mappings: finalMappings, clientsCreated, aliasesCreated } =
      await ensureClientsForCsvCustomers(preview.unmappedCustomers, customerMappings);

    const mergedMappings: Record<string, CustomerMappingValue> = {
      ...customerMappings,
      ...finalMappings,
    };

    if (saveAliases) {
      await persistCustomerMappings(mergedMappings);
    }

    const result = await applyWeeklyCsvImport(
      rows,
      headers,
      batch.id,
      mergedMappings
    );

    result.clientsCreated = clientsCreated;
    result.aliasesCreated = aliasesCreated;

    await prisma.importBatch.update({
      where: { id: batch.id },
      data: {
        status: "COMMITTED",
        successCount: result.created + result.updated,
        errorCount: result.errors.length,
        errors: result.errors.length > 0 ? JSON.stringify(result.errors) : null,
        metadata: JSON.stringify({
          mode: "weekly",
          created: result.created,
          updated: result.updated,
          skipped: result.skipped,
          unmappedCustomers: result.unmappedCustomers,
          byClient: result.byClient,
          customerMappings: mergedMappings,
          clientsCreated,
          aliasesCreated,
        }),
        committedAt: new Date(),
      },
    });

    return NextResponse.json({
      mode: "weekly",
      batchId: batch.id,
      ...result,
    });
  }

  if (!clientId) {
    return NextResponse.json(
      { error: "Client is required for non–Sales Rep Summary CSV files" },
      { status: 400 }
    );
  }

  const client = await prisma.client.findUnique({ where: { id: clientId } });
  if (!client) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  let mapping: CsvMappingConfig = suggestMapping(headers);
  if (mappingJson) {
    mapping = JSON.parse(mappingJson) as CsvMappingConfig;
  }

  if (!commit) {
    return NextResponse.json({
      mode: "legacy",
      clientId,
      clientName: client.name,
      headers,
      rows: rows.slice(0, 20),
      totalRows: rows.length,
      suggestedMapping: mapping,
    });
  }

  const { filePath, filename } = await saveUploadedFile(file, `csv/${clientId}`);

  const batch = await prisma.importBatch.create({
    data: {
      clientId,
      type: "CSV",
      status: "PENDING",
      filename,
      filePath,
      rowCount: rows.length,
      metadata: JSON.stringify({ mapping, mode: "legacy" }),
    },
  });

  const result = await applyCsvUpdates(clientId, rows, mapping, batch.id, headers);

  await prisma.importBatch.update({
    where: { id: batch.id },
    data: {
      status: "COMMITTED",
      successCount: result.updated,
      errorCount: result.notFound.length,
      errors: result.notFound.length > 0 ? JSON.stringify(result.notFound) : null,
      committedAt: new Date(),
    },
  });

  if (saveMapping) {
    await prisma.csvColumnMapping.create({
      data: {
        clientId,
        name: mappingName,
        mapping: JSON.stringify(mapping),
      },
    });
  }

  return NextResponse.json({
    mode: "legacy",
    batchId: batch.id,
    ...result,
  });
}

export async function GET(request: NextRequest) {
  await requireAdmin();
  const { searchParams } = new URL(request.url);
  const clientId = searchParams.get("clientId");

  if (!clientId) {
    return NextResponse.json({ error: "clientId required" }, { status: 400 });
  }

  const mappings = await prisma.csvColumnMapping.findMany({
    where: { clientId },
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json(
    mappings.map((m) => ({
      ...m,
      mapping: JSON.parse(m.mapping),
    }))
  );
}
