import authConfig from '../config/auth.js';
import * as authService from '../services/authService.js';

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
    if (refreshToken) {
      await authService.logout(refreshToken);
    }
    const { accessTokenName, refreshTokenName } = authConfig.cookies;
    res.clearCookie(accessTokenName);
    res.clearCookie(refreshTokenName);
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
