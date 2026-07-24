import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

export async function POST(request: NextRequest) {
  await requireAdmin();
  const body = await request.json();
  const { clientId, message } = body;

  if (!clientId || !message) {
    return NextResponse.json(
      { error: "clientId and message are required" },
      { status: 400 }
    );
  }

  const client = await prisma.client.findUnique({ where: { id: clientId } });
  if (!client) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  const recentUpdates = await prisma.orderEvent.count({
    where: {
      createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      order: { clientId },
    },
  });

  return NextResponse.json({
    success: true,
    preview: {
      to: client.contactEmail,
      subject: `${client.name} - Order Update`,
      body: message,
      recentUpdates,
      portalUrl: `${process.env.NEXTAUTH_URL || "http://localhost:3000"}/portal`,
    },
    note: "Email delivery requires SMTP configuration. This endpoint prepares the notification payload.",
  });
}
