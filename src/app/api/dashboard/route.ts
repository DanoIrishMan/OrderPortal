import { NextRequest, NextResponse } from "next/server";
import { getDashboardStats } from "@/lib/orders";
import { isAccountManager, requireAdminOrAccountManager } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const session = await requireAdminOrAccountManager();
    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get("clientId") ?? undefined;

    const stats = isAccountManager(session)
      ? await getDashboardStats({ accountManagerId: session.user.id })
      : await getDashboardStats(clientId ? { clientId } : undefined);

    return NextResponse.json(stats);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }
}
