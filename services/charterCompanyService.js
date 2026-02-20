import { prisma } from '../config/database.js';

/**
 * List all charter companies with optional filtering and pagination.
 * @param {object} options - { regionId, isActive, page, limit, includeRegion, includeYachts }
 * @returns {Promise<{ companies: Array, total: number, page: number, limit: number }>}
 */
export async function listCharterCompanies(options = {}) {
  const {
    regionId,
    isActive,
    page = 1,
    limit = 50,
    includeRegion = true,
    includeYachts = false,
  } = options;

  const skip = (page - 1) * limit;
  const where = {};
  if (regionId) where.regionId = regionId;
  if (isActive !== undefined) where.isActive = isActive === 'true' || isActive === true;

  const include = {};
  if (includeRegion) include.region = true;
  if (includeYachts) {
    include.yachts = {
      select: {
        id: true,
        name: true,
        type: true,
        status: true,
        isActive: true,
      },
    };
  }

  const [companies, total] = await Promise.all([
    prisma.charterCompany.findMany({
      where,
      include: Object.keys(include).length > 0 ? include : undefined,
      orderBy: {
        createdAt: 'desc',
      },
      skip,
      take: limit,
    }),
    prisma.charterCompany.count({ where }),
  ]);

  return {
    companies,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

/**
 * Get a single charter company by ID.
 * @param {string} id - Charter company UUID
 * @param {object} options - { includeRegion, includeYachts }
 * @returns {Promise<object>}
 */
export async function getCharterCompanyById(id, options = {}) {
  const { includeRegion = true, includeYachts = false } = options;

  const include = {};
  if (includeRegion) include.region = true;
  if (includeYachts) {
    include.yachts = {
      include: {
        images: {
          take: 1,
          orderBy: { sortOrder: 'asc' },
        },
      },
    };
  }

  const company = await prisma.charterCompany.findUnique({
    where: { id },
    include: Object.keys(include).length > 0 ? include : undefined,
  });

  if (!company) {
    const err = new Error('Charter company not found');
    err.status = 404;
    throw err;
  }

  return company;
}

/**
 * Create a new charter company.
 * @param {object} data - Charter company data
 * @returns {Promise<object>}
 */
export async function createCharterCompany(data) {
  const {
    name,
    logoUrl,
    regionId,
    contactEmail,
    contactPhone,
    isActive = true,
  } = data;

  // Validate required fields
  if (!name || !regionId) {
    const err = new Error('Name and regionId are required');
    err.status = 400;
    throw err;
  }

  // Verify region exists
  const region = await prisma.region.findUnique({
    where: { id: regionId },
  });

  if (!region) {
    const err = new Error(`Region with id "${regionId}" not found`);
    err.status = 400;
    throw err;
  }

  const company = await prisma.charterCompany.create({
    data: {
      name,
      logoUrl,
      regionId,
      contactEmail,
      contactPhone,
      isActive,
    },
    include: {
      region: true,
    },
  });

  return company;
}

/**
 * Update a charter company.
 * @param {string} id - Charter company UUID
 * @param {object} data - Partial charter company data
 * @returns {Promise<object>}
 */
export async function updateCharterCompany(id, data) {
  // Check if company exists
  const existingCompany = await prisma.charterCompany.findUnique({
    where: { id },
  });

  if (!existingCompany) {
    const err = new Error('Charter company not found');
    err.status = 404;
    throw err;
  }

  const {
    name,
    logoUrl,
    regionId,
    contactEmail,
    contactPhone,
    isActive,
  } = data;

  const updateData = {};

  if (name !== undefined) updateData.name = name;
  if (logoUrl !== undefined) updateData.logoUrl = logoUrl;
  if (contactEmail !== undefined) updateData.contactEmail = contactEmail;
  if (contactPhone !== undefined) updateData.contactPhone = contactPhone;
  if (isActive !== undefined) updateData.isActive = isActive === 'true' || isActive === true;

  // Handle regionId update
  if (regionId !== undefined && regionId !== existingCompany.regionId) {
    const region = await prisma.region.findUnique({
      where: { id: regionId },
    });
    if (!region) {
      const err = new Error(`Region with id "${regionId}" not found`);
      err.status = 400;
      throw err;
    }
    updateData.regionId = regionId;
  }

  const company = await prisma.charterCompany.update({
    where: { id },
    data: updateData,
    include: {
      region: true,
    },
  });

  return company;
}

/**
 * Delete a charter company.
 * @param {string} id - Charter company UUID
 * @returns {Promise<void>}
 */
export async function deleteCharterCompany(id) {
  const company = await prisma.charterCompany.findUnique({
    where: { id },
    include: {
      yachts: {
        select: { id: true },
        take: 1,
      },
    },
  });

  if (!company) {
    const err = new Error('Charter company not found');
    err.status = 404;
    throw err;
  }

  // Check if company has yachts (optional validation - you may want to prevent deletion)
  if (company.yachts.length > 0) {
    const err = new Error('Cannot delete charter company with associated yachts. Please remove or reassign yachts first.');
    err.status = 400;
    throw err;
  }

  await prisma.charterCompany.delete({
    where: { id },
  });
}
