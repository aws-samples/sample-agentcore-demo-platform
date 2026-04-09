/**
 * Email Service
 *
 * Sends emails via SMTP using Nodemailer.
 * Used for invite emails and other transactional notifications.
 */

import nodemailer from 'nodemailer';
import { config } from '../config/index.js';

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter {
  if (transporter) return transporter;

  if (!config.smtp.enabled) {
    throw new Error('SMTP is not configured. Set SMTP_HOST in environment variables.');
  }

  transporter = nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.secure,
    auth: config.smtp.user
      ? { user: config.smtp.user, pass: config.smtp.pass }
      : undefined,
  });

  return transporter;
}

/**
 * Send an invite email with a link to accept the invitation.
 */
export async function sendInviteEmail(params: {
  to: string;
  inviterName: string;
  organizationName: string;
  inviteToken: string;
  role: string;
}): Promise<void> {
  const { to, inviterName, organizationName, inviteToken, role } = params;
  const acceptUrl = `${config.appUrl}/invite/${inviteToken}`;

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 40px 20px;">
      <div style="background: #1e293b; border-radius: 12px; padding: 32px; color: #e2e8f0;">
        <h2 style="margin: 0 0 16px; color: #f8fafc; font-size: 20px;">You're invited to Super Agent</h2>
        <p style="margin: 0 0 12px; color: #94a3b8; font-size: 14px; line-height: 1.6;">
          <strong style="color: #e2e8f0;">${inviterName}</strong> has invited you to join
          <strong style="color: #e2e8f0;">${organizationName}</strong> as <strong style="color: #06b6d4;">${role}</strong>.
        </p>
        <p style="margin: 0 0 24px; color: #94a3b8; font-size: 14px; line-height: 1.6;">
          Click the button below to set up your account and get started.
        </p>
        <a href="${acceptUrl}" style="display: inline-block; padding: 12px 32px; background: linear-gradient(135deg, #3b82f6, #8b5cf6); color: #fff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px;">
          Accept Invitation
        </a>
        <p style="margin: 24px 0 0; color: #64748b; font-size: 12px;">
          This invitation expires in 7 days. If you didn't expect this email, you can safely ignore it.
        </p>
      </div>
    </div>
  `;

  const transport = getTransporter();
  await transport.sendMail({
    from: config.smtp.from,
    to,
    subject: `${inviterName} invited you to ${organizationName} on Super Agent`,
    html,
  });
}

/**
 * Check if SMTP is configured and ready.
 */
export function isEmailConfigured(): boolean {
  return config.smtp.enabled;
}
