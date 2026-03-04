import express from 'express';
import * as dashboardController from '../controllers/dashboardController.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

router.get('/stats', requireAuth, dashboardController.getStats);
router.get('/revenue-chart', requireAuth, dashboardController.getRevenueChart);
router.get('/bookings-by-region', requireAuth, dashboardController.getBookingsByRegion);
router.get('/fleet-status', requireAuth, dashboardController.getFleetStatus);
router.get('/upcoming-bookings', requireAuth, dashboardController.getUpcomingBookings);
router.get('/top-packages', requireAuth, dashboardController.getTopPackages);

export default router;
