import * as yachtMaintenanceService from '../services/yachtMaintenanceService.js';

/**
 * GET /api/yachts/:id/maintenance
 * List all maintenance records for a yacht.
 * Query params: maintenanceType, status, page, limit
 */
export async function getYachtMaintenance(req, res, next) {
  try {
    const { id } = req.params;
    const { maintenanceType, status, page, limit } = req.query;
    const result = await yachtMaintenanceService.getYachtMaintenance(id, {
      maintenanceType,
      status,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/yachts/:id/maintenance
 * Create a maintenance record for a yacht.
 * Body: { maintenanceType, description, scheduledDate, completedDate?, status?, cost?, performedBy?, notes? }
 */
export async function createYachtMaintenance(req, res, next) {
  try {
    const { id } = req.params;
    const maintenance = await yachtMaintenanceService.createYachtMaintenance(id, req.body);
    res.status(201).json(maintenance);
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/yachts/:id/maintenance/:mId
 * Update a maintenance record.
 * Body: Partial maintenance data
 */
export async function updateYachtMaintenance(req, res, next) {
  try {
    const { id, mId } = req.params;
    const maintenance = await yachtMaintenanceService.updateYachtMaintenance(id, mId, req.body);
    res.status(200).json(maintenance);
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/yachts/:id/maintenance/:mId
 * Delete a maintenance record.
 */
export async function deleteYachtMaintenance(req, res, next) {
  try {
    const { id, mId } = req.params;
    await yachtMaintenanceService.deleteYachtMaintenance(id, mId);
    res.status(200).json({ message: 'Maintenance record deleted successfully' });
  } catch (err) {
    next(err);
  }
}
