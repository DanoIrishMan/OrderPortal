import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  assertAccountManagerClientAccess,
  isAccountManager,
  requireAdminOrAccountManager,
} from "@/lib/auth";

async function upsertSchedule(body: {
  clientId: string;
  dayOfWeek?: number;
  hour?: number;
  enabled?: boolean;
}) {
  const existing = await prisma.scheduledExport.findFirst({
    where: { clientId: body.clientId },
  });

  return existing
    ? prisma.scheduledExport.update({
        where: { id: existing.id },
        data: {
          dayOfWeek: body.dayOfWeek ?? 1,
          hour: body.hour ?? 9,
          enabled: body.enabled ?? false,
        },
      })
    : prisma.scheduledExport.create({
        data: {
          clientId: body.clientId,
          dayOfWeek: body.dayOfWeek ?? 1,
          hour: body.hour ?? 9,
          enabled: body.enabled ?? false,
        },
      });
}

export async function GET() {
  try {
    const session = await requireAdminOrAccountManager();

    if (session.user.role === "ADMIN") {
      const [schedules, clients] = await Promise.all([
        prisma.scheduledExport.findMany(),
        prisma.client.findMany({
          select: { id: true, name: true, contactEmail: true },
          orderBy: { name: "asc" },
        }),
      ]);

      return NextResponse.json({ schedules, clients });
    }

    const clients = await prisma.client.findMany({
      where: { accountManagerId: session.user.id, active: true },
      select: { id: true, name: true, contactEmail: true },
      orderBy: { name: "asc" },
    });
    const clientIds = clients.map((client) => client.id);
    const schedules = await prisma.scheduledExport.findMany({
      where: { clientId: { in: clientIds } },
    });

    return NextResponse.json({ schedules, clients });
  } catch (error) {
    if (error instanceof Error && error.message === "Forbidden") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireAdminOrAccountManager();
    const body = await request.json();

    if (!body.clientId) {
      return NextResponse.json({ error: "Client is required" }, { status: 400 });
    }

    if (isAccountManager(session)) {
      await assertAccountManagerClientAccess(session.user.id, body.clientId);
    }

    const schedule = await upsertSchedule(body);
    return NextResponse.json(schedule);
  } catch (error) {
    if (error instanceof Error && error.message === "Forbidden") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }
}
