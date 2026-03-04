import * as dashboardService from '../services/dashboardService.js';

/**
 * GET /api/dashboard/stats
 * KPI cards: bookings, revenue, occupancy, fleet.
 * Query: period=month|year
 */
export async function getStats(req, res, next) {
  try {
    const { period } = req.query;
    const result = await dashboardService.getStats({
      period: period === 'year' ? 'year' : 'month',
    });
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/dashboard/revenue-chart
 * Revenue over time by region.
 * Query: period=month|quarter|year, groupBy=month|week
 */
export async function getRevenueChart(req, res, next) {
  try {
    const { period, groupBy } = req.query;
    const result = await dashboardService.getRevenueChart({
      period: period || 'month',
      groupBy: groupBy || 'month',
    });
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/dashboard/bookings-by-region
 * Donut chart data: bookings count per region.
 */
export async function getBookingsByRegion(req, res, next) {
  try {
    const result = await dashboardService.getBookingsByRegion();
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/dashboard/fleet-status
 * Fleet availability summary.
 */
export async function getFleetStatus(req, res, next) {
  try {
    const result = await dashboardService.getFleetStatus();
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/dashboard/upcoming-bookings
 * Next 7 days bookings.
 */
export async function getUpcomingBookings(req, res, next) {
  try {
    const result = await dashboardService.getUpcomingBookings();
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/dashboard/top-packages
 * Top 5 packages by revenue.
 */
export async function getTopPackages(req, res, next) {
  try {
    const result = await dashboardService.getTopPackages();
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}
