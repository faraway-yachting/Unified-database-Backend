import { prisma } from '../config/database.js';
import { uploadFile, generateS3Key, validateFile, deleteFile as deleteS3File, getPresignedUrl, s3Config } from './s3Service.js';

const VALID_DOCUMENT_TYPES = ['insurance', 'registration', 'certificate', 'inspection'];

/**
 * Get all documents for a yacht.
 * @param {string} yachtId - Yacht UUID
 * @param {object} options - { documentType, isExpired }
 * @returns {Promise<Array>}
 */
export async function getYachtDocuments(yachtId, options = {}) {
  const { documentType, isExpired } = options;

  // Verify yacht exists
  const yacht = await prisma.yacht.findUnique({
    where: { id: yachtId },
  });

  if (!yacht) {
    const err = new Error('Yacht not found');
    err.status = 404;
    throw err;
  }

  const where = { yachtId };
  if (documentType) where.documentType = documentType;
  if (isExpired !== undefined) {
    where.isExpired = isExpired === 'true' || isExpired === true;
  }

  const documents = await prisma.yachtDocument.findMany({
    where,
    orderBy: [
      { documentType: 'asc' },
      { issuedDate: 'desc' },
    ],
  });

  return documents;
}

/**
 * Upload a document for a yacht.
 * @param {string} yachtId - Yacht UUID
 * @param {{ buffer: Buffer, mimetype: string, originalname: string, size: number }} file - File object
 * @param {object} data - { documentType, issuedDate?, expiryDate?, notes? }
 * @returns {Promise<object>}
 */
export async function uploadYachtDocument(yachtId, file, data) {
  const { documentType, issuedDate, expiryDate, notes } = data;

  // Validate required fields
  if (!documentType) {
    const err = new Error('documentType is required');
    err.status = 400;
    throw err;
  }

  // Validate documentType
  if (!VALID_DOCUMENT_TYPES.includes(documentType)) {
    const err = new Error(`documentType must be one of: ${VALID_DOCUMENT_TYPES.join(', ')}`);
    err.status = 400;
    throw err;
  }

  // Verify yacht exists
  const yacht = await prisma.yacht.findUnique({
    where: { id: yachtId },
  });

  if (!yacht) {
    const err = new Error('Yacht not found');
    err.status = 404;
    throw err;
  }

  if (!file) {
    const err = new Error('No file provided');
    err.status = 400;
    throw err;
  }

  // Validate file
  validateFile(file.size, file.mimetype);

  // Parse dates
  let parsedIssuedDate = null;
  let parsedExpiryDate = null;
  if (issuedDate) {
    parsedIssuedDate = new Date(issuedDate);
    if (isNaN(parsedIssuedDate.getTime())) {
      const err = new Error('Invalid issuedDate format');
      err.status = 400;
      throw err;
    }
  }
  if (expiryDate) {
    parsedExpiryDate = new Date(expiryDate);
    if (isNaN(parsedExpiryDate.getTime())) {
      const err = new Error('Invalid expiryDate format');
      err.status = 400;
      throw err;
    }
  }

  // Check if expired
  const isExpired = parsedExpiryDate ? parsedExpiryDate < new Date() : false;

  // Upload to S3
  const s3Key = generateS3Key(file.originalname, `yachts/${yachtId}/documents`);
  const s3Result = await uploadFile(file.buffer, s3Key, file.mimetype, {
    metadata: {
      yachtId,
      documentType,
      originalName: file.originalname,
    },
  });

  // Create document record
  const document = await prisma.yachtDocument.create({
    data: {
      yachtId,
      documentType,
      documentUrl: s3Result.url,
      issuedDate: parsedIssuedDate,
      expiryDate: parsedExpiryDate,
      isExpired,
      notes: notes || null,
    },
  });

  if (s3Config.bucket) {
    const key = extractS3KeyFromUrl(document.documentUrl, yachtId);
    if (key) {
      try {
        document.documentUrl = await getPresignedUrl(key);
      } catch (_) {
        // Keep original URL if signing fails
      }
    }
  }

  return document;
}

function extractS3KeyFromUrl(documentUrl, yachtId) {
  if (!documentUrl) return null;
  if (documentUrl.startsWith('s3://')) {
    const parts = documentUrl.replace('s3://', '').split('/');
    return parts.length > 1 ? parts.slice(1).join('/') : null;
  }
  if (documentUrl.includes('.s3.') || documentUrl.includes('s3.amazonaws.com')) {
    try {
      const url = new URL(documentUrl);
      const pathParts = url.pathname.split('/').filter(Boolean);
      if (pathParts.length === 0) return null;
      if (s3Config.bucket && pathParts[0] === s3Config.bucket) {
        return pathParts.slice(1).join('/');
      }
      return pathParts.join('/');
    } catch (_) {
      const match = documentUrl.match(/\/yachts\/[^/]+\/documents\/(.+)$/);
      if (match) return `yachts/${yachtId}/documents/${match[1]}`;
    }
  } else {
    const match = documentUrl.match(/\/yachts\/[^/]+\/documents\/(.+)$/);
    if (match) return `yachts/${yachtId}/documents/${match[1]}`;
  }
  return null;
}

/**
 * Update a yacht document.
 * @param {string} yachtId - Yacht UUID
 * @param {string} documentId - Document UUID
 * @param {object} data - { documentType?, issuedDate?, expiryDate?, notes? }
 * @returns {Promise<object>}
 */
export async function updateYachtDocument(yachtId, documentId, data) {
  const { documentType, issuedDate, expiryDate, notes } = data;

  // Verify yacht exists
  const yacht = await prisma.yacht.findUnique({
    where: { id: yachtId },
  });

  if (!yacht) {
    const err = new Error('Yacht not found');
    err.status = 404;
    throw err;
  }

  // Verify document exists and belongs to yacht
  const document = await prisma.yachtDocument.findFirst({
    where: {
      id: documentId,
      yachtId,
    },
  });

  if (!document) {
    const err = new Error('Document not found');
    err.status = 404;
    throw err;
  }

  const updateData = {};

  if (documentType !== undefined) {
    if (!VALID_DOCUMENT_TYPES.includes(documentType)) {
      const err = new Error(`documentType must be one of: ${VALID_DOCUMENT_TYPES.join(', ')}`);
      err.status = 400;
      throw err;
    }
    updateData.documentType = documentType;
  }

  if (issuedDate !== undefined) {
    if (issuedDate === null) {
      updateData.issuedDate = null;
    } else {
      const parsed = new Date(issuedDate);
      if (isNaN(parsed.getTime())) {
        const err = new Error('Invalid issuedDate format');
        err.status = 400;
        throw err;
      }
      updateData.issuedDate = parsed;
    }
  }

  if (expiryDate !== undefined) {
    if (expiryDate === null) {
      updateData.expiryDate = null;
      updateData.isExpired = false;
    } else {
      const parsed = new Date(expiryDate);
      if (isNaN(parsed.getTime())) {
        const err = new Error('Invalid expiryDate format');
        err.status = 400;
        throw err;
      }
      updateData.expiryDate = parsed;
      updateData.isExpired = parsed < new Date();
    }
  }

  if (notes !== undefined) {
    updateData.notes = notes || null;
  }

  const updatedDocument = await prisma.yachtDocument.update({
    where: { id: documentId },
    data: updateData,
  });

  return updatedDocument;
}

/**
 * Delete a yacht document.
 * @param {string} yachtId - Yacht UUID
 * @param {string} documentId - Document UUID
 * @returns {Promise<void>}
 */
export async function deleteYachtDocument(yachtId, documentId) {
  // Verify yacht exists
  const yacht = await prisma.yacht.findUnique({
    where: { id: yachtId },
  });

  if (!yacht) {
    const err = new Error('Yacht not found');
    err.status = 404;
    throw err;
  }

  // Verify document exists and belongs to yacht
  const document = await prisma.yachtDocument.findFirst({
    where: {
      id: documentId,
      yachtId,
    },
  });

  if (!document) {
    const err = new Error('Document not found');
    err.status = 404;
    throw err;
  }

  // Extract S3 key from documentUrl (similar to image deletion)
  const documentUrl = document.documentUrl;
  let s3Key = null;

  if (documentUrl.startsWith('s3://')) {
    const parts = documentUrl.replace('s3://', '').split('/');
    if (parts.length > 1) {
      s3Key = parts.slice(1).join('/');
    }
  } else if (documentUrl.includes('.s3.') || documentUrl.includes('s3.amazonaws.com')) {
    try {
      const url = new URL(documentUrl);
      const pathParts = url.pathname.split('/').filter(p => p);
      if (pathParts.length > 1) {
        s3Key = pathParts.slice(1).join('/');
      } else if (pathParts.length === 1) {
        s3Key = pathParts[0];
      }
    } catch (e) {
      const match = documentUrl.match(/\/yachts\/[^/]+\/documents\/(.+)$/);
      if (match) {
        s3Key = `yachts/${yachtId}/documents/${match[1]}`;
      }
    }
  } else {
    const match = documentUrl.match(/\/yachts\/[^/]+\/documents\/(.+)$/);
    if (match) {
      s3Key = `yachts/${yachtId}/documents/${match[1]}`;
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
  await prisma.yachtDocument.delete({
    where: { id: documentId },
  });
}
