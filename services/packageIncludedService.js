import { prisma } from '../config/database.js';

const VALID_SERVICE_NAMES = ['skipper', 'fuel', 'catering', 'transfer', 'crew', 'gear'];

/**
 * List included services for a package.
 * @param {string} packageId - Package UUID
 * @returns {Promise<{ packageId: string, services: Array }>}
 */
export async function getIncludedServices(packageId) {
  const pkg = await prisma.package.findUnique({
    where: { id: packageId },
  });

  if (!pkg) {
    const err = new Error('Package not found');
    err.status = 404;
    throw err;
  }

  const services = await prisma.packageIncludedService.findMany({
    where: { packageId },
    orderBy: { serviceName: 'asc' },
  });

  return {
    packageId: pkg.id,
    packageName: pkg.name,
    services,
  };
}

/**
 * Add an included service to a package.
 * @param {string} packageId - Package UUID
 * @param {object} data - { serviceName, isIncluded?, notes? }
 * @returns {Promise<object>}
 */
export async function addIncludedService(packageId, data) {
  const { serviceName, isIncluded = true, notes } = data;

  if (!serviceName || !serviceName.trim()) {
    const err = new Error('serviceName is required');
    err.status = 400;
    throw err;
  }

  const normalized = serviceName.trim().toLowerCase();
  if (!VALID_SERVICE_NAMES.includes(normalized)) {
    const err = new Error(`serviceName must be one of: ${VALID_SERVICE_NAMES.join(', ')}`);
    err.status = 400;
    throw err;
  }

  const pkg = await prisma.package.findUnique({
    where: { id: packageId },
  });

  if (!pkg) {
    const err = new Error('Package not found');
    err.status = 404;
    throw err;
  }

  const existing = await prisma.packageIncludedService.findFirst({
    where: {
      packageId,
      serviceName: normalized,
    },
  });

  if (existing) {
    const err = new Error(`Service "${normalized}" is already included for this package`);
    err.status = 409;
    throw err;
  }

  const service = await prisma.packageIncludedService.create({
    data: {
      packageId,
      serviceName: normalized,
      isIncluded: isIncluded !== false,
      notes: notes?.trim() || null,
    },
  });

  return service;
}

/**
 * Update an included service.
 * @param {string} packageId - Package UUID
 * @param {string} serviceId - PackageIncludedService UUID
 * @param {object} data - { serviceName?, isIncluded?, notes? }
 * @returns {Promise<object>}
 */
export async function updateIncludedService(packageId, serviceId, data) {
  const { serviceName, isIncluded, notes } = data;

  const pkg = await prisma.package.findUnique({
    where: { id: packageId },
  });

  if (!pkg) {
    const err = new Error('Package not found');
    err.status = 404;
    throw err;
  }

  const service = await prisma.packageIncludedService.findFirst({
    where: {
      id: serviceId,
      packageId,
    },
  });

  if (!service) {
    const err = new Error('Included service not found');
    err.status = 404;
    throw err;
  }

  const updateData = {};
  if (serviceName !== undefined) {
    const normalized = serviceName.trim().toLowerCase();
    if (!normalized) {
      const err = new Error('serviceName cannot be empty');
      err.status = 400;
      throw err;
    }
    if (!VALID_SERVICE_NAMES.includes(normalized)) {
      const err = new Error(`serviceName must be one of: ${VALID_SERVICE_NAMES.join(', ')}`);
      err.status = 400;
      throw err;
    }
    // Check duplicate when changing name
    if (normalized !== service.serviceName) {
      const existing = await prisma.packageIncludedService.findFirst({
        where: {
          packageId,
          serviceName: normalized,
        },
      });
      if (existing) {
        const err = new Error(`Service "${normalized}" is already included for this package`);
        err.status = 409;
        throw err;
      }
    }
    updateData.serviceName = normalized;
  }
  if (isIncluded !== undefined) updateData.isIncluded = isIncluded !== false;
  if (notes !== undefined) updateData.notes = notes?.trim() || null;

  const updated = await prisma.packageIncludedService.update({
    where: { id: serviceId },
    data: updateData,
  });

  return updated;
}

/**
 * Remove an included service from a package.
 * @param {string} packageId - Package UUID
 * @param {string} serviceId - PackageIncludedService UUID
 * @returns {Promise<void>}
 */
export async function removeIncludedService(packageId, serviceId) {
  const pkg = await prisma.package.findUnique({
    where: { id: packageId },
  });

  if (!pkg) {
    const err = new Error('Package not found');
    err.status = 404;
    throw err;
  }

  const service = await prisma.packageIncludedService.findFirst({
    where: {
      id: serviceId,
      packageId,
    },
  });

  if (!service) {
    const err = new Error('Included service not found');
    err.status = 404;
    throw err;
  }

  await prisma.packageIncludedService.delete({
    where: { id: serviceId },
  });
}
