import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import s3Config from '../config/s3.js';

// Initialize S3 client
const s3Client = s3Config.accessKeyId && s3Config.secretAccessKey
  ? new S3Client({
      region: s3Config.region,
      credentials: {
        accessKeyId: s3Config.accessKeyId,
        secretAccessKey: s3Config.secretAccessKey,
      },
    })
  : new S3Client({
      region: s3Config.region,
      // Uses default AWS credentials (from ~/.aws/credentials or IAM role)
    });

/**
 * Upload a file to S3.
 * @param {Buffer|Uint8Array|string} fileContent - File content (Buffer, Uint8Array, or string)
 * @param {string} key - S3 object key (path/filename)
 * @param {string} contentType - MIME type (e.g. 'image/jpeg', 'application/pdf')
 * @param {object} options - Additional options: { acl, metadata, cacheControl }
 * @returns {Promise<{ key: string, url: string, bucket: string }>}
 */
export async function uploadFile(fileContent, key, contentType, options = {}) {
  if (!s3Config.bucket) {
    throw new Error('AWS_S3_BUCKET is not configured');
  }

  const putParams = {
    Bucket: s3Config.bucket,
    Key: key,
    Body: fileContent,
    ContentType: contentType,
    Metadata: options.metadata || {},
  };
  if (options.cacheControl) putParams.CacheControl = options.cacheControl;
  const acl = options.acl || s3Config.defaultAcl;
  if (acl && acl !== 'private' && acl !== '') putParams.ACL = acl;

  const command = new PutObjectCommand(putParams);

  await s3Client.send(command);

  const url = s3Config.publicUrl
    ? `${s3Config.publicUrl.replace(/\/$/, '')}/${key}`
    : `s3://${s3Config.bucket}/${key}`;

  return {
    key,
    url,
    bucket: s3Config.bucket,
  };
}

/**
 * Delete a file from S3.
 * @param {string} key - S3 object key
 * @returns {Promise<void>}
 */
export async function deleteFile(key) {
  if (!s3Config.bucket) {
    throw new Error('AWS_S3_BUCKET is not configured');
  }

  const command = new DeleteObjectCommand({
    Bucket: s3Config.bucket,
    Key: key,
  });

  await s3Client.send(command);
}

/**
 * Get a presigned URL for private file access (temporary URL).
 * @param {string} key - S3 object key
 * @param {number} expiresIn - URL expiration in seconds (default: 3600 = 1 hour)
 * @returns {Promise<string>}
 */
export async function getPresignedUrl(key, expiresIn = 3600) {
  if (!s3Config.bucket) {
    throw new Error('AWS_S3_BUCKET is not configured');
  }

  const command = new GetObjectCommand({
    Bucket: s3Config.bucket,
    Key: key,
  });

  return getSignedUrl(s3Client, command, { expiresIn });
}

/**
 * Check if a file exists in S3.
 * @param {string} key - S3 object key
 * @returns {Promise<{ exists: boolean, size?: number, contentType?: string, lastModified?: Date }>}
 */
export async function fileExists(key) {
  if (!s3Config.bucket) {
    throw new Error('AWS_S3_BUCKET is not configured');
  }

  try {
    const command = new HeadObjectCommand({
      Bucket: s3Config.bucket,
      Key: key,
    });

    const response = await s3Client.send(command);
    return {
      exists: true,
      size: response.ContentLength,
      contentType: response.ContentType,
      lastModified: response.LastModified,
    };
  } catch (error) {
    if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
      return { exists: false };
    }
    throw error;
  }
}

/**
 * Generate a unique S3 key with optional prefix and timestamp.
 * @param {string} filename - Original filename
 * @param {string} prefix - Optional folder prefix (e.g. 'uploads/images')
 * @returns {string} - S3 key
 */
export function generateS3Key(filename, prefix = '') {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 15);
  const ext = filename.includes('.') ? filename.substring(filename.lastIndexOf('.')) : '';
  const baseName = filename.includes('.')
    ? filename.substring(0, filename.lastIndexOf('.'))
    : filename;
  const sanitized = baseName.replace(/[^a-zA-Z0-9-_]/g, '_').substring(0, 50);

  const key = `${sanitized}_${timestamp}_${random}${ext}`;
  return prefix ? `${prefix.replace(/\/$/, '')}/${key}` : key;
}

/**
 * Validate file before upload (size and MIME type).
 * @param {number} fileSize - File size in bytes
 * @param {string} mimeType - MIME type
 * @throws {Error} If validation fails
 */
export function validateFile(fileSize, mimeType) {
  if (fileSize > s3Config.maxFileSize) {
    throw new Error(`File size exceeds maximum allowed size of ${s3Config.maxFileSize} bytes`);
  }

  if (s3Config.allowedMimeTypes.length > 0 && !s3Config.allowedMimeTypes.includes(mimeType)) {
    throw new Error(`File type ${mimeType} is not allowed. Allowed types: ${s3Config.allowedMimeTypes.join(', ')}`);
  }
}

export { s3Client, s3Config };
