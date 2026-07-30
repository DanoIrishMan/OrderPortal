import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const clientId = searchParams.get("clientId");

  if (!clientId) {
    return NextResponse.json({ sections: [] });
  }

  if (session.user.role === "CLIENT" && session.user.clientId !== clientId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const rows = await prisma.order.findMany({
    where: {
      clientId,
      section: { not: null },
    },
    select: { section: true },
    distinct: ["section"],
    orderBy: { section: "asc" },
  });

  const sections = rows
    .map((row) => row.section)
    .filter((section): section is string => !!section?.trim());

  return NextResponse.json({ sections });
}
