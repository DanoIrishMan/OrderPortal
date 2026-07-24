import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getClientFilter, getSession, requireAdmin } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const clientId = searchParams.get("clientId");
  const status = searchParams.get("status");
  const search = searchParams.get("search");
  const clientFilter = getClientFilter(session);

  const where: Record<string, unknown> = {};

  if (clientFilter) {
    where.clientId = clientFilter;
  } else if (clientId) {
    where.clientId = clientId;
  }

  if (status) where.status = status;

  if (search) {
    where.OR = [
      { orderNumber: { contains: search } },
      { poNumber: { contains: search } },
      { description: { contains: search } },
    ];
  }

  const orders = await prisma.order.findMany({
    where,
    include: {
      client: { select: { name: true } },
    },
    orderBy: [{ updatedAt: "desc" }],
    take: 200,
  });

  return NextResponse.json(orders);
}

export async function POST(request: NextRequest) {
  await requireAdmin();
  const body = await request.json();

  const order = await prisma.order.create({
    data: {
      clientId: body.clientId,
      orderNumber: body.orderNumber,
      orderDate: body.orderDate ? new Date(body.orderDate) : null,
      poNumber: body.poNumber,
      description: body.description,
      quantity: body.quantity,
      unitPrice: body.unitPrice,
      totalPrice: body.totalPrice,
      status: body.status || "RECEIVED",
      expectedDeliveryDate: body.expectedDeliveryDate
        ? new Date(body.expectedDeliveryDate)
        : null,
      actualDeliveryDate: body.actualDeliveryDate
        ? new Date(body.actualDeliveryDate)
        : null,
      notes: body.notes,
      source: "MANUAL",
    },
  });

  return NextResponse.json(order, { status: 201 });
}
