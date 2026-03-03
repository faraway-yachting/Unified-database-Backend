import { prisma } from '../config/database.js';

/**
 * Generate a URL-friendly slug from a string.
 * @param {string} text
 * @returns {string}
 */
function generateSlug(text) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * List all regions with optional filtering and pagination.
 * @param {object} options - { status, page, limit, includeCurrency }
 * @returns {Promise<{ regions: Array, total: number, page: number, limit: number }>}
 */
export async function listRegions(options = {}) {
  const {
    status,
    page = 1,
    limit = 50,
    includeCurrency = true,
  } = options;

  const skip = (page - 1) * limit;
  const where = status ? { status } : {};

  const [regions, total] = await Promise.all([
    prisma.region.findMany({
      where,
      include: {
        currency: includeCurrency,
      },
      orderBy: {
        createdAt: 'desc',
      },
      skip,
      take: limit,
    }),
    prisma.region.count({ where }),
  ]);

  return {
    regions,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

/**
 * Get region performance data for charts.
 * @returns {Promise<{ regions: Array }>}
 */
export async function getRegionPerformance() {
  const grouped = await prisma.booking.groupBy({
    by: ['regionId'],
    _count: { _all: true },
    _sum: { totalAmount: true },
  });

  const regionIds = grouped.map((item) => item.regionId);
  const regions = await prisma.region.findMany({
    where: { id: { in: regionIds } },
    select: { id: true, name: true },
  });
  const regionMap = new Map(regions.map((r) => [r.id, r.name]));

  const data = grouped.map((item) => ({
    regionId: item.regionId,
    name: regionMap.get(item.regionId) ?? 'Unknown',
    bookings: item._count?._all ?? 0,
    revenue: Number(item._sum?.totalAmount ?? 0),
  }));

  return { regions: data };
}

/**
 * Get a single region by ID.
 * @param {string} id - Region UUID
 * @returns {Promise<object>}
 */
export async function getRegionById(id) {
  const region = await prisma.region.findUnique({
    where: { id },
    include: {
      currency: true,
    },
  });

  if (!region) {
    const err = new Error('Region not found');
    err.status = 404;
    throw err;
  }

  return region;
}

/**
 * Create a new region.
 * @param {object} data - Region data
 * @returns {Promise<object>}
 */
export async function createRegion(data) {
  const {
    name,
    slug,
    siteUrl,
    country,
    currencyCode,
    languageCode = 'en',
    contactEmail,
    contactPhone,
    metaTitle,
    metaDescription,
    heroImageUrl,
    status = 'draft',
  } = data;

  // Validate required fields
  if (!name || !country || !currencyCode) {
    const err = new Error('Name, country, and currencyCode are required');
    err.status = 400;
    throw err;
  }

  // Generate slug if not provided
  const finalSlug = slug || generateSlug(name);

  // Check if slug already exists
  const existingSlug = await prisma.region.findUnique({
    where: { slug: finalSlug },
  });

  if (existingSlug) {
    const err = new Error(`Region with slug "${finalSlug}" already exists`);
    err.status = 409;
    throw err;
  }

  // Verify currency exists
  const currency = await prisma.currency.findUnique({
    where: { code: currencyCode },
  });

  if (!currency) {
    const err = new Error(`Currency with code "${currencyCode}" not found`);
    err.status = 400;
    throw err;
  }

  // Validate status
  if (status && !['live', 'draft'].includes(status)) {
    const err = new Error('Status must be either "live" or "draft"');
    err.status = 400;
    throw err;
  }

  const region = await prisma.region.create({
    data: {
      name,
      slug: finalSlug,
      siteUrl,
      country,
      currencyCode,
      languageCode,
      contactEmail,
      contactPhone,
      metaTitle,
      metaDescription,
      heroImageUrl,
      status,
    },
    include: {
      currency: true,
    },
  });

  return region;
}

/**
 * Update a region.
 * @param {string} id - Region UUID
 * @param {object} data - Partial region data
 * @returns {Promise<object>}
 */
export async function updateRegion(id, data) {
  // Check if region exists
  const existingRegion = await prisma.region.findUnique({
    where: { id },
  });

  if (!existingRegion) {
    const err = new Error('Region not found');
    err.status = 404;
    throw err;
  }

  const {
    name,
    slug,
    siteUrl,
    country,
    currencyCode,
    languageCode,
    contactEmail,
    contactPhone,
    metaTitle,
    metaDescription,
    heroImageUrl,
    status,
  } = data;

  const updateData = {};

  if (name !== undefined) updateData.name = name;
  if (siteUrl !== undefined) updateData.siteUrl = siteUrl;
  if (country !== undefined) updateData.country = country;
  if (languageCode !== undefined) updateData.languageCode = languageCode;
  if (contactEmail !== undefined) updateData.contactEmail = contactEmail;
  if (contactPhone !== undefined) updateData.contactPhone = contactPhone;
  if (metaTitle !== undefined) updateData.metaTitle = metaTitle;
  if (metaDescription !== undefined) updateData.metaDescription = metaDescription;
  if (heroImageUrl !== undefined) updateData.heroImageUrl = heroImageUrl;
  if (status !== undefined) {
    if (!['live', 'draft'].includes(status)) {
      const err = new Error('Status must be either "live" or "draft"');
      err.status = 400;
      throw err;
    }
    updateData.status = status;
  }

  // Handle slug update
  if (slug !== undefined) {
    const finalSlug = slug || (name ? generateSlug(name) : existingRegion.slug);
    if (finalSlug !== existingRegion.slug) {
      const existingSlug = await prisma.region.findUnique({
        where: { slug: finalSlug },
      });
      if (existingSlug) {
        const err = new Error(`Region with slug "${finalSlug}" already exists`);
        err.status = 409;
        throw err;
      }
      updateData.slug = finalSlug;
    }
  } else if (name && name !== existingRegion.name) {
    // Auto-generate slug if name changed but slug not provided
    const newSlug = generateSlug(name);
    if (newSlug !== existingRegion.slug) {
      const existingSlug = await prisma.region.findUnique({
        where: { slug: newSlug },
      });
      if (!existingSlug) {
        updateData.slug = newSlug;
      }
    }
  }

  // Handle currencyCode update
  if (currencyCode !== undefined && currencyCode !== existingRegion.currencyCode) {
    const currency = await prisma.currency.findUnique({
      where: { code: currencyCode },
    });
    if (!currency) {
      const err = new Error(`Currency with code "${currencyCode}" not found`);
      err.status = 400;
      throw err;
    }
    updateData.currencyCode = currencyCode;
  }

  const region = await prisma.region.update({
    where: { id },
    data: updateData,
    include: {
      currency: true,
    },
  });

  return region;
}

/**
 * Delete a region.
 * @param {string} id - Region UUID
 * @returns {Promise<void>}
 */
export async function deleteRegion(id) {
  const region = await prisma.region.findUnique({
    where: { id },
  });

  if (!region) {
    const err = new Error('Region not found');
    err.status = 404;
    throw err;
  }

  // Check for related records (optional - you may want to prevent deletion if there are related records)
  // For now, we'll allow deletion (cascade will handle related records if configured)

  await prisma.region.delete({
    where: { id },
  });
}
