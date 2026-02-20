import { prisma } from '../config/database.js';

const VALID_CATEGORIES = ['navigation', 'safety', 'entertainment', 'water_sports', 'comfort'];

/**
 * Get all amenities for a yacht.
 * @param {string} yachtId - Yacht UUID
 * @param {object} options - { category, isAvailable }
 * @returns {Promise<Array>}
 */
export async function getYachtAmenities(yachtId, options = {}) {
  const { category, isAvailable } = options;

  // Verify yacht exists
  const yacht = await prisma.yacht.findUnique({
    where: { id: yachtId },
  });

  if (!yacht) {
    const err = new Error('Yacht not found');
    err.status = 404;
    throw err;
  }

  const where = { yachtId };
  if (category) where.category = category;
  if (isAvailable !== undefined) {
    where.isAvailable = isAvailable === 'true' || isAvailable === true;
  }

  const amenities = await prisma.yachtAmenity.findMany({
    where,
    orderBy: [
      { category: 'asc' },
      { name: 'asc' },
    ],
  });

  return amenities;
}

/**
 * Add an amenity to a yacht.
 * @param {string} yachtId - Yacht UUID
 * @param {object} data - { category, name, isAvailable }
 * @returns {Promise<object>}
 */
export async function addYachtAmenity(yachtId, data) {
  const { category, name, isAvailable = true } = data;

  // Validate required fields
  if (!category || !name) {
    const err = new Error('Category and name are required');
    err.status = 400;
    throw err;
  }

  // Validate category
  if (!VALID_CATEGORIES.includes(category)) {
    const err = new Error(`Category must be one of: ${VALID_CATEGORIES.join(', ')}`);
    err.status = 400;
    throw err;
  }

  // Verify yacht exists
  const yacht = await prisma.yacht.findUnique({
    where: { id: yachtId },
  });

  if (!yacht) {
    const err = new Error('Yacht not found');
    err.status = 404;
    throw err;
  }

  // Check for duplicate (same category and name)
  const existing = await prisma.yachtAmenity.findFirst({
    where: {
      yachtId,
      category,
      name: name.trim(),
    },
  });

  if (existing) {
    const err = new Error(`Amenity "${name}" already exists in category "${category}" for this yacht`);
    err.status = 409;
    throw err;
  }

  const amenity = await prisma.yachtAmenity.create({
    data: {
      yachtId,
      category,
      name: name.trim(),
      isAvailable: isAvailable === 'true' || isAvailable === true,
    },
  });

  return amenity;
}

/**
 * Update a yacht amenity.
 * @param {string} yachtId - Yacht UUID
 * @param {string} amenityId - Amenity UUID
 * @param {object} data - { category?, name?, isAvailable? }
 * @returns {Promise<object>}
 */
export async function updateYachtAmenity(yachtId, amenityId, data) {
  const { category, name, isAvailable } = data;

  // Verify yacht exists
  const yacht = await prisma.yacht.findUnique({
    where: { id: yachtId },
  });

  if (!yacht) {
    const err = new Error('Yacht not found');
    err.status = 404;
    throw err;
  }

  // Verify amenity exists and belongs to yacht
  const amenity = await prisma.yachtAmenity.findFirst({
    where: {
      id: amenityId,
      yachtId,
    },
  });

  if (!amenity) {
    const err = new Error('Amenity not found');
    err.status = 404;
    throw err;
  }

  const updateData = {};

  if (category !== undefined) {
    if (!VALID_CATEGORIES.includes(category)) {
      const err = new Error(`Category must be one of: ${VALID_CATEGORIES.join(', ')}`);
      err.status = 400;
      throw err;
    }
    updateData.category = category;
  }

  if (name !== undefined) {
    updateData.name = name.trim();
  }

  if (isAvailable !== undefined) {
    updateData.isAvailable = isAvailable === 'true' || isAvailable === true;
  }

  // Check for duplicate if category or name changed
  if ((category !== undefined && category !== amenity.category) || 
      (name !== undefined && name.trim() !== amenity.name)) {
    const finalCategory = category || amenity.category;
    const finalName = name ? name.trim() : amenity.name;

    const existing = await prisma.yachtAmenity.findFirst({
      where: {
        yachtId,
        category: finalCategory,
        name: finalName,
        id: { not: amenityId },
      },
    });

    if (existing) {
      const err = new Error(`Amenity "${finalName}" already exists in category "${finalCategory}" for this yacht`);
      err.status = 409;
      throw err;
    }
  }

  const updatedAmenity = await prisma.yachtAmenity.update({
    where: { id: amenityId },
    data: updateData,
  });

  return updatedAmenity;
}

/**
 * Remove an amenity from a yacht.
 * @param {string} yachtId - Yacht UUID
 * @param {string} amenityId - Amenity UUID
 * @returns {Promise<void>}
 */
export async function removeYachtAmenity(yachtId, amenityId) {
  // Verify yacht exists
  const yacht = await prisma.yacht.findUnique({
    where: { id: yachtId },
  });

  if (!yacht) {
    const err = new Error('Yacht not found');
    err.status = 404;
    throw err;
  }

  // Verify amenity exists and belongs to yacht
  const amenity = await prisma.yachtAmenity.findFirst({
    where: {
      id: amenityId,
      yachtId,
    },
  });

  if (!amenity) {
    const err = new Error('Amenity not found');
    err.status = 404;
    throw err;
  }

  await prisma.yachtAmenity.delete({
    where: { id: amenityId },
  });
}
