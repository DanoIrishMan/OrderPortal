import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { commitPdfImport } from "@/lib/orders";
import { ParsedOrderRow } from "@/types/orders";

export async function POST(request: NextRequest) {
  await requireAdmin();
  const body = await request.json();
  const { clientId, batchId, rows, skipDuplicates = true } = body as {
    clientId: string;
    batchId: string;
    rows: ParsedOrderRow[];
    skipDuplicates?: boolean;
  };

  if (!clientId || !batchId || !rows?.length) {
    return NextResponse.json(
      { error: "clientId, batchId, and rows are required" },
      { status: 400 }
    );
  }

  const result = await commitPdfImport({
    clientId,
    batchId,
    rows,
    skipDuplicates,
  });

  return NextResponse.json(result);
}
