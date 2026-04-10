/**
 * AWS S3 configuration.
 * Set AWS credentials via environment variables or AWS credentials file.
 */
export default {
  region: process.env.AWS_REGION || 'us-east-1',
  bucket: process.env.AWS_S3_BUCKET || '',
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  /** Base URL for public files (if bucket is public) or CDN URL */
  publicUrl: process.env.AWS_CLOUDFRONT_URL || process.env.AWS_S3_PUBLIC_URL || '',
  /** Default ACL for uploaded files: 'private' | 'public-read' | 'authenticated-read' */
  defaultAcl: process.env.AWS_S3_DEFAULT_ACL || 'private',
  /** Max file size in bytes (default: 10MB) */
  maxFileSize: parseInt(process.env.AWS_S3_MAX_FILE_SIZE || '10485760', 10),
  /** Allowed MIME types (empty array = allow all) */
  allowedMimeTypes: process.env.AWS_S3_ALLOWED_MIME_TYPES
    ? process.env.AWS_S3_ALLOWED_MIME_TYPES.split(',').map(t => t.trim())
    : [],
};
