import { prisma } from '../config/database.js';
import * as bookingService from './bookingService.js';

const VALID_LEAD_STATUSES = ['new', 'contacted', 'quoted', 'converted', 'lost'];

export async function listLeads(options = {}) {
  const { status, regionId, assigned, page = 1, limit = 50 } = options;
  const skip = (page - 1) * limit;
  const where = {};

  if (status) {
    if (!VALID_LEAD_STATUSES.includes(status)) {
      const err = new Error(`status must be one of: ${VALID_LEAD_STATUSES.join(', ')}`);
      err.status = 400;
      throw err;
    }
    where.status = status;
  }
  if (regionId) where.regionId = regionId;
  if (assigned !== undefined) {
    if (assigned === 'true' || assigned === true) where.assignedTo = { not: null };
    else if (assigned === 'false' || assigned === false) where.assignedTo = null;
  }

  const [leads, total] = await Promise.all([
    prisma.lead.findMany({
      where,
      include: {
        customer: { select: { id: true, firstName: true, lastName: true, email: true } },
        region: { select: { id: true, name: true } },
        package: { select: { id: true, name: true } },
        yacht: { select: { id: true, name: true } },
        assignedToUser: { select: { id: true, firstName: true, lastName: true, email: true } },
        convertedBooking: { select: { id: true, bookingRef: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.lead.count({ where }),
  ]);

  return { leads, total, page, limit, totalPages: Math.ceil(total / limit) };
}

export async function getLeadById(id) {
  const lead = await prisma.lead.findUnique({
    where: { id },
    include: {
      customer: true,
      region: true,
      package: true,
      yacht: true,
      assignedToUser: { select: { id: true, firstName: true, lastName: true, email: true } },
      convertedBooking: true,
    },
  });
  if (!lead) {
    const err = new Error('Lead not found');
    err.status = 404;
    throw err;
  }
  return lead;
}

export async function createLead(data) {
  const { customerId, regionId, packageId, yachtId, status = 'new', source, notes, assignedTo } = data;

  if (!regionId) {
    const err = new Error('regionId is required');
    err.status = 400;
    throw err;
  }

  const region = await prisma.region.findUnique({ where: { id: regionId } });
  if (!region) {
    const err = new Error('Region not found');
    err.status = 400;
    throw err;
  }

  if (status && !VALID_LEAD_STATUSES.includes(status)) {
    const err = new Error(`status must be one of: ${VALID_LEAD_STATUSES.join(', ')}`);
    err.status = 400;
    throw err;
  }

  if (customerId) {
    const customer = await prisma.customer.findUnique({ where: { id: customerId } });
    if (!customer) {
      const err = new Error('Customer not found');
      err.status = 400;
      throw err;
    }
  }
  if (assignedTo) {
    const user = await prisma.adminUser.findUnique({ where: { id: assignedTo } });
    if (!user) {
      const err = new Error('Assigned user not found');
      err.status = 400;
      throw err;
    }
  }

  const lead = await prisma.lead.create({
    data: {
      customerId: customerId || null,
      regionId,
      packageId: packageId || null,
      yachtId: yachtId || null,
      status: status || 'new',
      source: source?.trim() || null,
      notes: notes?.trim() || null,
      assignedTo: assignedTo || null,
    },
    include: {
      customer: { select: { id: true, firstName: true, lastName: true, email: true } },
      region: { select: { id: true, name: true } },
      assignedToUser: { select: { id: true, firstName: true, lastName: true } },
    },
  });
  return lead;
}

export async function updateLead(id, data) {
  const lead = await prisma.lead.findUnique({ where: { id } });
  if (!lead) {
    const err = new Error('Lead not found');
    err.status = 404;
    throw err;
  }

  const updateData = {};
  const allowed = ['customerId', 'regionId', 'packageId', 'yachtId', 'status', 'source', 'notes', 'assignedTo'];
  for (const f of allowed) {
    if (data[f] === undefined) continue;
    if (f === 'status' && !VALID_LEAD_STATUSES.includes(data[f])) {
      const err = new Error(`status must be one of: ${VALID_LEAD_STATUSES.join(', ')}`);
      err.status = 400;
      throw err;
    }
    updateData[f] = data[f] ?? null;
  }

  return prisma.lead.update({
    where: { id },
    data: updateData,
    include: {
      customer: { select: { id: true, firstName: true, lastName: true, email: true } },
      region: { select: { id: true, name: true } },
      package: { select: { id: true, name: true } },
      yacht: { select: { id: true, name: true } },
      assignedToUser: { select: { id: true, firstName: true, lastName: true } },
      convertedBooking: { select: { id: true, bookingRef: true } },
    },
  });
}

export async function deleteLead(id) {
  const lead = await prisma.lead.findUnique({ where: { id } });
  if (!lead) {
    const err = new Error('Lead not found');
    err.status = 404;
    throw err;
  }
  await prisma.lead.delete({ where: { id } });
}

export async function updateLeadStatus(id, data) {
  const { status } = data;
  if (!status || !VALID_LEAD_STATUSES.includes(status)) {
    const err = new Error(`status must be one of: ${VALID_LEAD_STATUSES.join(', ')}`);
    err.status = 400;
    throw err;
  }
  return updateLead(id, { status });
}

export async function convertLeadToBooking(id, data) {
  const lead = await prisma.lead.findUnique({
    where: { id },
    include: { customer: true, region: { select: { id: true, name: true, currencyCode: true } }, package: true, yacht: true },
  });

  if (!lead) {
    const err = new Error('Lead not found');
    err.status = 404;
    throw err;
  }

  if (lead.status === 'converted' && lead.convertedBookingId) {
    const err = new Error('Lead already converted to a booking');
    err.status = 400;
    throw err;
  }

  if (!lead.customerId) {
    const err = new Error('Lead has no customer; attach a customer before converting');
    err.status = 400;
    throw err;
  }

  const bookingData = data || {};
  const regionId = bookingData.regionId || lead.regionId;
  const currencyCode = bookingData.currencyCode || lead.region?.currencyCode || 'USD';
  const booking = await bookingService.createBooking({
    customerId: lead.customerId,
    yachtId: bookingData.yachtId || lead.yachtId,
    packageId: bookingData.packageId || lead.packageId,
    regionId,
    startDate: bookingData.startDate,
    endDate: bookingData.endDate,
    guestCount: bookingData.guestCount ?? 1,
    baseAmount: bookingData.baseAmount ?? 0,
    totalAmount: bookingData.totalAmount ?? 0,
    currencyCode,
    status: 'inquiry',
    ...bookingData,
  });

  await prisma.lead.update({
    where: { id },
    data: { status: 'converted', convertedBookingId: booking.id },
  });

  const updatedLead = await getLeadById(id);
  return { lead: updatedLead, booking };
}
