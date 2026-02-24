import { prisma } from '../config/database.js';

/**
 * Get region visibility settings for a package.
 * @param {string} packageId - Package UUID
 * @returns {Promise<{ packageId: string, regions: Array }>}
 */
export async function getRegionVisibility(packageId) {
  const pkg = await prisma.package.findUnique({
    where: { id: packageId },
  });

  if (!pkg) {
    const err = new Error('Package not found');
    err.status = 404;
    throw err;
  }

  const visibilityRecords = await prisma.packageRegionVisibility.findMany({
    where: { packageId },
    include: {
      region: {
        select: { id: true, name: true, slug: true, country: true },
      },
    },
    orderBy: [{ sortOrder: 'asc' }, { regionId: 'asc' }],
  });

  const regions = visibilityRecords.map((record) => ({
    id: record.id,
    regionId: record.regionId,
    region: record.region,
    isVisible: record.isVisible,
    sortOrder: record.sortOrder,
  }));

  return {
    packageId: pkg.id,
    packageName: pkg.name,
    regions,
  };
}

/**
 * Update region visibility in bulk (replace all visibility for this package).
 * Body: { regions: [ { regionId, isVisible?, sortOrder? } ] }
 * @param {string} packageId - Package UUID
 * @param {object} data - { regions: Array<{ regionId, isVisible?, sortOrder? }> }
 * @returns {Promise<{ packageId: string, regions: Array }>}
 */
export async function updateRegionVisibilityBulk(packageId, data) {
  const { regions: regionsPayload } = data;

  if (!Array.isArray(regionsPayload)) {
    const err = new Error('regions must be an array');
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

  // Validate all regionIds exist and are unique in the payload
  const seenRegionIds = new Set();
  for (const item of regionsPayload) {
    if (!item || !item.regionId) {
      const err = new Error('Each region entry must have regionId');
      err.status = 400;
      throw err;
    }
    if (seenRegionIds.has(item.regionId)) {
      const err = new Error('Duplicate regionId in regions array');
      err.status = 400;
      throw err;
    }
    seenRegionIds.add(item.regionId);
  }

  const regionIds = regionsPayload.map((r) => r.regionId);
  const existingRegions = await prisma.region.findMany({
    where: { id: { in: regionIds } },
    select: { id: true },
  });
  const existingIds = new Set(existingRegions.map((r) => r.id));
  const missing = regionIds.filter((id) => !existingIds.has(id));
  if (missing.length > 0) {
    const err = new Error(`Region(s) not found: ${missing.join(', ')}`);
    err.status = 400;
    throw err;
  }

  await prisma.$transaction(async (tx) => {
    await tx.packageRegionVisibility.deleteMany({
      where: { packageId },
    });

    if (regionsPayload.length > 0) {
      await tx.packageRegionVisibility.createMany({
        data: regionsPayload.map((item, index) => ({
          packageId,
          regionId: item.regionId,
          isVisible: item.isVisible !== false,
          sortOrder: item.sortOrder != null ? parseInt(item.sortOrder, 10) : index,
        })),
      });
    }
  });

  return getRegionVisibility(packageId);
}
