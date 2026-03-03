import * as regionService from '../services/regionService.js';

/**
 * GET /api/regions
 * List all regions with optional filtering and pagination.
 * Query params: status, page, limit, includeCurrency
 */
export async function listRegions(req, res, next) {
  try {
    const { status, page, limit, includeCurrency } = req.query;
    const result = await regionService.listRegions({
      status,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      includeCurrency: includeCurrency !== 'false',
    });
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/regions/performance
 * Get region performance aggregated by revenue and bookings.
 */
export async function getRegionPerformance(req, res, next) {
  try {
    const result = await regionService.getRegionPerformance();
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/regions/:id
 * Get a single region by ID.
 */
export async function getRegionById(req, res, next) {
  try {
    const { id } = req.params;
    const region = await regionService.getRegionById(id);
    res.status(200).json(region);
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/regions
 * Create a new region.
 * Body: { name, slug?, siteUrl?, country, currencyCode, languageCode?, contactEmail?, contactPhone?, metaTitle?, metaDescription?, heroImageUrl?, status? }
 */
export async function createRegion(req, res, next) {
  try {
    const region = await regionService.createRegion(req.body);
    res.status(201).json(region);
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/regions/:id
 * Update a region.
 * Body: Partial region data
 */
export async function updateRegion(req, res, next) {
  try {
    const { id } = req.params;
    const region = await regionService.updateRegion(id, req.body);
    res.status(200).json(region);
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/regions/:id
 * Delete a region.
 */
export async function deleteRegion(req, res, next) {
  try {
    const { id } = req.params;
    await regionService.deleteRegion(id);
    res.status(200).json({ message: 'Region deleted successfully' });
  } catch (err) {
    next(err);
  }
}
