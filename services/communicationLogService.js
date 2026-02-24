import { prisma } from '../config/database.js';

const VALID_CHANNELS = ['email', 'phone', 'whatsapp', 'in_person'];
const VALID_DIRECTIONS = ['inbound', 'outbound'];

export async function listCommunications(options = {}) {
  const { customerId, channel, direction, page = 1, limit = 50 } = options;
  const skip = (page - 1) * limit;
  const where = {};

  if (customerId) where.customerId = customerId;
  if (channel) {
    if (!VALID_CHANNELS.includes(channel)) {
      const err = new Error(`channel must be one of: ${VALID_CHANNELS.join(', ')}`);
      err.status = 400;
      throw err;
    }
    where.channel = channel;
  }
  if (direction) {
    if (!VALID_DIRECTIONS.includes(direction)) {
      const err = new Error('direction must be inbound or outbound');
      err.status = 400;
      throw err;
    }
    where.direction = direction;
  }

  const [communications, total] = await Promise.all([
    prisma.communicationLog.findMany({
      where,
      include: {
        customer: { select: { id: true, firstName: true, lastName: true, email: true } },
        adminUser: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
      orderBy: { loggedAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.communicationLog.count({ where }),
  ]);

  return { communications, total, page, limit, totalPages: Math.ceil(total / limit) };
}

export async function getCommunicationById(id) {
  const log = await prisma.communicationLog.findUnique({
    where: { id },
    include: {
      customer: true,
      adminUser: { select: { id: true, firstName: true, lastName: true, email: true } },
    },
  });
  if (!log) {
    const err = new Error('Communication log not found');
    err.status = 404;
    throw err;
  }
  return log;
}

export async function createCommunication(data) {
  const { customerId, channel, direction, subject, body, adminUserId } = data;

  if (!customerId || !channel || !direction) {
    const err = new Error('customerId, channel, and direction are required');
    err.status = 400;
    throw err;
  }

  if (!VALID_CHANNELS.includes(channel)) {
    const err = new Error(`channel must be one of: ${VALID_CHANNELS.join(', ')}`);
    err.status = 400;
    throw err;
  }
  if (!VALID_DIRECTIONS.includes(direction)) {
    const err = new Error('direction must be inbound or outbound');
    err.status = 400;
    throw err;
  }

  const customer = await prisma.customer.findUnique({ where: { id: customerId } });
  if (!customer) {
    const err = new Error('Customer not found');
    err.status = 400;
    throw err;
  }

  const log = await prisma.communicationLog.create({
    data: {
      customerId,
      channel,
      direction,
      subject: subject?.trim() || null,
      body: body?.trim() || null,
      adminUserId: adminUserId || null,
    },
    include: {
      customer: { select: { id: true, firstName: true, lastName: true, email: true } },
      adminUser: { select: { id: true, firstName: true, lastName: true } },
    },
  });
  return log;
}

export async function updateCommunication(id, data) {
  const log = await prisma.communicationLog.findUnique({ where: { id } });
  if (!log) {
    const err = new Error('Communication log not found');
    err.status = 404;
    throw err;
  }

  const updateData = {};
  if (data.channel !== undefined) {
    if (!VALID_CHANNELS.includes(data.channel)) {
      const err = new Error(`channel must be one of: ${VALID_CHANNELS.join(', ')}`);
      err.status = 400;
      throw err;
    }
    updateData.channel = data.channel;
  }
  if (data.direction !== undefined) {
    if (!VALID_DIRECTIONS.includes(data.direction)) {
      const err = new Error('direction must be inbound or outbound');
      err.status = 400;
      throw err;
    }
    updateData.direction = data.direction;
  }
  if (data.subject !== undefined) updateData.subject = data.subject?.trim() || null;
  if (data.body !== undefined) updateData.body = data.body?.trim() || null;
  if (data.adminUserId !== undefined) updateData.adminUserId = data.adminUserId || null;

  return prisma.communicationLog.update({
    where: { id },
    data: updateData,
    include: {
      customer: { select: { id: true, firstName: true, lastName: true, email: true } },
      adminUser: { select: { id: true, firstName: true, lastName: true } },
    },
  });
}

export async function deleteCommunication(id) {
  const log = await prisma.communicationLog.findUnique({ where: { id } });
  if (!log) {
    const err = new Error('Communication log not found');
    err.status = 404;
    throw err;
  }
  await prisma.communicationLog.delete({ where: { id } });
}
