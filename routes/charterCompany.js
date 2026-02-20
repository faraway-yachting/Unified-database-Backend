import express from 'express';
import * as charterCompanyController from '../controllers/charterCompanyController.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

// All charter company routes require authentication
router.get('/', requireAuth, charterCompanyController.listCharterCompanies);
router.post('/', requireAuth, charterCompanyController.createCharterCompany);
router.get('/:id', requireAuth, charterCompanyController.getCharterCompanyById);
router.patch('/:id', requireAuth, charterCompanyController.updateCharterCompany);
router.delete('/:id', requireAuth, charterCompanyController.deleteCharterCompany);

export default router;
