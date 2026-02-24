import { prisma } from '../config/database.js';

/**
 * List add-ons for a booking.
 * @param {string} bookingId - Booking UUID
 * @returns {Promise<{ bookingId: string, addons: Array }>}
 */
export async function listBookingAddons(bookingId) {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
  });

  if (!booking) {
    const err = new Error('Booking not found');
    err.status = 404;
    throw err;
  }

  const addons = await prisma.bookingAddon.findMany({
    where: { bookingId },
    include: {
      addon: { select: { id: true, name: true, price: true, priceType: true } },
    },
  });

  return {
    bookingId: booking.id,
    bookingRef: booking.bookingRef,
    addons,
  };
}

/**
 * Add an add-on to a booking.
 * @param {string} bookingId - Booking UUID
 * @param {object} data - { addonId, quantity? }
 * @returns {Promise<object>}
 */
export async function addAddonToBooking(bookingId, data) {
  const { addonId, quantity = 1 } = data;

  if (!addonId) {
    const err = new Error('addonId is required');
    err.status = 400;
    throw err;
  }

  const qty = parseInt(quantity, 10);
  if (Number.isNaN(qty) || qty < 1) {
    const err = new Error('quantity must be a positive integer');
    err.status = 400;
    throw err;
  }

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
  });

  if (!booking) {
    const err = new Error('Booking not found');
    err.status = 404;
    throw err;
  }

  const packageAddon = await prisma.packageAddon.findFirst({
    where: { id: addonId, packageId: booking.packageId },
  });

  if (!packageAddon) {
    const err = new Error('Add-on not found or does not belong to this booking\'s package');
    err.status = 400;
    throw err;
  }

  const unitPrice = Number(packageAddon.price);
  const totalPrice = unitPrice * qty;

  const existing = await prisma.bookingAddon.findFirst({
    where: { bookingId, addonId },
  });

  if (existing) {
    const newQty = existing.quantity + qty;
    const newTotal = Number(existing.unitPrice) * newQty;
    const updated = await prisma.bookingAddon.update({
      where: { id: existing.id },
      data: { quantity: newQty, totalPrice: newTotal },
      include: { addon: { select: { id: true, name: true, price: true, priceType: true } } },
    });
    return updated;
  }

  const bookingAddon = await prisma.bookingAddon.create({
    data: {
      bookingId,
      addonId,
      quantity: qty,
      unitPrice,
      totalPrice,
    },
    include: { addon: { select: { id: true, name: true, price: true, priceType: true } } },
  });

  return bookingAddon;
}

/**
 * Remove an add-on from a booking.
 * @param {string} bookingId - Booking UUID
 * @param {string} addonId - BookingAddon UUID (the booking_addon row id, not package addon id)
 * @returns {Promise<void>}
 */
export async function removeAddonFromBooking(bookingId, addonId) {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
  });

  if (!booking) {
    const err = new Error('Booking not found');
    err.status = 404;
    throw err;
  }

  const bookingAddon = await prisma.bookingAddon.findFirst({
    where: { id: addonId, bookingId },
  });

  if (!bookingAddon) {
    const err = new Error('Booking add-on not found');
    err.status = 404;
    throw err;
  }

  await prisma.bookingAddon.delete({
    where: { id: addonId },
  });
}
