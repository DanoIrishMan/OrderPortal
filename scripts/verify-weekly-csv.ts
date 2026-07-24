import fs from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";
import {
  applyWeeklyCsvImport,
  parseCsvContent,
  previewWeeklyCsvImport,
} from "../src/lib/csv-parser";

const prisma = new PrismaClient();

async function main() {
  const samplePath = path.join(
    process.cwd(),
    "samples",
    "Sales_Rep_Summary_Daniel_Ennis.csv"
  );
  const content = fs.readFileSync(samplePath, "utf-8");
  const { headers, rows } = parseCsvContent(content);

  const preview = await previewWeeklyCsvImport(rows, headers);
  console.log("Preview:", {
    totalRows: preview.totalRows,
    wouldCreate: preview.wouldCreate,
    wouldUpdate: preview.wouldUpdate,
    unmapped: preview.unmappedCustomers,
    clubs: preview.byClient.map((c) => `${c.clientName}: +${c.wouldCreate}/~${c.wouldUpdate}`),
  });

  const batch = await prisma.importBatch.create({
    data: {
      clientId: null,
      type: "CSV",
      status: "PENDING",
      filename: "test-import.csv",
      filePath: samplePath,
      rowCount: rows.length,
    },
  });

  const firstImport = await applyWeeklyCsvImport(rows, headers, batch.id);
  console.log("First import:", {
    created: firstImport.created,
    updated: firstImport.updated,
    skipped: firstImport.skipped,
    errors: firstImport.errors.length,
  });

  const batch2 = await prisma.importBatch.create({
    data: {
      clientId: null,
      type: "CSV",
      status: "PENDING",
      filename: "test-import-2.csv",
      filePath: samplePath,
      rowCount: rows.length,
    },
  });

  const secondImport = await applyWeeklyCsvImport(rows, headers, batch2.id);
  console.log("Second import (same CSV):", {
    created: secondImport.created,
    updated: secondImport.updated,
    skipped: secondImport.skipped,
  });

  const shelbourneOrders = await prisma.order.count({
    where: { clientId: "seed-shelbourne" },
  });
  const bohemiansOrders = await prisma.order.count({
    where: { clientId: "seed-bohemians" },
  });

  console.log("Order counts:", { shelbourneOrders, bohemiansOrders });

  if (firstImport.created === 0) {
    throw new Error("Expected orders to be created on first import");
  }
  if (secondImport.created > 0) {
    throw new Error("Expected no new orders on second import (upsert only)");
  }
  if (secondImport.updated === 0 && secondImport.skipped === 0) {
    throw new Error("Expected updates or skips on second import");
  }

  console.log("Verification passed");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
