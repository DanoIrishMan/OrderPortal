import { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { getStartOfTodayUtc } from "./order-filters";
import { getTaskAssigneeRolesForTitle } from "./pathway-templates";

export function isPathwayTaskOverdue(task: {
  dueDate: Date | string;
  completedAt: Date | string | null;
}): boolean {
  if (task.completedAt) return false;
  const due = task.dueDate instanceof Date ? task.dueDate : new Date(task.dueDate);
  const dueDay = Date.UTC(
    due.getUTCFullYear(),
    due.getUTCMonth(),
    due.getUTCDate()
  );
  const today = getStartOfTodayUtc().getTime();
  return dueDay < today;
}

export function pathwayTaskStatus(task: {
  dueDate: Date | string;
  completedAt: Date | string | null;
}): "complete" | "overdue" | "upcoming" {
  if (task.completedAt) return "complete";
  if (isPathwayTaskOverdue(task)) return "overdue";
  return "upcoming";
}

export async function userCanAccessPathway(
  userId: string,
  role: string,
  pathway: { accountManagerId: string; designerId: string }
): Promise<boolean> {
  if (role === "ADMIN") return true;
  if (role !== "STAFF") return false;
  return pathway.accountManagerId === userId || pathway.designerId === userId;
}

export async function buildStaffOrderWhere(userId: string): Promise<Prisma.OrderWhereInput> {
  return {
    client: { accountManagerId: userId },
  };
}

export async function getStaffAssignedClientIds(userId: string): Promise<string[]> {
  const clients = await prisma.client.findMany({
    where: { accountManagerId: userId, active: true },
    select: { id: true },
  });
  return clients.map((c) => c.id);
}

export function getPathwayTaskAssigneeName(
  task: {
    title: string;
    assignAccountManager?: boolean;
    assignDesigner?: boolean;
  },
  pathway: {
    accountManager: { name: string };
    designer: { name: string };
  }
): string {
  let assignAccountManager = task.assignAccountManager ?? false;
  let assignDesigner = task.assignDesigner ?? false;

  if (!assignAccountManager && !assignDesigner) {
    const roles = getTaskAssigneeRolesForTitle(task.title);
    assignAccountManager = roles.includes("ACCOUNT_MANAGER");
    assignDesigner = roles.includes("DESIGNER");
  }

  const names: string[] = [];
  if (assignAccountManager) names.push(pathway.accountManager.name);
  if (assignDesigner) names.push(pathway.designer.name);

  if (names.length === 0) {
    return `${pathway.accountManager.name} / ${pathway.designer.name}`;
  }

  return names.join(" / ");
}

export const pathwaySubTaskInclude = {
  orderBy: { sortOrder: "asc" as const },
  include: {
    completedBy: { select: { id: true, name: true } },
  },
};

export const pathwayTaskInclude = {
  orderBy: { sortOrder: "asc" as const },
  include: {
    completedBy: { select: { id: true, name: true } },
    subTasks: pathwaySubTaskInclude,
  },
};

export const pathwayDetailInclude = {
  client: { select: { id: true, name: true, accountManagerId: true } },
  accountManager: { select: { id: true, name: true, email: true, staffRole: true } },
  designer: { select: { id: true, name: true, email: true, staffRole: true } },
  tasks: pathwayTaskInclude,
};
