import * as charterCompanyService from '../services/charterCompanyService.js';

/**
 * GET /api/charter-companies
 * List all charter companies with optional filtering and pagination.
 * Query params: regionId, isActive, page, limit, includeRegion, includeYachts
 */
export async function listCharterCompanies(req, res, next) {
  try {
    const { regionId, isActive, page, limit, includeRegion, includeYachts } = req.query;
    const result = await charterCompanyService.listCharterCompanies({
      regionId,
      isActive,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      includeRegion: includeRegion !== 'false',
      includeYachts: includeYachts === 'true',
    });
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/charter-companies/:id
 * Get a single charter company by ID.
 * Query params: includeRegion, includeYachts
 */
export async function getCharterCompanyById(req, res, next) {
  try {
    const { id } = req.params;
    const { includeRegion, includeYachts } = req.query;
    const company = await charterCompanyService.getCharterCompanyById(id, {
      includeRegion: includeRegion !== 'false',
      includeYachts: includeYachts === 'true',
    });
    res.status(200).json(company);
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/charter-companies
 * Create a new charter company.
 * Body: { name, logoUrl?, regionId, contactEmail?, contactPhone?, isActive? }
 */
export async function createCharterCompany(req, res, next) {
  try {
    const company = await charterCompanyService.createCharterCompany(req.body);
    res.status(201).json(company);
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/charter-companies/:id
 * Update a charter company.
 * Body: Partial charter company data
 */
export async function updateCharterCompany(req, res, next) {
  try {
    const { id } = req.params;
    const company = await charterCompanyService.updateCharterCompany(id, req.body);
    res.status(200).json(company);
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/charter-companies/:id
 * Delete a charter company.
 */
export async function deleteCharterCompany(req, res, next) {
  try {
    const { id } = req.params;
    await charterCompanyService.deleteCharterCompany(id);
    res.status(200).json({ message: 'Charter company deleted successfully' });
  } catch (err) {
    next(err);
  }
}
