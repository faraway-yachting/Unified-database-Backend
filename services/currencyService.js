import { prisma } from '../config/database.js';

export async function listCurrencies() {
  const currencies = await prisma.currency.findMany({
    orderBy: { code: 'asc' },
  });
  return { currencies };
}

export async function getCurrencyByCode(code) {
  const currency = await prisma.currency.findUnique({
    where: { code: code.toUpperCase() },
  });
  if (!currency) {
    const err = new Error('Currency not found');
    err.status = 404;
    throw err;
  }
  return currency;
}

export async function createCurrency(data) {
  const { code, name, symbol, exchangeRateToUsd, autoUpdate = true } = data;

  if (!code || !name || !symbol || exchangeRateToUsd == null) {
    const err = new Error('code, name, symbol, and exchangeRateToUsd are required');
    err.status = 400;
    throw err;
  }

  const c = code.trim().toUpperCase();
  const existing = await prisma.currency.findUnique({ where: { code: c } });
  if (existing) {
    const err = new Error('Currency code already exists');
    err.status = 409;
    throw err;
  }

  const rate = parseFloat(exchangeRateToUsd);
  if (Number.isNaN(rate) || rate <= 0) {
    const err = new Error('exchangeRateToUsd must be a positive number');
    err.status = 400;
    throw err;
  }

  const currency = await prisma.currency.create({
    data: {
      code: c,
      name: name.trim(),
      symbol: symbol.trim(),
      exchangeRateToUsd: rate,
      autoUpdate: autoUpdate !== false,
      lastUpdated: new Date(),
    },
  });
  return currency;
}

export async function updateCurrency(code, data) {
  const c = code.toUpperCase();
  const currency = await prisma.currency.findUnique({ where: { code: c } });
  if (!currency) {
    const err = new Error('Currency not found');
    err.status = 404;
    throw err;
  }

  const updateData = {};
  if (data.name !== undefined) updateData.name = data.name.trim();
  if (data.symbol !== undefined) updateData.symbol = data.symbol.trim();
  if (data.exchangeRateToUsd !== undefined) {
    const rate = parseFloat(data.exchangeRateToUsd);
    if (Number.isNaN(rate) || rate <= 0) {
      const err = new Error('exchangeRateToUsd must be a positive number');
      err.status = 400;
      throw err;
    }
    updateData.exchangeRateToUsd = rate;
    updateData.lastUpdated = new Date();
  }
  if (data.autoUpdate !== undefined) updateData.autoUpdate = data.autoUpdate !== false;

  return prisma.currency.update({
    where: { code: c },
    data: updateData,
  });
}

export async function deleteCurrency(code) {
  const c = code.toUpperCase();
  const currency = await prisma.currency.findUnique({ where: { code: c } });
  if (!currency) {
    const err = new Error('Currency not found');
    err.status = 404;
    throw err;
  }
  await prisma.currency.delete({ where: { code: c } });
}

export async function refreshCurrencyRates() {
  const currencies = await prisma.currency.findMany({
    where: { autoUpdate: true },
  });
  for (const c of currencies) {
    await prisma.currency.update({
      where: { code: c.code },
      data: { lastUpdated: new Date() },
    });
  }
  return { message: 'Refresh triggered', count: currencies.length };
}
