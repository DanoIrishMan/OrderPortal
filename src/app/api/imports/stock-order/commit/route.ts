import { NextRequest, NextResponse } from "next/server";
import {
  assertAccountManagerClientAccess,
  isAccountManager,
  requireAdminOrAccountManager,
} from "@/lib/auth";
import { commitStockOrderImport, commitStockOrderImports } from "@/lib/orders";
import { ParsedOrderRow } from "@/types/orders";

export async function POST(request: NextRequest) {
  let session: Awaited<ReturnType<typeof requireAdminOrAccountManager>>;
  try {
    session = await requireAdminOrAccountManager();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const body = await request.json();
  const { clientId, batchId, row, rows, items, skipDuplicates = true } = body as {
    clientId?: string;
    batchId?: string;
    row?: ParsedOrderRow;
    rows?: ParsedOrderRow[];
    items?: Array<{ clientId: string; batchId: string; row: ParsedOrderRow }>;
    skipDuplicates?: boolean;
  };

  if (items?.length) {
    for (const item of items) {
      if (!item.clientId || !item.batchId || !item.row?.orderNumber) {
        return NextResponse.json(
          { error: "Each item needs clientId, batchId, and row with orderNumber" },
          { status: 400 }
        );
      }

      if (isAccountManager(session)) {
        try {
          await assertAccountManagerClientAccess(session.user.id, item.clientId);
        } catch {
          return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
      }
    }

    const result = await commitStockOrderImports({ items, skipDuplicates });
    return NextResponse.json(result);
  }

  const commitRows = rows ?? (row ? [row] : []);
  if (!clientId || !batchId || commitRows.length === 0) {
    return NextResponse.json(
      { error: "items, or clientId, batchId, and row(s) are required" },
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

  if (commitRows.length === 1) {
    const result = await commitStockOrderImport({
      clientId,
      batchId,
      row: commitRows[0],
      skipDuplicates,
    });
    return NextResponse.json(result);
  }

  const result = await commitStockOrderImports({
    items: commitRows.map((commitRow) => ({ clientId, batchId, row: commitRow })),
    skipDuplicates,
  });

  return NextResponse.json(result);
}
