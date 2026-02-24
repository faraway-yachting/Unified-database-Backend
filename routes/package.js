import express from 'express';
import * as packageController from '../controllers/packageController.js';
import * as packageRegionController from '../controllers/packageRegionController.js';
import * as packageIncludedServiceController from '../controllers/packageIncludedServiceController.js';
import * as packageAddonController from '../controllers/packageAddonController.js';
import * as packageMediaController from '../controllers/packageMediaController.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

router.get('/', requireAuth, packageController.listPackages);
router.post('/', requireAuth, packageController.createPackage);
// Region visibility (must be before /:id)
router.get('/:id/regions', requireAuth, packageRegionController.getRegionVisibility);
router.patch('/:id/regions', requireAuth, packageRegionController.updateRegionVisibilityBulk);
// Included services (must be before /:id)
router.get('/:id/services', requireAuth, packageIncludedServiceController.getIncludedServices);
router.post('/:id/services', requireAuth, packageIncludedServiceController.addIncludedService);
router.patch('/:id/services/:sId', requireAuth, packageIncludedServiceController.updateIncludedService);
router.delete('/:id/services/:sId', requireAuth, packageIncludedServiceController.removeIncludedService);
// Add-ons (must be before /:id)
router.get('/:id/addons', requireAuth, packageAddonController.getAddons);
router.post('/:id/addons', requireAuth, packageAddonController.createAddon);
router.patch('/:id/addons/:addonId', requireAuth, packageAddonController.updateAddon);
router.delete('/:id/addons/:addonId', requireAuth, packageAddonController.deleteAddon);
// Media (must be before /:id)
router.get('/:id/media', requireAuth, packageMediaController.getMedia);
router.post('/:id/media', requireAuth, packageMediaController.uploadMiddleware.fields([{ name: 'media', maxCount: 10 }, { name: 'file', maxCount: 1 }]), packageMediaController.uploadMedia);
router.patch('/:id/media/:mediaId', requireAuth, packageMediaController.updateMedia);
router.delete('/:id/media/:mediaId', requireAuth, packageMediaController.deleteMedia);
router.get('/:id', requireAuth, packageController.getPackageById);
router.patch('/:id/status', requireAuth, packageController.updatePackageStatus);
router.patch('/:id', requireAuth, packageController.updatePackage);
router.delete('/:id', requireAuth, packageController.deletePackage);

export default router;
