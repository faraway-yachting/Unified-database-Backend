import { prisma } from '../config/database.js';

/**
 * Get all packages assigned to a region.
 * @param {string} regionId - Region UUID
 * @param {object} options - { isVisible, page, limit }
 * @returns {Promise<{ packages: Array, total: number, page: number, limit: number }>}
 */
export async function getRegionPackages(regionId, options = {}) {
  const {
    isVisible,
    page = 1,
    limit = 50,
  } = options;

  // Verify region exists
  const region = await prisma.region.findUnique({
    where: { id: regionId },
  });

  if (!region) {
    const err = new Error('Region not found');
    err.status = 404;
    throw err;
  }

  const skip = (page - 1) * limit;
  const where = {
    regionId,
    ...(isVisible !== undefined && { isVisible: isVisible === 'true' || isVisible === true }),
  };

  const [visibilityRecords, total] = await Promise.all([
    prisma.packageRegionVisibility.findMany({
      where,
      include: {
        package: {
          include: {
            currency: true,
            yacht: {
              select: {
                id: true,
                name: true,
                type: true,
              },
            },
          },
        },
      },
      orderBy: [
        { sortOrder: 'asc' },
        { createdAt: 'desc' },
      ],
      skip,
      take: limit,
    }),
    prisma.packageRegionVisibility.count({ where }),
  ]);

  // Transform to include visibility metadata
  const packages = visibilityRecords.map((record) => ({
    ...record.package,
    visibility: {
      id: record.id,
      isVisible: record.isVisible,
      sortOrder: record.sortOrder,
    },
  }));

  return {
    packages,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

/**
 * Assign a package to a region (create PackageRegionVisibility).
 * @param {string} regionId - Region UUID
 * @param {string} packageId - Package UUID
 * @param {object} options - { isVisible, sortOrder }
 * @returns {Promise<object>}
 */
export async function assignPackageToRegion(regionId, packageId, options = {}) {
  const { isVisible = true, sortOrder = 0 } = options;

  // Verify region exists
  const region = await prisma.region.findUnique({
    where: { id: regionId },
  });

  if (!region) {
    const err = new Error('Region not found');
    err.status = 404;
    throw err;
  }

  // Verify package exists
  const package_ = await prisma.package.findUnique({
    where: { id: packageId },
  });

  if (!package_) {
    const err = new Error('Package not found');
    err.status = 404;
    throw err;
  }

  // Check if already assigned
  const existing = await prisma.packageRegionVisibility.findFirst({
    where: {
      regionId,
      packageId,
    },
  });

  if (existing) {
    const err = new Error('Package is already assigned to this region');
    err.status = 409;
    throw err;
  }

  // Create the visibility record
  const visibility = await prisma.packageRegionVisibility.create({
    data: {
      regionId,
      packageId,
      isVisible,
      sortOrder: parseInt(sortOrder, 10) || 0,
    },
    include: {
      package: {
        include: {
          currency: true,
        },
      },
      region: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
    },
  });

  return visibility;
}

/**
 * Remove a package from a region (delete PackageRegionVisibility).
 * @param {string} regionId - Region UUID
 * @param {string} packageId - Package UUID
 * @returns {Promise<void>}
 */
export async function removePackageFromRegion(regionId, packageId) {
  // Verify region exists
  const region = await prisma.region.findUnique({
    where: { id: regionId },
  });

  if (!region) {
    const err = new Error('Region not found');
    err.status = 404;
    throw err;
  }

  // Find the visibility record
  const visibility = await prisma.packageRegionVisibility.findFirst({
    where: {
      regionId,
      packageId,
    },
  });

  if (!visibility) {
    const err = new Error('Package is not assigned to this region');
    err.status = 404;
    throw err;
  }

  // Delete the visibility record
  await prisma.packageRegionVisibility.delete({
    where: { id: visibility.id },
  });
}
