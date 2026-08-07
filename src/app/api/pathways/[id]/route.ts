import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession, requireAdmin } from "@/lib/auth";
import { pathwayDetailInclude, userCanAccessPathway } from "@/lib/pathways";
import { resolveTaskAssignees } from "@/lib/pathway-templates";
import { parseDate } from "@/lib/utils";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const pathway = await prisma.criticalPathway.findUnique({
    where: { id },
    include: pathwayDetailInclude,
  });

  if (!pathway) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const allowed = await userCanAccessPathway(session.user.id, session.user.role, pathway);
  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json(pathway);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();

  const existing = await prisma.criticalPathway.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (body.accountManagerId || body.designerId || body.name) {
    await prisma.criticalPathway.update({
      where: { id },
      data: {
        accountManagerId: body.accountManagerId ?? undefined,
        designerId: body.designerId ?? undefined,
        name: body.name ? String(body.name).trim() : undefined,
      },
    });
  }

  if (body.accountManagerId) {
    await prisma.client.update({
      where: { id: existing.clientId },
      data: { accountManagerId: body.accountManagerId },
    });
  }

  if (Array.isArray(body.tasks)) {
    await prisma.pathwayTask.deleteMany({ where: { pathwayId: id } });
    await prisma.pathwayTask.createMany({
      data: body.tasks.map(
        (
          task: {
            title: string;
            dueDate: string;
            completed?: boolean;
            assignAccountManager?: boolean;
            assignDesigner?: boolean;
          },
          index: number
        ) => {
          const assignees = resolveTaskAssignees(String(task.title).trim(), {
            assignAccountManager: task.assignAccountManager,
            assignDesigner: task.assignDesigner,
          });

          return {
            pathwayId: id,
            title: String(task.title).trim(),
            dueDate: parseDate(task.dueDate) ?? new Date(task.dueDate),
            sortOrder: index + 1,
            completedAt: task.completed ? new Date() : null,
            assignAccountManager: assignees.assignAccountManager,
            assignDesigner: assignees.assignDesigner,
          };
        }
      ),
    });
  }

  const pathway = await prisma.criticalPathway.findUnique({
    where: { id },
    include: pathwayDetailInclude,
  });

  return NextResponse.json(pathway);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { id } = await params;
  await prisma.criticalPathway.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
