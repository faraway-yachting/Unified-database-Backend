import express from 'express';
import * as pricingController from '../controllers/pricingController.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

// --- Pricing Rules ---
router.get('/rules', requireAuth, pricingController.listPricingRules);
router.post('/rules', requireAuth, pricingController.createPricingRule);
router.get('/rules/:id', requireAuth, pricingController.getPricingRule);
router.patch('/rules/:id/status', requireAuth, pricingController.updatePricingRuleStatus);
router.patch('/rules/:id', requireAuth, pricingController.updatePricingRule);
router.delete('/rules/:id', requireAuth, pricingController.deletePricingRule);

// --- Promo Codes (validate before :id) ---
router.post('/promo-codes/validate', requireAuth, pricingController.validatePromoCode);
router.get('/promo-codes', requireAuth, pricingController.listPromoCodes);
router.post('/promo-codes', requireAuth, pricingController.createPromoCode);
router.get('/promo-codes/:id', requireAuth, pricingController.getPromoCode);
router.patch('/promo-codes/:id', requireAuth, pricingController.updatePromoCode);
router.delete('/promo-codes/:id', requireAuth, pricingController.deletePromoCode);

// --- Currencies (refresh-rates before :code) ---
router.post('/currencies/refresh-rates', requireAuth, pricingController.refreshCurrencyRates);
router.get('/currencies', requireAuth, pricingController.listCurrencies);
router.post('/currencies', requireAuth, pricingController.createCurrency);
router.get('/currencies/:code', requireAuth, pricingController.getCurrency);
router.patch('/currencies/:code', requireAuth, pricingController.updateCurrency);
router.delete('/currencies/:code', requireAuth, pricingController.deleteCurrency);

// --- Agents (commissions before :id for GET) ---
router.get('/agents', requireAuth, pricingController.listAgents);
router.post('/agents', requireAuth, pricingController.createAgent);
router.get('/agents/:id/commissions', requireAuth, pricingController.getAgentCommissions);
router.get('/agents/:id', requireAuth, pricingController.getAgent);
router.patch('/agents/:id', requireAuth, pricingController.updateAgent);
router.delete('/agents/:id', requireAuth, pricingController.deleteAgent);

// --- Revenue ---
router.get('/revenue/export', requireAuth, pricingController.exportRevenueReport);
router.get('/revenue/by-region', requireAuth, pricingController.getRevenueByRegion);
router.get('/revenue/by-package', requireAuth, pricingController.getRevenueByPackage);
router.get('/revenue', requireAuth, pricingController.getRevenueSummary);

export default router;
