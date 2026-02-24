import { prisma } from '../config/database.js';

const VALID_DURATION_TYPES = ['half_day', 'full_day', 'weekly', 'custom'];
const VALID_STATUSES = ['active', 'draft', 'archived'];

/**
 * List packages with optional filters: region, duration, status, price.
 * @param {object} options - { regionId, durationType, status, minPrice, maxPrice, page, limit }
 * @returns {Promise<{ packages: Array, total: number, page: number, limit: number }>}
 */
export async function listPackages(options = {}) {
  const {
    regionId,
    durationType,
    status,
    minPrice,
    maxPrice,
    page = 1,
    limit = 50,
  } = options;

  const skip = (page - 1) * limit;
  const where = {};

  if (regionId) {
    where.regionVisibility = {
      some: { regionId },
    };
  }
  if (durationType) {
    if (!VALID_DURATION_TYPES.includes(durationType)) {
      const err = new Error(`durationType must be one of: ${VALID_DURATION_TYPES.join(', ')}`);
      err.status = 400;
      throw err;
    }
    where.durationType = durationType;
  }
  if (status) {
    if (!VALID_STATUSES.includes(status)) {
      const err = new Error(`status must be one of: ${VALID_STATUSES.join(', ')}`);
      err.status = 400;
      throw err;
    }
    where.status = status;
  }
  if (minPrice != null && minPrice !== '') {
    const min = parseFloat(minPrice);
    if (Number.isNaN(min) || min < 0) {
      const err = new Error('minPrice must be a non-negative number');
      err.status = 400;
      throw err;
    }
    where.basePrice = where.basePrice || {};
    where.basePrice.gte = min;
  }
  if (maxPrice != null && maxPrice !== '') {
    const max = parseFloat(maxPrice);
    if (Number.isNaN(max) || max < 0) {
      const err = new Error('maxPrice must be a non-negative number');
      err.status = 400;
      throw err;
    }
    where.basePrice = where.basePrice || {};
    where.basePrice.lte = max;
  }

  const [packages, total] = await Promise.all([
    prisma.package.findMany({
      where,
      include: {
        currency: { select: { code: true, name: true, symbol: true } },
        yacht: { select: { id: true, name: true, type: true } },
      },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
      skip,
      take: limit,
    }),
    prisma.package.count({ where }),
  ]);

  return {
    packages,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

/**
 * Create a package.
 * @param {object} data - Package fields
 * @returns {Promise<object>}
 */
export async function createPackage(data) {
  const {
    name,
    description,
    yachtId,
    yachtCategory,
    durationType,
    durationHours,
    durationDays,
    basePrice,
    currencyCode,
    maxCapacity,
    status = 'draft',
    isFeatured = false,
    sortOrder = 0,
  } = data;

  if (!name || !durationType || basePrice == null || basePrice === '' || !currencyCode) {
    const err = new Error('name, durationType, basePrice, and currencyCode are required');
    err.status = 400;
    throw err;
  }

  if (!VALID_DURATION_TYPES.includes(durationType)) {
    const err = new Error(`durationType must be one of: ${VALID_DURATION_TYPES.join(', ')}`);
    err.status = 400;
    throw err;
  }

  if (status && !VALID_STATUSES.includes(status)) {
    const err = new Error(`status must be one of: ${VALID_STATUSES.join(', ')}`);
    err.status = 400;
    throw err;
  }

  const currency = await prisma.currency.findUnique({
    where: { code: currencyCode },
  });
  if (!currency) {
    const err = new Error('Currency not found');
    err.status = 400;
    throw err;
  }

  const price = parseFloat(basePrice);
  if (Number.isNaN(price) || price < 0) {
    const err = new Error('basePrice must be a non-negative number');
    err.status = 400;
    throw err;
  }

  if (yachtId) {
    const yacht = await prisma.yacht.findUnique({ where: { id: yachtId } });
    if (!yacht) {
      const err = new Error('Yacht not found');
      err.status = 400;
      throw err;
    }
  }

  const pkg = await prisma.package.create({
    data: {
      name,
      description: description || null,
      yachtId: yachtId || null,
      yachtCategory: yachtCategory || null,
      durationType,
      durationHours: durationHours != null ? parseFloat(durationHours) : null,
      durationDays: durationDays != null ? parseInt(durationDays, 10) : null,
      basePrice: price,
      currencyCode,
      maxCapacity: maxCapacity != null ? parseInt(maxCapacity, 10) : null,
      status: status || 'draft',
      isFeatured: Boolean(isFeatured),
      sortOrder: sortOrder != null ? parseInt(sortOrder, 10) : 0,
    },
    include: {
      currency: { select: { code: true, name: true, symbol: true } },
      yacht: { select: { id: true, name: true, type: true } },
    },
  });

  return pkg;
}

/**
 * Get package by ID.
 * @param {string} id - Package UUID
 * @returns {Promise<object>}
 */
export async function getPackageById(id) {
  const pkg = await prisma.package.findUnique({
    where: { id },
    include: {
      currency: true,
      yacht: { select: { id: true, name: true, type: true } },
      regionVisibility: {
        include: { region: { select: { id: true, name: true, slug: true } } },
      },
      includedServices: true,
      addons: true,
      media: true,
    },
  });

  if (!pkg) {
    const err = new Error('Package not found');
    err.status = 404;
    throw err;
  }

  return pkg;
}

/**
 * Update a package.
 * @param {string} id - Package UUID
 * @param {object} data - Partial package data
 * @returns {Promise<object>}
 */
export async function updatePackage(id, data) {
  const pkg = await prisma.package.findUnique({
    where: { id },
  });

  if (!pkg) {
    const err = new Error('Package not found');
    err.status = 404;
    throw err;
  }

  const {
    name,
    description,
    yachtId,
    yachtCategory,
    durationType,
    durationHours,
    durationDays,
    basePrice,
    currencyCode,
    maxCapacity,
    status,
    isFeatured,
    sortOrder,
  } = data;

  const updateData = {};

  if (name !== undefined) updateData.name = name;
  if (description !== undefined) updateData.description = description ?? null;
  if (yachtId !== undefined) updateData.yachtId = yachtId ?? null;
  if (yachtCategory !== undefined) updateData.yachtCategory = yachtCategory ?? null;
  if (durationType !== undefined) {
    if (!VALID_DURATION_TYPES.includes(durationType)) {
      const err = new Error(`durationType must be one of: ${VALID_DURATION_TYPES.join(', ')}`);
      err.status = 400;
      throw err;
    }
    updateData.durationType = durationType;
  }
  if (durationHours !== undefined) updateData.durationHours = durationHours != null ? parseFloat(durationHours) : null;
  if (durationDays !== undefined) updateData.durationDays = durationDays != null ? parseInt(durationDays, 10) : null;
  if (basePrice !== undefined) {
    const price = parseFloat(basePrice);
    if (Number.isNaN(price) || price < 0) {
      const err = new Error('basePrice must be a non-negative number');
      err.status = 400;
      throw err;
    }
    updateData.basePrice = price;
  }
  if (currencyCode !== undefined) {
    const currency = await prisma.currency.findUnique({ where: { code: currencyCode } });
    if (!currency) {
      const err = new Error('Currency not found');
      err.status = 400;
      throw err;
    }
    updateData.currencyCode = currencyCode;
  }
  if (maxCapacity !== undefined) updateData.maxCapacity = maxCapacity != null ? parseInt(maxCapacity, 10) : null;
  if (status !== undefined) {
    if (!VALID_STATUSES.includes(status)) {
      const err = new Error(`status must be one of: ${VALID_STATUSES.join(', ')}`);
      err.status = 400;
      throw err;
    }
    updateData.status = status;
  }
  if (isFeatured !== undefined) updateData.isFeatured = Boolean(isFeatured);
  if (sortOrder !== undefined) updateData.sortOrder = parseInt(sortOrder, 10);

  const updated = await prisma.package.update({
    where: { id },
    data: updateData,
    include: {
      currency: { select: { code: true, name: true, symbol: true } },
      yacht: { select: { id: true, name: true, type: true } },
    },
  });

  return updated;
}

/**
 * Delete a package. Fails if package has existing bookings.
 * @param {string} id - Package UUID
 * @returns {Promise<void>}
 */
export async function deletePackage(id) {
  const pkg = await prisma.package.findUnique({
    where: { id },
    include: { _count: { select: { bookings: true } } },
  });

  if (!pkg) {
    const err = new Error('Package not found');
    err.status = 404;
    throw err;
  }

  if (pkg._count.bookings > 0) {
    const err = new Error('Cannot delete package with existing bookings');
    err.status = 409;
    throw err;
  }

  await prisma.package.delete({
    where: { id },
  });
}

/**
 * Update package status (active | draft | archived).
 * @param {string} id - Package UUID
 * @param {object} data - { status }
 * @returns {Promise<object>}
 */
export async function updatePackageStatus(id, data) {
  const { status } = data;

  if (!status || !VALID_STATUSES.includes(status)) {
    const err = new Error(`status must be one of: ${VALID_STATUSES.join(', ')}`);
    err.status = 400;
    throw err;
  }

  const pkg = await prisma.package.findUnique({
    where: { id },
  });

  if (!pkg) {
    const err = new Error('Package not found');
    err.status = 404;
    throw err;
  }

  const updated = await prisma.package.update({
    where: { id },
    data: { status },
    include: {
      currency: { select: { code: true, name: true, symbol: true } },
      yacht: { select: { id: true, name: true, type: true } },
    },
  });

  return updated;
}
