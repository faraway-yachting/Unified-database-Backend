import * as yachtService from '../services/yachtService.js';
import { logAudit } from '../utils/audit.js';

/**
 * GET /api/yachts
 * List all yachts with optional filtering and pagination.
 * Query params: regionId, type, status, minCapacity, maxCapacity, isActive, page, limit, includeCompany, includeRegion, includeImages
 */
export async function listYachts(req, res, next) {
  try {
    const {
      regionId,
      type,
      status,
      minCapacity,
      maxCapacity,
      isActive,
      page,
      limit,
      includeCompany,
      includeRegion,
      includeImages,
    } = req.query;

    const result = await yachtService.listYachts({
      regionId,
      type,
      status,
      minCapacity,
      maxCapacity,
      isActive,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      includeCompany: includeCompany !== 'false',
      includeRegion: includeRegion !== 'false',
      includeImages: includeImages === 'true',
    });
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/yachts/:id
 * Get a single yacht by ID.
 * Query params: includeCompany, includeRegion, includeImages, includeAmenities
 */
export async function getYachtById(req, res, next) {
  try {
    const { id } = req.params;
    const { includeCompany, includeRegion, includeImages, includeAmenities } = req.query;
    const yacht = await yachtService.getYachtById(id, {
      includeCompany: includeCompany !== 'false',
      includeRegion: includeRegion !== 'false',
      includeImages: includeImages !== 'false',
      includeAmenities: includeAmenities === 'true',
    });
    res.status(200).json(yacht);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/yachts/:id/detail
 * Get full yacht details with related data.
 */
export async function getYachtDetail(req, res, next) {
  try {
    const { id } = req.params;
    const yacht = await yachtService.getYachtDetail(id);
    res.status(200).json(yacht);
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/yachts
 * Create a new yacht.
 * Body: { companyId, name, type, capacityGuests, regionId, ... }
 */
export async function createYacht(req, res, next) {
  try {
    const yacht = await yachtService.createYacht(req.body);
    logAudit(req, {
      action: 'created',
      module: 'yachts',
      entityType: 'Yacht',
      entityId: yacht.id,
      description: `Created yacht ${yacht.name}`,
    }).catch(() => {});
    res.status(201).json(yacht);
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/yachts/:id
 * Update a yacht.
 * Body: Partial yacht data
 */
export async function updateYacht(req, res, next) {
  try {
    const { id } = req.params;
    console.log(`[YACHT UPDATE] id=${id}`);
    console.log(`[YACHT UPDATE] Content-Type: ${req.headers['content-type']}`);
    console.log(`[YACHT UPDATE] req.files keys:`, req.files ? Object.keys(req.files) : 'null');
    console.log(`[YACHT UPDATE] req.files.primary_image:`, req.files?.primary_image ? `${req.files.primary_image.length} file(s), size=${req.files.primary_image[0]?.size}` : 'none');
    console.log(`[YACHT UPDATE] req.files.gallery_images:`, req.files?.gallery_images ? `${req.files.gallery_images.length} file(s)` : 'none');
    console.log(`[YACHT UPDATE] body keys:`, Object.keys(req.body));
    const files = {
      primary_image: req.files?.primary_image?.[0] ?? req.file ?? null,
      gallery_images: req.files?.gallery_images ?? [],
    };
    const yacht = await yachtService.updateYacht(id, req.body, files);
    logAudit(req, {
      action: 'updated',
      module: 'yachts',
      entityType: 'Yacht',
      entityId: id,
      description: `Updated yacht ${yacht.name}`,
    }).catch(() => {});
    res.status(200).json(yacht);
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/yachts/:id
 * Soft delete a yacht (sets isActive=false and status=retired).
 */
export async function softDeleteYacht(req, res, next) {
  try {
    const { id } = req.params;
    const yacht = await yachtService.softDeleteYacht(id);
    logAudit(req, {
      action: 'deleted',
      module: 'yachts',
      entityType: 'Yacht',
      entityId: id,
      description: `Deleted yacht ${yacht.name}`,
    }).catch(() => {});
    res.status(200).json({
      message: 'Yacht soft deleted successfully',
      yacht,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/yachts/:id/status
 * Update yacht status.
 * Body: { status }
 */
export async function updateYachtStatus(req, res, next) {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ error: 'status is required' });
    }

    const yacht = await yachtService.updateYachtStatus(id, status);
    res.status(200).json(yacht);
  } catch (err) {
    next(err);
  }
}
