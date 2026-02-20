/**
 * Auth configuration for JWT, cookies, and password reset.
 * Use strong secrets in production (e.g. from env).
 */
export default {
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET || 'change-me-access-secret-in-production',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'change-me-refresh-secret-in-production',
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },
  cookies: {
    accessTokenName: 'accessToken',
    refreshTokenName: 'refreshToken',
    accessTokenMaxAgeMs: 15 * 60 * 1000,       // 15 min
    refreshTokenMaxAgeMs: 7 * 24 * 60 * 60 * 1000, // 7 days
  },
  passwordReset: {
    tokenExpiresMinutes: 60,
  },
  resend: {
    apiKey: process.env.RESEND_API_KEY,
    from: process.env.RESEND_FROM || 'YachtOS Admin <onboarding@resend.dev>',
    /** Base URL for the reset link (e.g. frontend app URL). Link will be ${passwordResetLinkBase}/reset-password?token=... */
    passwordResetLinkBase: process.env.FRONTEND_URL || process.env.PASSWORD_RESET_LINK_BASE || 'http://localhost:3000',
  },
};
