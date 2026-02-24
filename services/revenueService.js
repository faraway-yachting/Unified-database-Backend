import { prisma } from '../config/database.js';

export async function getRevenueSummary(options = {}) {
  const { regionId, from, to } = options;

  const where = { status: { in: ['confirmed', 'paid', 'completed'] } };
  if (regionId) where.regionId = regionId;
  if (from || to) {
    where.createdAt = {};
    if (from) where.createdAt.gte = new Date(from);
    if (to) where.createdAt.lte = new Date(to);
  }

  const bookings = await prisma.booking.findMany({
    where,
    select: {
      totalAmount: true,
      baseAmount: true,
      addonsAmount: true,
      discountAmount: true,
      taxAmount: true,
      regionId: true,
      packageId: true,
      createdAt: true,
    },
  });

  const totalRevenue = bookings.reduce((sum, b) => sum + Number(b.totalAmount), 0);
  const totalBase = bookings.reduce((sum, b) => sum + Number(b.baseAmount), 0);
  const totalAddons = bookings.reduce((sum, b) => sum + Number(b.addonsAmount), 0);
  const totalDiscount = bookings.reduce((sum, b) => sum + Number(b.discountAmount), 0);
  const totalTax = bookings.reduce((sum, b) => sum + Number(b.taxAmount), 0);
  const count = bookings.length;

  return {
    period: { from: from || null, to: to || null },
    summary: {
      totalRevenue,
      totalBase,
      totalAddons,
      totalDiscount,
      totalTax,
      bookingCount: count,
    },
  };
}

export async function getRevenueByRegion(options = {}) {
  const { from, to } = options;

  const where = { status: { in: ['confirmed', 'paid', 'completed'] } };
  if (from || to) {
    where.createdAt = {};
    if (from) where.createdAt.gte = new Date(from);
    if (to) where.createdAt.lte = new Date(to);
  }

  const bookings = await prisma.booking.findMany({
    where,
    include: { region: { select: { id: true, name: true } } },
    select: { totalAmount: true, regionId: true, region: true },
  });

  const byRegion = {};
  for (const b of bookings) {
    const key = b.regionId || 'unknown';
    if (!byRegion[key]) {
      byRegion[key] = { region: b.region, totalRevenue: 0, bookingCount: 0 };
    }
    byRegion[key].totalRevenue += Number(b.totalAmount);
    byRegion[key].bookingCount += 1;
  }

  return {
    period: { from: from || null, to: to || null },
    byRegion: Object.values(byRegion),
  };
}

export async function getRevenueByPackage(options = {}) {
  const { from, to } = options;

  const where = { status: { in: ['confirmed', 'paid', 'completed'] } };
  if (from || to) {
    where.createdAt = {};
    if (from) where.createdAt.gte = new Date(from);
    if (to) where.createdAt.lte = new Date(to);
  }

  const bookings = await prisma.booking.findMany({
    where,
    include: { package: { select: { id: true, name: true } } },
    select: { totalAmount: true, packageId: true, package: true },
  });

  const byPackage = {};
  for (const b of bookings) {
    const key = b.packageId || 'unknown';
    if (!byPackage[key]) {
      byPackage[key] = { package: b.package, totalRevenue: 0, bookingCount: 0 };
    }
    byPackage[key].totalRevenue += Number(b.totalAmount);
    byPackage[key].bookingCount += 1;
  }

  return {
    period: { from: from || null, to: to || null },
    byPackage: Object.values(byPackage),
  };
}

export async function exportRevenueReport(options = {}) {
  const summary = await getRevenueSummary(options);
  const byRegion = await getRevenueByRegion(options);
  const byPackage = await getRevenueByPackage(options);
  return { summary, byRegion, byPackage };
}
