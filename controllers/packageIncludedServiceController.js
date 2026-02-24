import * as packageIncludedService from '../services/packageIncludedService.js';

/**
 * GET /api/packages/:id/services
 * List included services for a package.
 */
export async function getIncludedServices(req, res, next) {
  try {
    const { id } = req.params;
    const result = await packageIncludedService.getIncludedServices(id);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/packages/:id/services
 * Add an included service. Body: { serviceName, isIncluded?, notes? }
 */
export async function addIncludedService(req, res, next) {
  try {
    const { id } = req.params;
    const service = await packageIncludedService.addIncludedService(id, req.body);
    res.status(201).json(service);
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/packages/:id/services/:sId
 * Update an included service. Body: { serviceName?, isIncluded?, notes? }
 */
export async function updateIncludedService(req, res, next) {
  try {
    const { id, sId } = req.params;
    const service = await packageIncludedService.updateIncludedService(id, sId, req.body);
    res.status(200).json(service);
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/packages/:id/services/:sId
 * Remove an included service from a package.
 */
export async function removeIncludedService(req, res, next) {
  try {
    const { id, sId } = req.params;
    await packageIncludedService.removeIncludedService(id, sId);
    res.status(200).json({ message: 'Included service removed successfully' });
  } catch (err) {
    next(err);
  }
}
