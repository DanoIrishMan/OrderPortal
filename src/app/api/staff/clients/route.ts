import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireStaff } from "@/lib/auth";

export async function GET() {
  try {
    const session = await requireStaff();
    if (session.user.staffRole !== "ACCOUNT_MANAGER") {
      return NextResponse.json({ clients: [] });
    }

    const clients = await prisma.client.findMany({
      where: { accountManagerId: session.user.id, active: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });

    return NextResponse.json({ clients });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }
}
