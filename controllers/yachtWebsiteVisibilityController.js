import * as visibilityService from '../services/yachtWebsiteVisibilityService.js';
import { logAudit } from '../utils/audit.js';

/**
 * GET /api/yachts/:id/website-visibility
 * Returns all websites (regions) this yacht is assigned to.
 */
export async function getVisibility(req, res, next) {
  try {
    const { id } = req.params;
    const data = await visibilityService.getYachtVisibility(id);
    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

/**
 * PUT /api/yachts/:id/website-visibility
 * Replaces the full list of website assignments for a yacht.
 * Body: { entries: [{ regionId, isVisible?, sortOrder? }] }
 */
export async function setVisibility(req, res, next) {
  try {
    const { id } = req.params;
    const { entries } = req.body;
    const data = await visibilityService.setYachtVisibility(id, entries);
    logAudit(req, {
      action: 'updated',
      module: 'yachts',
      entityType: 'YachtWebsiteVisibility',
      entityId: id,
      description: `Updated website visibility for yacht ${id}`,
    }).catch(() => {});
    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/yachts/:id/website-visibility/:regionId
 * Removes a yacht from a specific website.
 */
export async function removeVisibility(req, res, next) {
  try {
    const { id, regionId } = req.params;
    await visibilityService.removeYachtFromWebsite(id, regionId);
    logAudit(req, {
      action: 'deleted',
      module: 'yachts',
      entityType: 'YachtWebsiteVisibility',
      entityId: id,
      description: `Removed yacht ${id} from website/region ${regionId}`,
    }).catch(() => {});
    res.status(200).json({ success: true, message: 'Yacht removed from website' });
  } catch (err) {
    next(err);
  }
}
