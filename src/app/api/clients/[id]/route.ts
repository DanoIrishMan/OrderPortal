import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await requireAdmin();
  const { id } = await params;

  const client = await prisma.client.findUnique({
    where: { id },
    include: {
      users: { select: { id: true, email: true, name: true, role: true, createdAt: true } },
      accountManager: { select: { id: true, name: true, email: true, staffRole: true } },
      _count: { select: { orders: true, criticalPathways: true } },
    },
  });

  if (!client) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  return NextResponse.json(client);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await requireAdmin();
  const { id } = await params;
  const body = await request.json();

  const client = await prisma.client.update({
    where: { id },
    data: {
      name: body.name,
      contactEmail: body.contactEmail,
      active: body.active,
      accountManagerId: body.accountManagerId === "" ? null : body.accountManagerId ?? undefined,
    },
  });

  if (body.userEmail && body.userPassword) {
    const passwordHash = await bcrypt.hash(body.userPassword, 10);
    await prisma.user.upsert({
      where: { email: body.userEmail.toLowerCase() },
      update: {
        name: body.userName || body.userEmail,
        passwordHash,
        clientId: id,
        role: "CLIENT",
      },
      create: {
        email: body.userEmail.toLowerCase(),
        name: body.userName || body.userEmail,
        passwordHash,
        clientId: id,
        role: "CLIENT",
      },
    });
  }

  return NextResponse.json(client);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await requireAdmin();
  const { id } = await params;
  await prisma.client.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
