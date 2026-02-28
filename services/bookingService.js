import { prisma } from '../config/database.js';

const VALID_STATUSES = ['inquiry', 'confirmed', 'paid', 'completed', 'cancelled'];

/**
 * Generate a unique booking reference (e.g. BK-20250223-A1B2).
 * @returns {Promise<string>}
 */
async function generateBookingRef() {
  const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  const ref = `BK-${datePart}-${random}`;

  const existing = await prisma.booking.findUnique({
    where: { bookingRef: ref },
  });
  if (existing) {
    return generateBookingRef();
  }
  return ref;
}

/**
 * List bookings with filters: status, region, date range, yacht.
 * @param {object} options - { status, regionId, from, to, yachtId, page, limit }
 * @returns {Promise<{ bookings: Array, total: number, page: number, limit: number }>}
 */
export async function listBookings(options = {}) {
  const {
    status,
    regionId,
    from,
    to,
    yachtId,
    page = 1,
    limit = 50,
  } = options;

  const skip = (page - 1) * limit;
  const where = {};

  if (status) {
    if (!VALID_STATUSES.includes(status)) {
      const err = new Error(`status must be one of: ${VALID_STATUSES.join(', ')}`);
      err.status = 400;
      throw err;
    }
    where.status = status;
  }
  if (regionId) where.regionId = regionId;
  if (yachtId) where.yachtId = yachtId;

  if (from || to) {
    where.AND = where.AND || [];
    if (from) {
      const fromDate = new Date(from);
      if (isNaN(fromDate.getTime())) {
        const err = new Error('Invalid from date');
        err.status = 400;
        throw err;
      }
      where.AND.push({ endDate: { gte: fromDate } });
    }
    if (to) {
      const toDate = new Date(to);
      if (isNaN(toDate.getTime())) {
        const err = new Error('Invalid to date');
        err.status = 400;
        throw err;
      }
      where.AND.push({ startDate: { lte: toDate } });
    }
  }

  const [bookings, total] = await Promise.all([
    prisma.booking.findMany({
      where,
      include: {
        customer: { select: { id: true, firstName: true, lastName: true, email: true } },
        yacht: { select: { id: true, name: true, type: true } },
        package: { select: { id: true, name: true } },
        region: { select: { id: true, name: true, slug: true } },
        currency: { select: { code: true, symbol: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.booking.count({ where }),
  ]);

  return {
    bookings,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

/**
 * List upcoming bookings (next 5 by start date).
 * @returns {Promise<{ bookings: Array }>}
 */
export async function getUpcomingBookings() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const bookings = await prisma.booking.findMany({
    where: {
      status: { not: 'cancelled' },
      startDate: { gte: today },
    },
    include: {
      customer: { select: { id: true, firstName: true, lastName: true, email: true } },
      yacht: { select: { id: true, name: true, type: true } },
      package: { select: { id: true, name: true } },
      region: { select: { id: true, name: true, slug: true } },
      currency: { select: { code: true, symbol: true } },
    },
    orderBy: { startDate: 'asc' },
    take: 5,
  });

  return { bookings };
}

/**
 * Create a booking.
 * @param {object} data - Booking fields
 * @returns {Promise<object>}
 */
export async function createBooking(data) {
  const {
    customerId,
    yachtId,
    packageId,
    regionId,
    startDate,
    endDate,
    guestCount,
    baseAmount,
    totalAmount,
    currencyCode,
    agentId,
    startTime,
    addonsAmount = 0,
    discountAmount = 0,
    taxAmount = 0,
    promoCodeId,
    cancellationPolicy,
    specialRequests,
    internalNotes,
    status = 'inquiry',
  } = data;

  const required = ['customerId', 'yachtId', 'packageId', 'regionId', 'startDate', 'endDate', 'guestCount', 'baseAmount', 'totalAmount', 'currencyCode'];
  for (const field of required) {
    if (data[field] == null || data[field] === '') {
      const err = new Error(`${field} is required`);
      err.status = 400;
      throw err;
    }
  }

  if (status && !VALID_STATUSES.includes(status)) {
    const err = new Error(`status must be one of: ${VALID_STATUSES.join(', ')}`);
    err.status = 400;
    throw err;
  }

  const start = new Date(startDate);
  const end = new Date(endDate);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    const err = new Error('Invalid startDate or endDate');
    err.status = 400;
    throw err;
  }
  if (end < start) {
    const err = new Error('endDate must be on or after startDate');
    err.status = 400;
    throw err;
  }

  const guestCountNum = parseInt(guestCount, 10);
  if (Number.isNaN(guestCountNum) || guestCountNum < 1) {
    const err = new Error('guestCount must be a positive integer');
    err.status = 400;
    throw err;
  }

  const baseNum = parseFloat(baseAmount);
  const totalNum = parseFloat(totalAmount);
  if (Number.isNaN(baseNum) || baseNum < 0 || Number.isNaN(totalNum) || totalNum < 0) {
    const err = new Error('baseAmount and totalAmount must be non-negative numbers');
    err.status = 400;
    throw err;
  }

  const [customer, yacht, pkg, region, currency] = await Promise.all([
    prisma.customer.findUnique({ where: { id: customerId } }),
    prisma.yacht.findUnique({ where: { id: yachtId } }),
    prisma.package.findUnique({ where: { id: packageId } }),
    prisma.region.findUnique({ where: { id: regionId } }),
    prisma.currency.findUnique({ where: { code: currencyCode } }),
  ]);

  if (!customer) {
    const err = new Error('Customer not found');
    err.status = 400;
    throw err;
  }
  if (!yacht) {
    const err = new Error('Yacht not found');
    err.status = 400;
    throw err;
  }
  if (!pkg) {
    const err = new Error('Package not found');
    err.status = 400;
    throw err;
  }
  if (!region) {
    const err = new Error('Region not found');
    err.status = 400;
    throw err;
  }
  if (!currency) {
    const err = new Error('Currency not found');
    err.status = 400;
    throw err;
  }

  if (agentId) {
    const agent = await prisma.agent.findUnique({ where: { id: agentId } });
    if (!agent) {
      const err = new Error('Agent not found');
      err.status = 400;
      throw err;
    }
  }

  const bookingRef = await generateBookingRef();

  const booking = await prisma.booking.create({
    data: {
      bookingRef,
      customerId,
      yachtId,
      packageId,
      regionId,
      agentId: agentId || null,
      startDate: start,
      endDate: end,
      startTime: startTime?.trim() || null,
      guestCount: guestCountNum,
      status: status || 'inquiry',
      baseAmount: baseNum,
      addonsAmount: addonsAmount != null ? parseFloat(addonsAmount) : 0,
      discountAmount: discountAmount != null ? parseFloat(discountAmount) : 0,
      taxAmount: taxAmount != null ? parseFloat(taxAmount) : 0,
      totalAmount: totalNum,
      currencyCode,
      promoCodeId: promoCodeId || null,
      cancellationPolicy: cancellationPolicy?.trim() || null,
      specialRequests: specialRequests?.trim() || null,
      internalNotes: internalNotes?.trim() || null,
    },
    include: {
      customer: { select: { id: true, firstName: true, lastName: true, email: true } },
      yacht: { select: { id: true, name: true, type: true } },
      package: { select: { id: true, name: true } },
      region: { select: { id: true, name: true, slug: true } },
      currency: { select: { code: true, symbol: true } },
    },
  });

  return booking;
}

/**
 * Get booking by ID.
 * @param {string} id - Booking UUID
 * @returns {Promise<object>}
 */
export async function getBookingById(id) {
  const booking = await prisma.booking.findUnique({
    where: { id },
    include: {
      customer: true,
      yacht: { select: { id: true, name: true, type: true } },
      package: { select: { id: true, name: true } },
      region: { select: { id: true, name: true, slug: true } },
      agent: { select: { id: true, name: true, email: true } },
      currency: true,
      promoCode: { select: { id: true, code: true } },
      addons: {
        include: { addon: { select: { id: true, name: true, price: true, priceType: true } } },
      },
      payments: { select: { id: true, amount: true, paymentType: true, status: true, paidAt: true } },
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
 * Update a booking.
 * @param {string} id - Booking UUID
 * @param {object} data - Partial booking data
 * @returns {Promise<object>}
 */
export async function updateBooking(id, data) {
  const booking = await prisma.booking.findUnique({
    where: { id },
  });

  if (!booking) {
    const err = new Error('Booking not found');
    err.status = 404;
    throw err;
  }

  const {
    customerId,
    yachtId,
    packageId,
    regionId,
    agentId,
    startDate,
    endDate,
    startTime,
    guestCount,
    status,
    baseAmount,
    addonsAmount,
    discountAmount,
    taxAmount,
    totalAmount,
    currencyCode,
    promoCodeId,
    cancellationPolicy,
    cancellationReason,
    specialRequests,
    internalNotes,
  } = data;

  const updateData = {};

  if (customerId !== undefined) {
    const customer = await prisma.customer.findUnique({ where: { id: customerId } });
    if (!customer) {
      const err = new Error('Customer not found');
      err.status = 400;
      throw err;
    }
    updateData.customerId = customerId;
  }
  if (yachtId !== undefined) {
    const yacht = await prisma.yacht.findUnique({ where: { id: yachtId } });
    if (!yacht) {
      const err = new Error('Yacht not found');
      err.status = 400;
      throw err;
    }
    updateData.yachtId = yachtId;
  }
  if (packageId !== undefined) {
    const pkg = await prisma.package.findUnique({ where: { id: packageId } });
    if (!pkg) {
      const err = new Error('Package not found');
      err.status = 400;
      throw err;
    }
    updateData.packageId = packageId;
  }
  if (regionId !== undefined) {
    const region = await prisma.region.findUnique({ where: { id: regionId } });
    if (!region) {
      const err = new Error('Region not found');
      err.status = 400;
      throw err;
    }
    updateData.regionId = regionId;
  }
  if (agentId !== undefined) {
    updateData.agentId = agentId || null;
    if (agentId) {
      const agent = await prisma.agent.findUnique({ where: { id: agentId } });
      if (!agent) {
        const err = new Error('Agent not found');
        err.status = 400;
        throw err;
      }
    }
  }
  if (startDate !== undefined) {
    const d = new Date(startDate);
    if (isNaN(d.getTime())) {
      const err = new Error('Invalid startDate');
      err.status = 400;
      throw err;
    }
    updateData.startDate = d;
  }
  if (endDate !== undefined) {
    const d = new Date(endDate);
    if (isNaN(d.getTime())) {
      const err = new Error('Invalid endDate');
      err.status = 400;
      throw err;
    }
    updateData.endDate = d;
  }
  if (startTime !== undefined) updateData.startTime = startTime?.trim() || null;
  if (guestCount !== undefined) {
    const n = parseInt(guestCount, 10);
    if (Number.isNaN(n) || n < 1) {
      const err = new Error('guestCount must be a positive integer');
      err.status = 400;
      throw err;
    }
    updateData.guestCount = n;
  }
  if (status !== undefined) {
    if (!VALID_STATUSES.includes(status)) {
      const err = new Error(`status must be one of: ${VALID_STATUSES.join(', ')}`);
      err.status = 400;
      throw err;
    }
    updateData.status = status;
  }
  if (baseAmount !== undefined) {
    const n = parseFloat(baseAmount);
    if (Number.isNaN(n) || n < 0) {
      const err = new Error('baseAmount must be a non-negative number');
      err.status = 400;
      throw err;
    }
    updateData.baseAmount = n;
  }
  if (addonsAmount !== undefined) updateData.addonsAmount = parseFloat(addonsAmount);
  if (discountAmount !== undefined) updateData.discountAmount = parseFloat(discountAmount);
  if (taxAmount !== undefined) updateData.taxAmount = parseFloat(taxAmount);
  if (totalAmount !== undefined) {
    const n = parseFloat(totalAmount);
    if (Number.isNaN(n) || n < 0) {
      const err = new Error('totalAmount must be a non-negative number');
      err.status = 400;
      throw err;
    }
    updateData.totalAmount = n;
  }
  if (currencyCode !== undefined) {
    const currency = await prisma.currency.findUnique({ where: { code: currencyCode } });
    if (!currency) {
      const err = new Error('Currency not found');
      err.status = 400;
      throw err;
    }
    updateData.currencyCode = currencyCode;
  }
  if (promoCodeId !== undefined) updateData.promoCodeId = promoCodeId || null;
  if (cancellationPolicy !== undefined) updateData.cancellationPolicy = cancellationPolicy?.trim() || null;
  if (cancellationReason !== undefined) updateData.cancellationReason = cancellationReason?.trim() || null;
  if (specialRequests !== undefined) updateData.specialRequests = specialRequests?.trim() || null;
  if (internalNotes !== undefined) updateData.internalNotes = internalNotes?.trim() || null;

  const updated = await prisma.booking.update({
    where: { id },
    data: updateData,
    include: {
      customer: { select: { id: true, firstName: true, lastName: true, email: true } },
      yacht: { select: { id: true, name: true, type: true } },
      package: { select: { id: true, name: true } },
      region: { select: { id: true, name: true, slug: true } },
      currency: { select: { code: true, symbol: true } },
    },
  });

  return updated;
}

/**
 * Update booking status only.
 * @param {string} id - Booking UUID
 * @param {object} data - { status }
 * @returns {Promise<object>}
 */
export async function updateBookingStatus(id, data) {
  const { status } = data;

  if (!status || !VALID_STATUSES.includes(status)) {
    const err = new Error(`status must be one of: ${VALID_STATUSES.join(', ')}`);
    err.status = 400;
    throw err;
  }

  const booking = await prisma.booking.findUnique({
    where: { id },
  });

  if (!booking) {
    const err = new Error('Booking not found');
    err.status = 404;
    throw err;
  }

  const updated = await prisma.booking.update({
    where: { id },
    data: { status },
    include: {
      customer: { select: { id: true, firstName: true, lastName: true, email: true } },
      yacht: { select: { id: true, name: true } },
      package: { select: { id: true, name: true } },
      region: { select: { id: true, name: true } },
      currency: { select: { code: true, symbol: true } },
    },
  });

  return updated;
}

/**
 * Confirm a booking (set status to confirmed).
 * @param {string} id - Booking UUID
 * @returns {Promise<object>}
 */
export async function confirmBooking(id) {
  return updateBookingStatus(id, { status: 'confirmed' });
}

/**
 * Cancel a booking (set status to cancelled, cancelledAt, optional cancellationReason).
 * @param {string} id - Booking UUID
 * @param {object} options - { cancellationReason? }
 * @returns {Promise<object>}
 */
export async function cancelBooking(id, options = {}) {
  const { cancellationReason } = options;

  const booking = await prisma.booking.findUnique({
    where: { id },
  });

  if (!booking) {
    const err = new Error('Booking not found');
    err.status = 404;
    throw err;
  }

  if (booking.status === 'cancelled') {
    const err = new Error('Booking is already cancelled');
    err.status = 400;
    throw err;
  }

  const updated = await prisma.booking.update({
    where: { id },
    data: {
      status: 'cancelled',
      cancelledAt: new Date(),
      cancellationReason: cancellationReason?.trim() || null,
    },
    include: {
      customer: { select: { id: true, firstName: true, lastName: true, email: true } },
      yacht: { select: { id: true, name: true } },
      package: { select: { id: true, name: true } },
      region: { select: { id: true, name: true } },
      currency: { select: { code: true, symbol: true } },
    },
  });

  return updated;
}

/**
 * Mark a booking as completed (set status to completed).
 * @param {string} id - Booking UUID
 * @returns {Promise<object>}
 */
export async function completeBooking(id) {
  return updateBookingStatus(id, { status: 'completed' });
}
