import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession, requireAdmin } from "@/lib/auth";
import { pathwaySubTaskInclude, userCanAccessPathway } from "@/lib/pathways";

async function getSubTaskWithPathway(id: string) {
  return prisma.pathwaySubTask.findUnique({
    where: { id },
    include: {
      ...pathwaySubTaskInclude.include,
      task: {
        select: {
          pathway: {
            select: { id: true, accountManagerId: true, designerId: true },
          },
        },
      },
    },
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  const subTask = await getSubTaskWithPathway(id);

  if (!subTask) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const allowed = await userCanAccessPathway(
    session.user.id,
    session.user.role,
    subTask.task.pathway
  );
  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const completed = body.completed === true;

  const updated = await prisma.pathwaySubTask.update({
    where: { id },
    data: {
      completedAt: completed ? new Date() : null,
      completedById: completed ? session.user.id : null,
    },
    include: pathwaySubTaskInclude.include,
  });

  return NextResponse.json(updated);
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
  const subTask = await prisma.pathwaySubTask.findUnique({ where: { id } });

  if (!subTask) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.pathwaySubTask.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
