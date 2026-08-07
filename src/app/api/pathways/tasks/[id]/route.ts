import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { pathwayTaskInclude, userCanAccessPathway } from "@/lib/pathways";

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

  const task = await prisma.pathwayTask.findUnique({
    where: { id },
    include: {
      pathway: {
        select: { id: true, accountManagerId: true, designerId: true },
      },
    },
  });

  if (!task) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const allowed = await userCanAccessPathway(
    session.user.id,
    session.user.role,
    task.pathway
  );
  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const updateData: {
    completedAt?: Date | null;
    completedById?: string | null;
    assignAccountManager?: boolean;
    assignDesigner?: boolean;
  } = {};

  if (body.completed !== undefined) {
    const completed = body.completed === true;
    updateData.completedAt = completed ? new Date() : null;
    updateData.completedById = completed ? session.user.id : null;
  }

  if (body.assignAccountManager !== undefined || body.assignDesigner !== undefined) {
    if (session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const assignAccountManager =
      body.assignAccountManager === undefined
        ? task.assignAccountManager
        : body.assignAccountManager === true;
    const assignDesigner =
      body.assignDesigner === undefined ? task.assignDesigner : body.assignDesigner === true;

    if (!assignAccountManager && !assignDesigner) {
      return NextResponse.json(
        { error: "At least one assignee is required" },
        { status: 400 }
      );
    }

    updateData.assignAccountManager = assignAccountManager;
    updateData.assignDesigner = assignDesigner;
  }

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: "No updates provided" }, { status: 400 });
  }

  const updated = await prisma.pathwayTask.update({
    where: { id },
    data: updateData,
    include: {
      ...pathwayTaskInclude.include,
      pathway: {
        include: {
          client: { select: { id: true, name: true } },
          accountManager: { select: { id: true, name: true } },
          designer: { select: { id: true, name: true } },
        },
      },
    },
  });

  return NextResponse.json(updated);
}
