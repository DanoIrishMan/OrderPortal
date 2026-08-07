import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

const userSelect = {
  id: true,
  email: true,
  name: true,
  role: true,
  staffRole: true,
  clientId: true,
  createdAt: true,
  managedClients: {
    where: { active: true },
    select: { id: true, name: true },
    orderBy: { name: "asc" as const },
  },
  client: { select: { name: true } },
};

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await requireAdmin();
  const { id } = await params;

  const user = await prisma.user.findUnique({
    where: { id },
    select: userSelect,
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json(user);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await requireAdmin();
  const { id } = await params;
  const body = await request.json();

  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  if (body.clientIds !== undefined) {
    if (existing.role !== "STAFF" || existing.staffRole !== "ACCOUNT_MANAGER") {
      return NextResponse.json(
        { error: "Client assignment only applies to account managers" },
        { status: 400 }
      );
    }

    const clientIds = Array.isArray(body.clientIds)
      ? body.clientIds.map((clientId: unknown) => String(clientId))
      : [];

    const activeClients = await prisma.client.findMany({
      where: { id: { in: clientIds }, active: true },
      select: { id: true },
    });
    const activeClientIds = activeClients.map((client) => client.id);

    await prisma.$transaction([
      prisma.client.updateMany({
        where: { accountManagerId: id, id: { notIn: activeClientIds } },
        data: { accountManagerId: null },
      }),
      ...(activeClientIds.length > 0
        ? [
            prisma.client.updateMany({
              where: { id: { in: activeClientIds } },
              data: { accountManagerId: id },
            }),
          ]
        : []),
    ]);

    const user = await prisma.user.findUnique({
      where: { id },
      select: userSelect,
    });

    return NextResponse.json(user);
  }

  const data: {
    name?: string;
    email?: string;
    role?: "ADMIN" | "CLIENT";
    clientId?: string | null;
    passwordHash?: string;
  } = {};

  if (body.name !== undefined) data.name = String(body.name).trim();
  if (body.email !== undefined) data.email = String(body.email).toLowerCase().trim();
  if (body.role !== undefined) data.role = body.role;
  if (body.role === "ADMIN") data.clientId = null;
  if (body.role === "CLIENT" && body.clientId) data.clientId = body.clientId;
  if (body.password) {
    if (body.password.length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters" },
        { status: 400 }
      );
    }
    data.passwordHash = await bcrypt.hash(body.password, 10);
  }

  const user = await prisma.user.update({
    where: { id },
    data,
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      clientId: true,
      createdAt: true,
      client: { select: { name: true } },
    },
  });

  return NextResponse.json(user);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAdmin();
  const { id } = await params;

  if (session.user.id === id) {
    return NextResponse.json({ error: "You cannot delete your own account" }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  if (existing.role === "ADMIN") {
    const adminCount = await prisma.user.count({ where: { role: "ADMIN" } });
    if (adminCount <= 1) {
      return NextResponse.json({ error: "Cannot delete the last admin user" }, { status: 400 });
    }
  }

  await prisma.user.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
