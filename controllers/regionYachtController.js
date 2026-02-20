import * as regionYachtService from '../services/regionYachtService.js';

/**
 * GET /api/regions/:id/yachts
 * Get all yachts assigned to a region.
 * Query params: status, isActive, page, limit
 */
export async function getRegionYachts(req, res, next) {
  try {
    const { id } = req.params;
    const { status, isActive, page, limit } = req.query;
    const result = await regionYachtService.getRegionYachts(id, {
      status,
      isActive,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/regions/:id/yachts
 * Assign a yacht to a region.
 * Body: { yachtId }
 */
export async function assignYachtToRegion(req, res, next) {
  try {
    const { id } = req.params;
    const { yachtId } = req.body;

    if (!yachtId) {
      return res.status(400).json({ error: 'yachtId is required' });
    }

    const result = await regionYachtService.assignYachtToRegion(id, yachtId);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}
