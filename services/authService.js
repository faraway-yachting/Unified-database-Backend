import crypto from 'node:crypto';
import { prisma } from '../config/database.js';
import { comparePassword, hashPassword } from '../utils/password.js';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../utils/jwt.js';

/** @typedef {{ adminUserId?: string | null }} LogoutResult */
import { sendPasswordResetEmail } from './emailService.js';
import authConfig from '../config/auth.js';

/**
 * Hash a refresh token for storage (we store hash only).
 * @param {string} token
 * @returns {string}
 */
function hashRefreshToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Set access and refresh token cookies on the response.
 * @param {object} res - Express response object
 * @param {string} accessToken
 * @param {string} refreshToken
 */
function setTokenCookies(res, accessToken, refreshToken) {
  const { accessTokenName, refreshTokenName, accessTokenMaxAgeMs, refreshTokenMaxAgeMs } = authConfig.cookies;
  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
  };
  res.cookie(accessTokenName, accessToken, { ...cookieOptions, maxAge: accessTokenMaxAgeMs });
  res.cookie(refreshTokenName, refreshToken, { ...cookieOptions, maxAge: refreshTokenMaxAgeMs });
}

/**
 * Login: validate credentials, update lastLogin, create refresh token record, return tokens and user.
 * When res is provided, sets accessToken and refreshToken as httpOnly cookies and returns only { user, expiresIn }.
 * @param {{ email: string, password: string }} credentials
 * @param {object} [res] - Express response object; when provided, tokens are set as cookies and omitted from return
 * @returns {{ user: object, accessToken?: string, refreshToken?: string, expiresIn: number }}
 */
export async function login({ email, password }, res = null) {
  const user = await prisma.adminUser.findUnique({
    where: { email: email.toLowerCase().trim() },
    select: { id: true, email: true, firstName: true, lastName: true, role: true, isActive: true, passwordHash: true },
  });

  if (!user || !user.isActive) {
    const err = new Error('Invalid email or password');
    err.status = 401;
    throw err;
  }

  const valid = await comparePassword(password, user.passwordHash);
  if (!valid) {
    const err = new Error('Invalid email or password');
    err.status = 401;
    throw err;
  }

  const accessToken = signAccessToken({ id: user.id, email: user.email, role: user.role });
  const refreshToken = signRefreshToken({ id: user.id });
  const tokenHash = hashRefreshToken(refreshToken);

  const refreshExpiresAt = new Date();
  const match = authConfig.jwt.refreshExpiresIn.match(/^(\d+)([smhd])$/);
  if (match) {
    const [, num, unit] = match;
    const n = parseInt(num, 10);
    if (unit === 's') refreshExpiresAt.setSeconds(refreshExpiresAt.getSeconds() + n);
    else if (unit === 'm') refreshExpiresAt.setMinutes(refreshExpiresAt.getMinutes() + n);
    else if (unit === 'h') refreshExpiresAt.setHours(refreshExpiresAt.getHours() + n);
    else if (unit === 'd') refreshExpiresAt.setDate(refreshExpiresAt.getDate() + n);
  } else {
    refreshExpiresAt.setDate(refreshExpiresAt.getDate() + 7);
  }

  await prisma.$transaction([
    prisma.adminUser.update({
      where: { id: user.id },
      data: { lastLogin: new Date() },
    }),
    prisma.refreshToken.create({
      data: {
        adminUserId: user.id,
        tokenHash,
        expiresAt: refreshExpiresAt,
      },
    }),
  ]);

  const expiresInMs = 15 * 60 * 1000; // 15m default, could parse from authConfig
  const payload = {
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
    },
    expiresIn: Math.floor(expiresInMs / 1000),
  };
  if (res) {
    setTokenCookies(res, accessToken, refreshToken);
    return payload;
  }
  return { ...payload, accessToken, refreshToken };
}

/**
 * Logout: invalidate the given refresh token (delete by hash).
 * If the token is valid, returns adminUserId for audit logging.
 * @param {string} refreshToken
 * @returns {Promise<LogoutResult>} { adminUserId } when token was valid, {} otherwise
 */
export async function logout(refreshToken) {
  let adminUserId = null;
  try {
    const decoded = verifyRefreshToken(refreshToken);
    const uid = decoded.sub ?? decoded.id;
    adminUserId = uid != null ? String(uid) : null;
  } catch {
    // Token invalid/expired; we still invalidate if it exists
  }

  const tokenHash = hashRefreshToken(refreshToken);
  await prisma.refreshToken.deleteMany({ where: { tokenHash } });

  return adminUserId ? { adminUserId } : {};
}

/**
 * Refresh: verify refresh token, ensure it exists in DB, issue new access + refresh tokens (rotation).
 * When res is provided, sets new tokens as httpOnly cookies and returns only { user, expiresIn }.
 * @param {string} refreshToken
 * @param {object} [res] - Express response object; when provided, tokens are set as cookies and omitted from return
 * @returns {{ user: object, accessToken?: string, refreshToken?: string, expiresIn: number }}
 */
export async function refresh(refreshToken, res = null) {
  let decoded;
  try {
    decoded = verifyRefreshToken(refreshToken);
  } catch (e) {
    const err = new Error('Invalid or expired refresh token');
    err.status = 401;
    throw err;
  }

  const rawId = decoded.sub ?? decoded.id;
  if (rawId == null || rawId === '') {
    const err = new Error('Invalid or expired refresh token');
    err.status = 401;
    throw err;
  }
  const adminUserId = String(rawId);

  const tokenHash = hashRefreshToken(refreshToken);
  const stored = await prisma.refreshToken.findFirst({
    where: { adminUserId, tokenHash },
    include: { adminUser: true },
  });

  if (!stored || new Date() > stored.expiresAt) {
    if (stored) await prisma.refreshToken.delete({ where: { id: stored.id } }).catch(() => {});
    const err = new Error('Invalid or expired refresh token');
    err.status = 401;
    throw err;
  }

  const user = stored.adminUser;
  if (!user.isActive) {
    await prisma.refreshToken.delete({ where: { id: stored.id } }).catch(() => {});
    const err = new Error('Account is disabled');
    err.status = 401;
    throw err;
  }

  const newAccessToken = signAccessToken({ id: user.id, email: user.email, role: user.role });
  const newRefreshToken = signRefreshToken({ id: user.id });
  const newTokenHash = hashRefreshToken(newRefreshToken);

  const refreshExpiresAt = new Date();
  const match = authConfig.jwt.refreshExpiresIn.match(/^(\d+)([smhd])$/);
  if (match) {
    const [, num, unit] = match;
    const n = parseInt(num, 10);
    if (unit === 's') refreshExpiresAt.setSeconds(refreshExpiresAt.getSeconds() + n);
    else if (unit === 'm') refreshExpiresAt.setMinutes(refreshExpiresAt.getMinutes() + n);
    else if (unit === 'h') refreshExpiresAt.setHours(refreshExpiresAt.getHours() + n);
    else if (unit === 'd') refreshExpiresAt.setDate(refreshExpiresAt.getDate() + n);
  } else {
    refreshExpiresAt.setDate(refreshExpiresAt.getDate() + 7);
  }

  await prisma.$transaction([
    prisma.refreshToken.delete({ where: { id: stored.id } }),
    prisma.refreshToken.create({
      data: {
        adminUserId: user.id,
        tokenHash: newTokenHash,
        expiresAt: refreshExpiresAt,
      },
    }),
  ]);

  const expiresInMs = 15 * 60 * 1000;
  const payload = {
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
    },
    expiresIn: Math.floor(expiresInMs / 1000),
  };
  if (res) {
    setTokenCookies(res, newAccessToken, newRefreshToken);
    return payload;
  }
  return { ...payload, accessToken: newAccessToken, refreshToken: newRefreshToken };
}

/**
 * Forgot password: generate reset token, store hash and expiry on user, return token for email (in dev we can return it).
 * In production you would only send the token via email and not return it in the response.
 * @param {{ email: string }}
 * @returns {{ message: string, resetToken?: string }}
 */
export async function forgotPassword({ email }) {
  const user = await prisma.adminUser.findUnique({
    where: { email: email.toLowerCase().trim() },
  });

  if (!user) {
    return { message: 'If an account exists with this email, you will receive a password reset link.' };
  }

  const resetToken = crypto.randomBytes(32).toString('hex');
  const resetTokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');
  const expires = new Date();
  expires.setMinutes(expires.getMinutes() + authConfig.passwordReset.tokenExpiresMinutes);

  await prisma.adminUser.update({
    where: { id: user.id },
    data: {
      passwordResetToken: resetTokenHash,
      passwordResetExpires: expires,
    },
  });

  // Send password reset email via Resend (no-op if RESEND_API_KEY not set)
  await sendPasswordResetEmail(user.email, resetToken).catch((err) => {
    console.error('Failed to send password reset email:', err);
  });

  const payload = {
    message: 'If an account exists with this email, you will receive a password reset link.',
  };
  if (process.env.NODE_ENV === 'development' && process.env.RETURN_RESET_TOKEN === 'true') {
    payload.resetToken = resetToken;
  }
  return payload;
}

/**
 * Reset password: validate token and set new password.
 * @param {{ token: string, newPassword: string }}
 */
export async function resetPassword({ token, newPassword }) {
  if (!token || !newPassword || newPassword.length < 8) {
    const err = new Error('Valid token and password (min 8 characters) are required');
    err.status = 400;
    throw err;
  }

  const resetTokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const user = await prisma.adminUser.findFirst({
    where: {
      passwordResetToken: resetTokenHash,
      passwordResetExpires: { gt: new Date() },
    },
  });

  if (!user) {
    const err = new Error('Invalid or expired reset token');
    err.status = 400;
    throw err;
  }

  const passwordHash = await hashPassword(newPassword);
  await prisma.adminUser.update({
    where: { id: user.id },
    data: {
      passwordHash,
      passwordResetToken: null,
      passwordResetExpires: null,
    },
  });
}
