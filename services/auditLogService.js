import { prisma } from '../config/database.js';

export async function listAuditLogs(options = {}) {
  const { user, action, module, from, to, page = 1, limit = 50 } = options;
  const skip = (page - 1) * limit;
  const where = {};

  if (user) where.adminUserId = user;
  if (action) where.action = action;
  if (module) where.module = module;
  if (from || to) {
    where.createdAt = {};
    if (from) where.createdAt.gte = new Date(from);
    if (to) where.createdAt.lte = new Date(to);
  }

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      include: {
        adminUser: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.auditLog.count({ where }),
  ]);

  return { auditLogs: logs, total, page, limit, totalPages: Math.ceil(total / limit) };
}

export async function getAuditLogById(id) {
  const log = await prisma.auditLog.findUnique({
    where: { id },
    include: {
      adminUser: { select: { id: true, firstName: true, lastName: true, email: true } },
    },
  });
  if (!log) {
    const err = new Error('Audit log not found');
    err.status = 404;
    throw err;
  }
  return log;
}
