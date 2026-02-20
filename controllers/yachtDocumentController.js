import multer from 'multer';
import * as yachtDocumentService from '../services/yachtDocumentService.js';

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
});

/**
 * Middleware for handling document uploads.
 */
export const uploadMiddleware = upload;

/**
 * GET /api/yachts/:id/documents
 * List all documents for a yacht.
 * Query params: documentType, isExpired
 */
export async function getYachtDocuments(req, res, next) {
  try {
    const { id } = req.params;
    const { documentType, isExpired } = req.query;
    const documents = await yachtDocumentService.getYachtDocuments(id, {
      documentType,
      isExpired,
    });
    res.status(200).json({ documents });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/yachts/:id/documents
 * Upload a document for a yacht.
 * Body: multipart/form-data with 'file' field
 * Form fields: documentType (required), issuedDate?, expiryDate?, notes?
 */
export async function uploadYachtDocument(req, res, next) {
  try {
    const { id } = req.params;
    const { documentType, issuedDate, expiryDate, notes } = req.body;

    if (!req.file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    if (!documentType) {
      return res.status(400).json({ error: 'documentType is required' });
    }

    const document = await yachtDocumentService.uploadYachtDocument(id, req.file, {
      documentType,
      issuedDate,
      expiryDate,
      notes,
    });

    res.status(201).json(document);
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/yachts/:id/documents/:docId
 * Update a yacht document.
 * Body: { documentType?, issuedDate?, expiryDate?, notes? }
 */
export async function updateYachtDocument(req, res, next) {
  try {
    const { id, docId } = req.params;
    const { documentType, issuedDate, expiryDate, notes } = req.body;

    const document = await yachtDocumentService.updateYachtDocument(id, docId, {
      documentType,
      issuedDate,
      expiryDate,
      notes,
    });

    res.status(200).json(document);
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/yachts/:id/documents/:docId
 * Delete a yacht document.
 */
export async function deleteYachtDocument(req, res, next) {
  try {
    const { id, docId } = req.params;
    await yachtDocumentService.deleteYachtDocument(id, docId);
    res.status(200).json({ message: 'Document deleted successfully' });
  } catch (err) {
    next(err);
  }
}
