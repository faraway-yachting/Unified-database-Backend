import * as packageRegionService from '../services/packageRegionService.js';

/**
 * GET /api/packages/:id/regions
 * Get region visibility settings for a package.
 */
export async function getRegionVisibility(req, res, next) {
  try {
    const { id } = req.params;
    const result = await packageRegionService.getRegionVisibility(id);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/packages/:id/regions
 * Update region visibility in bulk. Body: { regions: [ { regionId, isVisible?, sortOrder? } ] }
 */
export async function updateRegionVisibilityBulk(req, res, next) {
  try {
    const { id } = req.params;
    const result = await packageRegionService.updateRegionVisibilityBulk(id, req.body);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}
