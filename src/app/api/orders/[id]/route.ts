import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getClientFilter, getSession, requireAdmin } from "@/lib/auth";
import { OrderSource, Prisma } from "@prisma/client";

function buildPartialUpdate(
  existing: {
    status: string;
    notes: string | null;
    description: string | null;
    poNumber: string | null;
    section: string | null;
    actualDeliveryDate: Date | null;
    deliveredAt: Date | null;
  },
  body: Record<string, unknown>
) {
  const data: Prisma.OrderUpdateInput = { source: OrderSource.MANUAL };
  const events: Array<{ field: string; oldValue: string | null; newValue: string | null }> = [];

  const track = (field: string, oldVal: unknown, newVal: unknown) => {
    const oldStr = oldVal == null ? null : String(oldVal);
    const newStr = newVal == null ? null : String(newVal);
    if (newStr !== oldStr) {
      events.push({ field, oldValue: oldStr, newValue: newStr });
    }
  };

  if (body.orderNumber !== undefined) data.orderNumber = String(body.orderNumber);
  if (body.section !== undefined) {
    data.section = body.section ? String(body.section) : null;
    track("section", existing.section, data.section);
  }
  if (body.orderDate !== undefined) {
    data.orderDate = body.orderDate ? new Date(String(body.orderDate)) : null;
  }
  if (body.poNumber !== undefined) {
    data.poNumber = body.poNumber ? String(body.poNumber) : null;
    track("poNumber", existing.poNumber, data.poNumber);
  }
  if (body.description !== undefined) {
    data.description = body.description ? String(body.description) : null;
    track("description", existing.description, data.description);
  }
  if (body.quantity !== undefined) data.quantity = body.quantity == null ? null : Number(body.quantity);
  if (body.unitPrice !== undefined) data.unitPrice = body.unitPrice == null ? null : Number(body.unitPrice);
  if (body.totalPrice !== undefined) data.totalPrice = body.totalPrice == null ? null : Number(body.totalPrice);
  if (body.expectedDeliveryDate !== undefined) {
    data.expectedDeliveryDate = body.expectedDeliveryDate
      ? new Date(String(body.expectedDeliveryDate))
      : null;
  }
  if (body.actualDeliveryDate !== undefined) {
    data.actualDeliveryDate = body.actualDeliveryDate
      ? new Date(String(body.actualDeliveryDate))
      : null;
  }
  if (body.notes !== undefined) {
    data.notes = body.notes ? String(body.notes) : null;
    track("notes", existing.notes, data.notes);
  }

  if (body.status !== undefined) {
    const nextStatus = String(body.status);
    data.status = nextStatus as Prisma.OrderUpdateInput["status"];
    track("status", existing.status, nextStatus);

    if (nextStatus === "DELIVERED" && existing.status !== "DELIVERED") {
      const now = new Date();
      data.deliveredAt = now;
      if (!existing.actualDeliveryDate && body.actualDeliveryDate === undefined) {
        data.actualDeliveryDate = now;
      }
    } else if (nextStatus !== "DELIVERED" && existing.status === "DELIVERED") {
      data.deliveredAt = null;
    }
  }

  if (body.markComplete === true && body.status === undefined) {
    const now = new Date();
    data.status = "DELIVERED";
    data.deliveredAt = now;
    if (!existing.actualDeliveryDate) data.actualDeliveryDate = now;
    track("status", existing.status, "DELIVERED");
  }

  if (body.markComplete === false && body.status === undefined && existing.status === "DELIVERED") {
    data.status = "IN_PRODUCTION";
    data.deliveredAt = null;
    track("status", existing.status, "IN_PRODUCTION");
  }

  return { data, events };
}

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

  if (session.user.role === "STAFF" && session.user.staffRole === "ACCOUNT_MANAGER") {
    const client = await prisma.client.findUnique({
      where: { id: order.clientId },
      select: { accountManagerId: true },
    });
    if (client?.accountManagerId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  if (session.user.role === "STAFF" && session.user.staffRole === "DESIGNER") {
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

  const { data, events } = buildPartialUpdate(existing, body);

  const order = await prisma.order.update({
    where: { id },
    data,
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
