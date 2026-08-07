import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

export async function GET() {
  await requireAdmin();

  const users = await prisma.user.findMany({
    orderBy: [{ role: "asc" }, { name: "asc" }],
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      staffRole: true,
      clientId: true,
      createdAt: true,
      client: { select: { name: true } },
      managedClients: {
        where: { active: true },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      },
    },
  });

  return NextResponse.json(users);
}

export async function POST(request: NextRequest) {
  await requireAdmin();
  const body = await request.json();
  const { name, email, password, role = "ADMIN", clientId, staffRole } = body;

  if (!name?.trim() || !email?.trim() || !password) {
    return NextResponse.json(
      { error: "Name, email, and password are required" },
      { status: 400 }
    );
  }

  if (typeof password !== "string" || password.length < 6) {
    return NextResponse.json(
      { error: "Password must be at least 6 characters" },
      { status: 400 }
    );
  }

  if (role === "CLIENT" && !clientId) {
    return NextResponse.json(
      { error: "Client is required for client users" },
      { status: 400 }
    );
  }

  if (role === "STAFF" && !staffRole) {
    return NextResponse.json(
      { error: "Staff type (Account Manager or Designer) is required" },
      { status: 400 }
    );
  }

  if (role !== "STAFF" && staffRole) {
    return NextResponse.json({ error: "Staff type only applies to staff users" }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
  });
  if (existing) {
    return NextResponse.json({ error: "Email already in use" }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: {
      name: name.trim(),
      email: email.toLowerCase().trim(),
      passwordHash,
      role,
      staffRole: role === "STAFF" ? staffRole : null,
      clientId: role === "CLIENT" ? clientId : null,
    },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      staffRole: true,
      clientId: true,
      createdAt: true,
      client: { select: { name: true } },
    },
  });

  return NextResponse.json(user, { status: 201 });
}
