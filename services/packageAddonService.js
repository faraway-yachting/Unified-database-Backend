import { prisma } from '../config/database.js';

const VALID_PRICE_TYPES = ['flat', 'per_person', 'per_day'];

/**
 * List add-ons for a package.
 * @param {string} packageId - Package UUID
 * @returns {Promise<{ packageId: string, addons: Array }>}
 */
export async function getAddons(packageId) {
  const pkg = await prisma.package.findUnique({
    where: { id: packageId },
  });

  if (!pkg) {
    const err = new Error('Package not found');
    err.status = 404;
    throw err;
  }

  const addons = await prisma.packageAddon.findMany({
    where: { packageId },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
  });

  return {
    packageId: pkg.id,
    packageName: pkg.name,
    addons,
  };
}

/**
 * Create an add-on for a package.
 * @param {string} packageId - Package UUID
 * @param {object} data - { name, description?, price, priceType?, isActive?, sortOrder? }
 * @returns {Promise<object>}
 */
export async function createAddon(packageId, data) {
  const {
    name,
    description,
    price,
    priceType = 'flat',
    isActive = true,
    sortOrder = 0,
  } = data;

  if (!name || !name.trim()) {
    const err = new Error('name is required');
    err.status = 400;
    throw err;
  }

  if (price == null || price === '') {
    const err = new Error('price is required');
    err.status = 400;
    throw err;
  }

  const priceNum = parseFloat(price);
  if (Number.isNaN(priceNum) || priceNum < 0) {
    const err = new Error('price must be a non-negative number');
    err.status = 400;
    throw err;
  }

  if (priceType && !VALID_PRICE_TYPES.includes(priceType)) {
    const err = new Error(`priceType must be one of: ${VALID_PRICE_TYPES.join(', ')}`);
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

  const addon = await prisma.packageAddon.create({
    data: {
      packageId,
      name: name.trim(),
      description: description?.trim() || null,
      price: priceNum,
      priceType: priceType || 'flat',
      isActive: isActive !== false,
      sortOrder: sortOrder != null ? parseInt(sortOrder, 10) : 0,
    },
  });

  return addon;
}

/**
 * Update an add-on.
 * @param {string} packageId - Package UUID
 * @param {string} addonId - PackageAddon UUID
 * @param {object} data - Partial addon fields
 * @returns {Promise<object>}
 */
export async function updateAddon(packageId, addonId, data) {
  const { name, description, price, priceType, isActive, sortOrder } = data;

  const pkg = await prisma.package.findUnique({
    where: { id: packageId },
  });

  if (!pkg) {
    const err = new Error('Package not found');
    err.status = 404;
    throw err;
  }

  const addon = await prisma.packageAddon.findFirst({
    where: {
      id: addonId,
      packageId,
    },
  });

  if (!addon) {
    const err = new Error('Add-on not found');
    err.status = 404;
    throw err;
  }

  const updateData = {};

  if (name !== undefined) {
    if (!name || !name.trim()) {
      const err = new Error('name cannot be empty');
      err.status = 400;
      throw err;
    }
    updateData.name = name.trim();
  }
  if (description !== undefined) updateData.description = description?.trim() || null;
  if (price !== undefined) {
    const priceNum = parseFloat(price);
    if (Number.isNaN(priceNum) || priceNum < 0) {
      const err = new Error('price must be a non-negative number');
      err.status = 400;
      throw err;
    }
    updateData.price = priceNum;
  }
  if (priceType !== undefined) {
    if (!VALID_PRICE_TYPES.includes(priceType)) {
      const err = new Error(`priceType must be one of: ${VALID_PRICE_TYPES.join(', ')}`);
      err.status = 400;
      throw err;
    }
    updateData.priceType = priceType;
  }
  if (isActive !== undefined) updateData.isActive = isActive !== false;
  if (sortOrder !== undefined) updateData.sortOrder = parseInt(sortOrder, 10);

  const updated = await prisma.packageAddon.update({
    where: { id: addonId },
    data: updateData,
  });

  return updated;
}

/**
 * Delete an add-on.
 * @param {string} packageId - Package UUID
 * @param {string} addonId - PackageAddon UUID
 * @returns {Promise<void>}
 */
export async function deleteAddon(packageId, addonId) {
  const pkg = await prisma.package.findUnique({
    where: { id: packageId },
  });

  if (!pkg) {
    const err = new Error('Package not found');
    err.status = 404;
    throw err;
  }

  const addon = await prisma.packageAddon.findFirst({
    where: {
      id: addonId,
      packageId,
    },
  });

  if (!addon) {
    const err = new Error('Add-on not found');
    err.status = 404;
    throw err;
  }

  await prisma.packageAddon.delete({
    where: { id: addonId },
  });
}
