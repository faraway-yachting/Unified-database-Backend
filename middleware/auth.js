import authConfig from '../config/auth.js';
import { verifyAccessToken } from '../utils/jwt.js';
import { prisma } from '../config/database.js';

/**
 * Middleware: require valid JWT access token and attach req.user (admin user id, email, role).
 * Accepts token from Authorization: Bearer <token> or from accessToken cookie.
 * Use on protected routes.
 */
export async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  const tokenFromHeader = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  const tokenFromCookie = req.cookies?.[authConfig.cookies.accessTokenName] ?? null;
  const token = tokenFromHeader ?? tokenFromCookie;

  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const decoded = verifyAccessToken(token);
    const user = await prisma.adminUser.findUnique({
      where: { id: decoded.sub },
      select: { id: true, email: true, firstName: true, lastName: true, role: true, isActive: true },
    });

    if (!user || !user.isActive) {
      return res.status(401).json({ error: 'User not found or inactive' });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}
