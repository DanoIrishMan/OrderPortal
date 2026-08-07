/**
 * Email notifications require SMTP configuration in production.
 * Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, and SMTP_FROM in .env
 */

import nodemailer from "nodemailer";

export interface EmailPayload {
  to: string;
  subject: string;
  text: string;
  attachments?: Array<{ filename: string; content: Buffer }>;
}

function getTransporter() {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) return null;

  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT ?? 587),
    secure: Number(SMTP_PORT ?? 587) === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
}

export async function sendEmail(payload: EmailPayload): Promise<{ sent: boolean; reason?: string }> {
  const from = process.env.SMTP_FROM;
  const transporter = getTransporter();

  if (!transporter || !from) {
    return {
      sent: false,
      reason: "SMTP not configured. Set SMTP_HOST, SMTP_USER, SMTP_PASS, and SMTP_FROM in .env",
    };
  }

  try {
    await transporter.sendMail({
      from,
      to: payload.to,
      subject: payload.subject,
      text: payload.text,
      attachments: payload.attachments,
    });
    return { sent: true };
  } catch (error) {
    console.error("[email] Send failed:", error);
    return {
      sent: false,
      reason: error instanceof Error ? error.message : "Failed to send email",
    };
  }
}

export async function sendEmailToMany(
  recipients: string[],
  payload: Omit<EmailPayload, "to">
): Promise<{ sent: number; failed: number }> {
  const unique = [...new Set(recipients.filter(Boolean))];
  let sent = 0;
  let failed = 0;

  for (const to of unique) {
    const result = await sendEmail({ ...payload, to });
    if (result.sent) sent++;
    else failed++;
  }

  return { sent, failed };
}

export async function notifyClientOfUpdates(params: {
  contactEmail: string;
  clientName: string;
  updatedCount: number;
  portalUrl: string;
}) {
  return sendEmail({
    to: params.contactEmail,
    subject: `${params.updatedCount} order update(s) for ${params.clientName}`,
    text: `${params.updatedCount} of your orders were updated this week.\n\nView details: ${params.portalUrl}`,
  });
}

export async function notifyPathwayTaskReminder(params: {
  to: string;
  recipientName: string;
  clientName: string;
  taskTitle: string;
  dueDateLabel: string;
  daysUntilDue: number;
  portalUrl: string;
}) {
  const when =
    params.daysUntilDue === 0
      ? "due today"
      : params.daysUntilDue === 1
        ? "due tomorrow"
        : `due in ${params.daysUntilDue} days`;

  return sendEmail({
    to: params.to,
    subject: `Critical Pathway reminder: ${params.clientName} — ${when}`,
    text: `Hi ${params.recipientName},\n\nTask: ${params.taskTitle}\nClient: ${params.clientName}\nDeadline: ${params.dueDateLabel} (${when})\n\nView tasks: ${params.portalUrl}/staff/pathways`,
  });
}

export async function notifyAdminsPathwayOverdue(params: {
  adminEmails: string[];
  clientName: string;
  taskTitle: string;
  dueDateLabel: string;
  assignees: string;
  portalUrl: string;
}) {
  return sendEmailToMany(params.adminEmails, {
    subject: `Overdue Critical Pathway task: ${params.clientName}`,
    text: `The following Critical Pathway task is overdue:\n\nClient: ${params.clientName}\nTask: ${params.taskTitle}\nDeadline: ${params.dueDateLabel}\nAssigned: ${params.assignees}\n\nView in admin: ${params.portalUrl}/admin/pathways`,
  });
}

export async function notifyPathwayAssigned(params: {
  to: string;
  recipientName: string;
  clientName: string;
  pathwayName: string;
  taskCount: number;
  portalUrl: string;
}) {
  return sendEmail({
    to: params.to,
    subject: `Critical Pathway assigned: ${params.clientName}`,
    text: `Hi ${params.recipientName},\n\nYou have been assigned to the pathway "${params.pathwayName}" for ${params.clientName} (${params.taskCount} tasks).\n\nView tasks: ${params.portalUrl}/staff/pathways`,
  });
}
