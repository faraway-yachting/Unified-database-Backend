import { prisma } from '../config/database.js';

function ratingInRange(n) {
  const num = parseInt(n, 10);
  return !Number.isNaN(num) && num >= 1 && num <= 5 ? num : null;
}

export async function listSurveys(options = {}) {
  const { customerId, bookingId, page = 1, limit = 50 } = options;
  const skip = (page - 1) * limit;
  const where = {};

  if (customerId) where.customerId = customerId;
  if (bookingId) where.bookingId = bookingId;

  const [surveys, total] = await Promise.all([
    prisma.customerSurvey.findMany({
      where,
      include: {
        customer: { select: { id: true, firstName: true, lastName: true, email: true } },
        booking: { select: { id: true, bookingRef: true, yachtId: true } },
      },
      orderBy: { submittedAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.customerSurvey.count({ where }),
  ]);

  return { surveys, total, page, limit, totalPages: Math.ceil(total / limit) };
}

export async function getSurveyById(id) {
  const survey = await prisma.customerSurvey.findUnique({
    where: { id },
    include: {
      customer: true,
      booking: { select: { id: true, bookingRef: true, startDate: true, endDate: true, yachtId: true } },
    },
  });
  if (!survey) {
    const err = new Error('Survey not found');
    err.status = 404;
    throw err;
  }
  return survey;
}

export async function createSurvey(data) {
  const {
    bookingId,
    customerId,
    overallRating,
    yachtRating,
    crewRating,
    valueRating,
    comment,
    isPublic = false,
  } = data;

  if (!bookingId || !customerId) {
    const err = new Error('bookingId and customerId are required');
    err.status = 400;
    throw err;
  }

  const o = ratingInRange(overallRating);
  const y = ratingInRange(yachtRating);
  const c = ratingInRange(crewRating);
  const v = ratingInRange(valueRating);

  if (o === null) {
    const err = new Error('overallRating must be 1-5');
    err.status = 400;
    throw err;
  }

  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!booking) {
    const err = new Error('Booking not found');
    err.status = 400;
    throw err;
  }
  if (booking.customerId !== customerId) {
    const err = new Error('Customer does not match booking');
    err.status = 400;
    throw err;
  }

  const customer = await prisma.customer.findUnique({ where: { id: customerId } });
  if (!customer) {
    const err = new Error('Customer not found');
    err.status = 400;
    throw err;
  }

  const existing = await prisma.customerSurvey.findFirst({
    where: { bookingId, customerId },
  });
  if (existing) {
    const err = new Error('Survey already submitted for this booking');
    err.status = 409;
    throw err;
  }

  const survey = await prisma.customerSurvey.create({
    data: {
      bookingId,
      customerId,
      overallRating: o,
      yachtRating: y ?? o,
      crewRating: c ?? o,
      valueRating: v ?? o,
      comment: comment?.trim() || null,
      isPublic: isPublic === true || isPublic === 'true',
    },
    include: {
      customer: { select: { id: true, firstName: true, lastName: true } },
      booking: { select: { id: true, bookingRef: true } },
    },
  });
  return survey;
}

export async function updateSurvey(id, data) {
  const survey = await prisma.customerSurvey.findUnique({ where: { id } });
  if (!survey) {
    const err = new Error('Survey not found');
    err.status = 404;
    throw err;
  }

  const updateData = {};
  if (data.overallRating !== undefined) {
    const o = ratingInRange(data.overallRating);
    if (o === null) {
      const err = new Error('overallRating must be 1-5');
      err.status = 400;
      throw err;
    }
    updateData.overallRating = o;
  }
  if (data.yachtRating !== undefined) {
    const y = ratingInRange(data.yachtRating);
    updateData.yachtRating = y !== null ? y : survey.yachtRating;
  }
  if (data.crewRating !== undefined) {
    const c = ratingInRange(data.crewRating);
    updateData.crewRating = c !== null ? c : survey.crewRating;
  }
  if (data.valueRating !== undefined) {
    const v = ratingInRange(data.valueRating);
    updateData.valueRating = v !== null ? v : survey.valueRating;
  }
  if (data.comment !== undefined) updateData.comment = data.comment?.trim() || null;
  if (data.isPublic !== undefined) updateData.isPublic = data.isPublic === true || data.isPublic === 'true';

  return prisma.customerSurvey.update({
    where: { id },
    data: updateData,
    include: {
      customer: { select: { id: true, firstName: true, lastName: true } },
      booking: { select: { id: true, bookingRef: true } },
    },
  });
}

export async function deleteSurvey(id) {
  const survey = await prisma.customerSurvey.findUnique({ where: { id } });
  if (!survey) {
    const err = new Error('Survey not found');
    err.status = 404;
    throw err;
  }
  await prisma.customerSurvey.delete({ where: { id } });
}
