import { prisma } from '../config/database.js';

const VALID_DISCOUNT_TYPES = ['percentage', 'fixed'];

export async function listPromoCodes(options = {}) {
  const { regionId, isActive, page = 1, limit = 50 } = options;
  const skip = (page - 1) * limit;
  const where = {};
  if (regionId) where.regionId = regionId;
  if (isActive !== undefined) where.isActive = isActive === 'true' || isActive === true;

  const [promoCodes, total] = await Promise.all([
    prisma.promoCode.findMany({
      where,
      include: { region: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.promoCode.count({ where }),
  ]);

  return { promoCodes, total, page, limit, totalPages: Math.ceil(total / limit) };
}

export async function getPromoCodeById(id) {
  const promo = await prisma.promoCode.findUnique({
    where: { id },
    include: { region: true },
  });
  if (!promo) {
    const err = new Error('Promo code not found');
    err.status = 404;
    throw err;
  }
  return promo;
}

export async function createPromoCode(data) {
  const {
    code,
    description,
    discountType,
    discountValue,
    minBookingValue,
    maxUses,
    maxUsesPerCustomer = 1,
    regionId,
    validFrom,
    validUntil,
    isActive = true,
  } = data;

  if (!code || !discountType || discountValue == null || !validFrom || !validUntil) {
    const err = new Error('code, discountType, discountValue, validFrom, and validUntil are required');
    err.status = 400;
    throw err;
  }
  if (!VALID_DISCOUNT_TYPES.includes(discountType)) {
    const err = new Error('discountType must be one of: percentage, fixed');
    err.status = 400;
    throw err;
  }

  const existing = await prisma.promoCode.findUnique({ where: { code: code.trim().toUpperCase() } });
  if (existing) {
    const err = new Error('Promo code already exists');
    err.status = 409;
    throw err;
  }

  const from = new Date(validFrom);
  const to = new Date(validUntil);
  if (isNaN(from.getTime()) || isNaN(to.getTime()) || to < from) {
    const err = new Error('Invalid validFrom or validUntil');
    err.status = 400;
    throw err;
  }

  const promo = await prisma.promoCode.create({
    data: {
      code: code.trim().toUpperCase(),
      description: description?.trim() || null,
      discountType,
      discountValue: parseFloat(discountValue),
      minBookingValue: minBookingValue != null ? parseFloat(minBookingValue) : null,
      maxUses: maxUses != null ? parseInt(maxUses, 10) : null,
      maxUsesPerCustomer: maxUsesPerCustomer != null ? parseInt(maxUsesPerCustomer, 10) : 1,
      regionId: regionId || null,
      validFrom: from,
      validUntil: to,
      isActive: isActive !== false,
    },
    include: { region: { select: { id: true, name: true } } },
  });
  return promo;
}

export async function updatePromoCode(id, data) {
  const promo = await prisma.promoCode.findUnique({ where: { id } });
  if (!promo) {
    const err = new Error('Promo code not found');
    err.status = 404;
    throw err;
  }

  const updateData = {};
  const fields = ['description', 'discountType', 'discountValue', 'minBookingValue', 'maxUses', 'maxUsesPerCustomer', 'regionId', 'validFrom', 'validUntil', 'isActive'];
  for (const f of fields) {
    if (data[f] === undefined) continue;
    if (f === 'discountType' && !VALID_DISCOUNT_TYPES.includes(data[f])) {
      const err = new Error('discountType must be one of: percentage, fixed');
      err.status = 400;
      throw err;
    }
    if (f === 'discountValue') updateData[f] = parseFloat(data[f]);
    else if (f === 'minBookingValue') updateData[f] = data[f] != null ? parseFloat(data[f]) : null;
    else if (f === 'maxUses' || f === 'maxUsesPerCustomer') updateData[f] = data[f] != null ? parseInt(data[f], 10) : null;
    else if (f === 'validFrom' || f === 'validUntil') updateData[f] = new Date(data[f]);
    else if (f === 'isActive') updateData[f] = data[f] !== false;
    else updateData[f] = data[f];
  }

  return prisma.promoCode.update({
    where: { id },
    data: updateData,
    include: { region: { select: { id: true, name: true } } },
  });
}

export async function deletePromoCode(id) {
  const promo = await prisma.promoCode.findUnique({ where: { id } });
  if (!promo) {
    const err = new Error('Promo code not found');
    err.status = 404;
    throw err;
  }
  await prisma.promoCode.delete({ where: { id } });
}

export async function validatePromoCode(data) {
  const { code, regionId, bookingAmount } = data;

  if (!code) {
    const err = new Error('code is required');
    err.status = 400;
    throw err;
  }

  const promo = await prisma.promoCode.findUnique({
    where: { code: code.trim().toUpperCase() },
    include: { region: { select: { id: true, name: true } } },
  });

  if (!promo) {
    return { valid: false, error: 'Promo code not found' };
  }
  if (!promo.isActive) {
    return { valid: false, error: 'Promo code is inactive' };
  }

  const now = new Date();
  if (new Date(promo.validFrom) > now) {
    return { valid: false, error: 'Promo code not yet valid' };
  }
  if (new Date(promo.validUntil) < now) {
    return { valid: false, error: 'Promo code has expired' };
  }
  if (promo.regionId && regionId && promo.regionId !== regionId) {
    return { valid: false, error: 'Promo code not valid for this region' };
  }
  if (promo.maxUses != null && promo.usesCount >= promo.maxUses) {
    return { valid: false, error: 'Promo code usage limit reached' };
  }
  const amount = bookingAmount != null ? parseFloat(bookingAmount) : 0;
  if (promo.minBookingValue != null && amount < Number(promo.minBookingValue)) {
    return { valid: false, error: `Minimum booking value is ${promo.minBookingValue}` };
  }

  const discountValue = Number(promo.discountValue);
  const discount = promo.discountType === 'percentage'
    ? (amount * discountValue) / 100
    : Math.min(discountValue, amount);

  return {
    valid: true,
    promoCode: {
      id: promo.id,
      code: promo.code,
      discountType: promo.discountType,
      discountValue: promo.discountValue,
      discountAmount: discount,
    },
  };
}
