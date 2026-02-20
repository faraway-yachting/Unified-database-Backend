import * as yachtAmenityService from '../services/yachtAmenityService.js';

/**
 * GET /api/yachts/:id/amenities
 * List all amenities for a yacht.
 * Query params: category, isAvailable
 */
export async function getYachtAmenities(req, res, next) {
  try {
    const { id } = req.params;
    const { category, isAvailable } = req.query;
    const amenities = await yachtAmenityService.getYachtAmenities(id, {
      category,
      isAvailable,
    });
    res.status(200).json({ amenities });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/yachts/:id/amenities
 * Add an amenity to a yacht.
 * Body: { category, name, isAvailable? }
 */
export async function addYachtAmenity(req, res, next) {
  try {
    const { id } = req.params;
    const { category, name, isAvailable } = req.body;

    if (!category || !name) {
      return res.status(400).json({ error: 'Category and name are required' });
    }

    const amenity = await yachtAmenityService.addYachtAmenity(id, {
      category,
      name,
      isAvailable,
    });
    res.status(201).json(amenity);
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/yachts/:id/amenities/:amenityId
 * Update a yacht amenity.
 * Body: { category?, name?, isAvailable? }
 */
export async function updateYachtAmenity(req, res, next) {
  try {
    const { id, amenityId } = req.params;
    const { category, name, isAvailable } = req.body;

    const amenity = await yachtAmenityService.updateYachtAmenity(id, amenityId, {
      category,
      name,
      isAvailable,
    });
    res.status(200).json(amenity);
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/yachts/:id/amenities/:amenityId
 * Remove an amenity from a yacht.
 */
export async function removeYachtAmenity(req, res, next) {
  try {
    const { id, amenityId } = req.params;
    await yachtAmenityService.removeYachtAmenity(id, amenityId);
    res.status(200).json({ message: 'Amenity removed successfully' });
  } catch (err) {
    next(err);
  }
}
