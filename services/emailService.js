import { Resend } from 'resend';
import authConfig from '../config/auth.js';

const resend = authConfig.resend?.apiKey ? new Resend(authConfig.resend.apiKey) : null;

/**
 * Send password reset email with a link containing the token.
 * Uses Resend (https://resend.com). No-op if RESEND_API_KEY is not set.
 * @param {string} toEmail - Recipient email
 * @param {string} resetToken - One-time token for the reset link
 * @returns {{ sent: boolean, error?: object }}
 */
export async function sendPasswordResetEmail(toEmail, resetToken) {
  if (!resend) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('Resend: RESEND_API_KEY not set; password reset email not sent.');
    }
    return { sent: false };
  }

  const baseUrl = authConfig.resend?.passwordResetLinkBase || 'http://localhost:3000';
  const resetLink = `${baseUrl.replace(/\/$/, '')}/reset-password?token=${encodeURIComponent(resetToken)}`;
  const from = authConfig.resend?.from || 'YachtOS Admin <onboarding@resend.dev>';

  const subject = 'Reset your password';
  const html = `
    <p>You requested a password reset.</p>
    <p>Click the link below to set a new password (valid for 1 hour):</p>
    <p><a href="${resetLink}" style="color: #2563eb;">Reset password</a></p>
    <p>Or copy this link: ${resetLink}</p>
    <p>If you didn't request this, you can ignore this email.</p>
  `;

  const { data, error } = await resend.emails.send({
    from,
    to: [toEmail],
    subject,
    html,
  });

  if (error) {
    console.error('Resend password reset email error:', error);
    return { sent: false, error };
  }

  return { sent: true, id: data?.id };
}
