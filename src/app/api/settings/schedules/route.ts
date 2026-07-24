import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

export async function GET() {
  await requireAdmin();
  const schedules = await prisma.scheduledExport.findMany();

  const clients = await prisma.client.findMany({
    select: { id: true, name: true, contactEmail: true },
  });

  return NextResponse.json({ schedules, clients });
}

export async function POST(request: NextRequest) {
  await requireAdmin();
  const body = await request.json();

  const existing = await prisma.scheduledExport.findFirst({
    where: { clientId: body.clientId },
  });

  const schedule = existing
    ? await prisma.scheduledExport.update({
        where: { id: existing.id },
        data: {
          dayOfWeek: body.dayOfWeek ?? 1,
          hour: body.hour ?? 9,
          enabled: body.enabled ?? false,
        },
      })
    : await prisma.scheduledExport.create({
        data: {
          clientId: body.clientId,
          dayOfWeek: body.dayOfWeek ?? 1,
          hour: body.hour ?? 9,
          enabled: body.enabled ?? false,
        },
      });

  return NextResponse.json(schedule);
}
