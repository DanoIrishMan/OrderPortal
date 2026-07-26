import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getClientFilter, getSession, requireAdmin } from "@/lib/auth";
import { buildOrderViewFilter, OrderView } from "@/lib/order-filters";
import { Prisma } from "@prisma/client";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const clientId = searchParams.get("clientId");
  const status = searchParams.get("status");
  const search = searchParams.get("search");
  const viewParam = searchParams.get("view") as OrderView | null;
  const clientFilter = getClientFilter(session);
  const isAdmin = session.user.role === "ADMIN";
  const view: OrderView = viewParam ?? (isAdmin ? "all" : "active");

  const where: Prisma.OrderWhereInput = {};

  if (clientFilter) {
    where.clientId = clientFilter;
  } else if (clientId) {
    where.clientId = clientId;
  }

  if (view !== "all") {
    const audience = isAdmin && !clientFilter ? "admin" : "client";
    where.AND = [
      ...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []),
      buildOrderViewFilter(view, audience),
    ];
  }

  if (status) where.status = status as Prisma.EnumOrderStatusFilter["equals"];

  if (search) {
    where.OR = [
      { orderNumber: { contains: search } },
      { poNumber: { contains: search } },
      { description: { contains: search } },
    ];
  }

  try {
    const orders = await prisma.order.findMany({
      where,
      include: {
        client: { select: { name: true } },
      },
      orderBy: [{ updatedAt: "desc" }],
      take: 200,
    });

    return NextResponse.json(orders);
  } catch (error) {
    console.error("Failed to fetch orders:", error);
    return NextResponse.json(
      { error: "Failed to load orders. Run npx prisma db push on the server if this persists." },
      { status: 500 }
    );
  }
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
      deliveredAt: body.status === "DELIVERED" ? new Date() : null,
      notes: body.notes,
      source: "MANUAL",
    },
  });

  return NextResponse.json(order, { status: 201 });
}
