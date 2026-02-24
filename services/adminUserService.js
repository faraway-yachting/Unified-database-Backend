import { prisma } from '../config/database.js';
import { hashPassword } from '../utils/password.js';

const VALID_ROLES = ['super_admin', 'manager', 'agent', 'viewer'];
const VALID_PERMISSION_LEVELS = ['view', 'edit', 'full'];

export async function listAdminUsers(options = {}) {
  const { role, isActive, page = 1, limit = 50 } = options;
  const skip = (page - 1) * limit;
  const where = {};
  if (role) {
    if (!VALID_ROLES.includes(role)) {
      const err = new Error(`role must be one of: ${VALID_ROLES.join(', ')}`);
      err.status = 400;
      throw err;
    }
    where.role = role;
  }
  if (isActive !== undefined) where.isActive = isActive === 'true' || isActive === true;

  const [users, total] = await Promise.all([
    prisma.adminUser.findMany({
      where,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true,
        isActive: true,
        lastLogin: true,
        createdAt: true,
        regionAccess: { include: { region: { select: { id: true, name: true } } } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.adminUser.count({ where }),
  ]);

  return { users, total, page, limit, totalPages: Math.ceil(total / limit) };
}

export async function getAdminUserById(id) {
  const user = await prisma.adminUser.findUnique({
    where: { id },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      role: true,
      isActive: true,
      lastLogin: true,
      createdAt: true,
      regionAccess: { include: { region: { select: { id: true, name: true, slug: true } } } },
    },
  });
  if (!user) {
    const err = new Error('User not found');
    err.status = 404;
    throw err;
  }
  return user;
}

export async function createAdminUser(data) {
  const { firstName, lastName, email, password, role = 'agent' } = data;

  if (!firstName || !lastName || !email) {
    const err = new Error('firstName, lastName, and email are required');
    err.status = 400;
    throw err;
  }

  if (!password || password.length < 8) {
    const err = new Error('password is required and must be at least 8 characters');
    err.status = 400;
    throw err;
  }

  if (!VALID_ROLES.includes(role)) {
    const err = new Error(`role must be one of: ${VALID_ROLES.join(', ')}`);
    err.status = 400;
    throw err;
  }

  const existing = await prisma.adminUser.findUnique({
    where: { email: email.trim().toLowerCase() },
  });
  if (existing) {
    const err = new Error('User with this email already exists');
    err.status = 409;
    throw err;
  }

  const passwordHash = await hashPassword(password);

  const user = await prisma.adminUser.create({
    data: {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.trim().toLowerCase(),
      passwordHash,
      role: role || 'agent',
      isActive: true,
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      role: true,
      isActive: true,
      createdAt: true,
    },
  });
  return user;
}

export async function updateAdminUser(id, data) {
  const user = await prisma.adminUser.findUnique({ where: { id } });
  if (!user) {
    const err = new Error('User not found');
    err.status = 404;
    throw err;
  }

  const updateData = {};
  if (data.firstName !== undefined) updateData.firstName = data.firstName.trim();
  if (data.lastName !== undefined) updateData.lastName = data.lastName.trim();
  if (data.email !== undefined) {
    const email = data.email.trim().toLowerCase();
    const existing = await prisma.adminUser.findFirst({
      where: { email, id: { not: id } },
    });
    if (existing) {
      const err = new Error('Email already in use');
      err.status = 409;
      throw err;
    }
    updateData.email = email;
  }
  if (data.role !== undefined) {
    if (!VALID_ROLES.includes(data.role)) {
      const err = new Error(`role must be one of: ${VALID_ROLES.join(', ')}`);
      err.status = 400;
      throw err;
    }
    updateData.role = data.role;
  }

  return prisma.adminUser.update({
    where: { id },
    data: updateData,
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      role: true,
      isActive: true,
      lastLogin: true,
      createdAt: true,
      regionAccess: { include: { region: { select: { id: true, name: true } } } },
    },
  });
}

export async function deactivateAdminUser(id) {
  const user = await prisma.adminUser.findUnique({ where: { id } });
  if (!user) {
    const err = new Error('User not found');
    err.status = 404;
    throw err;
  }
  return prisma.adminUser.update({
    where: { id },
    data: { isActive: false },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      role: true,
      isActive: true,
      createdAt: true,
    },
  });
}

export async function updateAdminUserRole(id, data) {
  const { role } = data;
  if (!role || !VALID_ROLES.includes(role)) {
    const err = new Error(`role must be one of: ${VALID_ROLES.join(', ')}`);
    err.status = 400;
    throw err;
  }
  return updateAdminUser(id, { role });
}

export async function updateAdminUserRegions(id, data) {
  const { regions } = data;

  const user = await prisma.adminUser.findUnique({ where: { id } });
  if (!user) {
    const err = new Error('User not found');
    err.status = 404;
    throw err;
  }

  if (!Array.isArray(regions)) {
    const err = new Error('regions must be an array of { regionId, permissionLevel? }');
    err.status = 400;
    throw err;
  }

  for (const r of regions) {
    if (!r.regionId) {
      const err = new Error('Each region must have regionId');
      err.status = 400;
      throw err;
    }
    const level = r.permissionLevel || 'view';
    if (!VALID_PERMISSION_LEVELS.includes(level)) {
      const err = new Error(`permissionLevel must be one of: ${VALID_PERMISSION_LEVELS.join(', ')}`);
      err.status = 400;
      throw err;
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.adminUserRegionAccess.deleteMany({ where: { adminUserId: id } });
    if (regions.length > 0) {
      await tx.adminUserRegionAccess.createMany({
        data: regions.map((r) => ({
          adminUserId: id,
          regionId: r.regionId,
          permissionLevel: r.permissionLevel || 'view',
        })),
      });
    }
  });

  return getAdminUserById(id);
}
