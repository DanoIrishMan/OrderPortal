import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import {
  isAccountManager,
  requireAdmin,
  requireAdminOrAccountManager,
} from "@/lib/auth";

export async function GET() {
  try {
    const session = await requireAdminOrAccountManager();

    if (session.user.role === "ADMIN") {
      const clients = await prisma.client.findMany({
        orderBy: { name: "asc" },
        include: {
          _count: { select: { orders: true, users: true } },
        },
      });
      return NextResponse.json(clients);
    }

    const clients = await prisma.client.findMany({
      where: { accountManagerId: session.user.id, active: true },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        contactEmail: true,
        active: true,
        accountManagerId: true,
      },
    });

    return NextResponse.json(clients);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }
}

export async function POST(request: NextRequest) {
  await requireAdmin();
  const body = await request.json();
  const { name, contactEmail, active = true, userEmail, userName, userPassword } = body;

  if (!name || !contactEmail) {
    return NextResponse.json({ error: "Name and contact email are required" }, { status: 400 });
  }

  const client = await prisma.client.create({
    data: {
      name,
      contactEmail,
      active,
    },
  });

  if (userEmail && userPassword) {
    const passwordHash = await bcrypt.hash(userPassword, 10);
    await prisma.user.create({
      data: {
        email: userEmail.toLowerCase(),
        name: userName || `${name} User`,
        passwordHash,
        role: "CLIENT",
        clientId: client.id,
      },
    });
  }

  return NextResponse.json(client, { status: 201 });
}
