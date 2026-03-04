import { prisma } from '../config/database.js';

/**
 * Parse decimal to number for JSON responses.
 * @param {Decimal|number|string} val
 * @returns {number}
 */
function toNum(val) {
  if (val == null) return 0;
  if (typeof val === 'number') return val;
  return Number(val);
}

/**
 * GET /api/dashboard/stats
 * KPI cards: bookings, revenue, occupancy, fleet.
 * @param {object} options - { period?: 'month' | 'year' } for date-scoped metrics
 */
export async function getStats(options = {}) {
  const { period = 'month' } = options;
  const now = new Date();
  const startOfPeriod = new Date(now);
  if (period === 'month') {
    startOfPeriod.setDate(1);
    startOfPeriod.setHours(0, 0, 0, 0);
  } else if (period === 'year') {
    startOfPeriod.setMonth(0, 1);
    startOfPeriod.setHours(0, 0, 0, 0);
  }

  // Bookings count (non-cancelled, in period)
  const bookingsCount = await prisma.booking.count({
    where: {
      status: { not: 'cancelled' },
      createdAt: { gte: startOfPeriod },
    },
  });

  // Revenue: sum of completed payments in period, converted to USD (refunds subtracted)
  const payments = await prisma.payment.findMany({
    where: {
      status: 'completed',
      createdAt: { gte: startOfPeriod },
    },
    include: { currency: true },
  });

  let revenueUsd = 0;
  for (const p of payments) {
    const amount = toNum(p.amount);
    const rate = toNum(p.currency?.exchangeRateToUsd ?? 1);
    const usdAmount = amount * rate;
    revenueUsd += p.paymentType === 'refund' ? -usdAmount : usdAmount;
  }

  // Fleet stats (active yachts only)
  const fleetCounts = await prisma.yacht.groupBy({
    by: ['status'],
    where: { isActive: true },
    _count: { id: true },
  });

  const fleet = {
    total: 0,
    available: 0,
    booked: 0,
    maintenance: 0,
    retired: 0,
  };
  for (const row of fleetCounts) {
    fleet.total += row._count.id;
    const k = row.status || 'available';
    if (k in fleet) fleet[k] = row._count.id;
  }

  // Occupancy: % of fleet currently booked (or in use)
  const occupancyPercent =
    fleet.total > 0 ? Math.round((fleet.booked / fleet.total) * 100) : 0;

  return {
    bookings: bookingsCount,
    revenueUsd: Math.round(revenueUsd * 100) / 100,
    occupancyPercent,
    fleet: {
      total: fleet.total,
      available: fleet.available,
      booked: fleet.booked,
      maintenance: fleet.maintenance,
      retired: fleet.retired,
    },
    period,
  };
}

/**
 * GET /api/dashboard/revenue-chart
 * Revenue over time by region.
 * Query: period=month|quarter|year (default month), groupBy=month|week
 */
export async function getRevenueChart(options = {}) {
  const { period = 'month', groupBy = 'month' } = options;
  const now = new Date();
  const start = new Date(now);
  if (period === 'month') start.setMonth(start.getMonth() - 1);
  else if (period === 'quarter') start.setMonth(start.getMonth() - 3);
  else if (period === 'year') start.setFullYear(start.getFullYear() - 1);
  start.setHours(0, 0, 0, 0);

  const payments = await prisma.payment.findMany({
    where: {
      status: 'completed',
      createdAt: { gte: start },
    },
    include: {
      currency: true,
      booking: { include: { region: true } },
    },
  });

  // Group by period key and region
  const byKey = {};
  for (const p of payments) {
    const d = new Date(p.paidAt || p.createdAt);
    let key;
    if (groupBy === 'week') {
      const weekStart = new Date(d);
      weekStart.setDate(d.getDate() - d.getDay());
      key = weekStart.toISOString().slice(0, 10);
    } else {
      key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    }

    const amount = toNum(p.amount);
    const rate = toNum(p.currency?.exchangeRateToUsd ?? 1);
    const usdAmount = (p.paymentType === 'refund' ? -amount : amount) * rate;
    const regionName = p.booking?.region?.name ?? 'Unknown';

    if (!byKey[key]) byKey[key] = {};
    if (!byKey[key][regionName]) byKey[key][regionName] = 0;
    byKey[key][regionName] += usdAmount;
  }

  const labels = Object.keys(byKey).sort();
  const regions = [...new Set(Object.values(byKey).flatMap((r) => Object.keys(r)))].sort();

  const series = regions.map((region) => ({
    name: region,
    data: labels.map((label) =>
      Math.round((byKey[label][region] ?? 0) * 100) / 100
    ),
  }));

  return { labels, series };
}

/**
 * GET /api/dashboard/bookings-by-region
 * Donut chart data: count of bookings per region (non-cancelled).
 */
export async function getBookingsByRegion() {
  const result = await prisma.booking.groupBy({
    by: ['regionId'],
    where: { status: { not: 'cancelled' } },
    _count: { id: true },
  });

  const regionIds = result.map((r) => r.regionId);
  const regions = await prisma.region.findMany({
    where: { id: { in: regionIds } },
    select: { id: true, name: true },
  });
  const regionMap = Object.fromEntries(regions.map((r) => [r.id, r.name]));

  return result.map((r) => ({
    regionId: r.regionId,
    regionName: regionMap[r.regionId] ?? 'Unknown',
    count: r._count.id,
  }));
}

/**
 * GET /api/dashboard/fleet-status
 * Fleet availability summary: count by status.
 */
export async function getFleetStatus() {
  const result = await prisma.yacht.groupBy({
    by: ['status'],
    where: { isActive: true },
    _count: { id: true },
  });

  const statuses = ['available', 'booked', 'maintenance', 'retired'];
  return statuses.map((status) => {
    const row = result.find((r) => r.status === status);
    return {
      status,
      count: row ? row._count.id : 0,
    };
  });
}

/**
 * GET /api/dashboard/upcoming-bookings
 * Next 7 days bookings (non-cancelled).
 */
export async function getUpcomingBookings() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const endDate = new Date(today);
  endDate.setDate(endDate.getDate() + 7);

  const bookings = await prisma.booking.findMany({
    where: {
      status: { not: 'cancelled' },
      startDate: { gte: today, lte: endDate },
    },
    include: {
      customer: { select: { id: true, firstName: true, lastName: true, email: true } },
      yacht: { select: { id: true, name: true, type: true } },
      package: { select: { id: true, name: true } },
      region: { select: { id: true, name: true, slug: true } },
      currency: { select: { code: true, symbol: true } },
    },
    orderBy: { startDate: 'asc' },
  });

  return { bookings };
}

/**
 * GET /api/dashboard/top-packages
 * Top 5 packages by revenue (from completed payments).
 */
export async function getTopPackages() {
  const payments = await prisma.payment.findMany({
    where: {
      status: 'completed',
      paymentType: { not: 'refund' },
    },
    include: {
      booking: {
        include: {
          package: { select: { id: true, name: true } },
          currency: true,
        },
      },
    },
  });

  const byPackage = {};
  for (const p of payments) {
    const pkg = p.booking?.package;
    if (!pkg) continue;
    const amount = toNum(p.amount);
    const rate = toNum(p.booking.currency?.exchangeRateToUsd ?? 1);
    const usd = amount * rate;
    if (!byPackage[pkg.id]) {
      byPackage[pkg.id] = { packageId: pkg.id, packageName: pkg.name, revenueUsd: 0 };
    }
    byPackage[pkg.id].revenueUsd += usd;
  }

  const top = Object.values(byPackage)
    .map((x) => ({ ...x, revenueUsd: Math.round(x.revenueUsd * 100) / 100 }))
    .sort((a, b) => b.revenueUsd - a.revenueUsd)
    .slice(0, 5);

  return { packages: top };
}
