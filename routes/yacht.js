import express from 'express';
import multer from 'multer';
import * as yachtController from '../controllers/yachtController.js';
import * as yachtImageController from '../controllers/yachtImageController.js';
import * as yachtAmenityController from '../controllers/yachtAmenityController.js';
import * as yachtDocumentController from '../controllers/yachtDocumentController.js';
import * as yachtMaintenanceController from '../controllers/yachtMaintenanceController.js';
import * as yachtAvailabilityController from '../controllers/yachtAvailabilityController.js';
import * as yachtWebsiteVisibilityController from '../controllers/yachtWebsiteVisibilityController.js';
import { requireAuth } from '../middleware/auth.js';

const upload = multer({ storage: multer.memoryStorage() });

const router = express.Router();

// All yacht routes require authentication
router.get('/', requireAuth, yachtController.listYachts);
router.post('/', requireAuth, yachtController.createYacht);

// Image management routes (must be before /:id to avoid route conflicts)
router.get('/:id/images', requireAuth, yachtImageController.getYachtImages);
router.post('/:id/images', requireAuth, yachtImageController.uploadMiddleware.fields([{ name: 'images', maxCount: 10 }, { name: 'image', maxCount: 1 }]), yachtImageController.uploadYachtImages);
router.patch('/:id/images/:imageId', requireAuth, yachtImageController.updateYachtImage);
router.delete('/:id/images/:imageId', requireAuth, yachtImageController.deleteYachtImage);

// Amenity management routes (must be before /:id to avoid route conflicts)
router.get('/:id/amenities', requireAuth, yachtAmenityController.getYachtAmenities);
router.post('/:id/amenities', requireAuth, yachtAmenityController.addYachtAmenity);
router.patch('/:id/amenities/:amenityId', requireAuth, yachtAmenityController.updateYachtAmenity);
router.delete('/:id/amenities/:amenityId', requireAuth, yachtAmenityController.removeYachtAmenity);

// Document management routes (must be before /:id to avoid route conflicts)
router.get('/:id/documents', requireAuth, yachtDocumentController.getYachtDocuments);
router.post('/:id/documents', requireAuth, yachtDocumentController.uploadMiddleware.single('file'), yachtDocumentController.uploadYachtDocument);
router.patch('/:id/documents/:docId', requireAuth, yachtDocumentController.updateYachtDocument);
router.delete('/:id/documents/:docId', requireAuth, yachtDocumentController.deleteYachtDocument);

// Maintenance management routes (must be before /:id to avoid route conflicts)
router.get('/:id/maintenance', requireAuth, yachtMaintenanceController.getYachtMaintenance);
router.post('/:id/maintenance', requireAuth, yachtMaintenanceController.createYachtMaintenance);
router.patch('/:id/maintenance/:mId', requireAuth, yachtMaintenanceController.updateYachtMaintenance);
router.delete('/:id/maintenance/:mId', requireAuth, yachtMaintenanceController.deleteYachtMaintenance);

// Availability / blackout routes (check and block before :blockId)
router.get('/:id/availability/check', requireAuth, yachtAvailabilityController.checkAvailability);
router.post('/:id/availability/block', requireAuth, yachtAvailabilityController.addBlock);
router.get('/:id/availability', requireAuth, yachtAvailabilityController.getAvailability);
router.delete('/:id/availability/:blockId', requireAuth, yachtAvailabilityController.removeBlock);

// Website visibility routes
router.get('/:id/website-visibility', requireAuth, yachtWebsiteVisibilityController.getVisibility);
router.put('/:id/website-visibility', requireAuth, yachtWebsiteVisibilityController.setVisibility);
router.delete('/:id/website-visibility/:regionId', requireAuth, yachtWebsiteVisibilityController.removeVisibility);

// Detail route (must be before /:id)
router.get('/:id/detail', requireAuth, yachtController.getYachtDetail);

router.get('/:id', requireAuth, yachtController.getYachtById);
router.patch('/:id', requireAuth, upload.fields([{ name: 'primary_image', maxCount: 1 }, { name: 'gallery_images', maxCount: 30 }]), yachtController.updateYacht);
router.delete('/:id', requireAuth, yachtController.softDeleteYacht);
router.patch('/:id/status', requireAuth, yachtController.updateYachtStatus);

export default router;
