import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import {
  fetchOrdersForExport,
  generateCsvContent,
  generateExcelBuffer,
} from "@/lib/export";
import { notifyClientOfUpdates } from "@/lib/email";

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export async function POST(request: NextRequest) {
  await requireAdmin();
  const body = await request.json();
  const dryRun = body.dryRun === true;

  const now = new Date();
  const currentDay = now.getDay();
  const currentHour = now.getHours();

  const schedules = await prisma.scheduledExport.findMany({
    where: { enabled: true },
  });

  const dueSchedules = schedules.filter(
    (s) => s.dayOfWeek === currentDay && s.hour === currentHour
  );

  if (dryRun) {
    return NextResponse.json({
      message: `Dry run: ${dueSchedules.length} export(s) would run now (${DAY_NAMES[currentDay]} ${currentHour}:00)`,
      dueSchedules,
    });
  }

  const results = [];

  for (const schedule of dueSchedules) {
    const client = await prisma.client.findUnique({
      where: { id: schedule.clientId },
    });

    if (!client) continue;

    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const orders = await fetchOrdersForExport({
      clientId: schedule.clientId,
      updatedSince: weekAgo,
      openOnly: false,
    });

    const buffer = await generateExcelBuffer(orders, client.name, weekAgo);
    const csv = generateCsvContent(orders, client.name);

    const portalUrl = process.env.NEXTAUTH_URL
      ? `${process.env.NEXTAUTH_URL}/portal`
      : "http://localhost:3000/portal";

    const emailResult = await notifyClientOfUpdates({
      contactEmail: client.contactEmail,
      clientName: client.name,
      updatedCount: orders.length,
      portalUrl,
    });

    await prisma.scheduledExport.update({
      where: { id: schedule.id },
      data: { lastRunAt: new Date() },
    });

    results.push({
      clientId: schedule.clientId,
      clientName: client.name,
      contactEmail: client.contactEmail,
      orderCount: orders.length,
      excelSize: buffer.length,
      csvPreview: csv.slice(0, 500),
      emailSent: emailResult.sent,
      emailNote: emailResult.reason,
    });
  }

  return NextResponse.json({
    processed: results.length,
    results,
    message:
      results.length > 0
        ? "Scheduled exports prepared. Configure SMTP in production to email clients automatically."
        : "No scheduled exports due at this time.",
  });
}
