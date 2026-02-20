import express from 'express';
import authRouter from './auth.js';
import uploadRouter from './upload.js';
import regionRouter from './region.js';
import charterCompanyRouter from './charterCompany.js';
import yachtRouter from './yacht.js';

const router = express.Router();

router.use('/auth', authRouter);
router.use('/upload', uploadRouter);
router.use('/regions', regionRouter);
router.use('/charter-companies', charterCompanyRouter);
router.use('/yachts', yachtRouter);

// Example route
router.get('/', (req, res) => {
  res.json({
    message: 'API is working',
    version: '1.0.0'
  });
});

export default router;
