/**
 * Email notifications require SMTP configuration in production.
 * Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, and SMTP_FROM in .env
 */

export interface EmailPayload {
  to: string;
  subject: string;
  text: string;
  attachments?: Array<{ filename: string; content: Buffer }>;
}

export async function sendEmail(payload: EmailPayload): Promise<{ sent: boolean; reason?: string }> {
  const { SMTP_HOST, SMTP_USER, SMTP_PASS, SMTP_FROM } = process.env;

  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS || !SMTP_FROM) {
    return {
      sent: false,
      reason: "SMTP not configured. Set SMTP_HOST, SMTP_USER, SMTP_PASS, and SMTP_FROM in .env",
    };
  }

  // Placeholder for production SMTP integration (e.g. nodemailer)
  console.log("[email] Would send:", payload.to, payload.subject);
  return { sent: true };
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
