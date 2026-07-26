import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getClientFilter, getSession, requireAdmin } from "@/lib/auth";
import {
  fetchOrdersForExport,
  generateCsvContent,
  generateExcelBuffer,
} from "@/lib/export";
import { generateUnmatchedCsv } from "@/lib/csv-parser";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const format = searchParams.get("format") || "xlsx";
  const clientIdParam = searchParams.get("clientId");
  const clientFilter = getClientFilter(session);
  const clientId = clientFilter || clientIdParam;

  if (!clientId) {
    return NextResponse.json({ error: "Client is required" }, { status: 400 });
  }

  if (clientFilter && clientId !== clientFilter) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const client = await prisma.client.findUnique({ where: { id: clientId } });
  if (!client) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  const dateFrom = searchParams.get("dateFrom");
  const dateTo = searchParams.get("dateTo");
  const updatedSince = searchParams.get("updatedSince");
  const openOnly = searchParams.get("openOnly") === "true";
  const activeReport = searchParams.get("activeReport") === "true";
  const includeChanges = searchParams.get("includeChanges") === "true";
  const type = searchParams.get("type");

  if (type === "unmatched") {
    const batchId = searchParams.get("batchId");
    if (!batchId) {
      return NextResponse.json({ error: "batchId required" }, { status: 400 });
    }
    const batch = await prisma.importBatch.findUnique({ where: { id: batchId } });
    if (!batch?.errors) {
      return NextResponse.json({ error: "No unmatched rows" }, { status: 404 });
    }
    const notFound = JSON.parse(batch.errors);
    const csv = generateUnmatchedCsv(notFound);
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="unmatched-${batch.filename}"`,
      },
    });
  }

  const orders = await fetchOrdersForExport({
    clientId,
    dateFrom: dateFrom ? new Date(dateFrom) : undefined,
    dateTo: dateTo ? new Date(dateTo) : undefined,
    updatedSince: updatedSince ? new Date(updatedSince) : undefined,
    openOnly,
    activeReport,
  });

  const safeName = client.name.replace(/[^a-zA-Z0-9]/g, "-").toLowerCase();
  const dateStamp = new Date().toISOString().slice(0, 10);

  if (format === "csv") {
    const csv = generateCsvContent(orders, client.name);
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="${safeName}-orders-${dateStamp}.csv"`,
      },
    });
  }

  const changesSince =
    includeChanges && updatedSince ? new Date(updatedSince) : undefined;
  const buffer = await generateExcelBuffer(orders, client.name, changesSince);

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${safeName}-orders-${dateStamp}.xlsx"`,
    },
  });
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
