import express from 'express';
import * as regionController from '../controllers/regionController.js';
import * as regionPackageController from '../controllers/regionPackageController.js';
import * as regionYachtController from '../controllers/regionYachtController.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

// All region routes require authentication
router.get('/', requireAuth, regionController.listRegions);
router.post('/', requireAuth, regionController.createRegion);

// Package management routes (must be before /:id to avoid route conflicts)
router.get('/performance', requireAuth, regionController.getRegionPerformance);
router.get('/:id/packages', requireAuth, regionPackageController.getRegionPackages);
router.post('/:id/packages', requireAuth, regionPackageController.assignPackageToRegion);
router.delete('/:id/packages/:packageId', requireAuth, regionPackageController.removePackageFromRegion);

// Yacht management routes (must be before /:id to avoid route conflicts)
router.get('/:id/yachts', requireAuth, regionYachtController.getRegionYachts);
router.post('/:id/yachts', requireAuth, regionYachtController.assignYachtToRegion);

router.get('/:id', requireAuth, regionController.getRegionById);
router.patch('/:id', requireAuth, regionController.updateRegion);
router.delete('/:id', requireAuth, regionController.deleteRegion);

export default router;
