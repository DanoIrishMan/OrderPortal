import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession, requireAdmin } from "@/lib/auth";
import { notifyPathwayAssigned } from "@/lib/email";
import { pathwayDetailInclude } from "@/lib/pathways";
import { resolveTaskAssignees } from "@/lib/pathway-templates";
import { parseDate } from "@/lib/utils";

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get("clientId");

    const where =
      session.user.role === "ADMIN"
        ? clientId
          ? { clientId }
          : {}
        : session.user.role === "STAFF"
          ? {
              OR: [
                { accountManagerId: session.user.id },
                { designerId: session.user.id },
              ],
            }
          : { id: "__none__" };

    const pathways = await prisma.criticalPathway.findMany({
      where,
      include: pathwayDetailInclude,
      orderBy: [{ updatedAt: "desc" }],
    });

    return NextResponse.json(pathways);
  } catch (error) {
    console.error("GET /api/pathways failed:", error);
    return NextResponse.json({ error: "Failed to load pathways" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const body = await request.json();
  const {
    clientId,
    accountManagerId,
    designerId,
    name = "Critical Pathway",
    tasks,
    notifyAssignees = true,
  } = body;

  if (!clientId || !accountManagerId || !designerId || !Array.isArray(tasks) || tasks.length === 0) {
    return NextResponse.json(
      { error: "Client, account manager, designer, and at least one task are required" },
      { status: 400 }
    );
  }

  const [client, am, designer] = await Promise.all([
    prisma.client.findUnique({ where: { id: clientId } }),
    prisma.user.findFirst({ where: { id: accountManagerId, role: "STAFF" } }),
    prisma.user.findFirst({ where: { id: designerId, role: "STAFF" } }),
  ]);

  if (!client) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }
  if (!am || !designer) {
    return NextResponse.json({ error: "Invalid staff assignees" }, { status: 400 });
  }

  const pathway = await prisma.criticalPathway.create({
    data: {
      clientId,
      accountManagerId,
      designerId,
      name: String(name).trim() || "Critical Pathway",
      tasks: {
        create: tasks.map(
          (
            task: {
              title: string;
              dueDate: string;
              assignAccountManager?: boolean;
              assignDesigner?: boolean;
              subTasks?: Array<{ title: string }>;
            },
            index: number
          ) => {
            const due = parseDate(task.dueDate) ?? new Date(task.dueDate);
            const subTasks = Array.isArray(task.subTasks)
              ? task.subTasks
                  .map((subTask) => String(subTask.title).trim())
                  .filter(Boolean)
              : [];
            const assignees = resolveTaskAssignees(String(task.title).trim(), {
              assignAccountManager: task.assignAccountManager,
              assignDesigner: task.assignDesigner,
            });

            return {
              title: String(task.title).trim(),
              dueDate: due,
              sortOrder: index + 1,
              assignAccountManager: assignees.assignAccountManager,
              assignDesigner: assignees.assignDesigner,
              subTasks:
                subTasks.length > 0
                  ? {
                      create: subTasks.map((title, subIndex) => ({
                        title,
                        sortOrder: subIndex + 1,
                      })),
                    }
                  : undefined,
            };
          }
        ),
      },
    },
    include: pathwayDetailInclude,
  });

  await prisma.client.update({
    where: { id: clientId },
    data: { accountManagerId },
  });

  if (notifyAssignees) {
    const portalUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
    const notifyTargets = [
      { user: am, role: "Account Manager" },
      { user: designer, role: "Designer" },
    ];
    for (const { user } of notifyTargets) {
      await notifyPathwayAssigned({
        to: user.email,
        recipientName: user.name,
        clientName: client.name,
        pathwayName: pathway.name,
        taskCount: pathway.tasks.length,
        portalUrl,
      });
    }
  }

  return NextResponse.json(pathway, { status: 201 });
}
