import { prisma } from '../config/database.js';

const CONFIRMED_BOOKING_STATUSES = ['confirmed', 'paid', 'completed'];

/**
 * Calendar view: list bookings as events (filter: region, month, yacht).
 * @param {object} options - { regionId, yachtId, month (YYYY-MM), from?, to? }
 * @returns {Promise<{ events: Array }>}
 */
export async function getCalendarView(options = {}) {
  const { regionId, yachtId, month, from, to } = options;

  let startDate;
  let endDate;

  if (month) {
    const [y, m] = month.split('-').map(Number);
    if (!y || !m || m < 1 || m > 12) {
      const err = new Error('month must be YYYY-MM');
      err.status = 400;
      throw err;
    }
    startDate = new Date(y, m - 1, 1);
    endDate = new Date(y, m, 0);
  } else if (from && to) {
    startDate = new Date(from);
    endDate = new Date(to);
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime()) || endDate < startDate) {
      const err = new Error('Invalid from or to date');
      err.status = 400;
      throw err;
    }
  } else {
    const now = new Date();
    startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    endDate = new Date(now.getFullYear(), now.getMonth() + 2, 0);
  }

  const where = {
    startDate: { lte: endDate },
    endDate: { gte: startDate },
    status: { not: 'cancelled' },
  };

  if (regionId) where.regionId = regionId;
  if (yachtId) where.yachtId = yachtId;

  const bookings = await prisma.booking.findMany({
    where,
    include: {
      customer: { select: { id: true, firstName: true, lastName: true } },
      yacht: { select: { id: true, name: true } },
      package: { select: { id: true, name: true } },
      region: { select: { id: true, name: true } },
    },
    orderBy: { startDate: 'asc' },
  });

  const events = bookings.map((b) => ({
    id: b.id,
    bookingRef: b.bookingRef,
    startDate: b.startDate,
    endDate: b.endDate,
    status: b.status,
    customer: b.customer,
    yacht: b.yacht,
    package: b.package,
    region: b.region,
    guestCount: b.guestCount,
  }));

  return {
    from: startDate,
    to: endDate,
    events,
  };
}

/**
 * Check availability for a yacht in a date range (conflicts with confirmed bookings and blackout blocks).
 * @param {object} options - { yachtId, from, to }
 * @returns {Promise<{ available: boolean, conflictingBookings?: Array, conflictingBlocks?: Array }>}
 */
export async function checkAvailability(options = {}) {
  const { yachtId, from, to } = options;

  if (!yachtId || !from || !to) {
    const err = new Error('yachtId, from, and to are required');
    err.status = 400;
    throw err;
  }

  const start = new Date(from);
  const end = new Date(to);
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) {
    const err = new Error('Invalid from or to date');
    err.status = 400;
    throw err;
  }

  const [conflictingBookings, conflictingBlocks] = await Promise.all([
    prisma.booking.findMany({
      where: {
        yachtId,
        status: { in: CONFIRMED_BOOKING_STATUSES },
        startDate: { lte: end },
        endDate: { gte: start },
      },
      select: { id: true, bookingRef: true, startDate: true, endDate: true, status: true },
    }),
    prisma.yachtAvailabilityBlock.findMany({
      where: {
        yachtId,
        startDate: { lte: end },
        endDate: { gte: start },
      },
    }),
  ]);

  const available = conflictingBookings.length === 0 && conflictingBlocks.length === 0;

  return {
    yachtId,
    from: start,
    to: end,
    available,
    conflictingBookings: conflictingBookings.length ? conflictingBookings : undefined,
    conflictingBlocks: conflictingBlocks.length ? conflictingBlocks : undefined,
  };
}
