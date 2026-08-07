import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  assertAccountManagerClientAccess,
  isAccountManager,
  requireAdminOrAccountManager,
} from "@/lib/auth";
import { saveUploadedFile } from "@/lib/upload";
import { parsePdfFile } from "@/lib/pdf-parser";
import { markDuplicates } from "@/lib/orders";
import { ParsedOrderRow } from "@/types/orders";

type ReviewRow = ParsedOrderRow & { batchId?: string; sourceFile?: string };

export async function POST(request: NextRequest) {
  try {
    const session = await requireAdminOrAccountManager();

    const formData = await request.formData();
    const clientId = formData.get("clientId") as string;
    const files = formData.getAll("files") as File[];

    if (!clientId) {
      return NextResponse.json({ error: "Client is required" }, { status: 400 });
    }

    if (isAccountManager(session)) {
      try {
        await assertAccountManagerClientAccess(session.user.id, clientId);
      } catch {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    if (files.length === 0) {
      return NextResponse.json({ error: "At least one PDF file is required" }, { status: 400 });
    }

    const client = await prisma.client.findUnique({ where: { id: clientId } });
    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    let allRows: ReviewRow[] = [];
    const allWarnings: string[] = [];
    const batchIds: string[] = [];

    for (const file of files) {
      if (!file.name.toLowerCase().endsWith(".pdf")) {
        allWarnings.push(`${file.name}: skipped (not a PDF)`);
        continue;
      }

      const { filePath, filename } = await saveUploadedFile(file, `pdf/${clientId}`);
      const { text, rows, warnings } = await parsePdfFile(filePath);
      allWarnings.push(...warnings.map((w) => `${filename}: ${w}`));

      const batch = await prisma.importBatch.create({
        data: {
          clientId,
          type: "PDF",
          status: "PENDING",
          filename,
          filePath,
          rowCount: rows.length,
          metadata: JSON.stringify({ extractedTextPreview: text.slice(0, 2000) }),
        },
      });

      batchIds.push(batch.id);

      allRows.push(
        ...rows.map((row) => ({ ...row, batchId: batch.id, sourceFile: filename }))
      );
    }

    const markedRows = await markDuplicates(
      clientId,
      allRows.map(({ batchId, sourceFile, ...row }) => row)
    );

    const finalRows = markedRows.map((row, index) => ({
      ...row,
      batchId: allRows[index]?.batchId ?? batchIds[0],
      sourceFile: allRows[index]?.sourceFile,
    }));

    return NextResponse.json({
      clientId,
      clientName: client.name,
      batchIds,
      rows: finalRows,
      warnings: allWarnings,
      duplicateCount: finalRows.filter((r) => r.isDuplicate).length,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Forbidden") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("PDF import failed:", error);
    const message = error instanceof Error ? error.message : "Failed to parse PDF";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
