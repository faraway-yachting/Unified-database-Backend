import * as regionPackageService from '../services/regionPackageService.js';

/**
 * GET /api/regions/:id/packages
 * Get all packages assigned to a region.
 * Query params: isVisible, page, limit
 */
export async function getRegionPackages(req, res, next) {
  try {
    const { id } = req.params;
    const { isVisible, page, limit } = req.query;
    const result = await regionPackageService.getRegionPackages(id, {
      isVisible,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/regions/:id/packages
 * Assign a package to a region.
 * Body: { packageId, isVisible?, sortOrder? }
 */
export async function assignPackageToRegion(req, res, next) {
  try {
    const { id } = req.params;
    const { packageId, isVisible, sortOrder } = req.body;

    if (!packageId) {
      return res.status(400).json({ error: 'packageId is required' });
    }

    const result = await regionPackageService.assignPackageToRegion(id, packageId, {
      isVisible,
      sortOrder,
    });
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/regions/:id/packages/:packageId
 * Remove a package from a region.
 */
export async function removePackageFromRegion(req, res, next) {
  try {
    const { id, packageId } = req.params;
    await regionPackageService.removePackageFromRegion(id, packageId);
    res.status(200).json({ message: 'Package removed from region successfully' });
  } catch (err) {
    next(err);
  }
}
