import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { notifyAdminsPathwayOverdue, notifyPathwayTaskReminder } from "@/lib/email";
import { getStartOfTodayUtc } from "@/lib/order-filters";
import { isPathwayTaskOverdue } from "@/lib/pathways";
import { formatDate } from "@/lib/utils";

function daysUntilDue(dueDate: Date, today: Date): number {
  const dueDay = Date.UTC(
    dueDate.getUTCFullYear(),
    dueDate.getUTCMonth(),
    dueDate.getUTCDate()
  );
  const todayDay = Date.UTC(
    today.getUTCFullYear(),
    today.getUTCMonth(),
    today.getUTCDate()
  );
  return Math.round((dueDay - todayDay) / (24 * 60 * 60 * 1000));
}

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const today = getStartOfTodayUtc();
  const portalUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";

  const tasks = await prisma.pathwayTask.findMany({
    where: { completedAt: null },
    include: {
      pathway: {
        include: {
          client: { select: { name: true } },
          accountManager: { select: { id: true, name: true, email: true } },
          designer: { select: { id: true, name: true, email: true } },
        },
      },
    },
  });

  const adminUsers = await prisma.user.findMany({
    where: { role: "ADMIN" },
    select: { email: true },
  });
  const adminEmails = adminUsers.map((u) => u.email);

  let reminders7 = 0;
  let reminders1 = 0;
  let overdueNotified = 0;

  for (const task of tasks) {
    const dueLabel = formatDate(task.dueDate);
    const days = daysUntilDue(task.dueDate, today);
    const clientName = task.pathway.client.name;
    const assignees = `${task.pathway.accountManager.name} (AM), ${task.pathway.designer.name} (Designer)`;

    const recipients = [
      task.pathway.accountManager,
      task.pathway.designer,
    ];

    if (days === 7 && !task.reminderSent7DayAt) {
      for (const user of recipients) {
        await notifyPathwayTaskReminder({
          to: user.email,
          recipientName: user.name,
          clientName,
          taskTitle: task.title,
          dueDateLabel: dueLabel,
          daysUntilDue: 7,
          portalUrl,
        });
      }
      await prisma.pathwayTask.update({
        where: { id: task.id },
        data: { reminderSent7DayAt: new Date() },
      });
      reminders7++;
    }

    if (days === 1 && !task.reminderSent1DayAt) {
      for (const user of recipients) {
        await notifyPathwayTaskReminder({
          to: user.email,
          recipientName: user.name,
          clientName,
          taskTitle: task.title,
          dueDateLabel: dueLabel,
          daysUntilDue: 1,
          portalUrl,
        });
      }
      await prisma.pathwayTask.update({
        where: { id: task.id },
        data: { reminderSent1DayAt: new Date() },
      });
      reminders1++;
    }

    if (isPathwayTaskOverdue(task) && !task.overdueNotifiedAt && adminEmails.length > 0) {
      await notifyAdminsPathwayOverdue({
        adminEmails,
        clientName,
        taskTitle: task.title,
        dueDateLabel: dueLabel,
        assignees,
        portalUrl,
      });
      await prisma.pathwayTask.update({
        where: { id: task.id },
        data: { overdueNotifiedAt: new Date() },
      });
      overdueNotified++;
    }
  }

  return NextResponse.json({
    checked: tasks.length,
    reminders7,
    reminders1,
    overdueNotified,
  });
}
