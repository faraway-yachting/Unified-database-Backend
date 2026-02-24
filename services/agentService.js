import { prisma } from '../config/database.js';

export async function listAgents(options = {}) {
  const { regionId, isActive, page = 1, limit = 50 } = options;
  const skip = (page - 1) * limit;
  const where = {};
  if (regionId) where.regionId = regionId;
  if (isActive !== undefined) where.isActive = isActive === 'true' || isActive === true;

  const [agents, total] = await Promise.all([
    prisma.agent.findMany({
      where,
      include: { region: { select: { id: true, name: true } } },
      orderBy: { name: 'asc' },
      skip,
      take: limit,
    }),
    prisma.agent.count({ where }),
  ]);

  return { agents, total, page, limit, totalPages: Math.ceil(total / limit) };
}

export async function getAgentById(id) {
  const agent = await prisma.agent.findUnique({
    where: { id },
    include: { region: true },
  });
  if (!agent) {
    const err = new Error('Agent not found');
    err.status = 404;
    throw err;
  }
  return agent;
}

export async function createAgent(data) {
  const { name, email, phone, regionId, commissionRate, isActive = true } = data;

  if (!name || !email || !regionId || commissionRate == null) {
    const err = new Error('name, email, regionId, and commissionRate are required');
    err.status = 400;
    throw err;
  }

  const region = await prisma.region.findUnique({ where: { id: regionId } });
  if (!region) {
    const err = new Error('Region not found');
    err.status = 400;
    throw err;
  }

  const rate = parseFloat(commissionRate);
  if (Number.isNaN(rate) || rate < 0 || rate > 1) {
    const err = new Error('commissionRate must be between 0 and 1');
    err.status = 400;
    throw err;
  }

  const agent = await prisma.agent.create({
    data: {
      name: name.trim(),
      email: email.trim().toLowerCase(),
      phone: phone?.trim() || null,
      regionId,
      commissionRate: rate,
      isActive: isActive !== false,
    },
    include: { region: { select: { id: true, name: true } } },
  });
  return agent;
}

export async function updateAgent(id, data) {
  const agent = await prisma.agent.findUnique({ where: { id } });
  if (!agent) {
    const err = new Error('Agent not found');
    err.status = 404;
    throw err;
  }

  const updateData = {};
  if (data.name !== undefined) updateData.name = data.name.trim();
  if (data.email !== undefined) updateData.email = data.email.trim().toLowerCase();
  if (data.phone !== undefined) updateData.phone = data.phone?.trim() || null;
  if (data.regionId !== undefined) {
    const region = await prisma.region.findUnique({ where: { id: data.regionId } });
    if (!region) {
      const err = new Error('Region not found');
      err.status = 400;
      throw err;
    }
    updateData.regionId = data.regionId;
  }
  if (data.commissionRate !== undefined) {
    const rate = parseFloat(data.commissionRate);
    if (Number.isNaN(rate) || rate < 0 || rate > 1) {
      const err = new Error('commissionRate must be between 0 and 1');
      err.status = 400;
      throw err;
    }
    updateData.commissionRate = rate;
  }
  if (data.isActive !== undefined) updateData.isActive = data.isActive !== false;

  return prisma.agent.update({
    where: { id },
    data: updateData,
    include: { region: { select: { id: true, name: true } } },
  });
}

export async function deleteAgent(id) {
  const agent = await prisma.agent.findUnique({ where: { id } });
  if (!agent) {
    const err = new Error('Agent not found');
    err.status = 404;
    throw err;
  }
  await prisma.agent.delete({ where: { id } });
}

export async function getAgentCommissions(agentId, options = {}) {
  const agent = await prisma.agent.findUnique({ where: { id: agentId } });
  if (!agent) {
    const err = new Error('Agent not found');
    err.status = 404;
    throw err;
  }

  const { from, to, page = 1, limit = 50 } = options;
  const where = { agentId };
  if (from || to) {
    where.createdAt = {};
    if (from) where.createdAt.gte = new Date(from);
    if (to) where.createdAt.lte = new Date(to);
  }

  const bookings = await prisma.booking.findMany({
    where,
    include: {
      customer: { select: { id: true, firstName: true, lastName: true } },
      totalAmount: true,
    },
    orderBy: { createdAt: 'desc' },
    skip: (page - 1) * limit,
    take: limit,
  });

  const rate = Number(agent.commissionRate);
  const commissions = bookings.map((b) => ({
    bookingId: b.id,
    bookingRef: b.bookingRef,
    customer: b.customer,
    totalAmount: b.totalAmount,
    commissionRate: rate,
    commissionAmount: Number(b.totalAmount) * rate,
    createdAt: b.createdAt,
  }));

  const total = await prisma.booking.count({ where });

  return {
    agent: { id: agent.id, name: agent.name, commissionRate: agent.commissionRate },
    commissions,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}
