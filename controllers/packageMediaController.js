import multer from 'multer';
import * as packageMediaService from '../services/packageMediaService.js';

const ALLOWED_IMAGE = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const ALLOWED_VIDEO = ['video/mp4', 'video/webm', 'video/quicktime'];
const ALLOWED_BROCHURE = ['application/pdf'];
const ALLOWED_MIMES = [...ALLOWED_IMAGE, ...ALLOWED_VIDEO, ...ALLOWED_BROCHURE];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB for video
  fileFilter: (req, file, cb) => {
    if (ALLOWED_MIMES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${file.mimetype} not allowed. Allowed: images, video (mp4/webm), PDF`), false);
    }
  },
});

export const uploadMiddleware = upload;

/**
 * GET /api/packages/:id/media
 * List media for a package.
 */
export async function getMedia(req, res, next) {
  try {
    const { id } = req.params;
    const result = await packageMediaService.getMedia(id);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/packages/:id/media
 * Upload media. multipart: 'media' (array) or 'file' (single). Body/query: mediaType?, caption?, isCover?, sortOrder?
 */
export async function uploadMedia(req, res, next) {
  try {
    const { id } = req.params;
    const { mediaType, caption, isCover, sortOrder } = req.body;

    let files = [];
    if (req.files) {
      if (req.files.media) {
        files = Array.isArray(req.files.media) ? req.files.media : [req.files.media];
      } else if (req.files.file) {
        files = Array.isArray(req.files.file) ? req.files.file : [req.files.file];
      }
    } else if (req.file) {
      files = [req.file];
    }

    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'No media file provided' });
    }

    const media = await packageMediaService.uploadMedia(id, files, {
      mediaType: mediaType || undefined,
      caption,
      isCover: isCover === 'true' || isCover === true,
      sortOrder: sortOrder != null ? sortOrder : undefined,
    });

    res.status(201).json({
      message: `${media.length} file(s) uploaded successfully`,
      media,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/packages/:id/media/:mediaId
 * Update media metadata. Body: { mediaType?, caption?, isCover?, sortOrder? }
 */
export async function updateMedia(req, res, next) {
  try {
    const { id, mediaId } = req.params;
    const result = await packageMediaService.updateMedia(id, mediaId, req.body);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/packages/:id/media/:mediaId
 * Delete media (and file from storage if applicable).
 */
export async function deleteMedia(req, res, next) {
  try {
    const { id, mediaId } = req.params;
    await packageMediaService.deleteMedia(id, mediaId);
    res.status(200).json({ message: 'Media deleted successfully' });
  } catch (err) {
    next(err);
  }
}
