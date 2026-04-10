import { prisma } from '../config/database.js';
import { uploadFile, generateS3Key, validateFile, deleteFile as deleteS3File, getPresignedUrl, toCdnUrl, s3Config } from './s3Service.js';

const VALID_MEDIA_TYPES = ['image', 'video', 'brochure'];

/**
 * Infer mediaType from MIME type.
 * @param {string} mimetype
 * @returns {string} image | video | brochure
 */
function mediaTypeFromMime(mimetype) {
  if (mimetype.startsWith('image/')) return 'image';
  if (mimetype.startsWith('video/')) return 'video';
  if (mimetype === 'application/pdf') return 'brochure';
  return 'image';
}

/**
 * List media for a package.
 * @param {string} packageId - Package UUID
 * @returns {Promise<{ packageId: string, media: Array }>}
 */
export async function getMedia(packageId) {
  const pkg = await prisma.package.findUnique({
    where: { id: packageId },
  });

  if (!pkg) {
    const err = new Error('Package not found');
    err.status = 404;
    throw err;
  }

  const media = await prisma.packageMedia.findMany({
    where: { packageId },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
  });

  if (media.length) {
    await Promise.all(
      media.map(async (m) => {
        if (m.mediaType === 'brochure') {
          const key = extractS3KeyFromUrl(m.url, packageId);
          if (!key) return;
          try {
            m.url = await getPresignedUrl(key);
          } catch (_) {}
        } else {
          m.url = toCdnUrl(m.url);
        }
      })
    );
  }

  return {
    packageId: pkg.id,
    packageName: pkg.name,
    media,
  };
}

/**
 * Upload media file(s) for a package.
 * @param {string} packageId - Package UUID
 * @param {Array<{ buffer: Buffer, mimetype: string, originalname: string, size: number }>} files - File objects
 * @param {object} options - { mediaType?, caption?, isCover?, sortOrder? }
 * @returns {Promise<Array>}
 */
export async function uploadMedia(packageId, files, options = {}) {
  const { mediaType: optionMediaType, caption, isCover = false, sortOrder } = options;

  const pkg = await prisma.package.findUnique({
    where: { id: packageId },
  });

  if (!pkg) {
    const err = new Error('Package not found');
    err.status = 404;
    throw err;
  }

  if (!files || files.length === 0) {
    const err = new Error('No files provided');
    err.status = 400;
    throw err;
  }

  for (const file of files) {
    validateFile(file.size, file.mimetype);
  }

  if (optionMediaType && !VALID_MEDIA_TYPES.includes(optionMediaType)) {
    const err = new Error(`mediaType must be one of: ${VALID_MEDIA_TYPES.join(', ')}`);
    err.status = 400;
    throw err;
  }

  if (isCover) {
    await prisma.packageMedia.updateMany({
      where: { packageId, isCover: true },
      data: { isCover: false },
    });
  }

  const maxSortOrder = await prisma.packageMedia.findFirst({
    where: { packageId },
    orderBy: { sortOrder: 'desc' },
    select: { sortOrder: true },
  });
  let currentSortOrder = sortOrder != null ? parseInt(sortOrder, 10) : (maxSortOrder?.sortOrder ?? -1) + 1;

  const uploaded = [];
  for (const file of files) {
    const mediaType = optionMediaType || mediaTypeFromMime(file.mimetype);
    const s3Key = generateS3Key(file.originalname, `packages/${packageId}/media`);

    const s3Result = await uploadFile(file.buffer, s3Key, file.mimetype, {
      metadata: {
        packageId,
        originalName: file.originalname,
        mediaType,
      },
    });

    const media = await prisma.packageMedia.create({
      data: {
        packageId,
        mediaType,
        url: s3Result.url,
        caption: caption?.trim() || null,
        isCover: isCover && uploaded.length === 0,
        sortOrder: currentSortOrder++,
      },
    });

    uploaded.push(media);
  }

  // Brochures stay presigned (private); images and videos get CDN URLs
  await Promise.all(
    uploaded.map(async (m) => {
      if (m.mediaType === 'brochure') {
        const key = extractS3KeyFromUrl(m.url, packageId);
        if (!key) return;
        try {
          m.url = await getPresignedUrl(key);
        } catch (_) {}
      } else {
        m.url = toCdnUrl(m.url);
      }
    })
  );

  return uploaded;
}

/**
 * Update media metadata.
 * @param {string} packageId - Package UUID
 * @param {string} mediaId - PackageMedia UUID
 * @param {object} data - { mediaType?, caption?, isCover?, sortOrder? }
 * @returns {Promise<object>}
 */
export async function updateMedia(packageId, mediaId, data) {
  const { mediaType, caption, isCover, sortOrder } = data;

  const pkg = await prisma.package.findUnique({
    where: { id: packageId },
  });

  if (!pkg) {
    const err = new Error('Package not found');
    err.status = 404;
    throw err;
  }

  const media = await prisma.packageMedia.findFirst({
    where: {
      id: mediaId,
      packageId,
    },
  });

  if (!media) {
    const err = new Error('Media not found');
    err.status = 404;
    throw err;
  }

  const updateData = {};
  if (mediaType !== undefined) {
    if (!VALID_MEDIA_TYPES.includes(mediaType)) {
      const err = new Error(`mediaType must be one of: ${VALID_MEDIA_TYPES.join(', ')}`);
      err.status = 400;
      throw err;
    }
    updateData.mediaType = mediaType;
  }
  if (caption !== undefined) updateData.caption = caption?.trim() || null;
  if (sortOrder !== undefined) updateData.sortOrder = parseInt(sortOrder, 10);

  if (isCover !== undefined) {
    const newIsCover = isCover === 'true' || isCover === true;
    if (newIsCover && !media.isCover) {
      await prisma.packageMedia.updateMany({
        where: { packageId, isCover: true },
        data: { isCover: false },
      });
      updateData.isCover = true;
    } else if (!newIsCover) {
      updateData.isCover = false;
    }
  }

  const updated = await prisma.packageMedia.update({
    where: { id: mediaId },
    data: updateData,
  });

  return updated;
}

/**
 * Extract S3 key from package media URL.
 * @param {string} url
 * @param {string} packageId
 * @returns {string|null}
 */
function extractS3KeyFromUrl(url, packageId) {
  if (!url) return null;
  if (url.startsWith('s3://')) {
    const parts = url.replace('s3://', '').split('/');
    return parts.length > 1 ? parts.slice(1).join('/') : null;
  }
  // Public URL: .../packages/:id/media/filename.ext -> key packages/:id/media/filename.ext
  const match = url.match(/\/packages\/[^/]+\/media\/(.+)$/);
  if (match) return `packages/${packageId}/media/${match[1]}`;
  try {
    const u = new URL(url);
    const pathParts = u.pathname.split('/').filter(Boolean);
    const idx = pathParts.indexOf('packages');
    if (idx !== -1 && pathParts[idx + 1] === packageId && pathParts[idx + 2] === 'media' && pathParts[idx + 3]) {
      return pathParts.slice(idx).join('/');
    }
  } catch (_) {}
  return null;
}

/**
 * Delete media (and file from S3 if applicable).
 * @param {string} packageId - Package UUID
 * @param {string} mediaId - PackageMedia UUID
 * @returns {Promise<void>}
 */
export async function deleteMedia(packageId, mediaId) {
  const pkg = await prisma.package.findUnique({
    where: { id: packageId },
  });

  if (!pkg) {
    const err = new Error('Package not found');
    err.status = 404;
    throw err;
  }

  const media = await prisma.packageMedia.findFirst({
    where: {
      id: mediaId,
      packageId,
    },
  });

  if (!media) {
    const err = new Error('Media not found');
    err.status = 404;
    throw err;
  }

  const s3Key = extractS3KeyFromUrl(media.url, packageId);
  if (s3Key) {
    try {
      await deleteS3File(s3Key);
    } catch (s3Err) {
      console.warn(`Failed to delete S3 file ${s3Key}:`, s3Err.message);
    }
  }

  await prisma.packageMedia.delete({
    where: { id: mediaId },
  });
}
