import express from 'express';
import multer from 'multer';
import * as blogController from '../controllers/blogController.js';
import { requireAuth } from '../middleware/auth.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fieldSize: 20 * 1024 * 1024 }, // 20 MB per field (for base64 content in detailed_description)
});

const router = express.Router();

// All blog routes require authentication
router.get('/', requireAuth, blogController.listBlogs);
router.post('/', requireAuth, upload.fields([{ name: 'primary_image', maxCount: 1 }]), blogController.createBlog);

// Status and content image upload routes must come before /:id
router.patch('/:id/status', requireAuth, blogController.updateBlogStatus);
router.post('/:id/upload-image', requireAuth, upload.fields([{ name: 'image', maxCount: 1 }]), blogController.uploadContentImage);

router.get('/:id', requireAuth, blogController.getBlogById);
router.patch('/:id', requireAuth, upload.fields([{ name: 'primary_image', maxCount: 1 }]), blogController.updateBlog);
router.delete('/:id', requireAuth, blogController.deleteBlog);

export default router;
