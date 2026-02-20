import multer from 'multer';
import * as yachtImageService from '../services/yachtImageService.js';

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  },
});

/**
 * Middleware for handling image uploads.
 */
export const uploadMiddleware = upload;

/**
 * GET /api/yachts/:id/images
 * List all images for a yacht.
 */
export async function getYachtImages(req, res, next) {
  try {
    const { id } = req.params;
    const images = await yachtImageService.getYachtImages(id);
    res.status(200).json({ images });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/yachts/:id/images
 * Upload image(s) for a yacht.
 * Body: multipart/form-data with 'images' field (array) or 'image' field (single)
 * Query params: isCover, caption, sortOrder
 */
export async function uploadYachtImages(req, res, next) {
  try {
    const { id } = req.params;
    const { isCover, caption, sortOrder } = req.body;

    // Handle both single file and multiple files
    // req.files is an object with field names as keys when using .fields()
    let files = [];
    if (req.files) {
      if (req.files.images) {
        files = Array.isArray(req.files.images) ? req.files.images : [req.files.images];
      } else if (req.files.image) {
        files = Array.isArray(req.files.image) ? req.files.image : [req.files.image];
      }
    } else if (req.file) {
      files = [req.file];
    }

    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'No images provided' });
    }

    const images = await yachtImageService.uploadYachtImages(id, files, {
      isCover: isCover === 'true' || isCover === true,
      caption,
      sortOrder,
    });

    res.status(201).json({
      message: `${images.length} image(s) uploaded successfully`,
      images,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/yachts/:id/images/:imageId
 * Update a yacht image.
 * Body: { caption?, isCover?, sortOrder? }
 */
export async function updateYachtImage(req, res, next) {
  try {
    const { id, imageId } = req.params;
    const { caption, isCover, sortOrder } = req.body;

    const image = await yachtImageService.updateYachtImage(id, imageId, {
      caption,
      isCover,
      sortOrder,
    });

    res.status(200).json(image);
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/yachts/:id/images/:imageId
 * Delete a yacht image.
 */
export async function deleteYachtImage(req, res, next) {
  try {
    const { id, imageId } = req.params;
    await yachtImageService.deleteYachtImage(id, imageId);
    res.status(200).json({ message: 'Image deleted successfully' });
  } catch (err) {
    next(err);
  }
}
