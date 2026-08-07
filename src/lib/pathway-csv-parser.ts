import { prisma } from "./db";
import { parseCsvContent } from "./csv-parser";
import { notifyPathwayAssigned } from "./email";
import {
  PathwayCsvGroupPreview,
  PathwayCsvImportResult,
  PathwayCsvPreviewResult,
  PathwayCsvRow,
} from "@/types/pathways";
import { resolveTaskAssignees } from "@/lib/pathway-templates";
import { parseDate } from "./utils";
import { StaffRole } from "@prisma/client";

function normalizeKey(value: string): string {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
}

function pickField(row: Record<string, string>, ...candidates: string[]): string | null {
  const entries = Object.entries(row);
  for (const candidate of candidates) {
    const key = entries.find(([k]) => normalizeKey(k) === normalizeKey(candidate))?.[0];
    if (key && row[key]?.trim()) return row[key].replace(/\s+/g, " ").trim();
  }
  for (const candidate of candidates) {
    const key = entries.find(([k]) => normalizeKey(k).includes(normalizeKey(candidate)))?.[0];
    if (key && row[key]?.trim()) return row[key].replace(/\s+/g, " ").trim();
  }
  return null;
}

export function mapPathwayCsvRow(
  row: Record<string, string>,
  rowNumber: number
): PathwayCsvRow | null {
  const clientName = pickField(row, "client", "club", "customer");
  const accountManagerName = pickField(
    row,
    "account manager",
    "account_manager",
    "accountmanager",
    "am"
  );
  const designerName = pickField(row, "designer", "design");
  const pathwayName = pickField(row, "pathway", "pathway name", "pathway_name") ?? "Critical Pathway";
  const taskTitle = pickField(row, "task", "task title", "task_title", "milestone", "description");
  const deadline = pickField(row, "deadline", "due date", "due_date", "date required", "date");

  if (!clientName && !taskTitle) return null;

  return {
    row: rowNumber,
    clientName: clientName ?? "",
    accountManagerName: accountManagerName ?? "",
    designerName: designerName ?? "",
    pathwayName,
    taskTitle: taskTitle ?? "",
    deadline: deadline ?? "",
  };
}

async function buildLookupMaps() {
  const [clients, staff] = await Promise.all([
    prisma.client.findMany({ select: { id: true, name: true } }),
    prisma.user.findMany({
      where: { role: "STAFF" },
      select: { id: true, name: true, staffRole: true, email: true },
    }),
  ]);

  const clientByName = new Map<string, string>();
  for (const client of clients) {
    clientByName.set(normalizeKey(client.name), client.id);
  }

  const staffByName = new Map<string, { id: string; staffRole: StaffRole | null }>();
  for (const user of staff) {
    staffByName.set(normalizeKey(user.name), { id: user.id, staffRole: user.staffRole });
  }

  return { clientByName, staffByName };
}

function groupKey(row: PathwayCsvRow): string {
  return [
    normalizeKey(row.clientName),
    normalizeKey(row.accountManagerName),
    normalizeKey(row.designerName),
    normalizeKey(row.pathwayName),
  ].join("|");
}

export async function previewPathwayCsvImport(content: string): Promise<PathwayCsvPreviewResult> {
  const { headers, rows } = parseCsvContent(content);
  const { clientByName, staffByName } = await buildLookupMaps();

  const errors: PathwayCsvPreviewResult["errors"] = [];
  const groupMap = new Map<string, PathwayCsvGroupPreview>();
  let wouldSkip = 0;

  rows.forEach((row, index) => {
    const rowNumber = index + 2;
    const mapped = mapPathwayCsvRow(row, rowNumber);
    if (!mapped) {
      wouldSkip++;
      return;
    }

    if (!mapped.clientName) {
      errors.push({ row: rowNumber, message: "Missing client name" });
      return;
    }
    if (!mapped.accountManagerName) {
      errors.push({ row: rowNumber, message: "Missing account manager" });
      return;
    }
    if (!mapped.designerName) {
      errors.push({ row: rowNumber, message: "Missing designer" });
      return;
    }
    if (!mapped.taskTitle) {
      errors.push({ row: rowNumber, message: "Missing task title" });
      return;
    }
    if (!mapped.deadline) {
      errors.push({ row: rowNumber, message: "Missing deadline" });
      return;
    }

    const due = parseDate(mapped.deadline);
    if (!due) {
      errors.push({ row: rowNumber, message: `Could not parse deadline: "${mapped.deadline}"` });
      return;
    }

    const key = groupKey(mapped);
    if (!groupMap.has(key)) {
      const amLookup = staffByName.get(normalizeKey(mapped.accountManagerName));
      const designerLookup = staffByName.get(normalizeKey(mapped.designerName));

      groupMap.set(key, {
        key,
        clientName: mapped.clientName,
        clientId: clientByName.get(normalizeKey(mapped.clientName)) ?? null,
        accountManagerName: mapped.accountManagerName,
        accountManagerId:
          amLookup?.staffRole === "ACCOUNT_MANAGER" ? amLookup.id : null,
        designerName: mapped.designerName,
        designerId: designerLookup?.staffRole === "DESIGNER" ? designerLookup.id : null,
        pathwayName: mapped.pathwayName,
        tasks: [],
      });
    }

    const group = groupMap.get(key)!;
    group.tasks.push({
      row: rowNumber,
      title: mapped.taskTitle,
      dueDate: mapped.deadline,
      dueDateParsed: true,
    });
  });

  const groups = [...groupMap.values()].sort((a, b) =>
    a.clientName.localeCompare(b.clientName)
  );

  for (const group of groups) {
    if (!group.clientId) {
      errors.push({
        row: group.tasks[0]?.row ?? 0,
        message: `Unknown client: "${group.clientName}"`,
      });
    }
    if (!group.accountManagerId) {
      errors.push({
        row: group.tasks[0]?.row ?? 0,
        message: `Unknown account manager: "${group.accountManagerName}" (add in Settings → Staff Users)`,
      });
    }
    if (!group.designerId) {
      errors.push({
        row: group.tasks[0]?.row ?? 0,
        message: `Unknown designer: "${group.designerName}" (add in Settings → Staff Users)`,
      });
    }
  }

  const validGroups = groups.filter(
    (g) => g.clientId && g.accountManagerId && g.designerId
  );

  return {
    headers,
    totalRows: rows.length,
    groups,
    errors,
    wouldCreate: validGroups.length,
    wouldSkip,
  };
}

export async function commitPathwayCsvImport(
  content: string,
  notifyAssignees = true
): Promise<PathwayCsvImportResult> {
  const preview = await previewPathwayCsvImport(content);
  const result: PathwayCsvImportResult = {
    created: 0,
    skipped: 0,
    errors: preview.errors.map((e) => `Row ${e.row}: ${e.message}`),
    pathwayIds: [],
  };

  if (preview.errors.length > 0) {
    return result;
  }

  const portalUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";

  for (const group of preview.groups) {
    if (!group.clientId || !group.accountManagerId || !group.designerId) {
      result.skipped++;
      continue;
    }

    try {
      const pathway = await prisma.criticalPathway.create({
        data: {
          clientId: group.clientId,
          accountManagerId: group.accountManagerId,
          designerId: group.designerId,
          name: group.pathwayName,
          tasks: {
            create: group.tasks.map((task, index) => {
              const assignees = resolveTaskAssignees(task.title);
              return {
                title: task.title,
                dueDate: parseDate(task.dueDate)!,
                sortOrder: index + 1,
                assignAccountManager: assignees.assignAccountManager,
                assignDesigner: assignees.assignDesigner,
              };
            }),
          },
        },
        include: {
          client: { select: { name: true } },
          accountManager: { select: { name: true, email: true } },
          designer: { select: { name: true, email: true } },
          tasks: true,
        },
      });

      await prisma.client.update({
        where: { id: group.clientId },
        data: { accountManagerId: group.accountManagerId },
      });

      if (notifyAssignees) {
        for (const user of [pathway.accountManager, pathway.designer]) {
          await notifyPathwayAssigned({
            to: user.email,
            recipientName: user.name,
            clientName: pathway.client.name,
            pathwayName: pathway.name,
            taskCount: pathway.tasks.length,
            portalUrl,
          });
        }
      }

      result.created++;
      result.pathwayIds.push(pathway.id);
    } catch (error) {
      result.errors.push(
        `${group.clientName}: ${error instanceof Error ? error.message : "Import failed"}`
      );
      result.skipped++;
    }
  }

  return result;
}
