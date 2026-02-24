import { prisma } from '../config/database.js';

const VALID_SEGMENTS = ['new', 'regular', 'vip', 'churned'];
const VALID_LOYALTY_TIERS = ['bronze', 'silver', 'gold', 'platinum'];

export async function listCustomers(options = {}) {
  const { segment, regionId, tag, page = 1, limit = 50 } = options;
  const skip = (page - 1) * limit;
  const where = {};

  if (segment) {
    if (!VALID_SEGMENTS.includes(segment)) {
      const err = new Error(`segment must be one of: ${VALID_SEGMENTS.join(', ')}`);
      err.status = 400;
      throw err;
    }
    where.segment = segment;
  }
  if (regionId) where.regionId = regionId;
  if (tag) {
    where.tags = { some: { tag: tag.trim() } };
  }

  const [customers, total] = await Promise.all([
    prisma.customer.findMany({
      where,
      include: {
        region: { select: { id: true, name: true, slug: true } },
        tags: { select: { id: true, tag: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.customer.count({ where }),
  ]);

  return { customers, total, page, limit, totalPages: Math.ceil(total / limit) };
}

export async function getCustomerById(id) {
  const customer = await prisma.customer.findUnique({
    where: { id },
    include: {
      region: true,
      tags: true,
    },
  });
  if (!customer) {
    const err = new Error('Customer not found');
    err.status = 404;
    throw err;
  }
  return customer;
}

export async function createCustomer(data) {
  const {
    firstName,
    lastName,
    email,
    phone,
    whatsapp,
    country,
    regionId,
    segment = 'new',
    loyaltyTier = 'bronze',
    loyaltyPoints = 0,
    source,
    notes,
    isActive = true,
  } = data;

  if (!firstName || !lastName || !email) {
    const err = new Error('firstName, lastName, and email are required');
    err.status = 400;
    throw err;
  }

  if (segment && !VALID_SEGMENTS.includes(segment)) {
    const err = new Error(`segment must be one of: ${VALID_SEGMENTS.join(', ')}`);
    err.status = 400;
    throw err;
  }
  if (loyaltyTier && !VALID_LOYALTY_TIERS.includes(loyaltyTier)) {
    const err = new Error(`loyaltyTier must be one of: ${VALID_LOYALTY_TIERS.join(', ')}`);
    err.status = 400;
    throw err;
  }

  const existing = await prisma.customer.findUnique({
    where: { email: email.trim().toLowerCase() },
  });
  if (existing) {
    const err = new Error('Customer with this email already exists');
    err.status = 409;
    throw err;
  }

  if (regionId) {
    const region = await prisma.region.findUnique({ where: { id: regionId } });
    if (!region) {
      const err = new Error('Region not found');
      err.status = 400;
      throw err;
    }
  }

  const customer = await prisma.customer.create({
    data: {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.trim().toLowerCase(),
      phone: phone?.trim() || null,
      whatsapp: whatsapp?.trim() || null,
      country: country?.trim() || null,
      regionId: regionId || null,
      segment: segment || 'new',
      loyaltyTier: loyaltyTier || 'bronze',
      loyaltyPoints: loyaltyPoints != null ? parseInt(loyaltyPoints, 10) : 0,
      source: source?.trim() || null,
      notes: notes?.trim() || null,
      isActive: isActive !== false,
    },
    include: {
      region: { select: { id: true, name: true } },
      tags: true,
    },
  });
  return customer;
}

export async function updateCustomer(id, data) {
  const customer = await prisma.customer.findUnique({ where: { id } });
  if (!customer) {
    const err = new Error('Customer not found');
    err.status = 404;
    throw err;
  }

  const updateData = {};
  const allowed = ['firstName', 'lastName', 'email', 'phone', 'whatsapp', 'country', 'regionId', 'segment', 'loyaltyTier', 'loyaltyPoints', 'source', 'notes', 'isActive'];
  for (const f of allowed) {
    if (data[f] === undefined) continue;
    if (f === 'segment' && !VALID_SEGMENTS.includes(data[f])) {
      const err = new Error(`segment must be one of: ${VALID_SEGMENTS.join(', ')}`);
      err.status = 400;
      throw err;
    }
    if (f === 'loyaltyTier' && !VALID_LOYALTY_TIERS.includes(data[f])) {
      const err = new Error(`loyaltyTier must be one of: ${VALID_LOYALTY_TIERS.join(', ')}`);
      err.status = 400;
      throw err;
    }
    if (f === 'email') updateData[f] = data[f].trim().toLowerCase();
    else if (f === 'firstName' || f === 'lastName' || f === 'phone' || f === 'whatsapp' || f === 'country' || f === 'source') updateData[f] = data[f]?.trim() || null;
    else if (f === 'regionId') updateData[f] = data[f] || null;
    else if (f === 'loyaltyPoints') updateData[f] = parseInt(data[f], 10);
    else if (f === 'notes') updateData[f] = data[f]?.trim() || null;
    else if (f === 'isActive') updateData[f] = data[f] !== false;
    else updateData[f] = data[f];
  }

  return prisma.customer.update({
    where: { id },
    data: updateData,
    include: { region: { select: { id: true, name: true } }, tags: true },
  });
}

export async function softDeleteCustomer(id) {
  const customer = await prisma.customer.findUnique({ where: { id } });
  if (!customer) {
    const err = new Error('Customer not found');
    err.status = 404;
    throw err;
  }
  return prisma.customer.update({
    where: { id },
    data: { isActive: false },
    include: { region: { select: { id: true, name: true } }, tags: true },
  });
}

export async function getCustomerBookings(customerId, options = {}) {
  const customer = await prisma.customer.findUnique({ where: { id: customerId } });
  if (!customer) {
    const err = new Error('Customer not found');
    err.status = 404;
    throw err;
  }
  const { page = 1, limit = 50 } = options;
  const skip = (page - 1) * limit;

  const [bookings, total] = await Promise.all([
    prisma.booking.findMany({
      where: { customerId },
      include: {
        yacht: { select: { id: true, name: true } },
        package: { select: { id: true, name: true } },
        region: { select: { id: true, name: true } },
        currency: { select: { code: true, symbol: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.booking.count({ where: { customerId } }),
  ]);

  return { customerId, bookings, total, page, limit, totalPages: Math.ceil(total / limit) };
}

export async function getCustomerCommunications(customerId, options = {}) {
  const customer = await prisma.customer.findUnique({ where: { id: customerId } });
  if (!customer) {
    const err = new Error('Customer not found');
    err.status = 404;
    throw err;
  }
  const { page = 1, limit = 50 } = options;
  const skip = (page - 1) * limit;

  const [communications, total] = await Promise.all([
    prisma.communicationLog.findMany({
      where: { customerId },
      include: { adminUser: { select: { id: true, firstName: true, lastName: true, email: true } } },
      orderBy: { loggedAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.communicationLog.count({ where: { customerId } }),
  ]);

  return { customerId, communications, total, page, limit, totalPages: Math.ceil(total / limit) };
}

export async function getCustomerSurveys(customerId, options = {}) {
  const customer = await prisma.customer.findUnique({ where: { id: customerId } });
  if (!customer) {
    const err = new Error('Customer not found');
    err.status = 404;
    throw err;
  }
  const { page = 1, limit = 50 } = options;
  const skip = (page - 1) * limit;

  const [surveys, total] = await Promise.all([
    prisma.customerSurvey.findMany({
      where: { customerId },
      include: { booking: { select: { id: true, bookingRef: true } } },
      orderBy: { submittedAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.customerSurvey.count({ where: { customerId } }),
  ]);

  return { customerId, surveys, total, page, limit, totalPages: Math.ceil(total / limit) };
}
