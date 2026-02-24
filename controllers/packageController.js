import * as packageService from '../services/packageService.js';

/**
 * GET /api/packages
 * List packages. Query: region, durationType, status, minPrice, maxPrice, page, limit
 */
export async function listPackages(req, res, next) {
  try {
    const { region, durationType, status, minPrice, maxPrice, page, limit } = req.query;
    const result = await packageService.listPackages({
      regionId: region,
      durationType,
      status,
      minPrice,
      maxPrice,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/packages
 * Create package. Body: { name, durationType, basePrice, currencyCode, ... }
 */
export async function createPackage(req, res, next) {
  try {
    const pkg = await packageService.createPackage(req.body);
    res.status(201).json(pkg);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/packages/:id
 * Get package detail.
 */
export async function getPackageById(req, res, next) {
  try {
    const { id } = req.params;
    const pkg = await packageService.getPackageById(id);
    res.status(200).json(pkg);
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/packages/:id
 * Update package. Body: partial package fields.
 */
export async function updatePackage(req, res, next) {
  try {
    const { id } = req.params;
    const pkg = await packageService.updatePackage(id, req.body);
    res.status(200).json(pkg);
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/packages/:id
 * Delete package. Fails if package has bookings.
 */
export async function deletePackage(req, res, next) {
  try {
    const { id } = req.params;
    await packageService.deletePackage(id);
    res.status(200).json({ message: 'Package deleted successfully' });
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/packages/:id/status
 * Toggle status: active | draft | archived. Body: { status }
 */
export async function updatePackageStatus(req, res, next) {
  try {
    const { id } = req.params;
    const pkg = await packageService.updatePackageStatus(id, req.body);
    res.status(200).json(pkg);
  } catch (err) {
    next(err);
  }
}
