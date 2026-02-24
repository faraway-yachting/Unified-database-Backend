import * as packageAddonService from '../services/packageAddonService.js';

/**
 * GET /api/packages/:id/addons
 * List add-ons for a package.
 */
export async function getAddons(req, res, next) {
  try {
    const { id } = req.params;
    const result = await packageAddonService.getAddons(id);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/packages/:id/addons
 * Create an add-on. Body: { name, description?, price, priceType?, isActive?, sortOrder? }
 */
export async function createAddon(req, res, next) {
  try {
    const { id } = req.params;
    const addon = await packageAddonService.createAddon(id, req.body);
    res.status(201).json(addon);
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/packages/:id/addons/:addonId
 * Update an add-on. Body: partial addon fields.
 */
export async function updateAddon(req, res, next) {
  try {
    const { id, addonId } = req.params;
    const addon = await packageAddonService.updateAddon(id, addonId, req.body);
    res.status(200).json(addon);
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/packages/:id/addons/:addonId
 * Delete an add-on.
 */
export async function deleteAddon(req, res, next) {
  try {
    const { id, addonId } = req.params;
    await packageAddonService.deleteAddon(id, addonId);
    res.status(200).json({ message: 'Add-on deleted successfully' });
  } catch (err) {
    next(err);
  }
}
