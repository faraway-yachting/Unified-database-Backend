import { prisma } from '../config/database.js';

/**
 * Get all website (region) visibility entries for a yacht.
 * @param {string} yachtId
 * @returns {Promise<Array>}
 */
export async function getYachtVisibility(yachtId) {
  const yacht = await prisma.yacht.findUnique({ where: { id: yachtId } });
  if (!yacht) {
    const err = new Error('Yacht not found');
    err.status = 404;
    throw err;
  }

  return prisma.yachtWebsiteVisibility.findMany({
    where: { yachtId },
    include: {
      region: {
        select: { id: true, name: true, slug: true, siteUrl: true, status: true },
      },
    },
    orderBy: { sortOrder: 'asc' },
  });
}

/**
 * Set website visibility for a yacht (replaces all existing entries).
 * @param {string} yachtId
 * @param {Array<{ regionId: string, isVisible?: boolean, sortOrder?: number }>} entries
 * @returns {Promise<Array>}
 */
export async function setYachtVisibility(yachtId, entries) {
  const yacht = await prisma.yacht.findUnique({ where: { id: yachtId } });
  if (!yacht) {
    const err = new Error('Yacht not found');
    err.status = 404;
    throw err;
  }

  if (!Array.isArray(entries)) {
    const err = new Error('entries must be an array');
    err.status = 400;
    throw err;
  }

  // Verify all regionIds exist
  const regionIds = [...new Set(entries.map((e) => e.regionId))];
  const regions = await prisma.region.findMany({
    where: { id: { in: regionIds } },
    select: { id: true },
  });
  const foundIds = new Set(regions.map((r) => r.id));
  const missing = regionIds.filter((id) => !foundIds.has(id));
  if (missing.length > 0) {
    const err = new Error(`Region(s) not found: ${missing.join(', ')}`);
    err.status = 400;
    throw err;
  }

  await prisma.$transaction(async (tx) => {
    await tx.yachtWebsiteVisibility.deleteMany({ where: { yachtId } });
    if (entries.length === 0) return;
    await tx.yachtWebsiteVisibility.createMany({
      data: entries.map((e, i) => ({
        yachtId,
        regionId: e.regionId,
        isVisible: e.isVisible !== undefined ? e.isVisible : true,
        sortOrder: e.sortOrder !== undefined ? e.sortOrder : i,
      })),
    });
  });

  return getYachtVisibility(yachtId);
}

/**
 * Remove a yacht from a specific website (region).
 * @param {string} yachtId
 * @param {string} regionId
 */
export async function removeYachtFromWebsite(yachtId, regionId) {
  const entry = await prisma.yachtWebsiteVisibility.findUnique({
    where: { yachtId_regionId: { yachtId, regionId } },
  });

  if (!entry) {
    const err = new Error('Visibility entry not found');
    err.status = 404;
    throw err;
  }

  await prisma.yachtWebsiteVisibility.delete({
    where: { yachtId_regionId: { yachtId, regionId } },
  });
}
