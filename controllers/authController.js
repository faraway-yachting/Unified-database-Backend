import authConfig from '../config/auth.js';
import * as authService from '../services/authService.js';
import { prisma } from '../config/database.js';
import { logAuditDirect, getClientIp } from '../utils/audit.js';

/**
 * GET /api/auth/me
 * Returns the current authenticated admin user (requires valid access token).
 * Response: { id, email, firstName, lastName, role, isActive, lastLogin, regionAccess }.
 */
export async function me(req, res, next) {
  try {
    const user = await prisma.adminUser.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        lastLogin: true,
        createdAt: true,
        regionAccess: {
          select: {
            permissionLevel: true,
            regionId: true,
            region: { select: { id: true, name: true, slug: true } },
          },
        },
      },
    });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.status(200).json(user);
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/auth/login
 * Body: { email, password }
 * Sets accessToken and refreshToken as httpOnly cookies; response body is { user, expiresIn }.
 */
export async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    const result = await authService.login({ email, password }, res);
    logAuditDirect({
      adminUserId: result.user.id,
      action: 'login',
      module: 'auth',
      entityType: 'AdminUser',
      entityId: result.user.id,
      description: `Logged in: ${result.user.email}`,
      ipAddress: getClientIp(req),
    }).catch(() => {});
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/auth/logout
 * Reads refreshToken from cookie (or body); invalidates it and clears token cookies.
 */
export async function logout(req, res, next) {
  try {
    const refreshToken = req.cookies?.refreshToken ?? req.body?.refreshToken;
    let logoutResult = {};
    if (refreshToken) {
      logoutResult = await authService.logout(refreshToken);
    }
    if (logoutResult.adminUserId) {
      logAuditDirect({
        adminUserId: logoutResult.adminUserId,
        action: 'logout',
        module: 'auth',
        entityType: 'AdminUser',
        entityId: logoutResult.adminUserId,
        description: 'Logged out',
        ipAddress: getClientIp(req),
      }).catch(() => {});
    }
    const { accessTokenName, refreshTokenName } = authConfig.cookies;
    res.clearCookie(accessTokenName, { path: '/' });
    res.clearCookie(refreshTokenName, { path: '/' });
    res.status(200).json({ message: 'Logged out successfully' });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/auth/refresh
 * Reads refreshToken from cookie (or body); issues new tokens and sets them as httpOnly cookies.
 * Response body is { user, expiresIn }.
 */
export async function refresh(req, res, next) {
  try {
    const refreshToken = req.cookies?.refreshToken ?? req.body?.refreshToken;
    if (!refreshToken) {
      return res.status(400).json({ error: 'Refresh token is required' });
    }
    const result = await authService.refresh(refreshToken, res);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/auth/forgot-password
 * Body: { email }
 */
export async function forgotPassword(req, res, next) {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }
    const result = await authService.forgotPassword({ email });
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/auth/reset-password
 * Body: { token, newPassword }
 */
export async function resetPassword(req, res, next) {
  try {
    const { token, newPassword } = req.body;
    await authService.resetPassword({ token, newPassword });
    res.status(200).json({ message: 'Password has been reset successfully' });
  } catch (err) {
    next(err);
  }
}
