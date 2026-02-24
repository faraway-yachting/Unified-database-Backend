import * as pricingRuleService from '../services/pricingRuleService.js';
import * as promoCodeService from '../services/promoCodeService.js';
import * as currencyService from '../services/currencyService.js';
import * as agentService from '../services/agentService.js';
import * as revenueService from '../services/revenueService.js';

// --- Pricing Rules ---
export async function listPricingRules(req, res, next) {
  try {
    const { package: pkg, region, isActive, page, limit } = req.query;
    const result = await pricingRuleService.listPricingRules({
      packageId: pkg,
      regionId: region,
      isActive,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function getPricingRule(req, res, next) {
  try {
    const rule = await pricingRuleService.getPricingRuleById(req.params.id);
    res.status(200).json(rule);
  } catch (err) {
    next(err);
  }
}

export async function createPricingRule(req, res, next) {
  try {
    const rule = await pricingRuleService.createPricingRule(req.body);
    res.status(201).json(rule);
  } catch (err) {
    next(err);
  }
}

export async function updatePricingRule(req, res, next) {
  try {
    const rule = await pricingRuleService.updatePricingRule(req.params.id, req.body);
    res.status(200).json(rule);
  } catch (err) {
    next(err);
  }
}

export async function deletePricingRule(req, res, next) {
  try {
    await pricingRuleService.deletePricingRule(req.params.id);
    res.status(200).json({ message: 'Pricing rule deleted' });
  } catch (err) {
    next(err);
  }
}

export async function updatePricingRuleStatus(req, res, next) {
  try {
    const rule = await pricingRuleService.updatePricingRuleStatus(req.params.id, req.body);
    res.status(200).json(rule);
  } catch (err) {
    next(err);
  }
}

// --- Promo Codes ---
export async function listPromoCodes(req, res, next) {
  try {
    const { region, isActive, page, limit } = req.query;
    const result = await promoCodeService.listPromoCodes({
      regionId: region,
      isActive,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function getPromoCode(req, res, next) {
  try {
    const promo = await promoCodeService.getPromoCodeById(req.params.id);
    res.status(200).json(promo);
  } catch (err) {
    next(err);
  }
}

export async function createPromoCode(req, res, next) {
  try {
    const promo = await promoCodeService.createPromoCode(req.body);
    res.status(201).json(promo);
  } catch (err) {
    next(err);
  }
}

export async function updatePromoCode(req, res, next) {
  try {
    const promo = await promoCodeService.updatePromoCode(req.params.id, req.body);
    res.status(200).json(promo);
  } catch (err) {
    next(err);
  }
}

export async function deletePromoCode(req, res, next) {
  try {
    await promoCodeService.deletePromoCode(req.params.id);
    res.status(200).json({ message: 'Promo code deleted' });
  } catch (err) {
    next(err);
  }
}

export async function validatePromoCode(req, res, next) {
  try {
    const { code, regionId, bookingAmount } = req.body || {};
    const result = await promoCodeService.validatePromoCode({ code, regionId, bookingAmount });
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

// --- Currencies ---
export async function listCurrencies(req, res, next) {
  try {
    const result = await currencyService.listCurrencies();
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function getCurrency(req, res, next) {
  try {
    const currency = await currencyService.getCurrencyByCode(req.params.code);
    res.status(200).json(currency);
  } catch (err) {
    next(err);
  }
}

export async function createCurrency(req, res, next) {
  try {
    const currency = await currencyService.createCurrency(req.body);
    res.status(201).json(currency);
  } catch (err) {
    next(err);
  }
}

export async function updateCurrency(req, res, next) {
  try {
    const currency = await currencyService.updateCurrency(req.params.code, req.body);
    res.status(200).json(currency);
  } catch (err) {
    next(err);
  }
}

export async function deleteCurrency(req, res, next) {
  try {
    await currencyService.deleteCurrency(req.params.code);
    res.status(200).json({ message: 'Currency removed' });
  } catch (err) {
    next(err);
  }
}

export async function refreshCurrencyRates(req, res, next) {
  try {
    const result = await currencyService.refreshCurrencyRates();
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

// --- Agents ---
export async function listAgents(req, res, next) {
  try {
    const { region, isActive, page, limit } = req.query;
    const result = await agentService.listAgents({
      regionId: region,
      isActive,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function getAgent(req, res, next) {
  try {
    const agent = await agentService.getAgentById(req.params.id);
    res.status(200).json(agent);
  } catch (err) {
    next(err);
  }
}

export async function createAgent(req, res, next) {
  try {
    const agent = await agentService.createAgent(req.body);
    res.status(201).json(agent);
  } catch (err) {
    next(err);
  }
}

export async function updateAgent(req, res, next) {
  try {
    const agent = await agentService.updateAgent(req.params.id, req.body);
    res.status(200).json(agent);
  } catch (err) {
    next(err);
  }
}

export async function deleteAgent(req, res, next) {
  try {
    await agentService.deleteAgent(req.params.id);
    res.status(200).json({ message: 'Agent deleted' });
  } catch (err) {
    next(err);
  }
}

export async function getAgentCommissions(req, res, next) {
  try {
    const { from, to, page, limit } = req.query;
    const result = await agentService.getAgentCommissions(req.params.id, {
      from,
      to,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

// --- Revenue ---
export async function getRevenueSummary(req, res, next) {
  try {
    const { region, from, to } = req.query;
    const result = await revenueService.getRevenueSummary({
      regionId: region,
      from,
      to,
    });
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function getRevenueByRegion(req, res, next) {
  try {
    const { from, to } = req.query;
    const result = await revenueService.getRevenueByRegion({ from, to });
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function getRevenueByPackage(req, res, next) {
  try {
    const { from, to } = req.query;
    const result = await revenueService.getRevenueByPackage({ from, to });
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function exportRevenueReport(req, res, next) {
  try {
    const { region, from, to } = req.query;
    const result = await revenueService.exportRevenueReport({
      regionId: region,
      from,
      to,
    });
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}
