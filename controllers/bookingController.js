import * as bookingService from '../services/bookingService.js';
import * as bookingInvoiceService from '../services/bookingInvoiceService.js';
import * as bookingAddonService from '../services/bookingAddonService.js';
import * as bookingPaymentService from '../services/bookingPaymentService.js';
import * as bookingCalendarService from '../services/bookingCalendarService.js';
import { sendBookingConfirmationEmail, sendPaymentReminderEmail } from '../services/emailService.js';

/**
 * GET /api/bookings/calendar
 * Calendar view. Query: region, month (YYYY-MM), yacht
 */
export async function getCalendarView(req, res, next) {
  try {
    const { region, month, yacht } = req.query;
    const result = await bookingCalendarService.getCalendarView({
      regionId: region,
      yachtId: yacht,
      month,
    });
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/bookings/availability
 * Check availability. Query: yacht, from, to
 */
export async function checkAvailability(req, res, next) {
  try {
    const { yacht, from, to } = req.query;
    const result = await bookingCalendarService.checkAvailability({
      yachtId: yacht,
      from,
      to,
    });
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/bookings
 * List bookings. Query: status, region, from, to, yacht, page, limit
 */
export async function listBookings(req, res, next) {
  try {
    const { status, region, from, to, yacht, page, limit } = req.query;
    const result = await bookingService.listBookings({
      status,
      regionId: region,
      from,
      to,
      yachtId: yacht,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/bookings/upcoming
 * List upcoming bookings (next 5).
 */
export async function getUpcomingBookings(req, res, next) {
  try {
    const result = await bookingService.getUpcomingBookings();
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/bookings
 * Create booking. Body: customerId, yachtId, packageId, regionId, startDate, endDate, guestCount, baseAmount, totalAmount, currencyCode, ...
 */
export async function createBooking(req, res, next) {
  try {
    const booking = await bookingService.createBooking(req.body);
    res.status(201).json(booking);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/bookings/:id
 * Get booking detail.
 */
export async function getBookingById(req, res, next) {
  try {
    const { id } = req.params;
    const booking = await bookingService.getBookingById(id);
    res.status(200).json(booking);
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/bookings/:id
 * Update booking. Body: partial booking fields.
 */
export async function updateBooking(req, res, next) {
  try {
    const { id } = req.params;
    const booking = await bookingService.updateBooking(id, req.body);
    res.status(200).json(booking);
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/bookings/:id
 * Cancel booking. Body: { cancellationReason? }
 */
export async function cancelBooking(req, res, next) {
  try {
    const { id } = req.params;
    const { cancellationReason } = req.body || {};
    const booking = await bookingService.cancelBooking(id, { cancellationReason });
    res.status(200).json(booking);
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/bookings/:id/status
 * Update booking status. Body: { status }
 */
export async function updateBookingStatus(req, res, next) {
  try {
    const { id } = req.params;
    const booking = await bookingService.updateBookingStatus(id, req.body);
    res.status(200).json(booking);
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/bookings/:id/confirm
 * Confirm booking (set status to confirmed).
 */
export async function confirmBooking(req, res, next) {
  try {
    const { id } = req.params;
    const booking = await bookingService.confirmBooking(id);
    res.status(200).json(booking);
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/bookings/:id/cancel
 * Cancel booking with reason. Body: { cancellationReason? }
 */
export async function cancelBookingPost(req, res, next) {
  try {
    const { id } = req.params;
    const { cancellationReason } = req.body || {};
    const booking = await bookingService.cancelBooking(id, { cancellationReason });
    res.status(200).json(booking);
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/bookings/:id/complete
 * Mark booking as completed.
 */
export async function completeBooking(req, res, next) {
  try {
    const { id } = req.params;
    const booking = await bookingService.completeBooking(id);
    res.status(200).json(booking);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/bookings/:id/invoice
 * Generate and download PDF invoice for the booking.
 */
export async function getInvoice(req, res, next) {
  try {
    const { id } = req.params;
    const booking = await bookingInvoiceService.getBookingForInvoice(id);
    const pdfBuffer = await bookingInvoiceService.generateInvoicePdf(booking);
    const filename = `invoice-${booking.bookingRef}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(pdfBuffer);
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/bookings/:id/send-confirmation
 * Send confirmation email to the customer.
 */
export async function sendConfirmation(req, res, next) {
  try {
    const { id } = req.params;
    const booking = await bookingService.getBookingById(id);
    const result = await sendBookingConfirmationEmail(booking);
    if (!result.sent) {
      return res.status(502).json({
        message: result.error?.message || 'Failed to send confirmation email',
        sent: false,
        error: result.error,
      });
    }
    res.status(200).json({ message: 'Confirmation email sent', sent: true });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/bookings/:id/send-reminder
 * Send payment reminder email to the customer. Body: { message? } optional custom message.
 */
export async function sendReminder(req, res, next) {
  try {
    const { id } = req.params;
    const { message } = req.body || {};
    const booking = await bookingService.getBookingById(id);
    const result = await sendPaymentReminderEmail(booking, message);
    if (!result.sent) {
      return res.status(502).json({
        message: result.error?.message || 'Failed to send reminder email',
        sent: false,
        error: result.error,
      });
    }
    res.status(200).json({ message: 'Payment reminder email sent', sent: true });
  } catch (err) {
    next(err);
  }
}

// --- Booking Add-ons ---
export async function listBookingAddons(req, res, next) {
  try {
    const { id } = req.params;
    const result = await bookingAddonService.listBookingAddons(id);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function addAddonToBooking(req, res, next) {
  try {
    const { id } = req.params;
    const addon = await bookingAddonService.addAddonToBooking(id, req.body);
    res.status(201).json(addon);
  } catch (err) {
    next(err);
  }
}

export async function removeAddonFromBooking(req, res, next) {
  try {
    const { id, addonId } = req.params;
    await bookingAddonService.removeAddonFromBooking(id, addonId);
    res.status(200).json({ message: 'Add-on removed from booking' });
  } catch (err) {
    next(err);
  }
}

// --- Booking Payments ---
export async function listPayments(req, res, next) {
  try {
    const { id } = req.params;
    const result = await bookingPaymentService.listPayments(id);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function recordPayment(req, res, next) {
  try {
    const { id } = req.params;
    const payment = await bookingPaymentService.recordPayment(id, req.body);
    res.status(201).json(payment);
  } catch (err) {
    next(err);
  }
}

export async function updatePayment(req, res, next) {
  try {
    const { id, paymentId } = req.params;
    const payment = await bookingPaymentService.updatePayment(id, paymentId, req.body);
    res.status(200).json(payment);
  } catch (err) {
    next(err);
  }
}

export async function processRefund(req, res, next) {
  try {
    const { id, paymentId } = req.params;
    const payment = await bookingPaymentService.processRefund(id, paymentId, req.body);
    res.status(201).json(payment);
  } catch (err) {
    next(err);
  }
}
