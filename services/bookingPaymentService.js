import { prisma } from '../config/database.js';

const VALID_PAYMENT_TYPES = ['deposit', 'balance', 'refund', 'partial'];
const VALID_STATUSES = ['pending', 'completed', 'failed', 'refunded'];
const VALID_PAYMENT_METHODS = ['card', 'bank_transfer', 'cash', 'paypal'];

/**
 * List payments for a booking.
 * @param {string} bookingId - Booking UUID
 * @returns {Promise<{ bookingId: string, payments: Array }>}
 */
export async function listPayments(bookingId) {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
  });

  if (!booking) {
    const err = new Error('Booking not found');
    err.status = 404;
    throw err;
  }

  const payments = await prisma.payment.findMany({
    where: { bookingId },
    include: { currency: { select: { code: true, symbol: true } } },
    orderBy: { createdAt: 'desc' },
  });

  return {
    bookingId: booking.id,
    bookingRef: booking.bookingRef,
    payments,
  };
}

/**
 * Record a payment for a booking.
 * @param {string} bookingId - Booking UUID
 * @param {object} data - { amount, currencyCode, paymentType, paymentMethod?, gatewayRef?, notes?, paidAt? }
 * @returns {Promise<object>}
 */
export async function recordPayment(bookingId, data) {
  const {
    amount,
    currencyCode,
    paymentType,
    paymentMethod,
    gatewayRef,
    notes,
    paidAt,
    status = 'pending',
  } = data;

  if (amount == null || amount === '' || !currencyCode || !paymentType) {
    const err = new Error('amount, currencyCode, and paymentType are required');
    err.status = 400;
    throw err;
  }

  if (!VALID_PAYMENT_TYPES.includes(paymentType)) {
    const err = new Error(`paymentType must be one of: ${VALID_PAYMENT_TYPES.join(', ')}`);
    err.status = 400;
    throw err;
  }

  if (status && !VALID_STATUSES.includes(status)) {
    const err = new Error(`status must be one of: ${VALID_STATUSES.join(', ')}`);
    err.status = 400;
    throw err;
  }

  if (paymentMethod && !VALID_PAYMENT_METHODS.includes(paymentMethod)) {
    const err = new Error(`paymentMethod must be one of: ${VALID_PAYMENT_METHODS.join(', ')}`);
    err.status = 400;
    throw err;
  }

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
  });

  if (!booking) {
    const err = new Error('Booking not found');
    err.status = 404;
    throw err;
  }

  const currency = await prisma.currency.findUnique({
    where: { code: currencyCode },
  });

  if (!currency) {
    const err = new Error('Currency not found');
    err.status = 400;
    throw err;
  }

  const amountNum = parseFloat(amount);
  if (Number.isNaN(amountNum) || amountNum <= 0) {
    const err = new Error('amount must be a positive number');
    err.status = 400;
    throw err;
  }

  const payment = await prisma.payment.create({
    data: {
      bookingId,
      amount: amountNum,
      currencyCode,
      paymentType,
      paymentMethod: paymentMethod || null,
      gatewayRef: gatewayRef?.trim() || null,
      notes: notes?.trim() || null,
      status: status || 'pending',
      paidAt: status === 'completed' && (paidAt !== undefined) ? new Date(paidAt) : (status === 'completed' ? new Date() : null),
    },
    include: { currency: { select: { code: true, symbol: true } } },
  });

  return payment;
}

/**
 * Update payment status (or other fields).
 * @param {string} bookingId - Booking UUID
 * @param {string} paymentId - Payment UUID
 * @param {object} data - Partial payment data
 * @returns {Promise<object>}
 */
export async function updatePayment(bookingId, paymentId, data) {
  const { amount, paymentType, paymentMethod, gatewayRef, notes, status, paidAt } = data;

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
  });

  if (!booking) {
    const err = new Error('Booking not found');
    err.status = 404;
    throw err;
  }

  const payment = await prisma.payment.findFirst({
    where: { id: paymentId, bookingId },
  });

  if (!payment) {
    const err = new Error('Payment not found');
    err.status = 404;
    throw err;
  }

  const updateData = {};
  if (amount !== undefined) {
    const n = parseFloat(amount);
    if (Number.isNaN(n) || n < 0) {
      const err = new Error('amount must be a non-negative number');
      err.status = 400;
      throw err;
    }
    updateData.amount = n;
  }
  if (paymentType !== undefined) {
    if (!VALID_PAYMENT_TYPES.includes(paymentType)) {
      const err = new Error(`paymentType must be one of: ${VALID_PAYMENT_TYPES.join(', ')}`);
      err.status = 400;
      throw err;
    }
    updateData.paymentType = paymentType;
  }
  if (paymentMethod !== undefined) updateData.paymentMethod = paymentMethod || null;
  if (gatewayRef !== undefined) updateData.gatewayRef = gatewayRef?.trim() || null;
  if (notes !== undefined) updateData.notes = notes?.trim() || null;
  if (status !== undefined) {
    if (!VALID_STATUSES.includes(status)) {
      const err = new Error(`status must be one of: ${VALID_STATUSES.join(', ')}`);
      err.status = 400;
      throw err;
    }
    updateData.status = status;
    if (status === 'completed' && !payment.paidAt) updateData.paidAt = new Date();
    if (status === 'refunded') updateData.paidAt = payment.paidAt; // keep original or set as needed
  }
  if (paidAt !== undefined) updateData.paidAt = paidAt ? new Date(paidAt) : null;

  const updated = await prisma.payment.update({
    where: { id: paymentId },
    data: updateData,
    include: { currency: { select: { code: true, symbol: true } } },
  });

  return updated;
}

/**
 * Process a refund (create a refund payment record).
 * @param {string} bookingId - Booking UUID
 * @param {string} paymentId - Original payment UUID (optional - if not provided, refund is standalone)
 * @param {object} data - { amount, currencyCode?, notes? }
 * @returns {Promise<object>}
 */
export async function processRefund(bookingId, paymentId, data) {
  const { amount, currencyCode, notes } = data;

  if (amount == null || amount === '') {
    const err = new Error('amount is required');
    err.status = 400;
    throw err;
  }

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
  });

  if (!booking) {
    const err = new Error('Booking not found');
    err.status = 404;
    throw err;
  }

  const amountNum = parseFloat(amount);
  if (Number.isNaN(amountNum) || amountNum <= 0) {
    const err = new Error('amount must be a positive number');
    err.status = 400;
    throw err;
  }

  const currency = currencyCode || booking.currencyCode;
  const currencyRecord = await prisma.currency.findUnique({
    where: { code: currency },
  });

  if (!currencyRecord) {
    const err = new Error('Currency not found');
    err.status = 400;
    throw err;
  }

  const payment = await prisma.payment.create({
    data: {
      bookingId,
      amount: amountNum,
      currencyCode: currency,
      paymentType: 'refund',
      paymentMethod: null,
      status: 'completed',
      paidAt: new Date(),
      notes: notes?.trim() || null,
    },
    include: { currency: { select: { code: true, symbol: true } } },
  });

  return payment;
}
