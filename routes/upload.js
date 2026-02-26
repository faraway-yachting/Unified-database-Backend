import express from 'express';
import * as uploadController from '../controllers/uploadController.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

// Upload routes (protected - require authentication)
router.post('/single', requireAuth, uploadController.uploadMiddleware.single('file'), uploadController.uploadSingle);
router.post('/multiple', requireAuth, uploadController.uploadMiddleware.array('files', 10), uploadController.uploadMultiple);

// File management routes
router.get('/files/presigned-url/:key', requireAuth, uploadController.getPresignedUrlForFile);
router.delete('/files/:key', requireAuth, uploadController.deleteFileFromS3);

export default router;
