import { prisma } from '../config/database.js';

const VALID_RULE_TYPES = ['peak', 'holiday', 'last_minute', 'demand', 'custom'];

export async function listPricingRules(options = {}) {
  const { packageId, regionId, isActive, page = 1, limit = 50 } = options;
  const skip = (page - 1) * limit;
  const where = {};
  if (packageId) where.packageId = packageId;
  if (regionId) where.regionId = regionId;
  if (isActive !== undefined) where.isActive = isActive === 'true' || isActive === true;

  const [rules, total] = await Promise.all([
    prisma.pricingRule.findMany({
      where,
      include: {
        package: { select: { id: true, name: true } },
        region: { select: { id: true, name: true } },
      },
      orderBy: [{ priority: 'desc' }, { startDate: 'desc' }],
      skip,
      take: limit,
    }),
    prisma.pricingRule.count({ where }),
  ]);

  return { rules, total, page, limit, totalPages: Math.ceil(total / limit) };
}

export async function getPricingRuleById(id) {
  const rule = await prisma.pricingRule.findUnique({
    where: { id },
    include: {
      package: true,
      region: true,
    },
  });
  if (!rule) {
    const err = new Error('Pricing rule not found');
    err.status = 404;
    throw err;
  }
  return rule;
}

export async function createPricingRule(data) {
  const {
    name,
    packageId,
    regionId,
    ruleType,
    multiplier,
    fixedAdjustment,
    startDate,
    endDate,
    priority = 0,
    isActive = true,
  } = data;

  if (!name || !ruleType || !startDate || !endDate) {
    const err = new Error('name, ruleType, startDate, and endDate are required');
    err.status = 400;
    throw err;
  }
  if (!VALID_RULE_TYPES.includes(ruleType)) {
    const err = new Error(`ruleType must be one of: ${VALID_RULE_TYPES.join(', ')}`);
    err.status = 400;
    throw err;
  }

  const start = new Date(startDate);
  const end = new Date(endDate);
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) {
    const err = new Error('Invalid startDate or endDate');
    err.status = 400;
    throw err;
  }

  const rule = await prisma.pricingRule.create({
    data: {
      name,
      packageId: packageId || null,
      regionId: regionId || null,
      ruleType,
      multiplier: multiplier != null ? parseFloat(multiplier) : null,
      fixedAdjustment: fixedAdjustment != null ? parseFloat(fixedAdjustment) : null,
      startDate: start,
      endDate: end,
      priority: priority != null ? parseInt(priority, 10) : 0,
      isActive: isActive !== false,
    },
    include: {
      package: { select: { id: true, name: true } },
      region: { select: { id: true, name: true } },
    },
  });
  return rule;
}

export async function updatePricingRule(id, data) {
  const rule = await prisma.pricingRule.findUnique({ where: { id } });
  if (!rule) {
    const err = new Error('Pricing rule not found');
    err.status = 404;
    throw err;
  }

  const updateData = {};
  const { name, packageId, regionId, ruleType, multiplier, fixedAdjustment, startDate, endDate, priority, isActive } = data;
  if (name !== undefined) updateData.name = name;
  if (packageId !== undefined) updateData.packageId = packageId || null;
  if (regionId !== undefined) updateData.regionId = regionId || null;
  if (ruleType !== undefined) {
    if (!VALID_RULE_TYPES.includes(ruleType)) {
      const err = new Error(`ruleType must be one of: ${VALID_RULE_TYPES.join(', ')}`);
      err.status = 400;
      throw err;
    }
    updateData.ruleType = ruleType;
  }
  if (multiplier !== undefined) updateData.multiplier = multiplier != null ? parseFloat(multiplier) : null;
  if (fixedAdjustment !== undefined) updateData.fixedAdjustment = fixedAdjustment != null ? parseFloat(fixedAdjustment) : null;
  if (startDate !== undefined) updateData.startDate = new Date(startDate);
  if (endDate !== undefined) updateData.endDate = new Date(endDate);
  if (priority !== undefined) updateData.priority = parseInt(priority, 10);
  if (isActive !== undefined) updateData.isActive = isActive !== false;

  return prisma.pricingRule.update({
    where: { id },
    data: updateData,
    include: { package: { select: { id: true, name: true } }, region: { select: { id: true, name: true } } },
  });
}

export async function deletePricingRule(id) {
  const rule = await prisma.pricingRule.findUnique({ where: { id } });
  if (!rule) {
    const err = new Error('Pricing rule not found');
    err.status = 404;
    throw err;
  }
  await prisma.pricingRule.delete({ where: { id } });
}

export async function updatePricingRuleStatus(id, data) {
  const { isActive } = data;
  const rule = await prisma.pricingRule.findUnique({ where: { id } });
  if (!rule) {
    const err = new Error('Pricing rule not found');
    err.status = 404;
    throw err;
  }
  return prisma.pricingRule.update({
    where: { id },
    data: { isActive: isActive !== false },
    include: { package: { select: { id: true, name: true } }, region: { select: { id: true, name: true } } },
  });
}
