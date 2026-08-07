import { NextRequest, NextResponse } from "next/server";
import {
  assertAccountManagerClientAccess,
  isAccountManager,
  requireAdminOrAccountManager,
} from "@/lib/auth";
import { commitPdfImport } from "@/lib/orders";
import { ParsedOrderRow } from "@/types/orders";

export async function POST(request: NextRequest) {
  let session: Awaited<ReturnType<typeof requireAdminOrAccountManager>>;
  try {
    session = await requireAdminOrAccountManager();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

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

  if (isAccountManager(session)) {
    try {
      await assertAccountManagerClientAccess(session.user.id, clientId);
    } catch {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const result = await commitPdfImport({
    clientId,
    batchId,
    rows,
    skipDuplicates,
  });

  return NextResponse.json(result);
}
