import { prisma } from '../config/database.js';
import { s3Config } from './s3Service.js';

function extractS3KeyFromUrl(url) {
  if (!url) return null;
  if (url.startsWith('s3://')) {
    const parts = url.replace('s3://', '').split('/');
    return parts.length > 1 ? parts.slice(1).join('/') : null;
  }
  return null;
}

function resolveImageUrl(url) {
  if (!url) return url;
  if (url.startsWith('https://') || url.startsWith('http://')) return url;
  if (url.startsWith('s3://')) {
    const key = extractS3KeyFromUrl(url);
    if (!key) return url;
    if (s3Config.publicUrl) return `${s3Config.publicUrl.replace(/\/$/, '')}/${key}`;
    if (s3Config.bucket) return `https://${s3Config.bucket}.s3.${s3Config.region || 'us-east-1'}.amazonaws.com/${key}`;
  }
  return url;
}

/**
 * Get all yachts assigned to a region.
 * @param {string} regionId - Region UUID
 * @param {object} options - { status, isActive, page, limit }
 * @returns {Promise<{ yachts: Array, total: number, page: number, limit: number }>}
 */
export async function getRegionYachts(regionId, options = {}) {
  const {
    status,
    isActive,
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
    ...(status && { status }),
    ...(isActive !== undefined && { isActive: isActive === 'true' || isActive === true }),
  };

  const [yachts, total] = await Promise.all([
    prisma.yacht.findMany({
      where,
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
        images: {
          take: 1,
          orderBy: [{ isCover: 'desc' }, { sortOrder: 'asc' }],
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      skip,
      take: limit,
    }),
    prisma.yacht.count({ where }),
  ]);

  const resolvedYachts = yachts.map(y => ({
    ...y,
    primaryImage: resolveImageUrl(y.primaryImage),
    images: y.images?.map(img => ({ ...img, imageUrl: resolveImageUrl(img.imageUrl) })),
  }));

  return {
    yachts: resolvedYachts,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

/**
 * Assign a yacht to a region (update yacht's regionId).
 * @param {string} regionId - Region UUID
 * @param {string} yachtId - Yacht UUID
 * @returns {Promise<object>}
 */
export async function assignYachtToRegion(regionId, yachtId) {
  // Verify region exists
  const region = await prisma.region.findUnique({
    where: { id: regionId },
  });

  if (!region) {
    const err = new Error('Region not found');
    err.status = 404;
    throw err;
  }

  // Verify yacht exists
  const yacht = await prisma.yacht.findUnique({
    where: { id: yachtId },
    include: {
      company: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  if (!yacht) {
    const err = new Error('Yacht not found');
    err.status = 404;
    throw err;
  }

  // Check if already assigned to this region
  if (yacht.regionId === regionId) {
    const err = new Error('Yacht is already assigned to this region');
    err.status = 409;
    throw err;
  }

  // Update yacht's region
  const updatedYacht = await prisma.yacht.update({
    where: { id: yachtId },
    data: { regionId },
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
      images: {
        take: 1,
        orderBy: { sortOrder: 'asc' },
      },
    },
  });

  return updatedYacht;
}
