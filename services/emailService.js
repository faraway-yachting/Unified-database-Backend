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

/**
 * Send booking confirmation email to the customer.
 * Uses Resend. No-op if RESEND_API_KEY is not set.
 * @param {object} booking - Booking with customer, yacht, package, region, currency
 * @returns {{ sent: boolean, error?: object }}
 */
export async function sendBookingConfirmationEmail(booking) {
  if (!resend) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('Resend: RESEND_API_KEY not set; booking confirmation email not sent.');
    }
    return { sent: false };
  }

  const customer = booking.customer;
  if (!customer?.email) {
    return { sent: false, error: { message: 'Customer has no email' } };
  }

  const from = authConfig.resend?.from || 'YachtOS Admin <onboarding@resend.dev>';
  const customerName = [customer.firstName, customer.lastName].filter(Boolean).join(' ') || 'Guest';
  const yachtName = booking.yacht?.name || 'your yacht';
  const packageName = booking.package?.name || 'your package';
  const regionName = booking.region?.name || '';
  const startDate = booking.startDate ? new Date(booking.startDate).toISOString().slice(0, 10) : '—';
  const endDate = booking.endDate ? new Date(booking.endDate).toISOString().slice(0, 10) : '—';
  const total = typeof booking.totalAmount === 'object' && booking.totalAmount?.toString
    ? Number(booking.totalAmount.toString()).toFixed(2)
    : Number(booking.totalAmount || 0).toFixed(2);
  const currency = booking.currency?.code || booking.currencyCode || '';

  const subject = `Booking confirmed – ${booking.bookingRef}`;
  const html = `
    <p>Dear ${customerName},</p>
    <p>Your booking has been confirmed.</p>
    <p><strong>Booking reference:</strong> ${booking.bookingRef}</p>
    <p><strong>Yacht:</strong> ${yachtName}</p>
    <p><strong>Package:</strong> ${packageName}</p>
    <p><strong>Region:</strong> ${regionName}</p>
    <p><strong>Dates:</strong> ${startDate} to ${endDate}</p>
    <p><strong>Guests:</strong> ${booking.guestCount}</p>
    <p><strong>Total:</strong> ${currency} ${total}</p>
    <p>Thank you for your booking.</p>
  `;

  const { data, error } = await resend.emails.send({
    from,
    to: [customer.email],
    subject,
    html,
  });

  if (error) {
    console.error('Resend booking confirmation email error:', error);
    return { sent: false, error };
  }

  return { sent: true, id: data?.id };
}

/**
 * Send payment reminder email to the customer.
 * Uses Resend. No-op if RESEND_API_KEY is not set.
 * @param {object} booking - Booking with customer, yacht, package, region, currency
 * @param {string} [message] - Optional custom reminder message
 * @returns {{ sent: boolean, error?: object }}
 */
export async function sendPaymentReminderEmail(booking, message) {
  if (!resend) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('Resend: RESEND_API_KEY not set; payment reminder email not sent.');
    }
    return { sent: false };
  }

  const customer = booking.customer;
  if (!customer?.email) {
    return { sent: false, error: { message: 'Customer has no email' } };
  }

  const from = authConfig.resend?.from || 'YachtOS Admin <onboarding@resend.dev>';
  const customerName = [customer.firstName, customer.lastName].filter(Boolean).join(' ') || 'Guest';
  const total = typeof booking.totalAmount === 'object' && booking.totalAmount?.toString
    ? Number(booking.totalAmount.toString()).toFixed(2)
    : Number(booking.totalAmount || 0).toFixed(2);
  const currency = booking.currency?.code || booking.currencyCode || '';

  const subject = `Payment reminder – Booking ${booking.bookingRef}`;
  const defaultMessage = `This is a friendly reminder that payment is due for your booking ${booking.bookingRef}. Total amount: ${currency} ${total}.`;
  const body = message && message.trim() ? message.trim() : defaultMessage;

  const html = `
    <p>Dear ${customerName},</p>
    <p>${body}</p>
    <p>Thank you.</p>
  `;

  const { data, error } = await resend.emails.send({
    from,
    to: [customer.email],
    subject,
    html,
  });

  if (error) {
    console.error('Resend payment reminder email error:', error);
    return { sent: false, error };
  }

  return { sent: true, id: data?.id };
}
