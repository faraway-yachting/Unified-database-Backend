import multer from 'multer';
import { uploadFile, generateS3Key, validateFile, getPresignedUrl, deleteFile } from '../services/s3Service.js';

// Configure multer for memory storage (file in memory as Buffer)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
});

/**
 * Middleware for handling file uploads.
 * Use: router.post('/upload', upload.single('file'), uploadController.upload);
 */
export const uploadMiddleware = upload;

/**
 * POST /api/upload
 * Upload a single file to S3.
 * Body: multipart/form-data with 'file' field
 * Returns: { key, url, bucket }
 */
export async function uploadSingle(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    const { buffer, originalname, mimetype, size } = req.file;

    // Validate file
    validateFile(size, mimetype);

    // Generate S3 key (path)
    const prefix = req.body?.prefix || 'uploads'; // Optional prefix from body
    const key = generateS3Key(originalname, prefix);

    // Upload to S3
    const result = await uploadFile(buffer, key, mimetype, {
      metadata: {
        originalName: originalname,
        uploadedBy: req.user?.id || 'anonymous',
      },
    });

    res.status(200).json({
      message: 'File uploaded successfully',
      ...result,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/upload/multiple
 * Upload multiple files to S3.
 * Body: multipart/form-data with 'files' field (array)
 * Returns: { files: [{ key, url, bucket }] }
 */
export async function uploadMultiple(req, res, next) {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files provided' });
    }

    const prefix = req.body?.prefix || 'uploads';
    const uploadPromises = req.files.map(async (file) => {
      validateFile(file.size, file.mimetype);
      const key = generateS3Key(file.originalname, prefix);
      return uploadFile(file.buffer, key, file.mimetype, {
        metadata: {
          originalName: file.originalname,
          uploadedBy: req.user?.id || 'anonymous',
        },
      });
    });

    const results = await Promise.all(uploadPromises);

    res.status(200).json({
      message: `${results.length} file(s) uploaded successfully`,
      files: results,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/files/:key/presigned-url
 * Get a presigned URL for private file access.
 * Query: ?expiresIn=3600 (optional, default: 1 hour)
 */
export async function getPresignedUrlForFile(req, res, next) {
  try {
    const { key } = req.params;
    const expiresIn = parseInt(req.query.expiresIn || '3600', 10);

    const url = await getPresignedUrl(key, expiresIn);

    res.status(200).json({
      url,
      expiresIn,
      key,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/files/:key
 * Delete a file from S3.
 */
export async function deleteFileFromS3(req, res, next) {
  try {
    const { key } = req.params;

    await deleteFile(key);

    res.status(200).json({
      message: 'File deleted successfully',
      key,
    });
  } catch (err) {
    next(err);
  }
}
