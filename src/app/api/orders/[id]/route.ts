import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getClientFilter, getSession, requireAdmin } from "@/lib/auth";
import { OrderSource } from "@prisma/client";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const clientFilter = getClientFilter(session);

  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      client: { select: { name: true } },
      events: { orderBy: { createdAt: "desc" }, take: 50 },
      importBatch: { select: { filename: true, type: true, createdAt: true } },
    },
  });

  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  if (clientFilter && order.clientId !== clientFilter) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json(order);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await requireAdmin();
  const { id } = await params;
  const body = await request.json();

  const existing = await prisma.order.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  const events: Array<{ field: string; oldValue: string | null; newValue: string | null }> = [];

  const track = (field: string, oldVal: unknown, newVal: unknown) => {
    const oldStr = oldVal == null ? null : String(oldVal);
    const newStr = newVal == null ? null : String(newVal);
    if (newStr !== oldStr) {
      events.push({ field, oldValue: oldStr, newValue: newStr });
    }
  };

  track("status", existing.status, body.status);
  track("notes", existing.notes, body.notes);
  track("description", existing.description, body.description);
  track("poNumber", existing.poNumber, body.poNumber);
  track("section", existing.section, body.section);

  const order = await prisma.order.update({
    where: { id },
    data: {
      orderNumber: body.orderNumber,
      section: body.section || null,
      orderDate: body.orderDate ? new Date(body.orderDate) : null,
      poNumber: body.poNumber,
      description: body.description,
      quantity: body.quantity,
      unitPrice: body.unitPrice,
      totalPrice: body.totalPrice,
      status: body.status,
      expectedDeliveryDate: body.expectedDeliveryDate
        ? new Date(body.expectedDeliveryDate)
        : null,
      actualDeliveryDate: body.actualDeliveryDate
        ? new Date(body.actualDeliveryDate)
        : null,
      notes: body.notes,
      source: OrderSource.MANUAL,
    },
  });

  if (events.length > 0) {
    await prisma.orderEvent.createMany({
      data: events.map((e) => ({
        orderId: id,
        field: e.field,
        oldValue: e.oldValue,
        newValue: e.newValue,
        source: OrderSource.MANUAL,
      })),
    });
  }

  return NextResponse.json(order);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await requireAdmin();
  const { id } = await params;
  await prisma.order.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
