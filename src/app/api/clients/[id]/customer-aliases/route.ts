import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, context: RouteContext) {
  await requireAdmin();
  const { id } = await context.params;

  const client = await prisma.client.findUnique({ where: { id } });
  if (!client) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  const aliases = await prisma.customerAlias.findMany({
    where: { clientId: id },
    orderBy: { csvCustomerName: "asc" },
  });

  return NextResponse.json(aliases);
}

export async function POST(request: NextRequest, context: RouteContext) {
  await requireAdmin();
  const { id } = await context.params;

  const client = await prisma.client.findUnique({ where: { id } });
  if (!client) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  const body = await request.json();
  const csvCustomerName = body.csvCustomerName?.trim();

  if (!csvCustomerName) {
    return NextResponse.json({ error: "CSV customer name is required" }, { status: 400 });
  }

  try {
    const alias = await prisma.customerAlias.upsert({
      where: { csvCustomerName },
      create: { csvCustomerName, clientId: id },
      update: { clientId: id },
    });

    return NextResponse.json(alias);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to save alias" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  await requireAdmin();
  const { id } = await context.params;
  const { searchParams } = new URL(request.url);
  const aliasId = searchParams.get("aliasId");

  if (!aliasId) {
    return NextResponse.json({ error: "aliasId is required" }, { status: 400 });
  }

  const alias = await prisma.customerAlias.findFirst({
    where: { id: aliasId, clientId: id },
  });

  if (!alias) {
    return NextResponse.json({ error: "Alias not found" }, { status: 404 });
  }

  await prisma.customerAlias.delete({ where: { id: aliasId } });

  return NextResponse.json({ success: true });
}
