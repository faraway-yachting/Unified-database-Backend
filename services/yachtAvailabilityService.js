import { prisma } from '../config/database.js';

const VALID_REASONS = ['blackout', 'maintenance', 'private_use'];
const CONFIRMED_BOOKING_STATUSES = ['confirmed', 'paid', 'completed'];

/**
 * Get availability calendar for a yacht (blackout blocks, optionally in date range).
 * @param {string} yachtId - Yacht UUID
 * @param {object} options - { from (Date string), to (Date string) }
 * @returns {Promise<{ blocks: Array, yacht: { id } }>}
 */
export async function getAvailability(yachtId, options = {}) {
  const { from, to } = options;

  const yacht = await prisma.yacht.findUnique({
    where: { id: yachtId },
  });

  if (!yacht) {
    const err = new Error('Yacht not found');
    err.status = 404;
    throw err;
  }

  const where = { yachtId };
  if (from || to) {
    let fromDate = from ? new Date(from) : null;
    let toDate = to ? new Date(to) : null;
    if (fromDate && isNaN(fromDate.getTime())) fromDate = null;
    if (toDate && isNaN(toDate.getTime())) toDate = null;
    where.AND = [];
    // Overlap: block overlaps [from, to] if block.startDate <= to && block.endDate >= from
    if (toDate) where.AND.push({ startDate: { lte: toDate } });
    if (fromDate) where.AND.push({ endDate: { gte: fromDate } });
    if (where.AND.length === 0) delete where.AND;
  }

  const blocks = await prisma.yachtAvailabilityBlock.findMany({
    where,
    orderBy: [{ startDate: 'asc' }, { endDate: 'asc' }],
  });

  return {
    yacht: { id: yacht.id, name: yacht.name },
    blocks,
  };
}

/**
 * Add a blackout/availability block for a yacht.
 * @param {string} yachtId - Yacht UUID
 * @param {object} data - { startDate, endDate, reason?, notes? }
 * @returns {Promise<object>}
 */
export async function addBlock(yachtId, data) {
  const { startDate, endDate, reason = 'blackout', notes } = data;

  if (!startDate || !endDate) {
    const err = new Error('startDate and endDate are required');
    err.status = 400;
    throw err;
  }

  if (reason && !VALID_REASONS.includes(reason)) {
    const err = new Error(`reason must be one of: ${VALID_REASONS.join(', ')}`);
    err.status = 400;
    throw err;
  }

  const yacht = await prisma.yacht.findUnique({
    where: { id: yachtId },
  });

  if (!yacht) {
    const err = new Error('Yacht not found');
    err.status = 404;
    throw err;
  }

  const start = new Date(startDate);
  const end = new Date(endDate);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    const err = new Error('Invalid startDate or endDate format');
    err.status = 400;
    throw err;
  }
  if (end < start) {
    const err = new Error('endDate must be on or after startDate');
    err.status = 400;
    throw err;
  }

  const block = await prisma.yachtAvailabilityBlock.create({
    data: {
      yachtId,
      startDate: start,
      endDate: end,
      reason: reason || 'blackout',
      notes: notes || null,
    },
  });

  return block;
}

/**
 * Remove an availability block.
 * @param {string} yachtId - Yacht UUID
 * @param {string} blockId - Block UUID
 * @returns {Promise<void>}
 */
export async function removeBlock(yachtId, blockId) {
  const yacht = await prisma.yacht.findUnique({
    where: { id: yachtId },
  });

  if (!yacht) {
    const err = new Error('Yacht not found');
    err.status = 404;
    throw err;
  }

  const block = await prisma.yachtAvailabilityBlock.findFirst({
    where: { id: blockId, yachtId },
  });

  if (!block) {
    const err = new Error('Availability block not found');
    err.status = 404;
    throw err;
  }

  await prisma.yachtAvailabilityBlock.delete({
    where: { id: blockId },
  });
}

/**
 * Check if a date range is available (no overlapping blocks; optionally consider confirmed bookings).
 * @param {string} yachtId - Yacht UUID
 * @param {string} startDate - Start date (YYYY-MM-DD or ISO)
 * @param {string} endDate - End date (YYYY-MM-DD or ISO)
 * @param {object} options - { includeBookings?: boolean }
 * @returns {Promise<{ available: boolean, conflictingBlocks?: Array, conflictingBookings?: Array }>}
 */
export async function checkAvailability(yachtId, startDate, endDate, options = {}) {
  const { includeBookings = true } = options;

  if (!startDate || !endDate) {
    const err = new Error('startDate and endDate are required (query: from, to)');
    err.status = 400;
    throw err;
  }

  const yacht = await prisma.yacht.findUnique({
    where: { id: yachtId },
  });

  if (!yacht) {
    const err = new Error('Yacht not found');
    err.status = 404;
    throw err;
  }

  const start = new Date(startDate);
  const end = new Date(endDate);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    const err = new Error('Invalid from or to date format');
    err.status = 400;
    throw err;
  }
  if (end < start) {
    const err = new Error('to must be on or after from');
    err.status = 400;
    throw err;
  }

  // Overlap: range [start, end] overlaps block if block.startDate <= end && block.endDate >= start
  const conflictingBlocks = await prisma.yachtAvailabilityBlock.findMany({
    where: {
      yachtId,
      startDate: { lte: end },
      endDate: { gte: start },
    },
  });

  let conflictingBookings = [];
  if (includeBookings) {
    conflictingBookings = await prisma.booking.findMany({
      where: {
        yachtId,
        status: { in: CONFIRMED_BOOKING_STATUSES },
        startDate: { lte: end },
        endDate: { gte: start },
      },
      select: {
        id: true,
        bookingRef: true,
        startDate: true,
        endDate: true,
        status: true,
      },
    });
  }

  const available = conflictingBlocks.length === 0 && conflictingBookings.length === 0;

  return {
    available,
    conflictingBlocks: conflictingBlocks.length ? conflictingBlocks : undefined,
    conflictingBookings: conflictingBookings.length ? conflictingBookings : undefined,
  };
}
