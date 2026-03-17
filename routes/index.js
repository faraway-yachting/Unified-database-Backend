import express from 'express';
import authRouter from './auth.js';
import uploadRouter from './upload.js';
import dashboardRouter from './dashboard.js';
import regionRouter from './region.js';
import charterCompanyRouter from './charterCompany.js';
import yachtRouter from './yacht.js';
import packageRouter from './package.js';
import bookingRouter from './booking.js';
import pricingRouter from './pricing.js';
import crmRouter from './crm.js';
import settingsRouter from './settings.js';
import tagsRouter from './tags.js';

const router = express.Router();

router.use('/auth', authRouter);
router.use('/dashboard', dashboardRouter);
router.use('/upload', uploadRouter);
router.use('/regions', regionRouter);
router.use('/charter-companies', charterCompanyRouter);
router.use('/yachts', yachtRouter);
router.use('/packages', packageRouter);
router.use('/bookings', bookingRouter);
router.use('/pricing', pricingRouter);
router.use('/crm', crmRouter);
router.use('/settings', settingsRouter);
router.use('/tags', tagsRouter);

// Example route
router.get('/', (req, res) => {
  res.json({
    message: 'API is working',
    version: '1.0.0'
  });
});

export default router;
