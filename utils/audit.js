import * as auditLogService from '../services/auditLogService.js';

/**
 * Get client IP from request (handles proxies via X-Forwarded-For).
 * @param {import('express').Request} req
 * @returns {string|null}
 */
export function getClientIp(req) {
  if (!req) return null;
  const forwarded = req.headers?.['x-forwarded-for'];
  if (forwarded) {
    const first = typeof forwarded === 'string' ? forwarded.split(',')[0] : forwarded[0];
    return first?.trim() ?? null;
  }
  return req.ip ?? req.socket?.remoteAddress ?? null;
}

/**
 * Log an audit entry from an authenticated request.
 * Use after successful operations. Fails silently to avoid breaking the main flow.
 *
 * @param {import('express').Request} req - Must have req.user (from requireAuth)
 * @param {object} options
 * @param {string} options.action - created | updated | deleted | login | logout
 * @param {string} options.module - Module name (e.g. auth, bookings, yachts, settings)
 * @param {string} options.entityType - Entity type (e.g. Booking, Yacht, AdminUser)
 * @param {string} [options.entityId] - ID of the affected entity
 * @param {string} [options.description] - Human-readable description
 */
export async function logAudit(req, options) {
  const adminUserId = req?.user?.id;
  if (!adminUserId) return;

  const { action, module, entityType, entityId, description } = options;
  const ipAddress = getClientIp(req);

  try {
    await auditLogService.createAuditLog({
      adminUserId,
      action,
      module,
      entityType,
      entityId,
      description,
      ipAddress,
    });
  } catch (err) {
    console.error('Audit log failed:', err);
  }
}

/**
 * Log an audit entry when admin user ID is known (e.g. after login, when req.user is not set).
 * Use for auth events. Fails silently.
 *
 * @param {object} options
 * @param {string} options.adminUserId - ID of the admin user
 * @param {string} options.action - created | updated | deleted | login | logout
 * @param {string} options.module - Module name (e.g. auth)
 * @param {string} options.entityType - Entity type (e.g. AdminUser)
 * @param {string} [options.entityId]
 * @param {string} [options.description]
 * @param {string} [options.ipAddress]
 */
export async function logAuditDirect(options) {
  const { adminUserId, action, module, entityType, entityId, description, ipAddress } = options;
  if (!adminUserId) return;

  try {
    await auditLogService.createAuditLog({
      adminUserId,
      action,
      module,
      entityType,
      entityId,
      description,
      ipAddress,
    });
  } catch (err) {
    console.error('Audit log failed:', err);
  }
}
