import jwt from 'jsonwebtoken';
import authConfig from '../config/auth.js';

/**
 * Sign an access token (short-lived) for an admin user.
 * @param {{ id: string, email: string, role: string }} payload
 * @returns {string}
 */
export function signAccessToken(payload) {
  return jwt.sign(
    { sub: payload.id, email: payload.email, role: payload.role, type: 'access' },
    authConfig.jwt.accessSecret,
    { expiresIn: authConfig.jwt.accessExpiresIn }
  );
}

/**
 * Sign a refresh token (long-lived). Store only the hash in DB.
 * @param {{ id: string }} payload
 * @returns {string}
 */
export function signRefreshToken(payload) {
  return jwt.sign(
    { sub: payload.id, type: 'refresh' },
    authConfig.jwt.refreshSecret,
    { expiresIn: authConfig.jwt.refreshExpiresIn }
  );
}

/**
 * Verify access token. Returns decoded payload or throws.
 * @param {string} token
 * @returns {{ sub: string, email: string, role: string, type: string }}
 */
export function verifyAccessToken(token) {
  return jwt.verify(token, authConfig.jwt.accessSecret);
}

/**
 * Verify refresh token. Returns decoded payload or throws.
 * @param {string} token
 * @returns {{ sub: string, type: string }}
 */
export function verifyRefreshToken(token) {
  return jwt.verify(token, authConfig.jwt.refreshSecret);
}
