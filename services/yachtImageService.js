import { prisma } from '../config/database.js';
import { uploadFile, generateS3Key, validateFile, deleteFile as deleteS3File, getPresignedUrl, s3Config } from './s3Service.js';

/**
 * Get all images for a yacht.
 * @param {string} yachtId - Yacht UUID
 * @returns {Promise<Array>}
 */
export async function getYachtImages(yachtId) {
  // Verify yacht exists
  const yacht = await prisma.yacht.findUnique({
    where: { id: yachtId },
  });

  if (!yacht) {
    const err = new Error('Yacht not found');
    err.status = 404;
    throw err;
  }

  const images = await prisma.yachtImage.findMany({
    where: { yachtId },
    orderBy: [
      { sortOrder: 'asc' },
      { createdAt: 'asc' },
    ],
  });

  return images;
}

/**
 * Upload image(s) for a yacht.
 * @param {string} yachtId - Yacht UUID
 * @param {Array<{ buffer: Buffer, mimetype: string, originalname: string, size: number }>} files - File objects
 * @param {object} options - { isCover, caption, sortOrder }
 * @returns {Promise<Array>}
 */
export async function uploadYachtImages(yachtId, files, options = {}) {
  const { isCover = false, caption, sortOrder } = options;

  // Verify yacht exists
  const yacht = await prisma.yacht.findUnique({
    where: { id: yachtId },
  });

  if (!yacht) {
    const err = new Error('Yacht not found');
    err.status = 404;
    throw err;
  }

  if (!files || files.length === 0) {
    const err = new Error('No files provided');
    err.status = 400;
    throw err;
  }

  // Validate all files
  for (const file of files) {
    validateFile(file.size, file.mimetype);
    if (!file.mimetype.startsWith('image/')) {
      const err = new Error(`File ${file.originalname} is not an image`);
      err.status = 400;
      throw err;
    }
  }

  // If setting cover, unset existing cover
  if (isCover) {
    await prisma.yachtImage.updateMany({
      where: { yachtId, isCover: true },
      data: { isCover: false },
    });
  }

  // Get current max sortOrder
  const maxSortOrder = await prisma.yachtImage.findFirst({
    where: { yachtId },
    orderBy: { sortOrder: 'desc' },
    select: { sortOrder: true },
  });
  let currentSortOrder = sortOrder !== undefined ? parseInt(sortOrder, 10) : (maxSortOrder?.sortOrder ?? -1) + 1;

  // Upload files and create image records
  const uploadedImages = [];
  for (const file of files) {
    const s3Key = generateS3Key(file.originalname, `yachts/Gallery-Images/${yachtId}`);
    
    // Upload to S3
    const s3Result = await uploadFile(file.buffer, s3Key, file.mimetype, {
      metadata: {
        yachtId,
        originalName: file.originalname,
      },
    });

    // Create image record
    const image = await prisma.yachtImage.create({
      data: {
        yachtId,
        imageUrl: s3Result.url,
        caption: caption || null,
        isCover: isCover && uploadedImages.length === 0, // Only first image if isCover
        sortOrder: currentSortOrder++,
      },
    });

    uploadedImages.push(image);
  }

  if (s3Config.bucket) {
    await Promise.all(
      uploadedImages.map(async (img) => {
        const key = extractS3KeyFromUrl(img.imageUrl);
        if (!key) return;
        try {
          img.imageUrl = await getPresignedUrl(key);
        } catch (_) {
          // Keep original URL if signing fails
        }
      })
    );
  }

  return uploadedImages;
}

function extractS3KeyFromUrl(url) {
  if (!url) return null;
  if (url.startsWith('s3://')) {
    const parts = url.replace('s3://', '').split('/');
    return parts.length > 1 ? parts.slice(1).join('/') : null;
  }
  try {
    const u = new URL(url);
    const pathParts = u.pathname.split('/').filter(Boolean);
    if (pathParts.length === 0) return null;
    if (s3Config.bucket && pathParts[0] === s3Config.bucket) {
      return pathParts.slice(1).join('/');
    }
    return pathParts.join('/');
  } catch (_) {
    return null;
  }
}

/**
 * Update a yacht image.
 * @param {string} yachtId - Yacht UUID
 * @param {string} imageId - Image UUID
 * @param {object} data - { caption, isCover, sortOrder }
 * @returns {Promise<object>}
 */
export async function updateYachtImage(yachtId, imageId, data) {
  const { caption, isCover, sortOrder } = data;

  // Verify yacht exists
  const yacht = await prisma.yacht.findUnique({
    where: { id: yachtId },
  });

  if (!yacht) {
    const err = new Error('Yacht not found');
    err.status = 404;
    throw err;
  }

  // Verify image exists and belongs to yacht
  const image = await prisma.yachtImage.findFirst({
    where: {
      id: imageId,
      yachtId,
    },
  });

  if (!image) {
    const err = new Error('Image not found');
    err.status = 404;
    throw err;
  }

  const updateData = {};

  if (caption !== undefined) updateData.caption = caption;
  if (sortOrder !== undefined) updateData.sortOrder = parseInt(sortOrder, 10);

  // Handle cover image update
  if (isCover !== undefined) {
    const newIsCover = isCover === 'true' || isCover === true;
    if (newIsCover && !image.isCover) {
      // Unset existing cover
      await prisma.yachtImage.updateMany({
        where: { yachtId, isCover: true },
        data: { isCover: false },
      });
      updateData.isCover = true;
    } else if (!newIsCover) {
      updateData.isCover = false;
    }
  }

  const updatedImage = await prisma.yachtImage.update({
    where: { id: imageId },
    data: updateData,
  });

  return updatedImage;
}

/**
 * Delete a yacht image.
 * @param {string} yachtId - Yacht UUID
 * @param {string} imageId - Image UUID
 * @returns {Promise<void>}
 */
export async function deleteYachtImage(yachtId, imageId) {
  // Verify yacht exists
  const yacht = await prisma.yacht.findUnique({
    where: { id: yachtId },
  });

  if (!yacht) {
    const err = new Error('Yacht not found');
    err.status = 404;
    throw err;
  }

  // Verify image exists and belongs to yacht
  const image = await prisma.yachtImage.findFirst({
    where: {
      id: imageId,
      yachtId,
    },
  });

  if (!image) {
    const err = new Error('Image not found');
    err.status = 404;
    throw err;
  }

  // Extract S3 key from imageUrl (if it's an S3 URL)
  const imageUrl = image.imageUrl;
  let s3Key = null;

  if (imageUrl.startsWith('s3://')) {
    // s3://bucket/key format
    const parts = imageUrl.replace('s3://', '').split('/');
    if (parts.length > 1) {
      s3Key = parts.slice(1).join('/');
    }
  } else if (imageUrl.includes('.s3.') || imageUrl.includes('s3.amazonaws.com')) {
    // https://bucket.s3.region.amazonaws.com/key or https://s3.amazonaws.com/bucket/key
    try {
      const url = new URL(imageUrl);
      const pathParts = url.pathname.split('/').filter(p => p);
      if (pathParts.length > 1) {
        s3Key = pathParts.slice(1).join('/');
      } else if (pathParts.length === 1) {
        s3Key = pathParts[0];
      }
    } catch (e) {
      // If URL parsing fails, try to extract from pathname
      const match = imageUrl.match(/\/yachts\/Gallery-Images\/[^/]+\/(.+)$/) || imageUrl.match(/\/yachts\/[^/]+\/images\/(.+)$/);
      if (match) {
        s3Key = `yachts/Gallery-Images/${yachtId}/${match[1]}`;
      }
    }
  } else {
    // Try to extract key from custom public URL
    const match = imageUrl.match(/\/yachts\/[^/]+\/images\/(.+)$/);
    if (match) {
      s3Key = `yachts/${yachtId}/images/${match[1]}`;
    }
  }

  // Delete from S3 if key found
  if (s3Key) {
    try {
      await deleteS3File(s3Key);
    } catch (s3Err) {
      console.warn(`Failed to delete S3 file ${s3Key}:`, s3Err.message);
      // Continue with DB deletion even if S3 deletion fails
    }
  }

  // Delete from database
  await prisma.yachtImage.delete({
    where: { id: imageId },
  });
}
