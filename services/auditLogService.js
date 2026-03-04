import { prisma } from '../config/database.js';

/**
 * Create an audit log entry.
 * @param {object} data
 * @param {string} data.adminUserId - ID of the admin user who performed the action
 * @param {string} data.action - created | updated | deleted | login | logout
 * @param {string} data.module - Module/area (e.g. auth, bookings, yachts, settings)
 * @param {string} data.entityType - Entity type (e.g. Booking, Yacht, AdminUser)
 * @param {string} [data.entityId] - ID of the affected entity
 * @param {string} [data.description] - Human-readable description
 * @param {string} [data.ipAddress] - Client IP address
 * @returns {Promise<object>} Created audit log
 */
export async function createAuditLog(data) {
  const { adminUserId, action, module, entityType, entityId, description, ipAddress } = data;
  return prisma.auditLog.create({
    data: {
      adminUserId,
      action,
      module,
      entityType,
      entityId: entityId ?? null,
      description: description ?? null,
      ipAddress: ipAddress ?? null,
    },
  });
}

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
