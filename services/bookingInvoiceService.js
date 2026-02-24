import PDFDocument from 'pdfkit';
import { prisma } from '../config/database.js';

/** Format Prisma Decimal or number for display */
function money(value) {
  if (value == null) return '0.00';
  const n = typeof value === 'object' && value?.toString ? Number(value.toString()) : Number(value);
  return Number.isNaN(n) ? '0.00' : n.toFixed(2);
}

/** Format date for display */
function dateStr(d) {
  if (!d) return '—';
  const date = d instanceof Date ? d : new Date(d);
  return isNaN(date.getTime()) ? '—' : date.toISOString().slice(0, 10);
}

/**
 * Get booking with relations for invoice.
 * @param {string} bookingId - Booking UUID
 * @returns {Promise<object>}
 */
export async function getBookingForInvoice(bookingId) {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      customer: true,
      yacht: { select: { id: true, name: true, type: true } },
      package: { select: { id: true, name: true } },
      region: { select: { id: true, name: true } },
      currency: { select: { code: true, symbol: true } },
      addons: {
        include: { addon: { select: { name: true, price: true, priceType: true } } },
      },
      payments: { select: { amount: true, paymentType: true, status: true, paidAt: true } },
    },
  });

  if (!booking) {
    const err = new Error('Booking not found');
    err.status = 404;
    throw err;
  }

  return booking;
}

/**
 * Generate PDF invoice buffer for a booking.
 * @param {object} booking - Booking with customer, yacht, package, region, currency, addons, payments
 * @returns {Promise<Buffer>}
 */
export function generateInvoicePdf(booking) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const buffers = [];
    doc.on('data', buffers.push.bind(buffers));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    const symbol = booking.currency?.symbol || booking.currencyCode || '';
    const customer = booking.customer;
    const customerName = customer ? `${customer.firstName || ''} ${customer.lastName || ''}`.trim() : '—';
    const customerEmail = customer?.email || '—';

    doc.fontSize(20).text('INVOICE', { align: 'left' });
    doc.moveDown(0.5);
    doc.fontSize(10).text(`Booking ref: ${booking.bookingRef}`, { continued: false });
    doc.text(`Date: ${dateStr(booking.createdAt)}`);
    doc.text(`Status: ${booking.status}`);
    doc.moveDown(1);

    doc.fontSize(11).text('Bill to', { underline: true });
    doc.fontSize(10).text(customerName);
    doc.text(customerEmail);
    if (customer?.phone) doc.text(customer.phone);
    doc.moveDown(1);

    doc.fontSize(11).text('Booking details', { underline: true });
    doc.fontSize(10);
    doc.text(`Yacht: ${booking.yacht?.name || '—'} (${booking.yacht?.type || '—'})`);
    doc.text(`Package: ${booking.package?.name || '—'}`);
    doc.text(`Region: ${booking.region?.name || '—'}`);
    doc.text(`Period: ${dateStr(booking.startDate)} to ${dateStr(booking.endDate)}`);
    doc.text(`Guests: ${booking.guestCount}`);
    doc.moveDown(1);

    doc.fontSize(11).text('Charges', { underline: true });
    doc.fontSize(10);
    doc.text(`${symbol} ${money(booking.baseAmount)} — Base`);
    const addonsTotal = Number(booking.addonsAmount) || 0;
    if (addonsTotal > 0) {
      doc.text(`${symbol} ${money(booking.addonsAmount)} — Add-ons`);
    }
    const discount = Number(booking.discountAmount) || 0;
    if (discount > 0) {
      doc.text(`- ${symbol} ${money(booking.discountAmount)} — Discount`);
    }
    const tax = Number(booking.taxAmount) || 0;
    if (tax > 0) {
      doc.text(`${symbol} ${money(booking.taxAmount)} — Tax`);
    }
    doc.moveDown(0.5);
    doc.fontSize(12).text(`Total: ${symbol} ${money(booking.totalAmount)}`, { underline: true });
    doc.moveDown(1);

    if (booking.payments && booking.payments.length > 0) {
      doc.fontSize(11).text('Payments', { underline: true });
      doc.fontSize(10);
      for (const p of booking.payments) {
        doc.text(`${symbol} ${money(p.amount)} — ${p.paymentType || '—'} (${p.status || '—'}) ${dateStr(p.paidAt) ? ` — Paid ${dateStr(p.paidAt)}` : ''}`);
      }
      doc.moveDown(0.5);
    }

    if (booking.specialRequests) {
      doc.fontSize(10).text(`Special requests: ${booking.specialRequests}`, { align: 'left' });
    }

    doc.end();
  });
}
