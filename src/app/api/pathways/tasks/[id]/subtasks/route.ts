import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { pathwaySubTaskInclude } from "@/lib/pathways";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { id: taskId } = await params;
  const body = await request.json();
  const titles = Array.isArray(body.titles)
    ? body.titles.map((title: unknown) => String(title).trim()).filter(Boolean)
    : [String(body.title ?? "").trim()].filter(Boolean);

  if (titles.length === 0) {
    return NextResponse.json({ error: "Sub-task title is required" }, { status: 400 });
  }

  const task = await prisma.pathwayTask.findUnique({
    where: { id: taskId },
    select: { id: true },
  });

  if (!task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  const last = await prisma.pathwaySubTask.findFirst({
    where: { taskId },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });

  let nextSortOrder = last?.sortOrder ?? 0;
  const created = [];

  for (const title of titles) {
    nextSortOrder += 1;
    const subTask = await prisma.pathwaySubTask.create({
      data: {
        taskId,
        title,
        sortOrder: nextSortOrder,
      },
      include: pathwaySubTaskInclude.include,
    });
    created.push(subTask);
  }

  return NextResponse.json(created.length === 1 ? created[0] : created, {
    status: 201,
  });
}
