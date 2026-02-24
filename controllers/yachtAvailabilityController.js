import * as yachtAvailabilityService from '../services/yachtAvailabilityService.js';

/**
 * GET /api/yachts/:id/availability
 * Get availability calendar (blackout blocks). Query: from, to (optional date range).
 */
export async function getAvailability(req, res, next) {
  try {
    const { id } = req.params;
    const { from, to } = req.query;
    const result = await yachtAvailabilityService.getAvailability(id, { from, to });
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/yachts/:id/availability/block
 * Add blackout block. Body: { startDate, endDate, reason?, notes? }
 */
export async function addBlock(req, res, next) {
  try {
    const { id } = req.params;
    const block = await yachtAvailabilityService.addBlock(id, req.body);
    res.status(201).json(block);
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/yachts/:id/availability/:blockId
 * Remove blackout block.
 */
export async function removeBlock(req, res, next) {
  try {
    const { id, blockId } = req.params;
    await yachtAvailabilityService.removeBlock(id, blockId);
    res.status(200).json({ message: 'Availability block removed successfully' });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/yachts/:id/availability/check
 * Check date range availability. Query: from, to (required).
 */
export async function checkAvailability(req, res, next) {
  try {
    const { id } = req.params;
    const { from, to, includeBookings } = req.query;
    const result = await yachtAvailabilityService.checkAvailability(id, from, to, {
      includeBookings: includeBookings !== 'false',
    });
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}
