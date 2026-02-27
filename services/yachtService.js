import { prisma } from '../config/database.js';
import { getPresignedUrl, s3Config } from './s3Service.js';

function extractS3KeyFromUrl(url) {
  if (!url) return null;
  if (url.startsWith('s3://')) {
    const parts = url.replace('s3://', '').split('/');
    return parts.length > 1 ? parts.slice(1).join('/') : null;
  }
  try {
    const u = new URL(url);
    const pathParts = u.pathname.split('/').filter(Boolean);
    if (pathParts.length === 0) return null;
    if (s3Config.bucket && pathParts[0] === s3Config.bucket) {
      return pathParts.slice(1).join('/');
    }
    return pathParts.join('/');
  } catch (_) {
    return null;
  }
}

async function attachPresignedUrlsToYachts(yachts) {
  if (!s3Config.bucket) return yachts;
  await Promise.all(
    yachts.map(async (yacht) => {
      if (!yacht?.images?.length) return;
      await Promise.all(
        yacht.images.map(async (img) => {
          const key = extractS3KeyFromUrl(img.imageUrl);
          if (!key) return;
          try {
            img.imageUrl = await getPresignedUrl(key);
          } catch (_) {
            // Keep original URL if signing fails
          }
        })
      );
    })
  );
  return yachts;
}

/**
 * List all yachts with optional filtering and pagination.
 * @param {object} options - { regionId, type, status, minCapacity, maxCapacity, isActive, page, limit, includeRelations }
 * @returns {Promise<{ yachts: Array, total: number, page: number, limit: number }>}
 */
export async function listYachts(options = {}) {
  const {
    regionId,
    type,
    status,
    minCapacity,
    maxCapacity,
    isActive,
    page = 1,
    limit = 50,
    includeCompany = true,
    includeRegion = true,
    includeImages = false,
  } = options;

  const skip = (page - 1) * limit;
  const where = {};

  if (regionId) where.regionId = regionId;
  if (type) where.type = type;
  if (status) where.status = status;
  if (isActive !== undefined) where.isActive = isActive === 'true' || isActive === true;

  // Capacity filtering
  if (minCapacity !== undefined) {
    where.capacityGuests = { gte: parseInt(minCapacity, 10) };
  }
  if (maxCapacity !== undefined) {
    if (where.capacityGuests) {
      where.capacityGuests.lte = parseInt(maxCapacity, 10);
    } else {
      where.capacityGuests = { lte: parseInt(maxCapacity, 10) };
    }
  }

  const include = {};
  if (includeCompany) {
    include.company = {
      select: {
        id: true,
        name: true,
        logoUrl: true,
      },
    };
  }
  if (includeRegion) {
    include.region = {
      select: {
        id: true,
        name: true,
        slug: true,
      },
    };
  }
  if (includeImages) {
    include.images = {
      orderBy: { sortOrder: 'asc' },
    };
  }

  const [yachts, total] = await Promise.all([
    prisma.yacht.findMany({
      where,
      include: Object.keys(include).length > 0 ? include : undefined,
      orderBy: {
        createdAt: 'desc',
      },
      skip,
      take: limit,
    }),
    prisma.yacht.count({ where }),
  ]);

  if (includeImages) {
    await attachPresignedUrlsToYachts(yachts);
  }

  return {
    yachts,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

/**
 * Get a single yacht by ID.
 * @param {string} id - Yacht UUID
 * @param {object} options - { includeCompany, includeRegion, includeImages, includeAmenities }
 * @returns {Promise<object>}
 */
export async function getYachtById(id, options = {}) {
  const {
    includeCompany = true,
    includeRegion = true,
    includeImages = true,
    includeAmenities = false,
  } = options;

  const include = {};
  if (includeCompany) {
    include.company = {
      select: {
        id: true,
        name: true,
        logoUrl: true,
        contactEmail: true,
        contactPhone: true,
      },
    };
  }
  if (includeRegion) {
    include.region = true;
  }
  if (includeImages) {
    include.images = {
      orderBy: { sortOrder: 'asc' },
    };
  }
  if (includeAmenities) {
    include.amenities = true;
  }

  const yacht = await prisma.yacht.findUnique({
    where: { id },
    include: Object.keys(include).length > 0 ? include : undefined,
  });

  if (!yacht) {
    const err = new Error('Yacht not found');
    err.status = 404;
    throw err;
  }

  if (includeImages && yacht.images?.length) {
    await attachPresignedUrlsToYachts([yacht]);
  }

  return yacht;
}

/**
 * Get full yacht details by ID, including related data.
 * @param {string} id - Yacht UUID
 * @returns {Promise<object>}
 */
export async function getYachtDetail(id) {
  const yacht = await prisma.yacht.findUnique({
    where: { id },
    include: {
      company: {
        select: {
          id: true,
          name: true,
          logoUrl: true,
          contactEmail: true,
          contactPhone: true,
        },
      },
      region: true,
      images: {
        orderBy: { sortOrder: 'asc' },
      },
      amenities: {
        orderBy: [
          { category: 'asc' },
          { name: 'asc' },
        ],
      },
      documents: {
        orderBy: [
          { documentType: 'asc' },
          { issuedDate: 'desc' },
        ],
      },
      maintenance: {
        orderBy: { scheduledDate: 'desc' },
      },
      availabilityBlocks: {
        orderBy: { startDate: 'asc' },
      },
      packages: {
        orderBy: { createdAt: 'desc' },
      },
      bookings: {
        orderBy: { startDate: 'desc' },
      },
      leads: {
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  if (!yacht) {
    const err = new Error('Yacht not found');
    err.status = 404;
    throw err;
  }

  if (yacht.images?.length) {
    await attachPresignedUrlsToYachts([yacht]);
  }

  return yacht;
}

/**
 * Create a new yacht.
 * @param {object} data - Yacht data
 * @returns {Promise<object>}
 */
export async function createYacht(data) {
  const {
    companyId,
    name,
    type,
    lengthM,
    beamM,
    capacityGuests,
    capacityCrew,
    yearBuilt,
    engineType,
    engineHp,
    cruiseSpeedKnots,
    fuelCapacityL,
    homePort,
    regionId,
    status = 'available',
    isActive = true,
  } = data;

  // Validate required fields
  if (!companyId || !name || !type || !capacityGuests || !regionId) {
    const err = new Error('companyId, name, type, capacityGuests, and regionId are required');
    err.status = 400;
    throw err;
  }

  // Validate type
  const validTypes = ['sailboat', 'motor', 'catamaran', 'gulet'];
  if (!validTypes.includes(type)) {
    const err = new Error(`Type must be one of: ${validTypes.join(', ')}`);
    err.status = 400;
    throw err;
  }

  // Validate status
  const validStatuses = ['available', 'booked', 'maintenance', 'retired'];
  if (status && !validStatuses.includes(status)) {
    const err = new Error(`Status must be one of: ${validStatuses.join(', ')}`);
    err.status = 400;
    throw err;
  }

  // Verify company exists
  const company = await prisma.charterCompany.findUnique({
    where: { id: companyId },
  });

  if (!company) {
    const err = new Error(`Charter company with id "${companyId}" not found`);
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

  const yacht = await prisma.yacht.create({
    data: {
      companyId,
      name,
      type,
      lengthM: lengthM ? parseFloat(lengthM) : null,
      beamM: beamM ? parseFloat(beamM) : null,
      capacityGuests: parseInt(capacityGuests, 10),
      capacityCrew: capacityCrew ? parseInt(capacityCrew, 10) : null,
      yearBuilt: yearBuilt ? parseInt(yearBuilt, 10) : null,
      engineType,
      engineHp: engineHp ? parseInt(engineHp, 10) : null,
      cruiseSpeedKnots: cruiseSpeedKnots ? parseFloat(cruiseSpeedKnots) : null,
      fuelCapacityL: fuelCapacityL ? parseInt(fuelCapacityL, 10) : null,
      homePort,
      regionId,
      status,
      isActive,
    },
    include: {
      company: {
        select: {
          id: true,
          name: true,
          logoUrl: true,
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

  return yacht;
}

/**
 * Update a yacht.
 * @param {string} id - Yacht UUID
 * @param {object} data - Partial yacht data
 * @returns {Promise<object>}
 */
export async function updateYacht(id, data) {
  // Check if yacht exists
  const existingYacht = await prisma.yacht.findUnique({
    where: { id },
  });

  if (!existingYacht) {
    const err = new Error('Yacht not found');
    err.status = 404;
    throw err;
  }

  const {
    companyId,
    name,
    type,
    lengthM,
    beamM,
    capacityGuests,
    capacityCrew,
    yearBuilt,
    engineType,
    engineHp,
    cruiseSpeedKnots,
    fuelCapacityL,
    homePort,
    regionId,
    isActive,
  } = data;

  const updateData = {};

  if (name !== undefined) updateData.name = name;
  if (lengthM !== undefined) updateData.lengthM = lengthM ? parseFloat(lengthM) : null;
  if (beamM !== undefined) updateData.beamM = beamM ? parseFloat(beamM) : null;
  if (capacityGuests !== undefined) updateData.capacityGuests = parseInt(capacityGuests, 10);
  if (capacityCrew !== undefined) updateData.capacityCrew = capacityCrew ? parseInt(capacityCrew, 10) : null;
  if (yearBuilt !== undefined) updateData.yearBuilt = yearBuilt ? parseInt(yearBuilt, 10) : null;
  if (engineType !== undefined) updateData.engineType = engineType;
  if (engineHp !== undefined) updateData.engineHp = engineHp ? parseInt(engineHp, 10) : null;
  if (cruiseSpeedKnots !== undefined) updateData.cruiseSpeedKnots = cruiseSpeedKnots ? parseFloat(cruiseSpeedKnots) : null;
  if (fuelCapacityL !== undefined) updateData.fuelCapacityL = fuelCapacityL ? parseInt(fuelCapacityL, 10) : null;
  if (homePort !== undefined) updateData.homePort = homePort;
  if (isActive !== undefined) updateData.isActive = isActive === 'true' || isActive === true;

  // Validate and update type
  if (type !== undefined) {
    const validTypes = ['sailboat', 'motor', 'catamaran', 'gulet'];
    if (!validTypes.includes(type)) {
      const err = new Error(`Type must be one of: ${validTypes.join(', ')}`);
      err.status = 400;
      throw err;
    }
    updateData.type = type;
  }

  // Handle companyId update
  if (companyId !== undefined && companyId !== existingYacht.companyId) {
    const company = await prisma.charterCompany.findUnique({
      where: { id: companyId },
    });
    if (!company) {
      const err = new Error(`Charter company with id "${companyId}" not found`);
      err.status = 400;
      throw err;
    }
    updateData.companyId = companyId;
  }

  // Handle regionId update
  if (regionId !== undefined && regionId !== existingYacht.regionId) {
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

  const yacht = await prisma.yacht.update({
    where: { id },
    data: updateData,
    include: {
      company: {
        select: {
          id: true,
          name: true,
          logoUrl: true,
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

  return yacht;
}

/**
 * Soft delete a yacht (set isActive to false and status to retired).
 * @param {string} id - Yacht UUID
 * @returns {Promise<object>}
 */
export async function softDeleteYacht(id) {
  const yacht = await prisma.yacht.findUnique({
    where: { id },
  });

  if (!yacht) {
    const err = new Error('Yacht not found');
    err.status = 404;
    throw err;
  }

  const updatedYacht = await prisma.yacht.update({
    where: { id },
    data: {
      isActive: false,
      status: 'retired',
    },
    include: {
      company: {
        select: {
          id: true,
          name: true,
        },
      },
      region: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  return updatedYacht;
}

/**
 * Update yacht status.
 * @param {string} id - Yacht UUID
 * @param {string} status - New status
 * @returns {Promise<object>}
 */
export async function updateYachtStatus(id, status) {
  const validStatuses = ['available', 'booked', 'maintenance', 'retired'];
  if (!validStatuses.includes(status)) {
    const err = new Error(`Status must be one of: ${validStatuses.join(', ')}`);
    err.status = 400;
    throw err;
  }

  const yacht = await prisma.yacht.findUnique({
    where: { id },
  });

  if (!yacht) {
    const err = new Error('Yacht not found');
    err.status = 404;
    throw err;
  }

  const updatedYacht = await prisma.yacht.update({
    where: { id },
    data: { status },
    include: {
      company: {
        select: {
          id: true,
          name: true,
          logoUrl: true,
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

  return updatedYacht;
}
